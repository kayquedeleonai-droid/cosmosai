import {safeMedia} from './runware-models.mjs';
import {withMediaReview} from './review-status.mjs';
export const historyKinds=['generate','video','upscale','upscalevideo'];
const fields=['url','mediaType','generatedModel','generatedResolution','cost','reviewStatus'];
export function readNodeHistory(value){
 if(!value)return [];
 if(typeof value!=='string'||value.length>200000)throw new Error('Histórico do node inválido.');
 const rows=JSON.parse(value);
 if(!Array.isArray(rows)||rows.length>50||rows.some(r=>!r||!safeMedia(r.url)||fields.some(k=>r[k]!=null&&typeof r[k]!=='string')||!['image','video'].includes(r.mediaType)))throw new Error('Histórico do node inválido.');
 return rows.map(r=>Object.fromEntries(fields.filter(k=>typeof r[k]==='string').map(k=>[k,r[k]])));
}
const entry=data=>({url:data.result,mediaType:data.mediaType||(['video','upscalevideo'].includes(data.kind)?'video':'image'),...Object.fromEntries(fields.slice(2).filter(k=>typeof data[k]==='string').map(k=>[k,data[k]]))});
export function nodeHistory(data){
 const rows=readNodeHistory(data.mediaHistory);
 if(!historyKinds.includes(data.kind)||!safeMedia(data.result))return rows;
 const current=entry(data),index=rows.findIndex(r=>r.url===current.url);
 if(index<0)rows.push(current);else rows[index]=current;
 return rows.slice(-50);
}
export function withNodeHistory(data,patch){
 if(patch.mediaHistory!==undefined)return {...data,...patch};
 const next=withMediaReview(data,patch);
 if(!historyKinds.includes(data.kind)||!safeMedia(patch.result)||patch.result===data.result)return next;
 const rows=nodeHistory(data),current=entry(next),index=rows.findIndex(r=>r.url===current.url);
 if(index<0)rows.push(current);else rows[index]=current;
 return {...next,mediaHistory:JSON.stringify(rows.slice(-50))};
}
export function selectHistory(data,index){
 const rows=nodeHistory(data),item=rows[index];
 if(!item)throw new Error('Resultado não encontrado.');
 return {result:item.url,mediaType:item.mediaType,generatedModel:item.generatedModel,generatedResolution:item.generatedResolution,cost:item.cost,reviewStatus:item.reviewStatus||'',mediaHistory:JSON.stringify(rows)};
}
export function mergeGenerationHistory(data,jobs){
 if(!historyKinds.includes(data.kind))return data;
 const rows=[];
 for(const job of [...jobs].reverse()){
  if(job.state!=='success'||!safeMedia(job.result?.url))continue;
  const item={url:job.result.url,mediaType:job.result.mediaType||'image',generatedModel:job.model,generatedResolution:job.metadata?.resolution,reviewStatus:'in-progress'};
  if(!rows.some(r=>r.url===item.url))rows.push(item);
 }
 for(const item of nodeHistory(data)){const index=rows.findIndex(r=>r.url===item.url);if(index<0)rows.push(item);else rows[index]=item;}
 let kept=rows.slice(-50);
 const active=rows.find(r=>r.url===data.result);
 if(active&&!kept.some(r=>r.url===active.url))kept=[active,...kept.slice(-49)];
 return kept.length?{...data,mediaHistory:JSON.stringify(kept)}:data;
}
