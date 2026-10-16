import { build } from 'esbuild';
import ts from 'typescript';
import { mkdir, readFile, writeFile, readdir, stat, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtinModules } from 'node:module';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(root, 'plugin');
const posix = file => file.replaceAll('\\', '/');
const sha = text => createHash('sha256').update(text).digest('hex');
const common = { absWorkingDir: root, bundle: true, write: false, target: 'es2022', logLevel: 'info',
  legalComments: 'eof', define: { 'process.env.NODE_ENV': '"production"' } };

async function output(relative, contents) {
  const destination = path.join(plugin, relative);
  // Never create directories or replace files through a symlink out of plugin.
  for (let current = destination; current !== root; current = path.dirname(current)) {
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error(`Symlink output path: ${current}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, contents);
}

// Emit the actual SDK declarations, then ship their complete resolved .d.ts
// closure (including TS standard libraries and package resolution metadata).
// Packing the virtual filesystem into ONE JSON avoids PluginPack's file limit.
async function typeAssets() {
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const outDir = path.join(root, '__declaration_output__'); // callback-only; never created
  const options = { ...parsed.options, noEmit: false, declaration: true, declarationMap: false,
    emitDeclarationOnly: true, incremental: false, composite: false,
    rootDir: path.join(root, 'packages'), outDir, types: ['react'],
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'] };
  const program = ts.createProgram([path.join(root, 'packages/sdk/src/index.tsx')], options);
  const files = Object.create(null);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const result = program.emit(undefined, (file, text) => {
    const relative = posix(path.relative(outDir, file));
    if (relative.startsWith('../') || !relative.endsWith('.d.ts')) throw new Error(`Unexpected declaration output: ${file}`);
    files[`packages/${relative}`] = text;
  });
  diagnostics.push(...result.diagnostics);
  if (diagnostics.length || result.emitSkipped) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => root, getCanonicalFileName: file => file, getNewLine: () => '\n',
    }));
  }
  const packageDirectories = new Set();
  for (const source of program.getSourceFiles()) {
    if (!source.isDeclarationFile) continue;
    const relative = posix(path.relative(root, source.fileName));
    if (!relative.startsWith('node_modules/')) throw new Error(`Declaration outside installed dependency root: ${source.fileName}`);
    files[relative] = source.text;
    let directory = path.dirname(source.fileName);
    while (directory !== root && directory !== path.dirname(directory)) {
      packageDirectories.add(directory);
      directory = path.dirname(directory);
    }
  }
  for (const directory of [...packageDirectories].sort()) {
    try {
      const filename = path.join(directory, 'package.json');
      files[posix(path.relative(root, filename))] = await readFile(filename, 'utf8');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'en')));
  const data = { schemaVersion: 1, typescriptVersion: ts.version, sdk: 'packages/sdk/src/index.d.ts', files: sorted };
  const json = JSON.stringify(data);
  await output('vendor/types.json', json);
  console.log(`Type assets: ${Object.keys(files).length} virtual files, ${Buffer.byteLength(json)} bytes`);
  return { files: Object.keys(files).length, sha256: sha(json) };
}

async function notices() {
  const entries = [];
  const installed = path.join(root, 'node_modules');
  async function packageNotice(directory) {
    const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
    const names = (await readdir(directory, { withFileTypes: true }))
      .filter(entry => entry.isFile() && /^(licen[cs]e|copying|notice)(\.|$|-)/i.test(entry.name)).map(entry => entry.name).sort();
    if (names.length) {
      const texts = await Promise.all(names.map(async name => `### ${name}\n\n${await readFile(path.join(directory, name), 'utf8')}`));
      entries.push(`## ${pkg.name}@${pkg.version}\n\nLicense: ${JSON.stringify(pkg.license ?? 'see upstream')}\n\n${texts.join('\n\n')}`);
    }
  }
  for (const entry of (await readdir(installed, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (entry.name.startsWith('@')) {
      for (const child of (await readdir(path.join(installed, entry.name), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
        if (child.isDirectory()) await packageNotice(path.join(installed, entry.name, child.name));
      }
    } else await packageNotice(path.join(installed, entry.name));
  }
  await output('vendor/THIRD_PARTY_LICENSES.md', `# Installed dependency license notices\n\nIncludes build-time dependencies for completeness.\n\n${entries.join('\n\n---\n\n')}\n`);
}

const types = await typeAssets();
const runtime = await build({ ...common, entryPoints: ['packages/compiler-assets/browser-runtime.ts'],
  platform: 'browser', format: 'iife', globalName: 'PiCanvasRuntime', minify: true, outdir: 'plugin/vendor' });
const runtimeJS = runtime.outputFiles.find(file => file.path.endsWith('.js'))?.text;
const runtimeCSS = runtime.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
if (!runtimeJS) throw new Error('Missing browser runtime output.');
await output('vendor/canvas-runtime.js', runtimeJS);
await output('vendor/canvas-runtime.css', runtimeCSS);
await output('vendor/assets.json', JSON.stringify({ schemaVersion: 1, typescriptVersion: ts.version,
  runtime: { file: 'canvas-runtime.js', sha256: sha(runtimeJS) },
  css: { file: 'canvas-runtime.css', sha256: sha(runtimeCSS) }, types: { file: 'types.json', ...types } }, null, 2) + '\n');
await notices();
await output('docs/LICENSE', await readFile(path.join(root, 'LICENSE')));
await output('docs/THIRD_PARTY_NOTICES.md', await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md')));
await output('docs/SDK.md', await readFile(path.join(root, 'docs/SDK.md')));
for (const example of (await readdir(path.join(root, 'examples'))).filter(file => file.endsWith('.tsx')).sort()) {
  await output(`examples/${example}`, await readFile(path.join(root, 'examples', example)));
}

// Source entry points are owned by the backend/bridge agent. Vendor generation
// above remains useful while those entries are being implemented.
const backendEntry = path.join(root, 'packages/pi-plugin/src/index.ts');
const bridgeEntry = path.join(root, 'packages/host-bridge/src/index.ts');
const missing = [];
for (const entry of [backendEntry, bridgeEntry]) {
  try { await stat(entry); } catch (error) { if (error.code === 'ENOENT') missing.push(posix(path.relative(root, entry))); else throw error; }
}
if (missing.length) throw new Error(`Compiler/vendor assets built. Waiting for main-agent source entries: ${missing.join(', ')}`);

const backend = await build({ ...common, entryPoints: [backendEntry], platform: 'node', format: 'cjs',
  target: 'node22', outfile: 'plugin/backend/main.cjs', minify: true, metafile: true,
  // TypeScript's optional stack-trace hook is not used by this no-sourcemap
  // compiler. Close its optional require instead of shipping another loader.
  plugins: [{ name: 'no-optional-source-maps', setup(builder) {
    builder.onResolve({ filter: /^source-map-support$/ }, () => ({ path: 'disabled', namespace: 'optional-source-maps' }));
    builder.onLoad({ filter: /.*/, namespace: 'optional-source-maps' }, () => ({ contents: 'exports.install = function() {};', loader: 'js' }));
  } }],
});
const builtins = new Set([...builtinModules, ...builtinModules.map(name => `node:${name}`)]);
for (const item of Object.values(backend.metafile.outputs)) {
  for (const imported of item.imports) {
    if (imported.external && !builtins.has(imported.path)) throw new Error(`Backend has a runtime dependency outside the plugin: ${imported.path}`);
  }
}
await output('backend/main.cjs', backend.outputFiles.find(file => file.path.endsWith('.cjs')).contents);

const design = await build({ ...common, entryPoints: ['packages/renderer/src/design-mode.ts'], outfile: 'plugin/ui/design-mode.js', platform: 'browser', format: 'iife', minify: true });
const designJS = design.outputFiles.find(file => file.path.endsWith('.js'))?.text;
if (!designJS) throw new Error('Missing design-mode output.');
const ui = await build({ ...common, entryPoints: ['packages/shell/src/shell.ts'], outdir: 'plugin/ui',
  platform: 'browser', format: 'iife', minify: true, define: { ...common.define, __CANVAS_DESIGN_SCRIPT__: JSON.stringify(designJS) } });
const escapeScript = text => text.replace(/<\/script/gi, '<\\/script');
const uiJS = ui.outputFiles.find(file => file.path.endsWith('.js'))?.text;
const uiCSS = ui.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
if (!uiJS) throw new Error('Missing shell output.');
const template = await readFile(path.join(root, 'packages/shell/src/shell.html'), 'utf8');
if (!template.includes('/* SHELL_CSS */') || !template.includes('/* SHELL_JS */')) throw new Error('Missing shell template placeholders.');
await output('ui/index.html', template.replace('/* SHELL_CSS */', () => uiCSS).replace('/* SHELL_JS */', () => escapeScript(uiJS)));

const manifest = JSON.parse(await readFile(path.join(plugin, 'manifest.json'), 'utf8'));
const entryPackage = JSON.parse(await readFile(path.join(plugin, 'package.json'), 'utf8'));
if (entryPackage.type !== 'commonjs' || (await readFile(path.join(plugin, 'main.js'), 'utf8')).trim() !== "'use strict';\nmodule.exports = require('./backend/main.cjs');") {
  throw new Error('The marketplace main.js entry must forward to the unchanged CommonJS backend.');
}
if (manifest.id !== 'local.pi-canvas' || manifest.main !== 'main.js' || manifest.ui?.panel || manifest.permissions.includes('ui.panel') ||
    !manifest.permissions.includes('ui.view') || !manifest.contributes?.views?.some(view => view.id === 'canvas' && view.entry === 'ui/index.html')) {
  throw new Error('PI Canvas must be view-only: declared canvas view, ui.view, no panel entry or permission.');
}
async function size(directory) {
  let files = 0, bytes = 0;
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name);
    if (item.isSymbolicLink()) throw new Error(`Plugin must not contain symlinks: ${filename}`);
    if (item.isDirectory()) { const child = await size(filename); files += child.files; bytes += child.bytes; }
    else if (item.isFile()) { files++; bytes += (await stat(filename)).size; }
  }
  return { files, bytes };
}
const total = await size(plugin);
if (total.files > 2000 || total.bytes > 50 * 1024 * 1024) throw new Error(`PluginPack limits exceeded: ${JSON.stringify(total)}`);
console.log(`Built self-contained plugin: ${total.files} files, ${total.bytes} bytes (${(total.bytes / 1024 / 1024).toFixed(2)} MiB).`);
