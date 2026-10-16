import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!process.env.PI_SCRATCH_DIR)throw new Error('PI_SCRATCH_DIR is required; never use a user library.');
const scratch=await realpath(process.env.PI_SCRATCH_DIR);
const directory=await mkdtemp(path.join(scratch,'pi-canvas-bridge-'));
const marker=randomUUID();await writeFile(path.join(directory,'.owner'),marker,{flag:'wx'});
try {
 const outfile=path.join(directory,'bridge.cjs');
 await build({absWorkingDir:root,entryPoints:['packages/host-bridge/src/index.ts'],bundle:true,platform:'node',format:'cjs',target:'node22',outfile,logLevel:'silent'});
 const result=spawnSync(process.execPath,['--test','--test-concurrency=1','--test-reporter=tap',path.join(root,'tests/bridge.test.mjs')],{cwd:directory,stdio:'inherit',timeout:30000,env:{...process.env,PI_CANVAS_BRIDGE_BUNDLE:outfile}});
 if(result.error)console.error(result.error);process.exitCode=result.status??1;
} finally {
 if(path.dirname(await realpath(directory))!==scratch||await readFile(path.join(directory,'.owner'),'utf8')!==marker)throw new Error('Refusing unsafe bridge-test cleanup');
 await rm(directory,{recursive:true,maxRetries:3});
}
