import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import { build } from 'esbuild';
import ts from 'typescript';
import { restrictedTypeScript, auditCompiler, compilerApi } from '../scripts/typescript-compiler.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assert.ok(process.env.PI_SCRATCH_DIR, 'Session-owned scratch is required');
const scratch=await fs.realpath(process.env.PI_SCRATCH_DIR);
const directory=await fs.mkdtemp(path.join(scratch,'pi-canvas-compiler-'));
const owner=randomUUID();await fs.writeFile(path.join(directory,'.owner'),owner,{flag:'wx'});
let restricted,createCompiler,compile,referenceCompile,assets;
const require=createRequire(import.meta.url);
before(async()=>{
  restricted=await restrictedTypeScript(root);
  const factory=path.join(directory,'factory.mjs');await fs.writeFile(factory,restricted.code);
  ({createCompiler}=await import(pathToFileURL(factory).href));
  assets=path.join(directory,'assets');await fs.mkdir(path.join(assets,'vendor'),{recursive:true});
  for(const name of ['types.json','canvas-runtime.js','canvas-runtime.css','typescript-diagnostics.json'])await fs.copyFile(path.join(root,'plugin/vendor',name),path.join(assets,'vendor',name));
  async function bundle(label,plugins){
    const outfile=path.join(directory,label+'.cjs');await build({absWorkingDir:root,stdin:{contents:"export {compile} from './packages/runtime/src/compiler.ts';",resolveDir:root,sourcefile:'compiler-test.ts',loader:'ts'},bundle:true,write:true,platform:'node',target:'node22',format:'cjs',outfile,plugins,logLevel:'silent'});return require(outfile).compile;
  }
  compile=await bundle('restricted',[restricted.plugin]);
  referenceCompile=await bundle('reference',[{name:'reference-full-typescript',setup(b){
    b.onResolve({filter:/compiler-assets[\/]typescript-api\.js$/},()=>({path:'reference',namespace:'reference-compiler'}));
    b.onLoad({filter:/.*/,namespace:'reference-compiler'},()=>({contents:"import ts from 'typescript'; export function createCompiler(){ return ts; }",loader:'js',resolveDir:root}));
    b.onResolve({filter:/^source-map-support$/},()=>({path:'disabled',namespace:'reference-optional'}));
    b.onLoad({filter:/.*/,namespace:'reference-optional'},()=>({contents:'exports.install = function() {};',loader:'js'}));
  }}]);
},{timeout:180000});
after(async()=>{
  assert.equal(path.dirname(await fs.realpath(directory)),scratch);
  assert.equal((await fs.lstat(directory)).isSymbolicLink(),false);
  assert.equal(await fs.readFile(path.join(directory,'.owner'),'utf8'),owner);
  await fs.rm(directory,{recursive:true,maxRetries:3});
});
test('restricted API excludes Node system, language services, server, tracing and CLI',()=>{
  const data=JSON.parse(restricted.diagnostics);
  assert.deepEqual(data.messages,JSON.parse(JSON.stringify(ts.Diagnostics)),'All upstream diagnostic text/metadata must stay unchanged');
  const api=createCompiler(data.messages);
  assert.deepEqual(Object.keys(api).sort(),[...compilerApi].sort());
  for(const name of ['sys','setSys','createCompilerHost','createLanguageService','server','executeCommandLine','startTracing'])assert.equal(api[name],undefined,name);
  assert.equal(api.version,ts.version);assert.equal(restricted.manifest.compiler.executableLoads,0);assert.equal(restricted.manifest.compiler.externalImports,0);
  auditCompiler(restricted.code);
});
test('AST audit distinguishes readable diagnostic data from executable loaders',()=>{
  auditCompiler('const diagnostic = "import {1} = require({2})";');
  for(const code of ["require('fs');",'require(target);','import(target);','host.require(target);','host["require"](target);','eval(source);','new Function(source);'])assert.throws(()=>auditCompiler(code),/executable module loading/);
});
test('pinned source mismatches fail before any dependency code can execute',async()=>{
  const fake=path.join(directory,'changed-dependency');await fs.mkdir(path.join(fake,'node_modules/typescript/lib'),{recursive:true});
  await fs.writeFile(path.join(fake,'package.json'),'{}');
  await fs.writeFile(path.join(fake,'node_modules/typescript/package.json'),'{"main":"lib/typescript.js"}');
  await fs.writeFile(path.join(fake,'node_modules/typescript/lib/typescript.js'),'throw new Error("Changed dependency must not execute");');
  await assert.rejects(restrictedTypeScript(fake),/Pinned TypeScript source mismatch/);
});
test('semantic diagnostics and browser output match full TypeScript for all examples and boundary cases',async()=>{
  const sources=[];for(const name of (await fs.readdir(path.join(root,'examples'))).filter(name=>name.endsWith('.tsx')).sort())sources.push({name,source:await fs.readFile(path.join(root,'examples',name),'utf8')});
  sources.push(
    {name:'real type error',source:"import {Page} from '@codex-canvas/sdk'; export default function Canvas(){return <Page title={42}/>;}"},
    {name:'syntax error',source:'export default function Canvas( { return null; }'},
    {name:'no default export',source:'export function Canvas(){return null;}'},
    {name:'dynamic import',source:"import('@codex-canvas/sdk'); export default function Canvas(){return null;}"},
    {name:'require policy',source:"require('fs'); export default function Canvas(){return null;}"},
    {name:'Function policy',source:"new Function('return 1'); export default function Canvas(){return null;}"},
    {name:'no Node execution',source:"import {Text} from '@codex-canvas/sdk'; if(typeof window==='undefined')throw new Error('Generated code must never run in Node'); export default function Canvas(){return <Text>Isolated</Text>;}"},
  );
  for(const {name,source} of sources){const actual=await compile(source,assets),expected=await referenceCompile(source,assets);assert.deepEqual(actual,expected,name);}
  const semantic=await compile(sources.find(s=>s.name==='real type error').source,assets);assert.ok(semantic.diagnostics.some(d=>d.phase==='typecheck'&&/number.*string/.test(d.message)));assert.equal(semantic.bundle,undefined);
},{timeout:240000});
