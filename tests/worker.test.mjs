import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../worker/index.mjs';
test('authenticated backend enforces ownership, quotas and idempotency without repeat billing',async()=>{
 const database=new DatabaseSync(':memory:');database.exec(readFileSync(new URL('../worker/schema.sql',import.meta.url),'utf8'));
 const DB={prepare(sql){return {bind(...args){return {
   async first(){return database.prepare(sql).get(...args);},
   async run(){const r=database.prepare(sql).run(...args);return {meta:{changes:r.changes}};}
 };}};}};
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='test-key';
 async function token(uid){const now=Math.floor(Date.now()/1000);const head=Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key'})).toString('base64url');const body=Buffer.from(JSON.stringify({sub:uid,aud:'cosmosai-1e2d6',iss:'https://securetoken.google.com/cosmosai-1e2d6',email_verified:true,exp:now+3600,iat:now,auth_time:now})).toString('base64url');const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(head+'.'+body));return head+'.'+body+'.'+Buffer.from(signature).toString('base64url');}
 const tokenA=await token('alice'),tokenB=await token('bob');
 const originalFetch=globalThis.fetch;let charges=0;
 globalThis.fetch=async(url,options)=>{
   if(String(url).startsWith('https://www.googleapis.com/'))return Response.json({keys:[jwk]});
   assert.equal(url,'https://api.runware.ai/v1');assert.equal(options.headers.Authorization,'Bearer secret-test');
   const [task]=JSON.parse(options.body);if(task.taskType!=='getResponse')charges++;
   return Response.json({data:[{taskUUID:task.taskUUID,status:'success',imageURL:'https://im.runware.ai/result.png'}]});
 };
 const env={DB,RUNWARE_API_KEY:'secret-test',FIREBASE_PROJECT_ID:'cosmosai-1e2d6',ALLOWED_ORIGINS:'https://aicosmos.app',USER_DAILY_UNITS:'1',GLOBAL_DAILY_UNITS:'1'};
 const call=(path,body,token=tokenA)=>worker.fetch(new Request('https://worker.test/'+path,{method:'POST',headers:{Origin:'https://aicosmos.app',Authorization:'Bearer '+token},body:JSON.stringify(body)}),env);
 try{
   const input={requestId:crypto.randomUUID(),model:'Nano Banana Pro',prompt:'A small green tree',ratio:'1:1'};
   assert.equal((await call('generate',{...input,model:'bad'})).status,400);
   assert.equal(charges,0);
   assert.equal((await (await call('generate',input)).json()).state,'success');assert.equal(charges,1);
   assert.equal((await call('generate',input)).status,200);assert.equal(charges,1);
   assert.equal((await call('generate',{...input,prompt:'A changed prompt'})).status,409);
   assert.equal((await call('status',{requestId:input.requestId},tokenB)).status,404);
   assert.equal((await call('generate',{...input,requestId:crypto.randomUUID()})).status,429);
   assert.equal((await call('generate',{...input,requestId:crypto.randomUUID()},tokenB)).status,429);
   assert.equal(charges,1);
 }finally{globalThis.fetch=originalFetch;database.close();}
});
