import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../worker/index.mjs';
test('authenticated backend enforces ownership, quotas and idempotency without repeat billing',async()=>{
 const database=new DatabaseSync(':memory:');database.exec(readFileSync(new URL('../worker/schema.sql',import.meta.url),'utf8'));
 const DB={prepare(sql){const stmt={args:[],bind(...args){this.args=args;return this;},async first(){return database.prepare(sql).get(...this.args);},async all(){return {results:database.prepare(sql).all(...this.args)};},async run(){const r=database.prepare(sql).run(...this.args);return {meta:{changes:r.changes}};}};return stmt;}};
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='test-key';
 async function token(uid){const now=Math.floor(Date.now()/1000);const head=Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key'})).toString('base64url');const body=Buffer.from(JSON.stringify({sub:uid,aud:'cosmosai-1e2d6',iss:'https://securetoken.google.com/cosmosai-1e2d6',email_verified:true,exp:now+3600,iat:now,auth_time:now})).toString('base64url');const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(head+'.'+body));return head+'.'+body+'.'+Buffer.from(signature).toString('base64url');}
 const tokenA=await token('alice'),tokenB=await token('bob');
 const originalFetch=globalThis.fetch;let charges=0,pendingOnce=false;
 globalThis.fetch=async(url,options)=>{
   if(String(url).startsWith('https://www.googleapis.com/'))return Response.json({keys:[jwk]});
   if(String(url).startsWith('https://api.magnific.com/')){assert.equal(options.headers['x-magnific-api-key'],'magnific-test');if(options.method==='POST'){charges++;return Response.json({data:{task_id:'12345678-1234-1234-1234-123456789abc',status:'IN_PROGRESS'}});}return Response.json({data:{status:'COMPLETED',generated:['https://ai-statics.freepik.com/upscaled.jpg']}});}
   assert.equal(url,'https://api.runware.ai/v1');assert.equal(options.headers.Authorization,'Bearer secret-test');
   const [task]=JSON.parse(options.body);
   if(task.taskType==='accountManagement')return Response.json({data:[{taskType:task.taskType,taskUUID:task.taskUUID,balance:{amount:12.34,currency:'USD',freeBalance:1},team:[{email:'private@example.com'}],apiKeys:[{apiKey:'must-never-leak'}]}]});
   if(task.taskType!=='getResponse')charges++;
   if(pendingOnce&&task.taskType!=='getResponse'){pendingOnce=false;return Response.json({data:[{taskUUID:task.taskUUID,status:'processing'}]});}
   return Response.json({data:[{taskUUID:task.taskUUID,status:'success',imageURL:'https://im.runware.ai/result.png'}]});
 };
 const env={ADMIN_UID:'alice',DB,RUNWARE_API_KEY:'secret-test',FIREBASE_PROJECT_ID:'cosmosai-1e2d6',ALLOWED_ORIGINS:'https://aicosmos.app',USER_DAILY_UNITS:'1',GLOBAL_DAILY_UNITS:'1'};
 const call=(path,body,token=tokenA)=>worker.fetch(new Request('https://worker.test/'+path,{method:'POST',headers:{Origin:'https://aicosmos.app',Authorization:'Bearer '+token},body:JSON.stringify(body)}),env);
 try{
   const input={requestId:crypto.randomUUID(),model:'Nano Banana Pro',prompt:'A small green tree',ratio:'1:1'};
   assert.equal((await call('generate',{...input,model:'bad'})).status,400);
   assert.equal(charges,0);
   assert.equal((await (await call('generate',input)).json()).state,'success');assert.equal(charges,1);
   assert.equal((await call('generate',input)).status,200);assert.equal(charges,1);
   assert.equal((await call('generate',{...input,prompt:'A changed prompt'})).status,409);
   assert.equal((await call('status',{requestId:input.requestId},tokenB)).status,404);
   env.ADMIN_UID='owner';
   assert.equal((await call('generate',{...input,requestId:crypto.randomUUID(),isAdmin:true})).status,429);
   env.ADMIN_UID='alice';
   assert.equal((await call('generate',{...input,requestId:crypto.randomUUID()},tokenB)).status,403);
   assert.equal(charges,1);
   assert.equal((await call('admin/users',{},tokenB)).status,403);
   assert.equal((await call('media-upload',{media:'data:video/mp4;base64,AAAA'},tokenB)).status,403);
   assert.equal((await call('media-upload',{media:'https://example.com/private.mp4'})).status,400);
   assert.equal((await call('admin/balance',{},tokenB)).status,403);
   const balance=await (await call('admin/balance',{})).json();
   assert.equal(balance.amount,12.34);assert.equal(balance.currency,'USD');assert.equal(balance.freeBalance,1);
   assert.deepEqual(Object.keys(balance).sort(),['amount','currency','freeBalance','updatedAt']);
   assert.equal((await call('admin/account',{uid:'alice',status:'blocked',daily_usd:2})).status,400);
   assert.equal((await call('admin/account',{uid:'bob',status:'active',daily_usd:0})).status,200);
   assert.equal((await call('admin/settings',{daily_usd:10,paused:true})).status,200);
   assert.equal((await call('generate',{...input,requestId:crypto.randomUUID()},tokenB)).status,429);
   assert.equal((await (await call('history',{},tokenB)).json()).jobs.length,0);
   assert.equal((await (await call('history',{})).json()).jobs.length,1);
   assert.equal((await (await call('me',{})).json()).isAdmin,true);
   assert.equal((await (await call('me',{},tokenB)).json()).isAdmin,false);
   assert.equal((await call('admin/account',{uid:'bob',status:'active',daily_usd:-1})).status,400);
   assert.equal(charges,1);
   env.USER_DAILY_UNITS='1000';env.GLOBAL_DAILY_UNITS='1000';
   await call('admin/settings',{daily_usd:10,paused:false});
   await call('admin/account',{uid:'bob',status:'active',daily_usd:.2});
   const racing=await Promise.all([call('generate',{...input,requestId:crypto.randomUUID()},tokenB),call('generate',{...input,requestId:crypto.randomUUID()},tokenB)]);
   assert.deepEqual(racing.map(r=>r.status).sort(),[200,429]);
   assert.equal(charges,2);
   await call('admin/account',{uid:'bob',status:'blocked',daily_usd:10});
   assert.equal((await call('generate',{...input,requestId:crypto.randomUUID()},tokenB)).status,403);
   assert.equal((await call('admin/users',{isAdmin:true},tokenB)).status,403);
   pendingOnce=true;const recoveryId=crypto.randomUUID();
   assert.equal((await (await call('generate',{...input,requestId:recoveryId})).json()).state,'processing');
   let background;await worker.scheduled({},env,{waitUntil(p){background=p;}});await background;
   assert.equal((await (await call('status',{requestId:recoveryId})).json()).state,'success');
   assert.equal(charges,3);

   env.MAGNIFIC_API_KEY='magnific-test';
   const upscale={requestId:crypto.randomUUID(),model:'Magnific Creative',reference:'data:image/png;base64,AAAA',upscaleFactor:'2x'};
   const beforeMagnific=charges;
   assert.equal((await call('generate',upscale,tokenB)).status,403);
   assert.equal((await (await call('generate',upscale)).json()).state,'processing');
   assert.equal(charges,beforeMagnific+1);
   assert.equal((await (await call('status',{requestId:upscale.requestId})).json()).state,'success');
   assert.equal((await call('generate',upscale)).status,200);assert.equal(charges,beforeMagnific+1);
   assert.equal((await call('generate',{...upscale,upscaleFactor:'4x'})).status,409);
   assert.equal((await call('status',{requestId:upscale.requestId},tokenB)).status,404);

   // The verified owner can generate beyond quantity and monetary caps.
   env.USER_DAILY_UNITS='1';env.GLOBAL_DAILY_UNITS='1';
   await call('admin/settings',{daily_usd:0,paused:false});
   await call('admin/account',{uid:'alice',status:'active',daily_usd:0});
   const video={requestId:crypto.randomUUID(),model:'Seedance 2.5',prompt:'A tree in the wind',ratio:'16:9',resolution:'720p',duration:4};
   assert.equal((await call('generate',video)).status,200);
   assert.equal((await call('generate',video)).status,200);assert.equal(charges,5);
   assert.equal((await call('generate',{...video,requestId:crypto.randomUUID()})).status,200);assert.equal(charges,6);
   await call('admin/account',{uid:'bob',status:'active',daily_usd:10});
   assert.equal((await call('generate',{...video,requestId:crypto.randomUUID(),isAdmin:true},tokenB)).status,429);
   await call('admin/settings',{daily_usd:0,paused:true});
   assert.equal((await call('generate',{...video,requestId:crypto.randomUUID()})).status,429);
   assert.equal(charges,6);

   await call('admin/settings',{daily_usd:0,paused:false});
   const previousFetch=globalThis.fetch;
   globalThis.fetch=async(url,options)=>{if(String(url).startsWith('https://api.runware.ai'))throw new Error('Runware must not be called for migrated models');return previousFetch(url,options);};
   delete env.RUNWARE_API_KEY;
   for(const model of ['GPT Image 2.5 Flare','GPT Image 2.5 Sunburst','Seedream 5.0 Pro']){
     const request={requestId:crypto.randomUUID(),model,prompt:'A blue vase',ratio:'1:1',resolution:'2K',references:['data:image/png;base64,AAAA']};
     assert.equal((await (await call('generate',request)).json()).state,'processing');
     assert.equal((await (await call('status',{requestId:request.requestId})).json()).state,'success');
     assert.equal((await call('generate',request)).status,200);
   }
   assert.equal(charges,9);
 }finally{globalThis.fetch=originalFetch;database.close();}
});

