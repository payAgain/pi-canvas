import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';

const root = process.env.PI_CANVAS_HOST_ROOT;
assert.ok(root && path.isAbsolute(root) && process.env.PI_CANVAS_HOST_BUNDLE, 'Run through scripts/check-host.mjs');
const module = createRequire(import.meta.url)(process.env.PI_CANVAS_HOST_BUNDLE);
const declarations = ['canvas_publish','canvas_update','canvas_open','canvas_read','canvas_list','canvas_status','canvas_delete','canvas_restore','canvas_probe'].map(name=>({name,description:name,risk:'low',schema:{type:'object'}}));
const packagedManifest=JSON.parse(await readFile(path.resolve(path.dirname(process.env.PI_CANVAS_HOST_BUNDLE),'manifest.json'),'utf8'));
const manifest = {...packagedManifest,permissions:[...packagedManifest.permissions],contributes:{...packagedManifest.contributes,agentTools:declarations}};
const popups=[], toasts=[];
const tools=new Map(), commands=new Map(), prompts=[];
let sendFailure=false, hostLocale='zh-CN';
globalThis.pi={
 app:{getLocale:async()=>hostLocale},
 plugin:{getManifest:()=>manifest,getDataPath:async()=>path.join(root,'library'),getSettings:async()=>({enableSending:true})},
 commands:{register:async command=>commands.set(command.id,command),unregister:async id=>commands.delete(id)},
 ui:{openPanel:async(...args)=>{popups.push(args);throw new Error('Detached panels are forbidden')},showToast:async(message,level)=>{toasts.push({message,level})}},workspace:{get:async()=>null},
 fs:{stat:async()=>{throw new Error('No external file permitted')},readRange:async()=>{throw new Error('No external file permitted')}},
 agent:{registerTool:async tool=>tools.set(tool.name,tool),unregisterTool:async name=>tools.delete(name)},
 desktop:{listOperations:async()=>[{id:'agent/prompt',risk:'write'}],invoke:async input=>{prompts.push(input);if(sendFailure)throw new Error('mock uncertain transport');return {accepted:true}}},
};
const canvas=label=>`import { Text } from '@codex-canvas/sdk'; export default function Canvas(){ return <Text>${label}</Text>; }`;
const context=sessionId=>({sessionId,log(){}});
const tool=async(name,args,session='session-A')=>tools.get(name).execute(args,context(session));
const invoke=async(channel,payload)=>module.onPanelInvoke(channel,payload);
const op=async(client,name,args={})=>invoke('canvas.operation',{session:client.session,op:name,args});
const connect=async(instanceId= randomUUID(),surface='panel')=>{const result=await invoke('canvas.connect',{instanceId,surface});assert.equal(result.ok,true,JSON.stringify(result));return {...result.data,instanceId,surface}};
const send=(client,doc,extra={})=>invoke('canvas.send',{session:client.session,requestId:randomUUID(),canvasId:doc.canvasId,sourceRevision:doc.sourceRevision,publishedRevision:doc.publishedRevision,text:'Explicit simulated edit request',...extra});

test('trusted backend protocol and independent surfaces', {timeout:120000}, async t=>{
 await mkdir(root,{recursive:true}); await module.onLoad();
 try{
  assert.equal(tools.size,declarations.length);
  let first;
  await t.test('view-only package has no detached panel entry or permission',async()=>{
   assert.equal(manifest.version,'0.1.5');assert.equal(manifest.ui?.panel,undefined);
   assert.ok(manifest.i18n.en.safetyNotes);assert.ok(manifest.i18n['zh-CN'].safetyNotes);
   assert.deepEqual(manifest.contributes.views[0].title,{en:'PI Canvas','zh-CN':'PI Canvas'});
   assert.equal(manifest.permissions.includes('ui.panel'),false);assert.equal(manifest.permissions.includes('ui.view'),true);
   assert.deepEqual(manifest.contributes.views.map(({id,entry})=>({id,entry})),[{id:'canvas',entry:'ui/index.html'}]);
  });
  await t.test('publish selects the right-side view without fabricating an open or render',async()=>{
   first=await tool('canvas_publish',{title:'Protocol fixture A',source:canvas('Fixture A')});
   assert.equal(first.ok,true);assert.equal(first.presentation.opened,false);assert.equal(first.presentation.render,'unobserved');
   assert.equal(first.presentation.mode,'pi-view');assert.equal(first.presentation.selectionUpdated,true);
   assert.equal(first.presentation.reason,'HOST_VIEW_REVEAL_UNAVAILABLE');assert.equal(popups.length,0);
   assert.equal(first.runtimeVersion,'0.1.5');assert.equal(JSON.stringify(first).includes('session-A'),false);
  });
  await t.test('unknown placement can become a view without misreporting or changing authorization',async()=>{
   const instanceId=randomUUID();const unknown=await connect(instanceId,'unknown');
   let status=await tool('canvas_status',{canvasId:first.manifest.canvasId});assert.ok(status.surfaces.some(surface=>surface.surface==='unknown'));
   const known=await connect(instanceId,'view');assert.equal(known.session,unknown.session);
   const mismatch=await invoke('canvas.connect',{instanceId,surface:'panel'});assert.equal(mismatch.error.code,'SURFACE_MISMATCH');
   assert.equal((await invoke('canvas.connect',{instanceId:randomUUID(),surface:'invalid'})).error.code,'INVALID_INPUT');
  });
  let panel,view;
  await t.test('panel and docked view have independent tokens and local navigation',async()=>{
   panel=await connect();view=await connect(randomUUID(),'view');assert.notEqual(panel.session,view.session);
   const newCanvas=await op(view,'publish',{title:'Local view fixture',source:canvas('Fixture B')});assert.equal(newCanvas.ok,true);
   const localId=newCanvas.data.manifest.canvasId;
   assert.equal(newCanvas.binding.canSend,false);
   assert.equal((await op(panel,'read',{canvasId:first.manifest.canvasId})).binding.canvasId,first.manifest.canvasId);
   assert.equal((await invoke('canvas.connect',{instanceId:view.instanceId,surface:'view'})).data.canvasId,localId);
   assert.equal((await op(panel,'state',{canvasId:localId,baseStateRevision:0,key:'count',value:1})).error.code,'BINDING_MISMATCH');
  });
  await t.test('state changes are shared without retargeting either surface',async()=>{
   await op(view,'read',{canvasId:first.manifest.canvasId});
   const saved=await op(panel,'state',{canvasId:first.manifest.canvasId,baseStateRevision:0,key:'count',value:2});assert.equal(saved.ok,true);
   const shared=await op(view,'readState',{canvasId:first.manifest.canvasId});assert.deepEqual(shared.data.values,{count:2});
   const stale=await op(view,'state',{canvasId:first.manifest.canvasId,baseStateRevision:0,key:'count',value:3});assert.equal(stale.error.code,'STATE_CONFLICT');
  });
  await t.test('render reports are validated, observable, bounded and do not leak authorization',async()=>{
   let status=await tool('canvas_status',{canvasId:first.manifest.canvasId});assert.ok(status.surfaces.every(surface=>surface.render.phase==='unobserved'));
   const report={canvasId:first.manifest.canvasId,publishedRevision:1,phase:'ready',theme:'system',visible:true};
   assert.equal((await invoke('canvas.report',{session:panel.session,report:{...report,publishedRevision:2}})).error.code,'STALE_RENDER');
   assert.equal((await invoke('canvas.report',{session:panel.session,report:{...report,canvasId:randomUUID()}})).error.code,'BINDING_MISMATCH');
   assert.equal((await invoke('canvas.report',{session:panel.session,report:{...report,message:'x'.repeat(801)}})).error.code,'INVALID_INPUT');
   assert.equal((await invoke('canvas.report',{session:panel.session,report})).ok,true);
   status=await tool('canvas_status',{canvasId:first.manifest.canvasId});assert.equal(status.surfaces.find(surface=>surface.surface==='panel').render.phase,'ready');
   assert.equal(status.surfaces.find(surface=>surface.surface==='panel').render.fresh,true);
   const json=JSON.stringify(status);assert.equal(json.includes(panel.session),false);assert.equal(json.includes('session-A'),false);assert.equal(json.includes(panel.instanceId),false);
  });
  await t.test('unknown channels, malformed input and ungranted sending are refused',async()=>{
   assert.equal((await invoke('desktop.invoke',{})).error.code,'UNKNOWN_CHANNEL');
   assert.equal((await invoke('canvas.connect',{})).error.code,'INVALID_INPUT');
   assert.equal((await send(panel,first.manifest)).error.code,'SEND_UNAVAILABLE');assert.equal(prompts.length,0);
  });
  await t.test('explicit open rejects queued old tokens even for the same artifact',async()=>{
   await tool('canvas_open',{canvasId:first.manifest.canvasId},'session-B');
   assert.equal((await op(panel,'state',{canvasId:first.manifest.canvasId,baseStateRevision:1,key:'count',value:4})).error.code,'INVALID_SESSION');
   assert.equal((await send(panel,first.manifest)).error.code,'INVALID_SESSION');
   panel=await connect(panel.instanceId,'panel');view=await connect(view.instanceId,'view');
   assert.equal((await op(panel,'readState',{canvasId:first.manifest.canvasId})).data.values.count,2);
  });
  await t.test('simulated optional send uses the bound host session and deduplicates request identity',async()=>{
   manifest.permissions.push('desktop.control');
   panel=await connect(panel.instanceId,'panel');
   assert.equal((await send(panel,first.manifest,{sourceRevision:999})).error.code,'STALE_SELECTION');
   const requestId=randomUUID();
   assert.equal((await send(panel,first.manifest,{requestId})).ok,true);
   assert.equal((await send(panel,first.manifest,{requestId})).ok,true);
   assert.equal(prompts.length,1);assert.equal(prompts[0].args[0].sessionId,'session-B');
   assert.equal((await send(panel,first.manifest,{requestId,text:'Different request'})).error.code,'REQUEST_ID_CONFLICT');
  });
  await t.test('uncertain send is not replayed and manual opening clears chat authorization',async()=>{
   sendFailure=true;const requestId=randomUUID();
   assert.equal((await send(panel,first.manifest,{requestId})).error.code,'SEND_RESULT_UNKNOWN');
   const attempts=prompts.length;assert.equal((await send(panel,first.manifest,{requestId})).error.code,'SEND_RESULT_UNKNOWN');assert.equal(prompts.length,attempts);
   await commands.get('pi-canvas.open').run();assert.equal(popups.length,0);assert.equal(toasts.length,1);assert.match(toasts[0].message,/右侧工作面板/);
   panel=await connect(panel.instanceId,'panel');assert.equal(panel.canSend,false);
   assert.equal((await send(panel,first.manifest)).error.code,'SEND_UNAVAILABLE');
  });
  await t.test('update, saved open and probe never create detached windows',async()=>{
   const update=await tool('canvas_update',{canvasId:first.manifest.canvasId,baseRevision:first.manifest.sourceRevision,title:'Protocol fixture A',source:canvas('Updated fixture')});
   assert.equal(update.ok,true);assert.equal(update.presentation.opened,false);
   for(const [name,args] of [['canvas_open',{canvasId:first.manifest.canvasId}],['canvas_probe',{}]]) {
    const result=await tool(name,args);assert.equal(result.presentation.mode,'pi-view');assert.equal(result.presentation.opened,false);
   }
   assert.equal(popups.length,0);
  });
  await t.test('English host locale localizes selection, status and command toast without changing view-only behavior',async()=>{
   hostLocale='en-US';
   const opened=await tool('canvas_open',{canvasId:first.manifest.canvasId});
   assert.match(opened.presentation.message,/right work-panel/);assert.equal(opened.presentation.opened,false);
   const status=await tool('canvas_status',{canvasId:first.manifest.canvasId});assert.match(status.note,/not a screenshot/);
   await commands.get('pi-canvas.open').run();assert.match(toasts.at(-1).message,/No detached window/);assert.equal(popups.length,0);
   hostLocale='zh-CN';
  });
 }finally{await module.onUnload();delete globalThis.pi;}
 assert.equal(tools.size,0);assert.equal(commands.size,0);
});
