import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadMedia} from '../worker/media-upload.mjs';
test('upload validates media and only returns a safe provider URL',async()=>{
 const original=globalThis.fetch;
 try{
  let calls=0,bad=false;
  globalThis.fetch=async(_url,options)=>{calls++;const [task]=JSON.parse(options.body);assert.equal(task.taskType,'mediaStorage');assert.equal(task.operation,'upload');return Response.json({data:[{taskUUID:task.taskUUID,mediaURL:bad?'https://evil.test/a.mp4':'https://mm.runware.ai/a.mp4',apiKey:'private'}]});};
  await assert.rejects(uploadMedia('https://example.com/a.mp4','key'));assert.equal(calls,0);
  assert.deepEqual(await uploadMedia('data:video/mp4;base64,AAAA','key'),{url:'https://mm.runware.ai/a.mp4',mediaType:'video'});
  bad=true;await assert.rejects(uploadMedia('data:video/mp4;base64,AAAA','key'));
 }finally{globalThis.fetch=original;}
});
