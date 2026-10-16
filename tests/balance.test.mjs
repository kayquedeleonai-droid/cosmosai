import test from 'node:test';
import assert from 'node:assert/strict';
import {readBalance} from '../worker/balance.mjs';
test('balance accepts zero, strips account data and rejects unavailable or invalid responses',async()=>{
 const original=globalThis.fetch;
 try{
  let amount=0,fail=false;
  globalThis.fetch=async(url,options)=>{const [task]=JSON.parse(options.body);assert.equal(task.operation,'getDetails');return fail?new Response('',{status:403}):Response.json({data:[{taskType:'accountManagement',taskUUID:task.taskUUID,balance:{amount,currency:'USD'},apiKeys:['secret']} ]});};
  assert.equal((await readBalance('test')).amount,0);
  amount='12.50';assert.equal((await readBalance('test')).amount,12.5);
  amount='invalid';await assert.rejects(readBalance('test'));
  fail=true;await assert.rejects(readBalance('test'),/não tem acesso/);
  await assert.rejects(readBalance(''));
 }finally{globalThis.fetch=original;}
});

test('live scalar balance format preserves USD amounts, including zero, without account metadata',async()=>{
 const original=globalThis.fetch;
 try{
  let balance=7.125;
  globalThis.fetch=async(_url,options)=>{const [task]=JSON.parse(options.body);return Response.json({data:[{...task,balance,organizationName:'Private',apiKeys:['secret']}]});};
  const result=await readBalance('test');assert.equal(result.amount,7.125);assert.equal(result.currency,'USD');assert.deepEqual(Object.keys(result).sort(),['amount','currency','updatedAt']);
  balance=0;assert.equal((await readBalance('test')).amount,0);
  balance='4.25';assert.equal((await readBalance('test')).amount,4.25);
  for(const invalid of [null,true,'',{},'invalid']){balance=invalid;await assert.rejects(readBalance('test'),/formato/);}
 }finally{globalThis.fetch=original;}
});

