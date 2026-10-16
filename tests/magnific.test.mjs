import test from 'node:test';
import assert from 'node:assert/strict';
import {magnificTask,magnificOptions} from '../src/magnific.mjs';
import {createMagnific,pollMagnific,readMagnific} from '../worker/magnific.mjs';
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
