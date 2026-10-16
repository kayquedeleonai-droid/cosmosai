import {isMagnificModel,magnificTask} from '../src/magnific.mjs';
import {createMagnific,pollMagnific} from './magnific.mjs';
import {buildTask,readResult} from '../src/runware-models.mjs';
import {estimateCost} from '../src/pricing.mjs';
import {verifyIdentity} from './auth.mjs';
import {readBalance} from './balance.mjs';
import {uploadMedia} from './media-upload.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const spent="CASE WHEN actual IS NOT NULL THEN actual ELSE reserved END";
const day=()=>new Date().toISOString().slice(0,10);
export default {
 async scheduled(event,env,ctx){ctx.waitUntil(recoverJobs(env));},
 async fetch(request,env){
  const origin=request.headers.get('Origin'),allowed=(env.ALLOWED_ORIGINS||'').split(',').includes(origin);
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Max-Age':'3600'}:{})};
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(!allowed)return reply({error:'Origem não autorizada.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({error:'Método não permitido.'},405);
  if(!env.DB)return reply({error:'Serviço indisponível.'},503);
  let identity;
  try{identity=await verifyIdentity(request.headers.get('Authorization')?.replace(/^Bearer /,''),env.FIREBASE_PROJECT_ID);}catch(e){return reply({error:e.message},401);}
  const {uid}=identity,isAdmin=uid===env.ADMIN_UID&&identity.verified;
  try{
   const reader=request.body?.getReader();if(!reader)return reply({error:'Requisição vazia.'},400);
   const chunks=[];let length=0;
   while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>33000000){await reader.cancel();return reply({error:'Referência muito grande.'},413);}chunks.push(value);}
   const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
   let input;try{input=JSON.parse(new TextDecoder().decode(bytes));if(!input||typeof input!=='object'||Array.isArray(input))throw 0;}catch{return reply({error:'JSON inválido.'},400);}
   const path=new URL(request.url).pathname;
   let account=await env.DB.prepare('SELECT * FROM accounts WHERE uid=?').bind(uid).first();
   if(!account||path==='/me'){
    await env.DB.prepare("INSERT INTO accounts(uid,email,name,status,created,last_seen) VALUES(?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET email=excluded.email,name=excluded.name,last_seen=excluded.last_seen").bind(uid,identity.email.slice(0,320),identity.name.slice(0,120),isAdmin?'active':'pending',Date.now(),Date.now()).run();
    account=await env.DB.prepare('SELECT * FROM accounts WHERE uid=?').bind(uid).first();
   }
   if(path==='/me')return reply({account,isAdmin,verified:identity.verified,storage:false});
   if(path==='/media-upload'){
    if(!identity.verified||account.status!=='active')return reply({error:'Sua conta precisa estar verificada e aprovada para enviar arquivos.'},403);
    if(!env.RUNWARE_API_KEY)return reply({error:'Runware indisponível.'},503);
    try{return reply(await uploadMedia(input.media,env.RUNWARE_API_KEY));}catch(error){return reply({error:error.message||'Falha no upload.'},400);}
   }
   if(path.startsWith('/admin/')){
    if(!isAdmin)return reply({error:'Acesso exclusivo do administrador.'},403);
    if(path==='/admin/balance'){
     try{return reply(await readBalance(env.RUNWARE_API_KEY));}catch(error){const message=error.name==='TimeoutError'?'Runware demorou para responder à consulta de saldo.':error.message||'Saldo Runware indisponível.';console.warn('runware_balance_failed',message);return reply({error:message},502);}
    }
    if(path==='/admin/users'){
     const offset=Number.isInteger(input.offset)&&input.offset>=0?Math.min(input.offset,100000):0;
     const users=await env.DB.prepare(`SELECT a.*, (SELECT COALESCE(SUM(${spent}),0) FROM jobs j WHERE j.uid=a.uid AND j.day=?) AS today_usd,(SELECT COUNT(*) FROM jobs j WHERE j.uid=a.uid) AS generations FROM accounts a ORDER BY created DESC,uid LIMIT 50 OFFSET ?`).bind(day(),offset).all();
     const settings=await env.DB.prepare('SELECT * FROM settings WHERE id=1').first();
     const total=await env.DB.prepare('SELECT COUNT(*) AS count FROM accounts').first();
     const usage=await env.DB.prepare(`SELECT COALESCE(SUM(actual),0) AS actual_usd,COALESCE(SUM(${spent}),0) AS committed_usd,COUNT(*) AS jobs FROM jobs WHERE day=?`).bind(day()).first();
     return reply({users:users.results,total:total.count,settings,usage});
    }
    if(path==='/admin/account'){
     if(typeof input.uid!=='string'||!['active','pending','blocked'].includes(input.status)||typeof input.daily_usd!=='number'||!Number.isFinite(input.daily_usd)||input.daily_usd<0||input.daily_usd>1000)return reply({error:'Configuração inválida.'},400);
     if(input.uid===env.ADMIN_UID&&input.status!=='active')return reply({error:'A conta proprietária não pode ser bloqueada.'},400);
     const changed=await env.DB.prepare('UPDATE accounts SET status=?,daily_usd=? WHERE uid=?').bind(input.status,input.daily_usd,input.uid).run();
     if(!changed.meta.changes)return reply({error:'Conta não encontrada.'},404);
     await audit(env,uid,input.uid,JSON.stringify({status:input.status,daily_usd:input.daily_usd}));
     return reply({ok:true});
    }
    if(path==='/admin/settings'){
     if(typeof input.daily_usd!=='number'||!Number.isFinite(input.daily_usd)||input.daily_usd<0||input.daily_usd>10000||typeof input.paused!=='boolean')return reply({error:'Configuração inválida.'},400);
     await env.DB.prepare('UPDATE settings SET daily_usd=?,paused=? WHERE id=1').bind(input.daily_usd,Number(input.paused)).run();
     await audit(env,uid,'global',JSON.stringify(input));return reply({ok:true});
    }
    return reply({error:'Endpoint inválido.'},404);
   }
   if(path==='/history'){
    const offset=Number.isInteger(input.offset)&&input.offset>=0?Math.min(input.offset,100000):0;
    const jobs=await env.DB.prepare('SELECT id,state,result,created,model,metadata,reserved,actual,projectId,nodeId FROM jobs WHERE uid=? ORDER BY created DESC LIMIT 30 OFFSET ?').bind(uid,offset).all();
    return reply({jobs:jobs.results.map(j=>({...j,result:j.result?JSON.parse(j.result):null,metadata:j.metadata?JSON.parse(j.metadata):null}))});
   }
   if(!['/generate','/status'].includes(path))return reply({error:'Endpoint inválido.'},404);
   if(!uuid.test(input.requestId))return reply({error:'Identificador inválido.'},400);
   let job=await env.DB.prepare('SELECT * FROM jobs WHERE id=?').bind(input.requestId).first();
   if(job&&job.uid!==uid)return reply({error:'Geração não encontrada.'},404);
   const isMagnific=isMagnificModel(job?.model||input.model);
   if(isMagnific&&!isAdmin)return reply({error:'O Magnific está disponível para a conta proprietária.'},403);
   if(!(isMagnific?env.MAGNIFIC_API_KEY:env.RUNWARE_API_KEY))return reply({error:'Provedor não configurado.'},503);
   if(path==='/generate'){
    if(!identity.verified||(!isAdmin&&account.status!=='active'))return reply({error:!identity.verified?'Verifique seu e-mail para gerar.':account.status==='blocked'?'Gerações bloqueadas pelo administrador.':'Sua conta aguarda aprovação do administrador.'},403);
    let task,quote;try{task=isMagnific?magnificTask(input):buildTask(input,input.requestId);quote=isMagnific?{usd:null,reserve:0}:estimateCost(input);}catch(e){return reply({error:e.message},400);}
    const signature=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(task)))),b=>b.toString(16).padStart(2,'0')).join('');
    if(job&&job.signature!==signature)return reply({error:'Este identificador já pertence a outra geração.'},409);
    if(!job){
     const units=task.taskType==='videoInference'?10:1,now=Date.now(),today=day();
     const metadata=JSON.stringify({prompt:input.prompt,ratio:input.ratio,resolution:input.resolution,quality:input.quality,duration:input.duration,hasReference:!!input.reference||!!input.references?.length,estimated:quote.usd});
     const reservation=await env.DB.prepare(`INSERT OR IGNORE INTO jobs(id,uid,day,units,signature,created,reserved,model,metadata,projectId,nodeId) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE
      (SELECT paused FROM settings WHERE id=1)=0 AND (SELECT status FROM accounts WHERE uid=?)='active' AND (?=1 OR (
      (SELECT COALESCE(SUM(units),0) FROM jobs WHERE day=? AND uid=?)+?<=? AND
      (SELECT COALESCE(SUM(units),0) FROM jobs WHERE day=?)+?<=? AND
      (SELECT COALESCE(SUM(${spent}),0) FROM jobs WHERE day=? AND uid=?)+?<=(SELECT daily_usd FROM accounts WHERE uid=?) AND
      (SELECT COALESCE(SUM(${spent}),0) FROM jobs WHERE day=?)+?<=(SELECT daily_usd FROM settings WHERE id=1)))`).bind(input.requestId,uid,today,units,signature,now,quote.reserve,input.model,metadata,typeof input.projectId==='string'?input.projectId.slice(0,80):null,typeof input.nodeId==='string'?input.nodeId.slice(0,100):null,uid,Number(isAdmin),today,uid,units,Number(env.USER_DAILY_UNITS)||10,today,units,Number(env.GLOBAL_DAILY_UNITS)||20,today,uid,quote.reserve,uid,today,quote.reserve).run();
     if(!reservation.meta.changes){job=await env.DB.prepare('SELECT * FROM jobs WHERE id=?').bind(input.requestId).first();if(!job)return reply({error:'Geração pausada ou limite diário atingido (orçamento ou quantidade). Consulte o administrador. Limites renovam às 00h UTC.'},429);if(job.uid!==uid||job.signature!==signature)return reply({error:'Identificador já utilizado.'},409);}
     else{
      let result;try{
       if(isMagnific){const submitted=await createMagnific(task,env.MAGNIFIC_API_KEY,input.model);
        if(submitted.providerTaskId)await env.DB.prepare('UPDATE jobs SET metadata=? WHERE id=?').bind(JSON.stringify({...JSON.parse(metadata),providerTaskId:submitted.providerTaskId,provider:'magnific'}),input.requestId).run();
        result=submitted.result||{state:'processing',message:'Envio Magnific sem confirmação. Consulte a pendência; não reenvie.'};
       }else result=await callRunware(task,env.RUNWARE_API_KEY);
      }catch{return reply({state:'processing',requestId:input.requestId,message:'Pedido enviado. Consulte o estado para evitar cobrança duplicada.'});}
      await saveResult(env,input.requestId,result);return reply({...result,requestId:input.requestId});
     }
    }
   }
   if(!job)return reply({error:'Geração não encontrada.'},404);
   if(job.result)return reply({...JSON.parse(job.result),requestId:job.id});
   const result=await pollJob(env,job);return reply({...result,requestId:job.id});
  }catch{return reply({error:'Falha temporária. Tente consultar novamente; não reenvie uma geração pendente.'},502);}
 }
};
async function audit(env,actor,target,action){await env.DB.prepare('INSERT INTO audit(actor,target,action,created) VALUES(?,?,?,?)').bind(actor,target,action,Date.now()).run();}
async function callRunware(task,key){
 const response=await fetch('https://api.runware.ai/v1',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify([task]),signal:AbortSignal.timeout(25000)});
 const body=await response.json();if(!response.ok&&!body.errors)throw new Error('Provedor indisponível');return readResult(body,task.taskUUID);
}
async function pollJob(env,job){
 const locked=await env.DB.prepare('UPDATE jobs SET polled=? WHERE id=? AND polled<? AND state=?').bind(Date.now(),job.id,Date.now()-4500,'processing').run();
 if(!locked.meta.changes)return {state:'processing'};
 const result=isMagnificModel(job.model)?await pollMagnific(job,env.MAGNIFIC_API_KEY):await callRunware({taskType:'getResponse',taskUUID:job.id},env.RUNWARE_API_KEY);await saveResult(env,job.id,result);return result;
}
async function saveResult(env,id,result){
 if(result.state==='processing')return;
 const cost=Number.isFinite(result.cost)&&result.cost>=0?result.cost:result.state==='error'?0:null;
 await env.DB.prepare('UPDATE jobs SET state=?,result=?,actual=? WHERE id=?').bind(result.state,JSON.stringify(result),cost,id).run();
}
async function recoverJobs(env){
 const jobs=await env.DB.prepare("SELECT * FROM jobs WHERE state='processing' AND created>? ORDER BY polled ASC LIMIT 10").bind(Date.now()-48*3600000).all();
 for(const job of jobs.results){try{await pollJob(env,job);}catch{/* Retry polling only, never creation. */}}
}

