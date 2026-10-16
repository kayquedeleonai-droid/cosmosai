import {useRef,useState} from 'react';
import {Upload,LoaderCircle} from 'lucide-react';
import {accountRequest} from './runware';
export async function uploadMediaFile(file:File,video=false){
 const types=video?['video/mp4','video/webm']:['image/png','image/jpeg','image/webp'];
 if(!types.includes(file.type)||file.size>20000000)throw new Error('Use '+(video?'MP4 ou WebM':'PNG, JPG ou WebP')+' de até 20 MB.');
 const media=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Não foi possível ler o arquivo.'));reader.readAsDataURL(file);});
 const result=await accountRequest('media-upload',{media});
 if(typeof result.url!=='string'||!result.url)throw new Error('O envio não retornou uma imagem válida.');
 return result.url;
}
export default function LoadMedia({video,disabled,onLoaded,onError}:{video:boolean;disabled:boolean;onLoaded:(url:string)=>void;onError:(text:string)=>void}){
 const input=useRef<HTMLInputElement>(null),lock=useRef(false),[busy,setBusy]=useState(false);
 async function upload(file?:File){if(!file||lock.current)return;lock.current=true;setBusy(true);try{onLoaded(await uploadMediaFile(file,video));}catch(error){onError((error as Error).message);}finally{lock.current=false;setBusy(false);}}

 return <div className="load-media nodrag nopan"><input ref={input} type="file" hidden accept={video?'video/mp4,video/webm':'image/png,image/jpeg,image/webp'} disabled={busy||disabled} onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/><button disabled={disabled||busy} onClick={()=>input.current?.click()}>{busy?<LoaderCircle className="spin" size={18}/>:<Upload size={18}/>} {busy?'Enviando…':video?'Carregar vídeo':'Carregar imagem'}</button><small>{video?'MP4 ou WebM':'PNG, JPG ou WebP'} · até 20 MB · enviado à Runware</small></div>;
}
