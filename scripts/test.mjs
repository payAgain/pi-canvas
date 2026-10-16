import { build } from 'esbuild';
import { restrictedTypeScript } from './typescript-compiler.mjs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { builtinModules } from 'node:module';
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratchSetting = process.env.PI_SCRATCH_DIR;
if (!scratchSetting || !path.isAbsolute(scratchSetting)) {
  throw new Error('PI_SCRATCH_DIR must identify an existing absolute session scratch directory.');
}
const scratch = await realpath(scratchSetting);
if (!(await lstat(scratch)).isDirectory()) throw new Error('Session scratch is not a directory.');
const directory = await mkdtemp(path.join(scratch, 'pi-canvas-core-'));
const ownership = randomUUID();
const marker = path.join(directory, '.core-test-owner');
await writeFile(marker, ownership, { flag: 'wx' });
let exitCode = 1;
try {
  const restricted = await restrictedTypeScript(root);
  const assetRoot = path.join(directory, 'detached-plugin');
  await mkdir(path.join(assetRoot, 'vendor'), { recursive: true });
  for (const name of ['types.json', 'canvas-runtime.js', 'canvas-runtime.css', 'typescript-diagnostics.json']) {
    await copyFile(path.join(root, 'plugin/vendor', name), path.join(assetRoot, 'vendor', name));
  }
  const bundle = path.join(directory, 'core.cjs');
  // Import only the stable core modules, never lifecycle, UI, bridge or real pi.
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: [
      "export { compile } from './packages/runtime/src/compiler.ts';",
      "export { CanvasStore } from './packages/runtime/src/store.ts';",
      "export { HostFiles } from './packages/pi-plugin/src/files.ts';",
    ].join('\n'), resolveDir: root, sourcefile: 'core-test-entry.ts', loader: 'ts' },
    bundle: true, platform: 'node', target: 'node22', format: 'cjs', outfile: bundle,
    write: false, metafile: true, sourcemap: false, logLevel: 'silent',
    plugins: [restricted.plugin],
  });
  const builtins = new Set([...builtinModules, ...builtinModules.map(name => `node:${name}`)]);
  for (const output of Object.values(result.metafile.outputs)) {
    for (const imported of output.imports) {
      if (imported.external && !builtins.has(imported.path)) throw new Error(`Test core is not self-contained: ${imported.path}`);
    }
  }
  const output = result.outputFiles.find(file => file.path === bundle);
  if (!output) throw new Error('Core test bundle was not produced.');
  await writeFile(bundle, output.contents, { flag: 'wx' });
  console.log(`Core regression scratch: ${directory}`);
  const child = spawnSync(process.execPath, [
    '--test', '--test-concurrency=1', '--test-reporter=tap', path.join(root, 'tests/core.test.mjs'),
  ], {
    cwd: directory, stdio: 'inherit', timeout: 300000,
    env: { ...process.env, PI_CANVAS_CORE_ROOT: directory,
      PI_CANVAS_CORE_BUNDLE: bundle, PI_CANVAS_CORE_ASSETS: assetRoot },
  });
  if (child.error) console.error(child.error);
  if (child.signal) console.error(`Core regression terminated by ${child.signal}.`);
  exitCode = child.status ?? 1;
} finally {
  // Delete only this invocation's mkdtemp directory after checking its identity.
  const liveDirectory = await realpath(directory);
  if (liveDirectory !== directory || path.dirname(liveDirectory) !== scratch ||
      !path.basename(liveDirectory).startsWith('pi-canvas-core-') ||
      (await lstat(directory)).isSymbolicLink() || await readFile(marker, 'utf8') !== ownership) {
    throw new Error(`Refusing to clean an unrecognized test directory: ${directory}`);
  }
  await rm(directory, { recursive: true, force: false, maxRetries: 3 });
}
process.exitCode = exitCode;
