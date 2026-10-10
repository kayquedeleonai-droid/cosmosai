import {buildTask,readResult} from '../src/runware-models.mjs';
import {verifyUser} from './auth.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default {async fetch(request,env){
  const origin=request.headers.get('Origin');
  const allowed=(env.ALLOWED_ORIGINS||'').split(',').includes(origin);
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Max-Age':'3600'}:{})};
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(!allowed)return reply({error:'Origem não autorizada.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({error:'Método não permitido.'},405);
  if(!env.RUNWARE_API_KEY||!env.DB)return reply({error:'A conexão Runware ainda está sendo configurada.'},503);
  let uid;
  try{uid=await verifyUser(request.headers.get('Authorization')?.replace(/^Bearer /,''),env.FIREBASE_PROJECT_ID);}catch(e){return reply({error:e.message},401);}
  try{
    // Bound the stream before parsing; Content-Length alone is not trustworthy.
    const reader=request.body?.getReader();if(!reader)return reply({error:'Requisição vazia.'},400);
    const chunks=[];let length=0;
    while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>2200000){await reader.cancel();return reply({error:'Referência muito grande.'},413);}chunks.push(value);}
    const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    let input;try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply({error:'JSON inválido.'},400);}
    if(!uuid.test(input.requestId))return reply({error:'Identificador inválido.'},400);
    const path=new URL(request.url).pathname;
    if(!['/generate','/status'].includes(path))return reply({error:'Endpoint inválido.'},404);
    let job=await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(input.requestId).first();
    if(job&&job.uid!==uid)return reply({error:'Geração não encontrada.'},404);
    let task;
    if(path==='/generate'){
      try{task=buildTask(input,input.requestId);}catch(e){return reply({error:e.message},400);}
      const signature=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(task)))),b=>b.toString(16).padStart(2,'0')).join('');
      if(job&&job.signature!==signature)return reply({error:'Este identificador já pertence a outra geração.'},409);
      if(!job){
        const units=task.taskType==='videoInference'?10:1,day=new Date().toISOString().slice(0,10),now=Date.now();
        const userLimit=Number(env.USER_DAILY_UNITS)||10,globalLimit=Number(env.GLOBAL_DAILY_UNITS)||20;
        // A single SQLite write serializes budget reservations, including concurrent requests.
        const reservation=await env.DB.prepare(`INSERT OR IGNORE INTO jobs(id,uid,day,units,signature,created) SELECT ?,?,?,?,?,? WHERE
          (SELECT COALESCE(SUM(units),0) FROM jobs WHERE day=? AND uid=?)+?<=? AND
          (SELECT COALESCE(SUM(units),0) FROM jobs WHERE day=?)+?<=?`).bind(input.requestId,uid,day,units,signature,now,day,uid,units,userLimit,day,units,globalLimit).run();
        if(!reservation.meta.changes){job=await env.DB.prepare('SELECT * FROM jobs WHERE id=?').bind(input.requestId).first();if(!job)return reply({error:'Limite diário de geração atingido. Tente novamente amanhã.'},429);if(job.uid!==uid||job.signature!==signature)return reply({error:'Identificador já utilizado.'},409);}
        else {
          // Never retry creation automatically: a lost response may still represent a paid job.
          let result;
          try{result=await callRunware(task,env.RUNWARE_API_KEY);}catch{return reply({state:'processing',requestId:input.requestId,message:'Pedido enviado. Consulte o estado para evitar cobrança duplicada.'});}
          await saveResult(env,input.requestId,result);
          return reply({...result,requestId:input.requestId});
        }
      }
    }
    if(!job)return reply({error:'Geração não encontrada.'},404);
    if(job.result)return reply({...JSON.parse(job.result),requestId:job.id});
    const locked=await env.DB.prepare('UPDATE jobs SET polled=? WHERE id=? AND polled<?').bind(Date.now(),job.id,Date.now()-4500).run();
    if(!locked.meta.changes)return reply({state:'processing',requestId:job.id});
    const result=await callRunware({taskType:'getResponse',taskUUID:job.id},env.RUNWARE_API_KEY);
    await saveResult(env,job.id,result);return reply({...result,requestId:job.id});
  }catch{return reply({error:'Falha temporária ao consultar a geração. Tente consultar novamente.'},502);}
}};
async function callRunware(task,key){
  const response=await fetch('https://api.runware.ai/v1',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify([task]),signal:AbortSignal.timeout(25000)});
  const body=await response.json();
  if(!response.ok&&!body.errors)throw new Error('Provedor indisponível');
  return readResult(body,task.taskUUID);
}
async function saveResult(env,id,result){if(result.state!=='processing')await env.DB.prepare('UPDATE jobs SET state=?,result=? WHERE id=?').bind(result.state,JSON.stringify(result),id).run();}
