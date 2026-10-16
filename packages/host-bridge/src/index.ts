import { getLocale, LocalizedError, sendingError, sendingReason, sessionLabel, setLocale, t } from './locale.js';

export interface Feature { state: 'supported' | 'unsupported' | 'unknown'; evidence: string; }
interface Probe {
  observedAt: string; mode: 'pi-desktop'; host: { name: string; version?: string }; theme: string;
  features: Record<string, Feature>; advertisedCapabilities: { serverTools: boolean; message: boolean; updateModelContext: boolean };
}
interface Binding { session: string; revision: number; canvasId?: string; canSend: boolean; sendReason: string; sessionLabel: string; runtimeVersion: string; }
interface Reply<T> { ok: boolean; data: T; binding?: Binding; error?: { code: string; message: string }; }
interface PluginBridge { invoke(channel: string, payload?: unknown): Promise<unknown>; on(event: string, handler: (payload: unknown) => void): () => void; }
interface RenderReport { canvasId?: string; publishedRevision?: number; phase: 'idle' | 'loading' | 'ready' | 'error'; message?: string; }
declare global { interface Window { pluginBridge?: PluginBridge } }

/** Trusted shell only. Generated iframes have no reference to this object or PI bridge. */
export class HostBridge {
  readonly mode = 'pi-desktop';
  private placement: 'panel' | 'widget' | 'view' | 'unknown' = 'unknown';
  get surface() {
    const shape = document.documentElement.dataset.piPluginPanelShape;
    if (shape === 'panel' || shape === 'widget' || shape === 'view') this.placement = shape;
    return this.placement;
  }
  private readonly instanceId = crypto.randomUUID();
  session = '';
  theme: 'light' | 'dark' = 'light';
  get locale() { return getLocale(); }
  private rawSendReason = '';
  private rawSessionLabel = '';
  get sendReason() {
    return this.uncertainSend ? t(this.sendOutcomeUnknown ? 'sendUnknown' : 'uncertainReload')
      : this.session ? sendingReason(this.rawSendReason) : t('notConnected');
  }
  get sessionLabel() { return sessionLabel(this.rawSessionLabel); }
  private bindingRevision = -1;
  private availableSend = false;
  private uncertainSend = false;
  private sendOutcomeUnknown = false;
  private current: { canvasId: string; sourceRevision: number; publishedRevision: number | null } | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private disposeTheme: (() => void) | undefined;
  private report: RenderReport = { phase: 'idle' };
  private reportMessage: (() => string) | undefined;
  private reporting = false;
  onBinding: ((id?: string) => Promise<void>) | undefined;
  onTheme: (() => void) | undefined;
  onLocale: (() => void) | undefined;
  onCapabilities: (() => void) | undefined;
  onError: ((message: string) => void) | undefined;
  private readonly evidence = new Map<string, () => Feature>();
  probe: Probe = {
    observedAt: new Date().toISOString(), mode: 'pi-desktop', host: { name: 'PI-Desktop' }, theme: 'light',
    advertisedCapabilities: { serverTools: false, message: false, updateModelContext: false }, features: {},
  };
  constructor() {
    this.feature('toolUi', 'unknown', () => t('waitPanel'));
    this.feature('instanceBinding', 'unknown', () => t('waitBinding'));
    this.feature('theme', 'unknown', () => t('appearanceUnread'));
    this.feature('modelContext', 'unsupported', () => t('noDraftApi'));
    this.feature('message', 'unknown', () => t('waitSendPermission'));
    this.feature('serverTools', 'unknown', () => t('waitRpc'));
    this.feature('render', 'unknown', () => t('waitRenderReady'));
  }
  private feature(name: string, state: Feature['state'], text: () => string) {
    const value = () => ({ state, evidence: text() });
    this.evidence.set(name, value); this.probe.features[name] = value();
  }
  private refreshEvidence() {
    if (this.reportMessage) this.report.message = this.reportMessage();
    for (const [name, value] of this.evidence) this.probe.features[name] = value();
  }
  recordToolProbe() { this.feature('serverTools', 'supported', () => t('probeClicked')); }
  get canAttach() { return false; }
  get canSend() { return this.availableSend && !this.uncertainSend; }
  private get transport() {
    if (!window.pluginBridge) throw new LocalizedError('bridgeUnavailable');
    return window.pluginBridge;
  }
  private async request<T>(channel: string, payload: unknown): Promise<T> {
    const reply = await this.transport.invoke(channel, payload) as Reply<T>;
    if (!reply || !reply.ok) {
      // Preserve backend diagnostics; localize only known sending reasons and the bridge's own fallback.
      const error = reply?.error?.code === 'SEND_RESULT_UNKNOWN' ? new LocalizedError('sendUnknown')
        : reply?.error?.code === 'SEND_UNAVAILABLE' ? sendingError(reply.error.message)
        : reply?.error?.message ? new Error(reply.error.message) : new LocalizedError('invalidReply');
      throw Object.assign(error, { code: reply?.error?.code ?? 'INVALID_REPLY' });
    }
    if (reply.binding) this.applyBinding(reply.binding);
    return reply.data;
  }
  private applyBinding(binding: Binding) {
    if (binding.session !== this.session) {
      this.report = { ...(binding.canvasId ? { canvasId: binding.canvasId } : {}), phase: 'idle' };
      this.reportMessage = undefined;
      this.feature('render', 'unknown', () => t('bindingRenderWait'));
    }
    this.session = binding.session; this.bindingRevision = binding.revision;
    this.availableSend = binding.canSend; this.rawSendReason = binding.sendReason;
    this.rawSessionLabel = binding.sessionLabel;
    if (this.uncertainSend) this.sendOutcomeUnknown = false;
    this.feature('runtime', 'supported', () => t('runtimeEvidence', { version: binding.runtimeVersion }));
    this.feature('instanceBinding', 'supported', () => t('bindingEvidence', { surface: this.surface, session: this.sessionLabel }));
    this.feature('message', this.canSend ? 'unknown' : 'unsupported', () => this.canSend ? t('sendUnobserved') : this.sendReason);
    this.probe.advertisedCapabilities.message = this.canSend; this.onCapabilities?.();
  }
  private appearance(payload: unknown) {
    const appearance = payload as { base?: string; locale?: string } | undefined;
    // Locale is independent of base. Missing/unsupported locales consistently fall back to zh-CN.
    const localeChanged = setLocale(appearance?.locale);
    if (appearance?.base === 'light' || appearance?.base === 'dark') {
      const changed = this.theme !== appearance.base; this.theme = appearance.base; this.probe.theme = this.theme;
      this.feature('theme', 'supported', () => t('appearanceSupported'));
      if (changed) this.onTheme?.();
    }
    if (localeChanged) { this.refreshEvidence(); this.onLocale?.(); this.onCapabilities?.(); }
  }
  private connectPayload() { return { instanceId: this.instanceId, surface: this.surface }; }
  async connect() {
    // Preload may publish placement at DOMContentLoaded, after the inline shell.
    // Never mislabel a missing attribute as a detached panel.
    if (document.readyState === 'loading') await new Promise<void>(resolve => {
      document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    });
    const binding = await this.request<Binding>('canvas.connect', this.connectPayload()); this.applyBinding(binding);
    this.feature('toolUi', 'supported', () => t('bridgeConnected'));
    this.probe.advertisedCapabilities.serverTools = true;
    // Subscribe independently so locale changes still work if the initial appearance read fails.
    let disposeAppearance: (() => void) | undefined, disposeScheme: (() => void) | undefined;
    let appearanceEventReceived = false;
    try { disposeAppearance = this.transport.on('appearance:changed', value => { appearanceEventReceived = true; this.appearance(value); }); } catch { /* Optional public event. */ }
    try {
      const initialAppearance = await this.transport.invoke('app.getAppearance');
      // A newer event wins over the response captured by the initial read.
      if (!appearanceEventReceived) this.appearance(initialAppearance);
    } catch {
      if (!appearanceEventReceived) {
        const scheme = window.matchMedia('(prefers-color-scheme: dark)');
        const update = () => { this.theme = scheme.matches ? 'dark' : 'light'; this.probe.theme = this.theme; this.onTheme?.(); };
        update(); scheme.addEventListener('change', update); disposeScheme = () => scheme.removeEventListener('change', update);
        this.feature('theme', 'unsupported', () => t('appearanceFallback'));
      }
    }
    this.disposeTheme = () => { disposeAppearance?.(); disposeScheme?.(); };
    window.addEventListener('pagehide', () => this.disposeTheme?.(), { once: true }); return binding.canvasId;
  }
  private ordered<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation); this.queue = result.catch(() => {}); return result;
  }
  async pollBinding(): Promise<boolean> {
    const result = await this.ordered(async () => {
      const previous = this.session;
      const binding = await this.request<Binding>('canvas.connect', this.connectPayload()); this.applyBinding(binding);
      return { changed: previous !== binding.session, binding };
    });
    // Outside the queue: the binding handler itself reads through this bridge.
    if (result.changed) { this.current = undefined; await this.onBinding?.(result.binding.canvasId); }
    return result.changed;
  }
  call<T = any>(op: string, args: Record<string, unknown> = {}): Promise<T> {
    const session = this.session, revision = this.bindingRevision;
    return this.ordered(async () => {
      if (session !== this.session || revision !== this.bindingRevision) throw Object.assign(new LocalizedError('bindingMismatch'), { code: 'BINDING_MISMATCH' });
      const data = await this.request<T>('canvas.operation', { session, op, args });
      if (op === 'read') this.current = (data as { manifest: NonNullable<HostBridge['current']> }).manifest;
      if ((op === 'delete' || op === 'purge') && args.canvasId === this.current?.canvasId) this.current = undefined;
      this.feature('serverTools', 'supported', () => t('rpcSuccess')); return data;
    });
  }
  async addContext(_text: string): Promise<void> { throw new LocalizedError('noDraftMutation'); }
  async copy(text: string) { await this.transport.invoke('clipboard.writeText', { text }); }
  async send(text: string) {
    if (!this.canSend || !this.current?.publishedRevision) {
      if (this.uncertainSend) throw new LocalizedError(this.sendOutcomeUnknown ? 'sendUnknown' : 'uncertainReload');
      if (!this.session) throw new LocalizedError('notConnected');
      throw sendingError(this.rawSendReason);
    }
    const manifest = { ...this.current }, session = this.session, revision = this.bindingRevision;
    await this.ordered(async () => {
      if (session !== this.session || revision !== this.bindingRevision) throw new LocalizedError('sendTargetChanged');
      try { await this.request('canvas.send', { session, requestId: crypto.randomUUID(), canvasId: manifest.canvasId,
        sourceRevision: manifest.sourceRevision, publishedRevision: manifest.publishedRevision, text }); }
      catch (error) {
        const code = (error as { code?: string }).code;
        if (!code || code === 'SEND_RESULT_UNKNOWN') {
          this.uncertainSend = true; this.sendOutcomeUnknown = true;
          this.feature('message', 'unsupported', () => this.sendReason);
          this.probe.advertisedCapabilities.message = false; this.onCapabilities?.();
        }
        throw error;
      }
    });
    this.feature('message', 'supported', () => t('sendObserved'));
  }
  renderStatus(report: RenderReport, message?: () => string) {
    this.report = report; this.reportMessage = message;
    this.feature('render', report.phase === 'ready' ? 'supported' : report.phase === 'error' ? 'unsupported' : 'unknown',
      () => report.phase === 'ready' ? t('renderEvidence', { revision: report.publishedRevision ?? 0 }) : message?.() ?? report.message ?? t('waitCurrentView'));
  }
  async heartbeat(theme: 'system' | 'light' | 'paper' | 'mist' | 'dark' | 'midnight') {
    if (!this.session || this.reporting) return;
    this.reporting = true;
    const session = this.session, report = { ...this.report, theme, visible: !document.hidden };
    try { await this.ordered(() => this.request('canvas.report', { session, report })); }
    catch { /* Old bindings / transient shutdown must not fabricate ready evidence or replay writes. */ }
    finally { this.reporting = false; }
  }
}
