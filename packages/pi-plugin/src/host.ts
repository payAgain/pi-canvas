// Narrow facade of the public PI-Desktop PluginHostApi, not a runtime SDK dependency.
export interface ToolContext { sessionId?: string; turnId?: string; signal?: AbortSignal; log(message: string): void; }
export interface ToolDeclaration { name: string; description: string; risk?: 'low' | 'medium' | 'high'; schema?: unknown; }
export interface HostManifest {
  id: string; version: string; permissions: string[];
  contributes?: { agentTools?: ToolDeclaration[] };
}
export interface PiHost {
  app?: { getLocale(): Promise<string> };
  plugin: {
    getManifest(): HostManifest;
    getDataPath(): Promise<string>;
    getSettings(): Promise<Record<string, unknown>>;
  };
  commands: {
    register(command: { id: string; title: string; run(): Promise<void> }): Promise<void>;
    unregister(id: string): Promise<void>;
  };
  ui: { showToast(message: string, level?: 'info' | 'warn' | 'error'): Promise<void> };
  workspace: { get(): Promise<{ path: string; name: string } | null> };
  fs: {
    stat(path: string): Promise<{ size: number; mtimeMs: number }>;
    readRange(path: string, offset: number, length: number): Promise<{ bytes: Uint8Array; totalSize: number }>;
  };
  agent: {
    registerTool(tool: ToolDeclaration & { execute(args: unknown, context?: ToolContext): Promise<unknown> }): Promise<void>;
    unregisterTool(name: string): Promise<void>;
  };
  desktop: {
    listOperations(): Promise<{ id: string; risk: string }[]>;
    invoke(input: { operation: string; args?: unknown[] }): Promise<unknown>;
  };
}
declare global { const pi: PiHost; }
