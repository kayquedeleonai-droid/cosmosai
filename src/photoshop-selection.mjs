import {mediaBlob} from './media-download.mjs';
import {readCrop} from './photoshop-crop.mjs';
export {readCrop};
export function sourceCrop(id,nodes,edges,inputsOnly=false){
 const found=new Map(),seen=new Set();
 function visit(key){
  if(seen.has(key))return;seen.add(key);const node=nodes.find(n=>n.id===key);if(!node)return;
  if(node.data.psCrop){const crop=readCrop(node.data.psCrop);found.set(crop.cropId,crop);return;}
  for(const edge of edges.filter(e=>e.target===key))visit(edge.source);
 }
 if(inputsOnly)for(const edge of edges.filter(e=>e.target===id))visit(edge.source);else visit(id);
 if(found.size>1)throw new Error('Esta imagem tem referências de recortes diferentes. Use um único recorte Photoshop para definir o destino.');
 return found.size?JSON.stringify([...found.values()][0]):undefined;
}
const base='http://127.0.0.1:48880';
let connection=null;
export function setPhotoshopConnection(value){connection=value;}
export async function bridgeRequest(config,path,options={}){
 const response=await fetch(base+path,{...options,headers:{'X-Cosmos-Key':config.key,'X-Cosmos-Client':config.client,...options.headers},signal:AbortSignal.timeout(60000)});
 if(!response.ok){let error;try{error=(await response.json()).error;}catch{}throw new Error(error||'Conector Photoshop indisponível.');}return response;
}
export async function sendPhotoshopResult(src,origin){
 const config=connection;if(!config)throw new Error('Conecte o Photoshop pelo botão no topo do workflow.');
 if(!origin)throw new Error('Esta imagem não está ligada a uma seleção Photoshop. Conecte o Load Image enviado pelo plugin como referência.');
 const crop=readCrop(origin);if(crop.projectId!==config.projectId)throw new Error('O recorte pertence a outro workflow.');
 const {blob}=await mediaBlob(src);const bitmap=await createImageBitmap(blob);
 try{
  if(Math.abs((bitmap.width/bitmap.height)/(crop.width/crop.height)-1)>.02)throw new Error('A proporção mudou. Gere com a mesma proporção do recorte para retornar sem distorcer.');
  const canvas=document.createElement('canvas');canvas.width=crop.width;canvas.height=crop.height;
  const context=canvas.getContext('2d');if(!context)throw new Error('Não foi possível preparar os pixels.');
  context.drawImage(bitmap,0,0,crop.width,crop.height);
  const pixels=context.getImageData(0,0,crop.width,crop.height).data;
  await bridgeRequest(config,'/result',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Cosmos-Crop':crop.cropId},body:pixels.buffer});
 }finally{bitmap.close();}
}
