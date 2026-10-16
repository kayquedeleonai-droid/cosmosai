import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {isLocalMedia,readLocalMedia} from '../src/local-media.mjs';
import {mediaBlob} from '../src/media-download.mjs';
import {nodeImage} from '../src/workflow-cover.mjs';
const src='/__cosmos_media/12345678-1234-1234-1234-123456789012';
test('local references preview and download original bytes without a network request',async()=>{
 const old=globalThis.caches,fetchOld=globalThis.fetch;
 globalThis.fetch=()=>assert.fail('Local media must not use network');
 globalThis.caches={open:async()=>({match:async key=>key===src?new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}}):undefined})};
 try{
 assert.ok(isLocalMedia(src));assert.equal(isLocalMedia('https://evil.test'+src),false);
 assert.equal(nodeImage({data:{kind:'image',result:src}}),src);
 const result=await mediaBlob(src);assert.deepEqual([...new Uint8Array(await result.blob.arrayBuffer())],[1,2,3]);
 await assert.rejects(()=>readLocalMedia(src.replace('12345678','87654321')),/outro dispositivo/);
 }finally{globalThis.caches=old;globalThis.fetch=fetchOld;}
});
test('service worker serves local media offline and never falls through to network when missing',async()=>{
 const handlers={},bytes=new Response('original',{headers:{'Content-Type':'image/png'}});
 const code=(await readFile('scripts/sw-template.js','utf8')).replace('__VERSION__','test').replace('__ASSETS__','[]');
 vm.runInNewContext(code,{URL,Response,caches:{open:async()=>({match:async key=>key===src?bytes:undefined})},fetch:()=>assert.fail('No network allowed'),self:{location:{origin:'https://aicosmos.app'},addEventListener:(type,fn)=>handlers[type]=fn}});
 for(const [path,status] of [[src,200],[src.replace('12345678','87654321'),404]]){
 let response;handlers.fetch({request:{url:'https://aicosmos.app'+path,method:'GET'},respondWith:p=>response=p});assert.equal((await response).status,status);
 }
});
