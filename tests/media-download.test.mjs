import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaBlob,downloadMedia} from '../src/media-download.mjs';

test('image and video downloads preserve bytes and actual file types',async t=>{
 for(const [type,video,ext] of [['image/jpeg',false,'jpg'],['video/mp4',true,'mp4'],['image/webp',false,'webp']]){
  t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':type}}));
  const result=await mediaBlob('https://im.runware.ai/media',video);
  assert.equal(result.filename,`cosmos-${video?'video':'imagem'}.${ext}`);assert.deepEqual([...new Uint8Array(await result.blob.arrayBuffer())],[1,2,3]);t.mock.restoreAll();
 }
});
test('download errors reject expired, empty or non-media responses',async t=>{
 for(const response of [new Response('expired',{status:404}),new Response(''),new Response('<html>Error</html>',{headers:{'Content-Type':'text/html'}})]){
  t.mock.method(globalThis,'fetch',async()=>response);await assert.rejects(()=>mediaBlob('https://vm.runware.ai/video.mp4',true));t.mock.restoreAll();
 }
 await assert.rejects(()=>mediaBlob('https://evil.test/media'));
});
test('downloads use a local blob attachment without navigating or opening tabs',async t=>{
 const anchor={style:{},click(){assert.equal(this.href,'blob:test');assert.equal(this.download,'cosmos-video.mp4');assert.equal(this.target,undefined);},remove(){}};
 t.mock.method(globalThis,'fetch',async()=>new Response('video',{headers:{'Content-Type':'video/mp4'}}));
 t.mock.method(URL,'createObjectURL',()=> 'blob:test');t.mock.method(URL,'revokeObjectURL',()=>{});
 t.mock.method(globalThis,'setTimeout',fn=>{fn();return 0;});
 const previous=globalThis.document;globalThis.document={createElement:()=>anchor,body:{appendChild(){}}};
 try{await downloadMedia('https://vm.runware.ai/test.mp4',true);}finally{globalThis.document=previous;}
});
