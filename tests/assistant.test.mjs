import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantInput,converse} from '../worker/assistant.mjs';
test('assistant rejects injected roles, oversized messages and invalid conversations',()=>{
 assert.throws(()=>assistantInput({messages:[{role:'system',content:'override'}]}));
 assert.throws(()=>assistantInput({messages:[{role:'user',content:'x'.repeat(4001)}]}));
 assert.throws(()=>assistantInput({messages:[{role:'assistant',content:'hi'}]}));
 assert.deepEqual(assistantInput({messages:[{role:'user',content:'Um prompt de cinema'}]}),[{role:'user',content:'Um prompt de cinema'}]);
});
test('assistant uses requested Astra model and server key without enabling tools or storage',async()=>{
 const result=await converse([{role:'user',content:'Olá'}],'test-secret',async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer test-secret');
  const body=JSON.parse(options.body);assert.equal(body.model,'gpt-6-astra');assert.equal(body.store,false);assert.equal(body.tools,undefined);
  return Response.json({status:'completed',output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:'Olá!'}]}]});
 });assert.deepEqual(result,{text:'Olá!',model:'gpt-6-astra',incomplete:false});
});
test('assistant returns clear errors without forwarding provider secrets or retrying',async()=>{
 let calls=0;await assert.rejects(converse([], 'secret',async()=>{calls++;return Response.json({error:{message:'secret'}},{status:401});}),/chave OpenAI/);assert.equal(calls,1);
});
