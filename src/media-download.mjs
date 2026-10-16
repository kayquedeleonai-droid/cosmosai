import {isLocalMedia,readLocalMedia} from './local-media.mjs';
import {safeMedia} from './runware-models.mjs';

export async function mediaBlob(src,video=false){
  if(isLocalMedia(src)){const blob=await readLocalMedia(src);const ext=({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'})[blob.type]||(video?'mp4':'png');return {blob,filename:'cosmos-local.'+ext};}
  if(!safeMedia(src)&&src!=='/demo-landscape.svg'&&!/^data:image\/(png|jpeg|webp);base64,/.test(src))throw new Error('Endereço de mídia inválido.');
  const response=await fetch(src,{credentials:'omit',signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error('Não foi possível baixar. O arquivo pode ter expirado.');
  const blob=await response.blob();
  if(!blob.size)throw new Error('O arquivo recebido está vazio.');
  const mime=blob.type.split(';')[0].toLowerCase();
  const extensions={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/svg+xml':'svg','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'};
  if(!extensions[mime]&&mime!==''&&mime!=='application/octet-stream')throw new Error('O servidor não retornou uma imagem ou vídeo válido.');
  const extension=extensions[mime]||new URL(src,'https://aicosmos.app').pathname.match(/\.(png|jpe?g|webp|mp4|webm|mov)$/i)?.[1]||(video?'mp4':'png');
  return {blob,filename:`cosmos-${video?'video':'imagem'}.${extension}`};
}

export async function downloadMedia(src,video=false){
  const {blob,filename}=await mediaBlob(src,video);
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;link.style.display='none';document.body.appendChild(link);
  try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
}
