import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sourceCrop} from '../src/photoshop-selection.mjs';
import {readCrop} from '../src/photoshop-crop.mjs';
import {withNodeHistory,selectHistory} from '../src/node-history.mjs';
const require=createRequire(import.meta.url);
const {createSelectionBridge}=require('../public/cosmos-selection-bridge.cjs');
// This .js file is CommonJS for UXP; load it in an isolated CommonJS wrapper.
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox={module:{exports:{}},Uint8Array,Error,Number};vm.runInNewContext(fs.readFileSync('photoshop-plugin/crop-core.js','utf8'),sandbox);
const {selectionBounds,paddedRGBA,validateReturn}=sandbox.module.exports;
const crop={session:'photoshop-session-1',documentId:24,documentName:'Example.psd',left:12,top:27,width:2,height:2,documentWidth:100,documentHeight:80};
test('plugin buttons capture full-resolution selection and write a new layer at recorded coordinates',async()=>{
 const elements=new Map(),calls=[];let submitted,disposed=0;
 const doc={id:24,name:'Example.psd',width:100,height:80,mode:'RGB',selection:{bounds:{left:12,top:27,right:14,bottom:29},solid:true},createLayer:async()=>({id:42})};
 const pixels=new Uint8Array(16).fill(255);
 const ps={app:{activeDocument:doc},constants:{DocumentMode:{RGB:'RGB'}},core:{executeAsModal:async fn=>fn({hostControl:{suspendHistory:async()=>1,resumeHistory:async(id,commit)=>calls.push({commit})}})},imaging:{
  getPixels:async options=>{assert.equal(options.targetSize,undefined);assert.equal(options.sourceBounds.left,12);return {level:0,sourceBounds:{left:12,top:27},imageData:{width:2,height:2,components:4,getData:async()=>pixels,dispose:()=>disposed++}};},
  createImageDataFromBuffer:async(bytes,options)=>{assert.deepEqual([...bytes],[...pixels]);assert.equal(options.width,2);return {dispose:()=>disposed++};},
  putPixels:async options=>calls.push(options)
 }};
 const context={require:name=>name==='photoshop'?ps:sandbox.module.exports,document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{value:'a'.repeat(64),addEventListener:(event,fn)=>{elements.get(id)[event]=fn;}});return elements.get(id);}},Uint8Array,Map,Set,Date,Math,JSON,Number,Error,encodeURIComponent,decodeURIComponent,fetch:async(url,options)=>{
  if(url.endsWith('/status'))return Response.json({workflow:{name:'Work'}});
  if(url.endsWith('/crop')){submitted={...JSON.parse(decodeURIComponent(options.headers['X-Cosmos-Crop'])),cropId:'crop-id-123',projectId:'workflow-1'};assert.equal(options.body.byteLength,16);return Response.json(submitted);}
  if(url.endsWith('/result'))return new Response(pixels,{headers:{'X-Cosmos-Crop':encodeURIComponent(JSON.stringify({...submitted,resultId:'result-1'}))}});
  if(url.endsWith('/result/ack'))return Response.json({ok:true});
  throw new Error('Unexpected request');
 }};
 vm.runInNewContext(fs.readFileSync('photoshop-plugin/main.js','utf8'),context);
 await elements.get('send').click();assert.equal(submitted.left,12);
 await elements.get('receive').click();const put=calls.find(c=>c.layerID);
 assert.equal(put.layerID,42);assert.equal(put.documentID,24);assert.equal(put.targetBounds.left,12);assert.equal(put.targetBounds.top,27);
 assert.equal(disposed,2);assert.equal(calls.at(-1).commit,true);
 await elements.get('receive').click();assert.equal(calls.filter(c=>c.layerID).length,1);
});
test('crop preserves native pixel geometry, trimmed transparency and exact return origin',()=>{
 const bounds=selectionBounds({left:12,top:27,right:14,bottom:29},100,80);
 assert.equal(bounds.width,2);assert.equal(bounds.height,2);
 const pixels=paddedRGBA(new Uint8Array([10,20,30]),{width:1,height:1,components:3,left:13,top:28},crop);
 assert.deepEqual([...pixels],[0,0,0,0,0,0,0,0,0,0,0,0,10,20,30,255]);
 const metadata={...crop,cropId:'crop-id-123',projectId:'workflow-1'};
 const target=validateReturn(metadata,metadata,{id:24,name:'Example.psd',width:100,height:80});
 assert.equal(target.left,12);assert.equal(target.top,27);
 assert.throws(()=>validateReturn(metadata,metadata,{id:25,name:'Example.psd',width:100,height:80}));
 assert.throws(()=>validateReturn(metadata,metadata,{id:24,name:'Example.psd',width:200,height:80}));
 assert.throws(()=>validateReturn({...metadata,left:11},metadata,{id:24,name:'Example.psd',width:100,height:80}));
 assert.throws(()=>selectionBounds({left:0,top:0,right:10000,bottom:10000},10000,10000));
});
test('crop provenance follows connected images and selected generation history, rejecting ambiguity',()=>{
 const meta={...crop,cropId:'crop-id-123',projectId:'workflow-1'},value=JSON.stringify(meta);
 const nodes=[{id:'a',data:{kind:'image',psCrop:value}},{id:'b',data:{kind:'generate'}},{id:'c',data:{kind:'image',psCrop:JSON.stringify({...meta,cropId:'different-crop'})}}];
 assert.equal(sourceCrop('b',nodes,[{source:'a',target:'b'}]),value);
 assert.throws(()=>sourceCrop('b',nodes,[{source:'a',target:'b'},{source:'c',target:'b'}]));
 assert.throws(()=>readCrop(JSON.stringify({...meta,width:-1})));
 const previous={kind:'generate',result:'https://im.runware.ai/old.png',psCrop:value};
 const next=withNodeHistory(previous,{result:'https://im.runware.ai/new.png',psCrop:undefined});
 assert.equal(selectHistory(next,0).psCrop,value);assert.equal(selectHistory(next,1).psCrop,undefined);
});
test('local bridge round trip is authenticated, workflow-scoped, lossless and acknowledged',async()=>{
 const {server,key}=createSelectionBridge();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const ps={'X-Cosmos-Key':key},browser={...ps,Origin:'https://aicosmos.app','X-Cosmos-Client':'browser-client-1'};
 const json=(headers,value)=>({method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(value)});
 try{
  assert.equal((await fetch(base+'/status',{headers:{...browser,'X-Cosmos-Key':'bad'}})).status,401);
  assert.equal((await fetch(base+'/status',{headers:{...browser,Origin:'https://evil.test'}})).status,403);
  assert.equal((await fetch(base+'/workflow',json(browser,{projectId:'workflow-1',name:'Work'}))).status,200);
  assert.equal((await fetch(base+'/workflow',json({...browser,'X-Cosmos-Client':'other-client'},{projectId:'workflow-2',name:'Other'}))).status,409);
  const pixels=new Uint8Array([1,2,3,255,4,5,6,255,7,8,9,255,10,11,12,255]);
  const posted=await fetch(base+'/crop',{method:'POST',headers:{...ps,'X-Cosmos-Crop':encodeURIComponent(JSON.stringify(crop))},body:pixels});
  assert.equal(posted.status,200);const meta=await posted.json();
  const incoming=await fetch(base+'/incoming',{headers:browser});assert.equal(incoming.status,200);
  assert.equal(JSON.parse(decodeURIComponent(incoming.headers.get('X-Cosmos-Crop'))).left,12);
  assert.deepEqual(new Uint8Array(await incoming.arrayBuffer()),pixels);
  assert.equal((await fetch(base+'/incoming',{headers:ps})).status,404);
  await fetch(base+'/incoming/ack',json(browser,{cropId:meta.cropId}));
  assert.equal((await fetch(base+'/incoming',{headers:browser})).status,204);
  assert.equal((await fetch(base+'/result',{method:'POST',headers:{...browser,'X-Cosmos-Crop':meta.cropId},body:new Uint8Array(2)})).status,400);
  assert.equal((await fetch(base+'/result',{method:'POST',headers:{...browser,'X-Cosmos-Crop':meta.cropId},body:pixels})).status,200);
  const result=await fetch(base+'/result',{headers:ps}),resultMeta=JSON.parse(decodeURIComponent(result.headers.get('X-Cosmos-Crop')));
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()),pixels);assert.equal(resultMeta.top,27);
  await fetch(base+'/result/ack',json(ps,{resultId:resultMeta.resultId}));
  assert.equal((await fetch(base+'/result',{headers:ps})).status,204);
  assert.equal((await fetch(base+'/result',{method:'POST',headers:{...browser,'X-Cosmos-Crop':'unknown'},body:pixels})).status,409);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
