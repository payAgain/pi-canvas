import { readFile, readdir, mkdir, copyFile, lstat, rm, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'plugin');
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--directory' || !path.isAbsolute(args[1])) {
  throw new Error('Usage: npm run stage -- --directory <absolute existing local.pi-canvas plugin directory>');
}
const target = path.resolve(args[1]);
if (target === source || target === root || source.startsWith(target + path.sep) || target.startsWith(source + path.sep)) {
  throw new Error('Refusing to stage into the source checkout or an overlapping directory.');
}
const allowDirectories = ['backend', 'ui', 'vendor', 'examples', 'docs', 'skills'];
const allowFiles = ['manifest.json', 'README.md', 'main.js', 'package.json'];
async function noSymlinks(filename) {
  let current = filename;
  while (true) {
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error(`Refusing symbolic link: ${current}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
async function inventory(directory, relative = '') {
  const found = [];
  for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing symbolic link: ${path.join(directory, name)}`);
    if (entry.isDirectory()) found.push(...await inventory(directory, name));
    else if (entry.isFile()) found.push(name);
    else throw new Error(`Unsupported stage entry: ${name}`);
  }
  return found.sort();
}
await noSymlinks(source);
await noSymlinks(target);
for (const name of [...allowFiles, ...allowDirectories]) {
  await noSymlinks(path.join(source, name));
  await noSymlinks(path.join(target, name));
}
for (const name of allowFiles) {
  if (!(await lstat(path.join(source, name))).isFile()) throw new Error(`Missing source plugin file: ${name}`);
  try { if (!(await lstat(path.join(target, name))).isFile()) throw new Error(`Target plugin file is not a regular file: ${name}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const manifest = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8'));
// A pre-existing matching manifest is mandatory: this is not a plugin creator.
const previous = JSON.parse(await readFile(path.join(target, 'manifest.json'), 'utf8'));
if (manifest.id !== 'local.pi-canvas' || previous.id !== manifest.id) throw new Error('Stage source/target plugin id must both be local.pi-canvas.');
if (manifest.main !== 'main.js' || manifest.ui?.panel || manifest.permissions.includes('ui.panel') || !manifest.permissions.includes('ui.view') || !manifest.contributes?.views?.some(view => view.id === 'canvas' && view.entry === 'ui/index.html')) throw new Error('Build the view-only production plugin before staging.');
const files = [...allowFiles];
for (const directory of allowDirectories) files.push(...await inventory(source, directory));
for (const required of ['main.js', 'package.json', 'backend/main.cjs', 'ui/index.html', 'vendor/types.json', 'vendor/canvas-runtime.js', 'vendor/canvas-runtime.css', 'skills/pi-canvas.md']) {
  if (!files.includes(path.normalize(required))) throw new Error(`Missing required built resource: ${required}`);
}
// Preflight ALL potentially replaced paths before copying anything. Unlisted
// top-level directories (data, out, .storage, etc.) are never touched.
for (const directory of allowDirectories) {
  const destination = path.join(target, directory);
  await noSymlinks(destination);
  try { await inventory(target, directory); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const oldRenderer = path.join(target, 'renderer');
await noSymlinks(oldRenderer);
let rendererEntries = [];
try { rendererEntries = await readdir(oldRenderer, { withFileTypes: true }); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (rendererEntries.some(entry => entry.name !== 'index.html' || !entry.isFile())) {
  throw new Error('Unknown files in old renderer directory; preserve them manually before staging.');
}
// Only known scaffold names are removed, never arbitrary previous manifest paths.
for (const directory of allowDirectories) {
  await rm(path.join(target, directory), { recursive: true, force: true });
  await mkdir(path.join(target, directory), { recursive: true });
}
for (const file of files.filter(name => name !== 'manifest.json')) {
  await mkdir(path.dirname(path.join(target, file)), { recursive: true });
  await copyFile(path.join(source, file), path.join(target, file));
}
await rm(path.join(oldRenderer, 'index.html'), { force: true });
try { await rmdir(oldRenderer); } catch (error) { if (error.code !== 'ENOENT') throw error; }
// Install the manifest last, after its resources exist.
await copyFile(path.join(source, 'manifest.json'), path.join(target, 'manifest.json'));
console.log(`Staged ${files.length} allowlisted plugin files to ${target}; unlisted user data was preserved. No plugin was created, loaded, or packed.`);
