import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.env.PI_SCRATCH_DIR)throw new Error('PI_SCRATCH_DIR is required; never use a user library for host tests.');
const scratch=await realpath(process.env.PI_SCRATCH_DIR);
const directory=await mkdtemp(path.join(scratch,'pi-canvas-host-'));
const marker=randomUUID();await writeFile(path.join(directory,'.owner'),marker,{flag:'wx'});
try{
 const packaged=path.join(directory,'plugin');await mkdir(path.join(packaged,'backend'),{recursive:true});await mkdir(path.join(packaged,'vendor'));
 for(const file of ['manifest.json','main.js','package.json','backend/main.cjs','vendor/types.json','vendor/typescript-diagnostics.json','vendor/canvas-runtime.js','vendor/canvas-runtime.css'])await copyFile(path.join(root,'plugin',file),path.join(packaged,file));
 const result=spawnSync(process.execPath,['--test','--test-concurrency=1','--test-reporter=tap',path.join(root,'tests/host.test.mjs')],{
  cwd:directory,stdio:'inherit',timeout:120000,env:{...process.env,PI_CANVAS_HOST_ROOT:directory,PI_CANVAS_HOST_BUNDLE:path.join(packaged,'main.js')},
 });
 if(result.error)console.error(result.error);process.exitCode=result.status??1;
}finally{
 if(path.dirname(await realpath(directory))!==scratch||await readFile(path.join(directory,'.owner'),'utf8')!==marker)throw new Error('Refusing unsafe test cleanup');
 await rm(directory,{recursive:true,maxRetries:3});
}
