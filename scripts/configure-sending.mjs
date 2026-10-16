import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2);
if (args.length !== 1 || !['--enable', '--disable'].includes(args[0])) throw new Error('Usage: node scripts/configure-sending.mjs --enable|--disable');
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../plugin/manifest.json');
const original = fs.readFileSync(file, 'utf8');
const manifest = JSON.parse(original);
if (manifest.id !== 'local.pi-canvas' || manifest.main !== 'main.js' || !Array.isArray(manifest.permissions)) throw new Error('Unexpected PI Canvas manifest; aborting.');
const enabled = args[0] === '--enable';
const permissions = manifest.permissions.filter(value => value !== 'desktop.control');
if (enabled) permissions.push('desktop.control');
manifest.permissions = permissions;
// Enabling the high-risk manifest permission deliberately does not toggle the user setting.
if (fs.readFileSync(file, 'utf8') !== original) throw new Error('Manifest changed while configuring; aborting.');
fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(enabled ? 'desktop.control declared. Rebuild, reload with explicit permission approval, then enableSending in plugin settings.' : 'desktop.control removed. Rebuild and reload the plugin to revoke the permission.');
