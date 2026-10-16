import { randomUUID, randomBytes } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { CanvasStore, atomicJson } from '../../runtime/src/store.js';
import { CanvasError, themePreferences, type Json } from '../../runtime/src/contracts.js';

export const id = z.string().uuid();
const title = z.string().trim().min(1).max(160);
const source = z.string().max(256000);
export const publishSchema = z.object({ title, source }).strict();
export const updateSchema = z.object({ canvasId: id, baseRevision: z.number().int().positive(), title, source }).strict();
export const openFileSchema = z.object({ path: z.string().min(1).max(4096), title: title.optional(), watch: z.boolean().default(true) }).strict();
export const deleteSchema = z.object({ canvasId: id, baseRevision: z.number().int().positive() }).strict();
const selection = z.object({ domPath: z.string().min(1).max(2000), tag: z.string().max(40), text: z.string().max(4000), label: z.string().max(160), partId: z.string().max(160).optional() }).strict();
const feature = z.object({ state: z.enum(['supported', 'unsupported', 'unknown']), evidence: z.string().max(1000) });
const probeSchema = z.object({
  observedAt: z.string().max(64), mode: z.literal('pi-desktop'),
  host: z.object({ name: z.string().max(150), version: z.string().max(80).optional(), platform: z.string().max(80).optional() }),
  theme: z.string().max(30), features: z.record(z.string().max(60), feature).refine(value => Object.keys(value).length <= 40),
  advertisedCapabilities: z.object({ serverTools: z.boolean(), message: z.boolean(), updateModelContext: z.boolean() }),
});
export interface FileInputs {
  errors: Map<string, string>;
  open(file: string, title?: string, watch?: boolean): ReturnType<CanvasStore['publish']>;
  forget(id: string): void;
}
/** Transport-independent domain operations. The host owns delivery and conversation identity. */
export class CanvasService {
  sessions = new Map<string, { canvasId?: string; probeId: string }>();
  constructor(public store: CanvasStore, public root: string, public files: FileInputs) {}
  bind(canvasId?: string) {
    const token = randomBytes(32).toString('hex');
    this.sessions.set(token, { ...(canvasId ? { canvasId } : {}), probeId: randomUUID() });
    return token;
  }
  binding(token: string) {
    const binding = this.sessions.get(token);
    if (!binding) throw new CanvasError('INVALID_SESSION', '面板会话已失效，请重新打开 PI Canvas。', 401);
    return binding;
  }
  assertBound(token: string, canvasId: string) {
    if (this.binding(token).canvasId !== canvasId) throw new CanvasError('BINDING_MISMATCH', '画布已切换，请重新加载后操作。', 409);
  }
  async call(token: string, op: string, raw: unknown) {
    const binding = this.binding(token);
    const args = z.record(z.string(), z.unknown()).parse(raw);
    switch (op) {
      case 'list': return { ...await this.store.library(), fileErrors: Object.fromEntries(this.files.errors) };
      case 'read': {
        const canvasId = id.parse(args.canvasId);
        const document = await this.store.read(canvasId, undefined, true);
        binding.canvasId = canvasId; return document;
      }
      case 'publish': {
        const data = publishSchema.parse(args);
        const result = await this.store.publish(data.title, data.source);
        binding.canvasId = result.manifest.canvasId; return result;
      }
      case 'update': {
        const data = updateSchema.parse(args); this.assertBound(token, data.canvasId);
        return this.store.publish(data.title, data.source, data.canvasId, data.baseRevision);
      }
      case 'readState': {
        const canvasId = id.parse(args.canvasId); this.assertBound(token, canvasId);
        return (await this.store.read(canvasId)).state;
      }
      case 'state': {
        const data = z.object({ canvasId: id, baseStateRevision: z.number().int().nonnegative(), key: z.string().min(1).max(200), value: z.json() }).strict().parse(args);
        this.assertBound(token, data.canvasId);
        return this.store.setState(data.canvasId, data.baseStateRevision, data.key, data.value as Json);
      }
      case 'feedback': {
        const data = z.object({ canvasId: id, sourceRevision: z.number().int().positive(), publishedRevision: z.number().int().positive(), selection, request: z.string().max(4000) }).strict().parse(args);
        this.assertBound(token, data.canvasId);
        return this.store.saveFeedback(data.canvasId, data.sourceRevision, data.publishedRevision, data.selection, data.request);
      }
      case 'delete':
      case 'restore': {
        const data = deleteSchema.parse(args);
        const result = await this.store.setDeleted(data.canvasId, data.baseRevision, op === 'delete');
        if (op === 'delete' && binding.canvasId === data.canvasId) delete binding.canvasId;
        this.files.forget(data.canvasId); return result;
      }
      case 'purge': {
        const data = deleteSchema.extend({ deletedAt: z.string().datetime(), confirmTitle: title }).parse(args);
        const result = await this.store.purge(data.canvasId, data.baseRevision, data.deletedAt, data.confirmTitle);
        for (const session of this.sessions.values()) if (session.canvasId === data.canvasId) delete session.canvasId;
        this.files.forget(data.canvasId); return result;
      }
      case 'openFile': {
        const data = openFileSchema.parse(args);
        const result = await this.files.open(data.path, data.title, data.watch);
        binding.canvasId = result.manifest.canvasId; return result;
      }
      case 'example': {
        const name = z.enum(['report', 'architecture', 'review']).parse(args.name);
        const titles = { report: '分析报告 · 示例', architecture: '系统架构 · 示例', review: '代码审查 · 示例' };
        const content = await readFile(path.join(this.root, 'examples', `${name}.tsx`), 'utf8');
        const result = await this.store.publish(titles[name], content);
        binding.canvasId = result.manifest.canvasId; return result;
      }
      case 'setTheme': return this.store.setTheme(z.enum(themePreferences).parse(args.theme));
      case 'probe': return { probeId: binding.probeId, workspaceId: this.store.workspaceId, observedAt: new Date().toISOString() };
      case 'probeSave': {
        const record = probeSchema.parse(args);
        const directory = path.join(this.store.dataRoot, 'probes'); await mkdir(directory, { recursive: true });
        await atomicJson(path.join(directory, `${binding.probeId}.json`), { ...record, probeId: binding.probeId });
        return { saved: true, probeId: binding.probeId };
      }
      case 'openLibraryFolder': throw new CanvasError('UNSUPPORTED', '当前版本不通过系统命令打开私有库；请复制目录后手动打开。');
      default: throw new CanvasError('UNKNOWN_OPERATION', '未知的画布操作。');
    }
  }
}
