import path from 'node:path';
import { createHash } from 'node:crypto';
import { CanvasError } from '../../runtime/src/contracts.js';
import type { CanvasStore } from '../../runtime/src/store.js';
import type { PiHost } from './host.js';

/** External inputs always pass through the host's scoped fs gate, including refreshes. */
export class HostFiles {
  errors = new Map<string, string>();
  private grants = new Map<string, { workspace: string; relative: string }>();
  constructor(private store: CanvasStore, private host: PiHost) {}
  async open(filePath: string, title?: string, watch = true, syncId?: string) {
    const workspace = await this.host.workspace.get();
    if (!workspace) throw new CanvasError('NO_WORKSPACE', '请先在 PI-Desktop 打开项目；也可以通过文件选择器导入快照。');
    const absolute = path.resolve(workspace.path, filePath);
    const relative = path.relative(workspace.path, absolute);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new CanvasError('OUTSIDE_WORKSPACE', '文件不在当前 PI 项目内。请切换项目，或通过文件选择器显式导入快照。');
    }
    if (!/\.(tsx|jsx)$/i.test(absolute)) throw new CanvasError('UNSUPPORTED_FILE', '仅支持使用 @codex-canvas/sdk 的单文件 TSX / JSX。');
    const stat = await this.host.fs.stat(absolute);
    if (stat.size > 256000) throw new CanvasError('SOURCE_LIMIT', '画布源码上限为 256 KB。');
    const result = await this.host.fs.readRange(absolute, 0, 256001);
    // The Node host proxy may JSON-serialize typed arrays; normalize without accepting arbitrary objects.
    const raw = result.bytes as unknown;
    const bytes = raw instanceof Uint8Array ? raw : Array.isArray(raw) ? Uint8Array.from(raw) : (() => {
      if (!raw || typeof raw !== 'object') throw new CanvasError('INVALID_FILE_RESULT', '宿主未返回文件字节。');
      const object = raw as Record<string, unknown>;
      const keys = Object.keys(object);
      if (keys.some((key, i) => key !== String(i) || !Number.isInteger(object[key]) || Number(object[key]) < 0 || Number(object[key]) > 255)) {
        throw new CanvasError('INVALID_FILE_RESULT', '宿主返回的文件字节格式不受支持。');
      }
      return Uint8Array.from(keys.map(key => Number(object[key])));
    })();
    if (result.totalSize > 256000 || bytes.byteLength > 256000) throw new CanvasError('SOURCE_LIMIT', '画布源码上限为 256 KB。');
    if (bytes.byteLength !== result.totalSize) throw new CanvasError('FILE_CHANGED', '文件在读取期间发生变化，请重新打开。');
    const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const identity = process.platform === 'win32' ? absolute.toLowerCase() : absolute;
    const existing = (await this.store.list()).find(item => item.sourceFile?.path === identity);
    if ((await this.host.workspace.get())?.path !== workspace.path) throw new CanvasError('WORKSPACE_CHANGED', '读取期间 PI 项目已切换；未发布，请在目标项目重新打开。');
    const published = await this.store.publish(title ?? existing?.title ?? path.basename(absolute), source, syncId, existing?.sourceRevision,
      { path: identity, hash: createHash('sha256').update(source).digest('hex'), watch });
    if ((await this.host.workspace.get())?.path !== workspace.path) {
      this.grants.delete(published.manifest.canvasId);
      this.errors.set(published.manifest.canvasId, '编译期间项目已切换；已保存明确读取的原文件快照，文件跟随未启用。');
      return published;
    }
    this.grants.set(published.manifest.canvasId, { workspace: workspace.path, relative });
    this.errors.delete(published.manifest.canvasId);
    return published;
  }
  async sync() {
    // Restarted plugins do not silently reacquire persisted file access. Explicit open reauthorizes it.
    const workspace = await this.host.workspace.get();
    for (const item of await this.store.list()) {
      const grant = this.grants.get(item.canvasId);
      if (!item.sourceFile?.watch || !grant) continue;
      if (workspace?.path !== grant.workspace) {
        this.errors.set(item.canvasId, '项目已切换，文件跟随暂停；回到原项目后重新打开文件。');
        this.grants.delete(item.canvasId); continue;
      }
      try { await this.open(path.resolve(grant.workspace, grant.relative), undefined, true, item.canvasId); }
      catch (error) { this.errors.set(item.canvasId, error instanceof Error ? error.message : String(error)); }
    }
  }
  forget(id: string) { this.grants.delete(id); this.errors.delete(id); }
}
