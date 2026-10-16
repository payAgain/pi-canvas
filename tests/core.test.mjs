import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readdir, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';

const runRoot = process.env.PI_CANVAS_CORE_ROOT;
const bundlePath = process.env.PI_CANVAS_CORE_BUNDLE;
const assetRoot = process.env.PI_CANVAS_CORE_ASSETS;
assert.ok(runRoot && bundlePath && assetRoot && process.env.PI_SCRATCH_DIR,
  'Run this suite with node scripts/test.mjs; no user library is an acceptable fixture.');
const scratch = await realpath(process.env.PI_SCRATCH_DIR);
assert.equal(path.dirname(await realpath(runRoot)), scratch);
assert.ok(path.basename(runRoot).startsWith('pi-canvas-core-'));
for (const filename of [bundlePath, assetRoot, process.cwd()]) {
  const relative = path.relative(runRoot, filename);
  assert.ok(!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`),
    `Test resource must remain in its owned scratch directory: ${filename}`);
}
const { compile, CanvasStore, HostFiles } = createRequire(import.meta.url)(bundlePath);
const options = { concurrency: false, timeout: 120000 };
const sha256 = text => createHash('sha256').update(text).digest('hex');
const canvas = (label = 'Core regression') => `import { Page, Text, useCanvasState } from '@codex-canvas/sdk';
if (typeof window === 'undefined') throw new Error('Generated code must never execute in Node');
export default function Canvas() {
  const [count, setCount] = useCanvasState<number>('count', 0);
  return <Page title=${JSON.stringify(label)}><Text>{count}</Text><button onClick={() => setCount(value => value + 1)}>Increment</button></Page>;
}`;
const invalidCanvas = `import { Page } from '@codex-canvas/sdk';
export default function Canvas() { return <Page title={42}>Invalid title</Page>; }`;
function success(result) {
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.manifest.buildHash, /^[a-f0-9]{64}$/);
  return result.manifest;
}
async function fixture(label) {
  const directory = await mkdtemp(path.join(runRoot, `${label}-`));
  const store = new CanvasStore(path.join(directory, 'library'), assetRoot);
  await store.init();
  return { directory, store };
}
async function codeRejects(action, code) {
  await assert.rejects(action, error => {
    assert.equal(error.code, code);
    return true;
  });
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
// All external bytes are in memory. There is deliberately no host file on disk:
// an accidental Node read cannot masquerade as a successful authorized read.
function mockHost(workspace) {
  const state = { workspace, contents: new Map(), stats: [], reads: [], readHook: undefined, denied: false };
  function gated(filename) {
    assert.ok(path.isAbsolute(filename), 'Host filesystem calls must receive absolute paths.');
    const relative = path.relative(state.workspace, filename);
    assert.ok(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
      'Host gate must not receive a path outside its active workspace.');
    if (state.denied) throw Object.assign(new Error('Mock host denied access'), { code: 'EACCES' });
    assert.ok(state.contents.has(filename), `No mock host bytes for ${filename}`);
    return Buffer.from(state.contents.get(filename), 'utf8');
  }
  const host = {
    workspace: { async get() { return state.workspace ? { path: state.workspace, name: 'Mock workspace' } : null; } },
    fs: {
      async stat(filename) {
        state.stats.push(filename);
        return { size: gated(filename).byteLength, mtimeMs: 1 };
      },
      async readRange(filename, offset, length) {
        state.reads.push({ filename, offset, length });
        const bytes = gated(filename);
        assert.equal(offset, 0);
        assert.equal(length, 256001);
        if (state.readHook) await state.readHook();
        return { bytes: new Uint8Array(bytes.subarray(offset, offset + length)), totalSize: bytes.byteLength };
      },
    },
  };
  return { host, state };
}
async function fileFixture(label) {
  const data = await fixture(label);
  const workspace = path.join(data.directory, 'workspace');
  await mkdir(workspace);
  const filename = path.join(workspace, 'input.tsx');
  const mock = mockHost(workspace);
  mock.state.contents.set(filename, canvas(label));
  return { ...data, workspace, filename, ...mock, files: new HostFiles(data.store, mock.host) };
}

test('SDK TSX compiles from detached assets without executing generated code or finding checkout dependencies', options, async () => {
  await assert.rejects(access(path.join(assetRoot, 'node_modules')), { code: 'ENOENT' });
  await assert.rejects(access(path.join(assetRoot, 'packages')), { code: 'ENOENT' });
  const result = await compile(canvas(), assetRoot);
  assert.deepEqual(result.diagnostics, []);
  assert.ok(result.bundle.length > 1000);
  assert.ok(result.css.length > 1000);
  assert.equal(result.buildHash, createHash('sha256').update(result.bundle).update(result.css).digest('hex'));
  assert.match(result.bundle, /runtime\.mount\(module\.exports\.default\)/);
  assert.match(result.bundle, /Object\.prototype\.hasOwnProperty\.call\(modules,id\)/);
  assert.match(result.bundle, /react\/jsx-runtime/);
  const repeated = await compile(canvas(), assetRoot);
  assert.equal(repeated.buildHash, result.buildHash, 'Same input and shipped assets must produce the same build.');
});

test('policy rejects non-SDK imports, dynamic import, require, and Function call/constructor', options, async () => {
  const cases = [
    "import React from 'react'; export default function Canvas() { return null; }",
    "import value from './local.ts'; export default function Canvas() { return null; }",
    "import('@codex-canvas/sdk'); export default function Canvas() { return null; }",
    "require('@codex-canvas/sdk'); export default function Canvas() { return null; }",
    "Function('return 1')(); export default function Canvas() { return null; }",
    "new Function('return 1'); export default function Canvas() { return null; }",
  ];
  for (const source of cases) {
    const result = await compile(source, assetRoot);
    assert.ok(result.diagnostics.length, source);
    assert.ok(result.diagnostics.every(item => item.phase === 'policy'), source);
    assert.ok(result.diagnostics.every(item => item.file === 'canvas.tsx' && item.line >= 1 && item.column >= 1));
    assert.equal(result.bundle, undefined);
    assert.equal(result.buildHash, undefined);
  }
});

test('real SDK prop types reject a number where Page.title requires a string', options, async () => {
  const result = await compile(invalidCanvas, assetRoot);
  const diagnostic = result.diagnostics.find(item => item.phase === 'typecheck');
  assert.ok(diagnostic, JSON.stringify(result.diagnostics));
  assert.match(diagnostic.message, /number.*string/);
  assert.equal(diagnostic.file, 'canvas.tsx');
  assert.equal(diagnostic.line, 2);
  assert.ok(diagnostic.column > 0);
  assert.equal(result.bundle, undefined);
});

test('a named component without a default export is not publishable', options, async () => {
  const result = await compile('export function Canvas() { return <div>Named only</div>; }', assetRoot);
  assert.ok(result.diagnostics.some(item => item.phase === 'bundle' && /默认|default/.test(item.message)));
  assert.equal(result.bundle, undefined);
  assert.equal(result.buildHash, undefined);
});

test('store retains the published render and history after failed source, then publishes a repair', options, async () => {
  const { store } = await fixture('publish');
  const original = canvas('Original');
  const first = success(await store.publish('Original', original));
  assert.equal(first.sourceRevision, 1);
  assert.equal(first.publishedRevision, 1);
  const firstDocument = await store.read(first.canvasId, undefined, true);
  const failed = await store.publish('Broken attempt', invalidCanvas, first.canvasId, 1);
  assert.equal(failed.ok, false);
  assert.equal(failed.manifest.sourceRevision, 2);
  assert.equal(failed.manifest.publishedRevision, 1);
  assert.equal(failed.manifest.buildHash, first.buildHash);
  assert.ok(failed.diagnostics.some(item => item.phase === 'typecheck'));
  const failedDocument = await store.read(first.canvasId, undefined, true);
  assert.equal(failedDocument.source, invalidCanvas);
  assert.equal(failedDocument.bundle, firstDocument.bundle);
  assert.equal(failedDocument.css, firstDocument.css);
  assert.equal((await store.read(first.canvasId, 1)).source, original);
  const fixedSource = canvas('Fixed');
  const fixed = success(await store.publish('Fixed', fixedSource, first.canvasId, 2));
  assert.equal(fixed.sourceRevision, 3);
  assert.equal(fixed.publishedRevision, 3);
  assert.notEqual(fixed.buildHash, first.buildHash);
  assert.equal((await store.read(first.canvasId)).source, fixedSource);
  assert.equal((await store.read(first.canvasId, 2)).source, invalidCanvas);
  assert.equal((await readdir(path.join(store.dir(first.canvasId), 'builds'))).length, 2);
});

test('stale baseRevision cannot replace a newer source or leave a new revision', options, async () => {
  const { store } = await fixture('revision');
  const first = success(await store.publish('First', canvas('First')));
  const secondSource = canvas('Second');
  const second = success(await store.publish('Second', secondSource, first.canvasId, 1));
  await assert.rejects(() => store.publish('Stale writer', canvas('Stale'), first.canvasId, 1),
    error => error.code === 'REVISION_CONFLICT' && error.status === 409);
  assert.deepEqual(await store.manifest(first.canvasId), second);
  assert.equal((await store.read(first.canvasId)).source, secondSource);
  assert.deepEqual((await readdir(path.join(store.dir(first.canvasId), 'source'))).sort(), ['1.tsx', '2.tsx']);
});

test('state survives reopening and source publication; concurrent stale state writes conflict', options, async () => {
  const { store } = await fixture('state');
  const first = success(await store.publish('State', canvas('State')));
  const id = first.canvasId;
  const initial = await store.setState(id, 0, 'filter', { query: 'saved', selected: [1, 2] });
  assert.equal(initial.stateRevision, 1);
  const reopened = new CanvasStore(store.dataRoot, assetRoot);
  await reopened.init();
  assert.equal(reopened.workspaceId, store.workspaceId);
  assert.deepEqual((await reopened.read(id)).state, initial);
  const attempts = await Promise.allSettled([
    store.setState(id, 1, 'left', true), reopened.setState(id, 1, 'right', true),
  ]);
  assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 1);
  const failure = attempts.find(item => item.status === 'rejected');
  assert.equal(failure.reason.code, 'STATE_CONFLICT');
  assert.equal(failure.reason.status, 409);
  const state = (await reopened.read(id)).state;
  assert.equal(state.stateRevision, 2);
  assert.deepEqual(state.values.filter, initial.values.filter);
  assert.equal(Object.hasOwn(state.values, 'left') !== Object.hasOwn(state.values, 'right'), true);
  success(await reopened.publish('State updated', canvas('State updated'), id, 1));
  assert.deepEqual((await store.read(id)).state, state);
});

test('state rejects prototype keys, byte-oversized values and aggregate overflow without committing', options, async () => {
  const { store } = await fixture('state-limits');
  const { canvasId: id } = success(await store.publish('Limits', canvas('Limits')));
  const initial = (await store.read(id)).state;
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    await codeRejects(() => store.setState(id, 0, key, { polluted: true }), 'INVALID_KEY');
  }
  await codeRejects(() => store.setState(id, 0, 'oversized', '界'.repeat(11000)), 'STATE_LIMIT');
  assert.deepEqual((await store.read(id)).state, initial);
  for (let index = 0; index < 4; index++) await store.setState(id, index, `block${index}`, 'x'.repeat(31000));
  const beforeOverflow = (await store.read(id)).state;
  await codeRejects(() => store.setState(id, 4, 'overflow', 'x'.repeat(5000)), 'STATE_LIMIT');
  assert.deepEqual((await store.read(id)).state, beforeOverflow);
  assert.equal(beforeOverflow.stateRevision, 4);
  assert.equal(Object.hasOwn(beforeOverflow.values, 'overflow'), false);
  assert.equal(Object.hasOwn(Object.prototype, 'polluted'), false);
});

test('HostFiles reads through the absolute host gate and never reads out-of-workspace inputs', options, async () => {
  const { store, files, workspace, filename, state } = await fileFixture('host-gate');
  await assert.rejects(access(filename), { code: 'ENOENT' });
  const first = success(await files.open(filename));
  assert.equal((await store.read(first.canvasId)).source, state.contents.get(filename));
  assert.deepEqual(state.stats, [filename]);
  assert.deepEqual(state.reads, [{ filename, offset: 0, length: 256001 }]);
  const stats = state.stats.length, reads = state.reads.length;
  for (const outside of [path.dirname(workspace), path.join(`${workspace}-other`, 'escape.tsx'), path.join(workspace, '..', 'escape.tsx')]) {
    await codeRejects(() => files.open(outside), 'OUTSIDE_WORKSPACE');
  }
  await codeRejects(() => files.open(path.join(workspace, 'notes.txt')), 'UNSUPPORTED_FILE');
  state.workspace = null;
  await codeRejects(() => files.open(filename), 'NO_WORKSPACE');
  assert.equal(state.stats.length, stats);
  assert.equal(state.reads.length, reads);
  state.workspace = workspace;
  state.denied = true;
  await codeRejects(() => files.open(filename), 'EACCES');
  assert.equal(state.reads.length, reads, 'A denied host stat must not be followed by a read.');
  assert.equal((await store.list()).length, 1);
  assert.deepEqual(await store.manifest(first.canvasId), first);
});

test('workspace switching during a pending host read cannot publish either workspace file', options, async () => {
  const { store, files, directory, filename, state } = await fileFixture('workspace-race');
  const entered = deferred(), release = deferred();
  state.readHook = async () => { entered.resolve(); await release.promise; };
  const pending = files.open(filename);
  const rejected = codeRejects(() => pending, 'WORKSPACE_CHANGED');
  try {
    await entered.promise;
    state.workspace = path.join(directory, 'other-workspace');
  } finally { release.resolve(); }
  await rejected;
  assert.deepEqual(state.stats, [filename]);
  assert.equal(state.reads[0].filename, filename);
  assert.deepEqual(await store.list(), []);
  assert.deepEqual(await readdir(path.join(store.dataRoot, 'canvases')), []);
});

test('unchanged file hashes deduplicate; changed files sync, but independent canvas edits cause FILE_CONFLICT', options, async () => {
  const { store, files, filename, state } = await fileFixture('file-conflict');
  const first = success(await files.open(filename));
  const duplicate = success(await files.open(filename));
  assert.deepEqual(duplicate, first);
  assert.equal(first.sourceFile.importedRevision, 1);
  assert.equal(first.sourceFile.hash, sha256(state.contents.get(filename)));
  assert.equal((await store.list()).length, 1);
  assert.deepEqual(await readdir(path.join(store.dir(first.canvasId), 'source')), ['1.tsx']);
  const updatedFile = canvas('External revision two');
  state.contents.set(filename, updatedFile);
  await files.sync();
  const imported = await store.manifest(first.canvasId);
  assert.equal(imported.sourceRevision, 2);
  assert.equal(imported.sourceFile.importedRevision, 2);
  assert.equal(imported.sourceFile.hash, sha256(updatedFile));
  assert.equal((await store.read(first.canvasId)).source, updatedFile);
  assert.equal(files.errors.size, 0);
  const independentSource = canvas('Independent canvas edit');
  const edited = success(await store.publish('Independent', independentSource, first.canvasId, 2));
  state.contents.set(filename, canvas('External revision three'));
  await codeRejects(() => files.open(filename), 'FILE_CONFLICT');
  assert.deepEqual(await store.manifest(first.canvasId), edited);
  assert.equal((await store.read(first.canvasId)).source, independentSource);
  assert.deepEqual((await readdir(path.join(store.dir(first.canvasId), 'source'))).sort(), ['1.tsx', '2.tsx', '3.tsx']);
});

test('watch restart and workspace switches do not silently reacquire file access; explicit open reauthorizes', options, async () => {
  const { store, files, filename, directory, workspace, host, state } = await fileFixture('watch-restart');
  const first = success(await files.open(filename, undefined, true));
  assert.equal(first.sourceFile.watch, true);
  const reopened = new CanvasStore(store.dataRoot, assetRoot);
  await reopened.init();
  const restarted = new HostFiles(reopened, host);
  state.contents.set(filename, canvas('Changed during restart'));
  const reads = state.reads.length, stats = state.stats.length;
  await restarted.sync();
  assert.equal(state.reads.length, reads);
  assert.equal(state.stats.length, stats);
  assert.deepEqual(await reopened.manifest(first.canvasId), first);
  const authorized = success(await restarted.open(filename));
  assert.equal(authorized.canvasId, first.canvasId);
  assert.equal(authorized.sourceRevision, 2);
  state.contents.set(filename, canvas('Authorized follow-up'));
  await restarted.sync();
  assert.equal((await reopened.manifest(first.canvasId)).sourceRevision, 3);
  const afterSyncReads = state.reads.length, afterSyncStats = state.stats.length;
  state.workspace = path.join(directory, 'other-workspace');
  await restarted.sync();
  assert.ok(restarted.errors.has(first.canvasId));
  state.workspace = workspace;
  state.contents.set(filename, canvas('Must explicitly reopen'));
  await restarted.sync();
  assert.equal(state.reads.length, afterSyncReads);
  assert.equal(state.stats.length, afterSyncStats);
  assert.equal((await reopened.manifest(first.canvasId)).sourceRevision, 3);
  assert.equal(success(await restarted.open(filename)).sourceRevision, 4);
  assert.equal(restarted.errors.has(first.canvasId), false);
});
