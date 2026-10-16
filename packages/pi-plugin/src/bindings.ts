import { z } from 'zod';
import { CanvasError } from '../../runtime/src/contracts.js';
import type { CanvasService } from '../../canvas-service/src/index.js';

export const reportSchema = z.object({
  canvasId: z.string().uuid().optional(),
  publishedRevision: z.number().int().positive().optional(),
  phase: z.enum(['idle', 'loading', 'ready', 'error']),
  message: z.string().max(800).optional(),
  theme: z.enum(['system', 'light', 'paper', 'mist', 'dark', 'midnight']),
  visible: z.boolean(),
}).strict();
export type RenderReport = z.infer<typeof reportSchema>;
export interface UiClient {
  instanceId: string; surface: 'panel' | 'widget' | 'view' | 'unknown'; token: string; intentRevision: number;
  lastSeen: number; chat: { canvasId: string; sessionId: string } | undefined;
  report: { value: RenderReport; receivedAt: number } | undefined;
}
/** One explicit open intent, independent artifact/authorization for each trusted surface. */
export class UiBindings {
  private revision = 0;
  private intent: { canvasId?: string; sessionId?: string } = {};
  private clients = new Map<string, UiClient>();
  constructor(private service: CanvasService, private now = () => Date.now()) {}
  open(canvasId?: string, sessionId?: string) {
    ++this.revision;
    this.intent = { ...(canvasId ? { canvasId } : {}), ...(canvasId && sessionId ? { sessionId } : {}) };
  }
  get preferredCanvas() { return this.intent.canvasId; }
  connect(instanceId: string, surface: UiClient['surface']) {
    this.prune();
    let client = this.clients.get(instanceId);
    if (client && client.surface !== surface) {
      if (client.surface === 'unknown' && surface !== 'unknown') client.surface = surface;
      else throw new CanvasError('SURFACE_MISMATCH', '界面类型已改变，请重新加载。');
    }
    if (!client || client.intentRevision !== this.revision) {
      if (!client && this.clients.size >= 32) throw new CanvasError('TOO_MANY_PANELS', '打开的画布界面过多，请关闭不用的界面。');
      if (client) this.service.sessions.delete(client.token);
      client = { instanceId, surface, token: this.service.bind(this.intent.canvasId), intentRevision: this.revision,
        lastSeen: this.now(), chat: this.intent.canvasId && this.intent.sessionId ? { canvasId: this.intent.canvasId, sessionId: this.intent.sessionId } : undefined,
        report: undefined };
      this.clients.set(instanceId, client);
    }
    client.lastSeen = this.now(); return client;
  }
  get(token: string) {
    const client = [...this.clients.values()].find(value => value.token === token);
    if (!client || client.intentRevision !== this.revision || !this.service.sessions.has(token)) {
      throw new CanvasError('INVALID_SESSION', '有新的画布打开请求，请刷新后重新确认操作。', 401);
    }
    client.lastSeen = this.now(); return client;
  }
  afterOperation(client: UiClient) {
    const canvasId = this.service.binding(client.token).canvasId;
    if (client.chat?.canvasId !== canvasId) client.chat = undefined;
    if (client.report?.value.canvasId !== canvasId) client.report = undefined;
  }
  async report(client: UiClient, value: RenderReport) {
    const canvasId = this.service.binding(client.token).canvasId;
    if (value.canvasId !== canvasId) throw new CanvasError('BINDING_MISMATCH', '渲染报告与本界面画布不符。');
    if (value.phase !== 'idle' && (!canvasId || !value.publishedRevision)) throw new CanvasError('INVALID_REPORT', '渲染报告缺少发布版本。');
    if (canvasId) {
      const manifest = await this.service.store.manifest(canvasId);
      if (value.publishedRevision && value.publishedRevision !== manifest.publishedRevision) throw new CanvasError('STALE_RENDER', '报告对应旧发布版本，请刷新。');
    }
    client.report = { value, receivedAt: this.now() };
  }
  snapshot(canvasId?: string) {
    this.prune();
    return [...this.clients.values()].filter(client => !canvasId || this.service.binding(client.token).canvasId === canvasId).map(client => {
      const report = client.report;
      const pendingOpen = client.intentRevision !== this.revision;
      const ageMs = report ? Math.max(0, this.now() - report.receivedAt) : null;
      return { surface: client.surface, canvasId: this.service.binding(client.token).canvasId,
        pendingOpen, connected: !pendingOpen && this.now() - client.lastSeen < 20000,
        render: report ? { ...report.value, receivedAt: new Date(report.receivedAt).toISOString(), ageMs,
          fresh: !pendingOpen && ageMs! < 20000, evidence: 'trusted-shell-report' } : { phase: 'unobserved' } };
    });
  }
  clear() { this.clients.clear(); this.service.sessions.clear(); this.intent = {}; ++this.revision; }
  private prune() {
    for (const [id, client] of this.clients) if (this.now() - client.lastSeen > 30 * 60 * 1000) {
      this.service.sessions.delete(client.token); this.clients.delete(id);
    }
  }
}
