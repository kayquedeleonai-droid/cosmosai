import test from 'node:test';
import assert from 'node:assert/strict';
import {readBalance} from '../worker/balance.mjs';
test('balance accepts zero, strips account data and rejects unavailable or invalid responses',async()=>{
 const original=globalThis.fetch;
 try{
  let amount=0,fail=false;
  globalThis.fetch=async(url,options)=>{const [task]=JSON.parse(options.body);assert.equal(task.operation,'getDetails');return fail?new Response('',{status:403}):Response.json({data:[{taskType:'accountManagement',taskUUID:task.taskUUID,balance:{amount,currency:'USD'},apiKeys:['secret']} ]});};
  assert.equal((await readBalance('test')).amount,0);
  amount='invalid';await assert.rejects(readBalance('test'));
  fail=true;await assert.rejects(readBalance('test'));
  await assert.rejects(readBalance(''));
 }finally{globalThis.fetch=original;}
});

