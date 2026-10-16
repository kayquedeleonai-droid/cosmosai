export const LOCAL_MEDIA_CACHE='cosmos-local-media-v1';
export const isLocalMedia=value=>typeof value==='string'&&/^\/__cosmos_media\/[0-9a-f-]{36}$/.test(value);
export async function readLocalMedia(src){
 if(!isLocalMedia(src))throw new Error('Arquivo local inválido.');
 const response=await (await caches.open(LOCAL_MEDIA_CACHE)).match(src);
 if(!response)throw new Error('Esta mídia está em outro dispositivo ou foi removida do navegador. Carregue o arquivo novamente.');
 return response.blob();
}
export async function saveLocalMedia(file){
 if(!navigator.serviceWorker?.controller)throw new Error('Atualize o Cosmos para ativar a importação local.');
 // Verify that the controlling worker can serve local files before storing one.
 await new Promise((resolve,reject)=>{
  const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(new Error('Clique em Atualizar agora no Cosmos para ativar a importação local.'));},3000);
  channel.port1.onmessage=()=>{clearTimeout(timer);channel.port1.close();resolve();};
  navigator.serviceWorker.controller.postMessage({type:'LOCAL_MEDIA_READY'},[channel.port2]);
 });
 const src='/__cosmos_media/'+crypto.randomUUID();
 try{await (await caches.open(LOCAL_MEDIA_CACHE)).put(src,new Response(file,{headers:{'Content-Type':file.type,'Cache-Control':'no-store'}}));}
 catch{throw new Error('Não há espaço para guardar este arquivo no dispositivo.');}
 return src;
}
export async function localMediaData(src){
 const blob=await readLocalMedia(src);
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Não foi possível ler a mídia local.'));reader.readAsDataURL(blob);});
}
