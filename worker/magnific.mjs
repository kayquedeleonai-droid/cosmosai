import {isMagnificGeneration,generationEndpoint} from '../src/magnific-generation.mjs';
import {magnificEndpoint,topazModels} from '../src/magnific.mjs';
import {safeMedia} from '../src/runware-models.mjs';
const endpoint=(model,edit=false)=>'https://api.magnific.com/v1/ai/'+(isMagnificGeneration(model)?generationEndpoint(model,edit):magnificEndpoint(model));
export function readMagnific(body,model){
 const data=body?.data;
 if(['FAILED','ERROR','CANCELLED'].includes(data?.status))return {state:'error',error:'Magnific não concluiu a geração. Confira a imagem e os créditos da conta Magnific.'};
 if(data?.status==='COMPLETED'){
  const url=data.generated?.[0];
  if(!safeMedia(url))return {state:'error',error:'Magnific retornou uma mídia não reconhecida.'};
  return {state:'success',url,mediaType:topazModels.includes(model)?'video':'image'};
 }
 return {state:'processing'};
}
async function imageBase64(image){
 if(image.startsWith('data:'))return image.split(',')[1];
 if(!safeMedia(image))throw new Error('Imagem inválida.');
 // Workers supports manual/follow only. Inspect redirects without following
 // an unvalidated Location to another host.
 const response=await fetch(image,{redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(response.status>=300&&response.status<400){await response.body?.cancel();throw new Error('O endereço da imagem foi redirecionado. Carregue a imagem novamente antes de ampliar.');}
 if(!response.ok||!/^image\/(png|jpeg|webp)(;|$)/i.test(response.headers.get('content-type')||''))throw new Error('Não foi possível ler a imagem original. Use PNG, JPEG ou WebP.');
 const reader=response.body.getReader(),chunks=[];let size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>20000000){await reader.cancel();throw new Error('Use uma imagem de até 20 MB.');}chunks.push(value);}
 let binary='';for(const chunk of chunks)for(let i=0;i<chunk.length;i+=8192)binary+=String.fromCharCode(...chunk.subarray(i,i+8192));return btoa(binary);
}
export async function createMagnific(task,key,model){
 let image;try{if(!task.video&&!isMagnificGeneration(model))image=await imageBase64(task.image);}catch(error){return {result:{state:'error',error:error.message||'Não foi possível ler a imagem original.'}};}
 let response;try{response=await fetch(endpoint(model,!!task.reference_images?.length),{method:'POST',headers:{'x-magnific-api-key':key,'Content-Type':'application/json'},body:JSON.stringify(task.video||isMagnificGeneration(model)?task:{...task,image}),signal:AbortSignal.timeout(25000)});}catch{return {uncertain:true};}
 if(!response.ok){if(response.status>=500)return {uncertain:true};return {result:{state:'error',error:response.status===401||response.status===403?'Magnific recusou a chave ou o acesso à API.':response.status===402?'Créditos Magnific insuficientes.':response.status===429?'Magnific está limitando os pedidos. Aguarde antes de tentar novamente.':'Magnific recusou a imagem ou os ajustes. Confira os limites de tamanho do modelo selecionado.'}};}
 let body;try{body=await response.json();}catch{return {uncertain:true};}
 if(!/^[\w-]{1,100}$/.test(body?.data?.task_id||''))return {uncertain:true};
 return {providerTaskId:body.data.task_id,result:readMagnific(body,model)};
}
export async function pollMagnific(job,key){
 const metadata=JSON.parse(job.metadata||'{}');
 if(!metadata.providerTaskId)return {state:'processing',message:'Envio Magnific sem confirmação. Confira o histórico Magnific antes de repetir o pedido.'};
 if(!/^[\w-]{1,100}$/.test(metadata.providerTaskId))throw new Error('Tarefa Magnific inválida.');
 const response=await fetch(endpoint(job.model,metadata.hasReference)+'/'+metadata.providerTaskId,{headers:{'x-magnific-api-key':key},signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw new Error('Não foi possível consultar o Magnific. Tente consultar a pendência novamente.');
 return readMagnific(await response.json(),job.model);
}
