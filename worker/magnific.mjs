import {safeMedia} from '../src/runware-models.mjs';
const endpoint='https://api.magnific.com/v1/ai/image-upscaler';
export function readMagnific(body){
 const data=body?.data;
 if(['FAILED','ERROR','CANCELLED'].includes(data?.status))return {state:'error',error:'Magnific não concluiu o upscale. Confira a imagem e os créditos da conta Magnific.'};
 if(data?.status==='COMPLETED'){
  const url=data.generated?.[0];
  if(!safeMedia(url))return {state:'error',error:'Magnific retornou uma mídia não reconhecida.'};
  return {state:'success',url,mediaType:'image'};
 }
 return {state:'processing'};
}
async function imageBase64(image){
 if(image.startsWith('data:'))return image.split(',')[1];
 if(!safeMedia(image))throw new Error('Imagem inválida.');
 const response=await fetch(image,{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok||!/^image\/(png|jpeg|webp)(;|$)/i.test(response.headers.get('content-type')||''))throw new Error('Não foi possível ler a imagem original. Use PNG, JPEG ou WebP.');
 const reader=response.body.getReader(),chunks=[];let size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>20000000){await reader.cancel();throw new Error('Use uma imagem de até 20 MB.');}chunks.push(value);}
 let binary='';for(const chunk of chunks)for(let i=0;i<chunk.length;i+=8192)binary+=String.fromCharCode(...chunk.subarray(i,i+8192));return btoa(binary);
}
export async function createMagnific(task,key){
 let image;try{image=await imageBase64(task.image);}catch(error){return {result:{state:'error',error:error.message||'Não foi possível ler a imagem original.'}};}
 let response;try{response=await fetch(endpoint,{method:'POST',headers:{'x-magnific-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({...task,image}),signal:AbortSignal.timeout(25000)});}catch{return {uncertain:true};}
 if(!response.ok){if(response.status>=500)return {uncertain:true};return {result:{state:'error',error:response.status===401||response.status===403?'Magnific recusou a chave ou o acesso à API.':response.status===402?'Créditos Magnific insuficientes.':response.status===429?'Magnific está limitando os pedidos. Aguarde antes de tentar novamente.':'Magnific recusou a imagem ou os ajustes. A saída deve ter no máximo 25,3 megapixels.'}};}
 let body;try{body=await response.json();}catch{return {uncertain:true};}
 if(!/^[\w-]{1,100}$/.test(body?.data?.task_id||''))return {uncertain:true};
 return {providerTaskId:body.data.task_id,result:readMagnific(body)};
}
export async function pollMagnific(job,key){
 const metadata=JSON.parse(job.metadata||'{}');
 if(!metadata.providerTaskId)return {state:'processing',message:'Envio Magnific sem confirmação. Confira o histórico Magnific antes de repetir o pedido.'};
 if(!/^[\w-]{1,100}$/.test(metadata.providerTaskId))throw new Error('Tarefa Magnific inválida.');
 const response=await fetch(endpoint+'/'+metadata.providerTaskId,{headers:{'x-magnific-api-key':key},signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw new Error('Não foi possível consultar o Magnific. Tente consultar a pendência novamente.');
 return readMagnific(await response.json());
}
