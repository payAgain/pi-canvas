import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
assert.ok(process.env.PI_CANVAS_BRIDGE_BUNDLE,'Run scripts/check-bridge.mjs');
const {HostBridge}=createRequire(import.meta.url)(process.env.PI_CANVAS_BRIDGE_BUNDLE);
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture(initial){
 const previous={window:globalThis.window,document:globalThis.document};
 const handlers=new Map();let schemeReads=0;
 globalThis.document={readyState:'complete',documentElement:{dataset:{piPluginPanelShape:'view'}}};
 globalThis.window={addEventListener(){},matchMedia(){schemeReads++;return {matches:false,addEventListener(){},removeEventListener(){}};},pluginBridge:{
  on(event,handler){handlers.set(event,handler);return()=>handlers.delete(event);},
  async invoke(channel){
   if(channel==='canvas.connect')return {ok:true,data:{session:'a'.repeat(64),revision:1,canSend:false,sendReason:'',sessionLabel:'未绑定聊天',runtimeVersion:'0.1.3'}};
   if(channel==='app.getAppearance')return initial;
   throw new Error('Unexpected mock channel');
  },
 }};
 const bridge=new HostBridge();
 return {bridge,event:payload=>handlers.get('appearance:changed')(payload),get schemeReads(){return schemeReads;},restore(){if(previous.window===undefined)delete globalThis.window;else globalThis.window=previous.window;if(previous.document===undefined)delete globalThis.document;else globalThis.document=previous.document;}};
}
const subscribed=()=>new Promise(resolve=>setImmediate(resolve));
test('a newer appearance event wins over a delayed stale initial response',async()=>{
 const initial=deferred(),f=fixture(initial.promise);
 try{const connected=f.bridge.connect();await subscribed();f.event({base:'dark',locale:'zh-CN'});initial.resolve({base:'light',locale:'en-US'});await connected;assert.equal(f.bridge.locale,'zh-CN');assert.equal(f.bridge.theme,'dark');assert.equal(f.bridge.surface,'view');assert.equal(f.schemeReads,0);}finally{f.restore();}
});
test('a failed initial read cannot replace a newer event with fallback appearance',async()=>{
 const initial=deferred(),f=fixture(initial.promise);
 try{const connected=f.bridge.connect();await subscribed();f.event({base:'dark',locale:'en-US'});initial.reject(new Error('Expected initial read failure'));await connected;assert.equal(f.bridge.locale,'en');assert.equal(f.bridge.theme,'dark');assert.equal(f.schemeReads,0);}finally{f.restore();}
});
test('locale-only appearance changes do not invoke the theme render callback',async()=>{
 const f=fixture(Promise.resolve({base:'light',locale:'en-US'}));
 try{await f.bridge.connect();let themes=0,locales=0;f.bridge.onTheme=()=>themes++;f.bridge.onLocale=()=>locales++;f.event({base:'light',locale:'zh-CN'});assert.equal(f.bridge.locale,'zh-CN');assert.equal(themes,0);assert.equal(locales,1);}finally{f.restore();}
});
