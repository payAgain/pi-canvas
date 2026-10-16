import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CanvasStore } from '../../runtime/src/store.js';
import { CanvasError } from '../../runtime/src/contracts.js';
import { CanvasService, id, publishSchema, updateSchema, openFileSchema, deleteSchema } from '../../canvas-service/src/index.js';
import { HostFiles } from './files.js';
import { UiBindings, reportSchema, type UiClient } from './bindings.js';
import type { ToolContext } from './host.js';
import { hostText } from './locale.js';

let service: CanvasService | undefined;
let files: HostFiles | undefined;
let bindings: UiBindings | undefined;
let unloading = false;
let timer: ReturnType<typeof setInterval> | undefined;
let queuedRefresh = false;
let tail: Promise<unknown> = Promise.resolve();
const registeredTools: string[] = [];
const sent = new Map<string, { fingerprint: string; state: 'unknown' | 'accepted' }>();
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const result = tail.then(() => { if (unloading) throw new CanvasError('UNLOADING', '插件正在卸载，请重新打开。'); return operation(); });
  tail = result.catch(() => {}); return result;
}
function ready() { if (!service || !bindings) throw new CanvasError('NOT_READY', 'PI Canvas 尚未完成初始化。'); return service; }
async function sending() {
  if (!pi.plugin.getManifest().permissions.includes('desktop.control')) return { enabled: false, reason: '未申请 desktop.control；请复制上下文后粘贴到聊天。' };
  const settings = await pi.plugin.getSettings();
  if (settings.enableSending !== true) return { enabled: false, reason: '发送功能未启用；请在插件设置中明确开启。' };
  try {
    const operations = await pi.desktop.listOperations();
    return operations.some(operation => operation.id === 'agent/prompt') ? { enabled: true, reason: '' } : { enabled: false, reason: '当前宿主未声明 agent/prompt。' };
  } catch { return { enabled: false, reason: '当前宿主未提供或未授权桌面控制接口。' }; }
}
async function bindingInfo(client: UiClient) {
  const availability = await sending();
  const canvasId = ready().binding(client.token).canvasId;
  const chat = client.chat?.canvasId === canvasId ? client.chat : undefined;
  return { session: client.token, revision: client.intentRevision, canvasId,
    canSend: availability.enabled && Boolean(chat),
    sendReason: !chat ? '当前画布未绑定聊天；请从目标聊天调用 canvas_open 重新打开。' : availability.reason,
    sessionLabel: chat ? `已绑定会话 …${chat.sessionId.slice(-8)}` : '未绑定聊天',
    runtimeVersion: pi.plugin.getManifest().version, mode: 'pi-desktop' };
}
async function present(canvasId: string | undefined, context?: ToolContext) {
  bindings!.open(canvasId, context?.sessionId);
  // The public host SDK cannot reveal a contributed view. Update the selection
  // for an existing/manual view, but never create a detached panel as fallback.
  return { mode: 'pi-view', opened: false, selectionUpdated: true,
    reason: 'HOST_VIEW_REVEAL_UNAVAILABLE', render: 'unobserved', statusTool: 'canvas_status',
    message: await hostText('viewSelection') };
}
async function execute(name: string, raw: unknown, context?: ToolContext) {
  if (context?.signal?.aborted) throw new CanvasError('ABORTED', '工具调用已取消。');
  const current = ready();
  switch (name) {
    case 'canvas_publish': {
      const args = publishSchema.parse(raw);
      const result = await current.store.publish(args.title, args.source);
      return { ...result, presentation: await present(result.manifest.canvasId, context) };
    }
    case 'canvas_update': {
      const args = updateSchema.parse(raw);
      const result = await current.store.publish(args.title, args.source, args.canvasId, args.baseRevision);
      return { ...result, presentation: await present(result.manifest.canvasId, context) };
    }
    case 'canvas_open_file': {
      const args = openFileSchema.parse(raw);
      const result = await files!.open(args.path, args.title, args.watch);
      return { ...result, presentation: await present(result.manifest.canvasId, context) };
    }
    case 'canvas_open': {
      const args = z.object({ canvasId: id }).strict().parse(raw);
      const manifest = await current.store.manifest(args.canvasId);
      return { manifest, presentation: await present(manifest.canvasId, context) };
    }
    case 'canvas_read': {
      const args = z.object({ canvasId: id, revision: z.number().int().positive().optional() }).strict().parse(raw);
      return { ...await current.store.read(args.canvasId, args.revision) };
    }
    case 'canvas_status': {
      const args = z.object({ canvasId: id.optional() }).strict().parse(raw);
      const manifest = args.canvasId ? await current.store.manifest(args.canvasId) : undefined;
      return { observedAt: new Date().toISOString(), ...(manifest ? { canvasId: manifest.canvasId, sourceRevision: manifest.sourceRevision,
        publishedRevision: manifest.publishedRevision, diagnostics: manifest.diagnostics } : {}),
        surfaces: bindings!.snapshot(args.canvasId).map(surface => {
          if (!manifest || !('publishedRevision' in surface.render)) return surface;
          const matchesPublished = surface.render.publishedRevision === manifest.publishedRevision;
          return { ...surface, render: { ...surface.render, matchesPublished, fresh: surface.render.fresh && matchesPublished } };
        }),
        note: await hostText('renderEvidence') };
    }
    case 'canvas_list': {
      const args = z.object({ deleted: z.boolean().optional() }).strict().parse(raw);
      const library = await current.store.library();
      return { ...library, canvases: args.deleted ? library.deleted : library.canvases };
    }
    case 'canvas_delete':
    case 'canvas_restore': {
      const args = deleteSchema.parse(raw);
      const result = await current.store.setDeleted(args.canvasId, args.baseRevision, name === 'canvas_delete'); files!.forget(args.canvasId);
      if (name === 'canvas_delete') for (const binding of current.sessions.values()) if (binding.canvasId === args.canvasId) delete binding.canvasId;
      return result;
    }
    case 'canvas_probe': {
      z.object({}).strict().parse(raw);
      return { status: 'probe-ready', presentation: await present(undefined, context) };
    }
    default: throw new CanvasError('UNKNOWN_TOOL', '未知的 Canvas 工具。');
  }
}
function failure(error: unknown) {
  const value = error as { code?: string; message?: string };
  return { code: typeof value?.code === 'string' ? value.code : error instanceof z.ZodError ? 'INVALID_INPUT' : 'ERROR',
    message: error instanceof z.ZodError ? error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') : String(value?.message ?? error).slice(0, 3000) };
}
export async function onLoad() {
  unloading = false;
  const root = path.resolve(__dirname, '..');
  const data = await pi.plugin.getDataPath();
  const store = new CanvasStore(data, root); await store.init();
  files = new HostFiles(store, pi); service = new CanvasService(store, root, files); bindings = new UiBindings(service);
  await pi.commands.register({ id: 'pi-canvas.open', title: await hostText('openCommand'), run: () => serial(async () => {
    const current = ready(); let canvasId = bindings!.preferredCanvas;
    if (canvasId) { try { await current.store.manifest(canvasId); } catch (error) { if (!['DELETED', 'NOT_FOUND'].includes((error as { code: string }).code)) throw error; canvasId = undefined; } }
    const presentation = await present(canvasId); await pi.ui.showToast(presentation.message, 'info');
  }) });
  for (const declaration of pi.plugin.getManifest().contributes?.agentTools ?? []) {
    await pi.agent.registerTool({ ...declaration, execute: (args, context) => serial(async () => {
      const runtimeVersion = pi.plugin.getManifest().version;
      try { return { runtimeVersion, ...await execute(declaration.name, args, context) }; }
      catch (error) { return { ok: false, isError: true, runtimeVersion, ...failure(error) }; }
    }) });
    registeredTools.push(declaration.name);
  }
  timer = setInterval(() => {
    if (queuedRefresh || unloading) return; queuedRefresh = true;
    void serial(() => files!.sync()).catch(() => {}).finally(() => { queuedRefresh = false; });
  }, 2500); timer.unref();
}
export async function onPanelInvoke(channel: string, payload: unknown) {
  try {
    return await serial(async () => {
      const current = ready();
      if (channel === 'canvas.connect') {
        const args = z.object({ instanceId: z.string().uuid(), surface: z.enum(['panel', 'widget', 'view', 'unknown']) }).strict().parse(payload);
        const client = bindings!.connect(args.instanceId, args.surface);
        return { ok: true, data: await bindingInfo(client) };
      }
      if (!['canvas.operation', 'canvas.send', 'canvas.report'].includes(channel)) throw new CanvasError('UNKNOWN_CHANNEL', '不允许的面板通信通道。');
      const token = z.object({ session: z.string().length(64) }).passthrough().parse(payload).session;
      const client = bindings!.get(token);
      if (channel === 'canvas.report') {
        const args = z.object({ session: z.string(), report: reportSchema }).strict().parse(payload);
        await bindings!.report(client, args.report);
        return { ok: true, data: { recorded: true } };
      }
      if (channel === 'canvas.send') {
        const args = z.object({ session: z.string(), requestId: z.string().uuid(), canvasId: id,
          sourceRevision: z.number().int().positive(), publishedRevision: z.number().int().positive(), text: z.string().trim().min(1).max(24000) }).strict().parse(payload);
        current.assertBound(token, args.canvasId);
        const availability = await bindingInfo(client);
        if (!availability.canSend || !client.chat) throw new CanvasError('SEND_UNAVAILABLE', availability.sendReason);
        const fingerprint = createHash('sha256').update(JSON.stringify([client.chat.sessionId, args])).digest('hex');
        const previous = sent.get(args.requestId);
        if (previous?.fingerprint !== undefined && previous.fingerprint !== fingerprint) throw new CanvasError('REQUEST_ID_CONFLICT', '发送请求标识已用于其他内容。');
        if (previous?.state === 'accepted') return { ok: true, data: { accepted: true }, binding: await bindingInfo(client) };
        if (previous) throw new CanvasError('SEND_RESULT_UNKNOWN', '这次发送结果未知；请先检查原聊天，避免重复发送。');
        const manifest = await current.store.manifest(args.canvasId);
        if (manifest.sourceRevision !== args.sourceRevision || manifest.publishedRevision !== args.publishedRevision) throw new CanvasError('STALE_SELECTION', '画布版本已变化，请重新选择并确认。');
        sent.set(args.requestId, { fingerprint, state: 'unknown' });
        if (sent.size > 200) sent.delete(sent.keys().next().value!);
        try { await pi.desktop.invoke({ operation: 'agent/prompt', args: [{ sessionId: client.chat.sessionId, content: args.text }] }); }
        catch { throw new CanvasError('SEND_RESULT_UNKNOWN', '宿主发送结果未知，请先检查绑定聊天；不会自动重试。'); }
        sent.set(args.requestId, { fingerprint, state: 'accepted' });
        return { ok: true, data: { accepted: true }, binding: await bindingInfo(client) };
      }
      const args = z.object({ session: z.string(), op: z.string().max(50), args: z.record(z.string(), z.unknown()) }).strict().parse(payload);
      const data = await current.call(token, args.op, args.args);
      bindings!.afterOperation(client);
      return { ok: true, data, binding: await bindingInfo(client) };
    });
  } catch (error) { return { ok: false, error: failure(error) }; }
}
export async function onUnload() {
  unloading = true; clearInterval(timer); timer = undefined;
  await Promise.allSettled(registeredTools.splice(0).map(name => pi.agent.unregisterTool(name)));
  await pi.commands.unregister('pi-canvas.open').catch(() => {});
  bindings?.clear(); service = undefined; files = undefined; bindings = undefined; sent.clear();
}
