import test from 'node:test';
import assert from 'node:assert/strict';
import {magnificTask,magnificOptions,precisionModel,topazModels} from '../src/magnific.mjs';
import {createMagnific,pollMagnific,readMagnific} from '../worker/magnific.mjs';
import {validConnection} from '../src/graph.mjs';
test('Precision and Topaz use distinct settings, endpoints and media types',async()=>{
 const original=globalThis.fetch,seen=[];
 try{
 globalThis.fetch=async(url,options)=>{seen.push({url,body:options.body&&JSON.parse(options.body)});return Response.json({data:{task_id:'12345678-1234-1234-1234-123456789abc',status:'COMPLETED',generated:['https://ai-statics.freepik.com/result.mp4']}});};
 const precision=magnificTask({model:precisionModel,reference:'data:image/png;base64,AAAA',upscaleFactor:'3x',creativity:10,sharpen:'25'});
 assert.equal(precision.scale_factor,3);assert.equal(precision.sharpen,25);assert.equal(precision.creativity,undefined);
 await createMagnific(precision,'test',precisionModel);assert.match(seen[0].url,/image-upscaler-precision-v2$/);
 const video=magnificTask({model:topazModels[1],reference:'https://vm.runware.ai/in.mp4',topazResolution:'4k',targetFps:'30'});
 assert.equal(video.enhancement_model,'starlight_fast_2');assert.equal(video.target_fps,30);assert.equal(video.image,undefined);
 const result=await createMagnific(video,'test',topazModels[1]);assert.equal(result.result.mediaType,'video');assert.match(seen[1].url,/video-upscaler-topaz$/);
 await pollMagnific({model:topazModels[1],metadata:JSON.stringify({providerTaskId:'12345678-1234-1234-1234-123456789abc'})},'test');assert.match(seen[2].url,/video-upscaler-topaz\//);
 assert.throws(()=>magnificOptions({model:precisionModel,sharpen:'101'}));assert.throws(()=>magnificOptions({model:topazModels[0],noise:'2'}));
 const nodes=[{id:'image',data:{kind:'image'}},{id:'video',data:{kind:'loadvideo'}},{id:'topaz',data:{kind:'upscalevideo'}}];
 assert.equal(validConnection({source:'image',target:'topaz'},nodes,[]),false);assert.equal(validConnection({source:'video',target:'topaz'},nodes,[]),true);
 }finally{globalThis.fetch=original;}
});
test('Magnific validates settings and image inputs before paid submission',()=>{
 assert.throws(()=>magnificTask({reference:'https://localhost/private.png'}));
 assert.throws(()=>magnificOptions({upscaleFactor:'32x'}));
 assert.throws(()=>magnificOptions({creativity:'11'}));
 assert.throws(()=>magnificOptions({hdr:NaN}));
 assert.equal(magnificOptions({upscaleFactor:'4x',resemblance:'7'}).resemblance,7);
 assert.equal(readMagnific({data:{status:'COMPLETED',generated:['https://evil.test/a.png']}}).state,'error');
 assert.equal(readMagnific({data:{status:'FAILED'}}).state,'error');
});
test('Magnific submits base64, polls provider task and never retries ambiguous submission',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.headers['x-magnific-api-key'],'test');if(options.method==='POST'){assert.equal(JSON.parse(options.body).image,'AAAA');return Response.json({data:{task_id:'12345678-1234-1234-1234-123456789abc',status:'IN_PROGRESS'}});}return Response.json({data:{status:'COMPLETED',generated:['https://ai-statics.freepik.com/result.jpg']}});};
  const task=magnificTask({reference:'data:image/png;base64,AAAA'});
  const submitted=await createMagnific(task,'test');assert.equal(submitted.result.state,'processing');
  const result=await pollMagnific({metadata:JSON.stringify(submitted)},'test');assert.equal(result.state,'success');assert.equal(calls,2);
  assert.equal((await pollMagnific({metadata:'{}'},'test')).state,'processing');assert.equal(calls,2);
  globalThis.fetch=async()=>{calls++;throw new Error('timeout');};
  assert.deepEqual(await createMagnific(task,'test'),{uncertain:true});assert.equal(calls,3);
 }finally{globalThis.fetch=original;}
});
