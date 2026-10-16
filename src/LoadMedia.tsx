import {useRef,useState} from 'react';
import {Upload,LoaderCircle} from 'lucide-react';
import {saveLocalMedia} from './local-media.mjs';
export async function importMediaFile(file:File,video=false){
 const types=video?['video/mp4','video/webm']:['image/png','image/jpeg','image/webp'];
 if(!types.includes(file.type)||file.size>20000000)throw new Error('Use '+(video?'MP4 ou WebM':'PNG, JPG ou WebP')+' de até 20 MB.');
 return saveLocalMedia(file);
}
export default function LoadMedia({video,disabled,onLoaded,onError}:{video:boolean;disabled:boolean;onLoaded:(url:string)=>void;onError:(text:string)=>void}){
 const input=useRef<HTMLInputElement>(null),lock=useRef(false),[busy,setBusy]=useState(false);
 async function upload(file?:File){if(!file||lock.current)return;lock.current=true;setBusy(true);try{onLoaded(await importMediaFile(file,video));}catch(error){onError((error as Error).message);}finally{lock.current=false;setBusy(false);}}

 return <div className="load-media nodrag nopan"><input ref={input} type="file" hidden accept={video?'video/mp4,video/webm':'image/png,image/jpeg,image/webp'} disabled={busy||disabled} onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/><button disabled={disabled||busy} onClick={()=>input.current?.click()}>{busy?<LoaderCircle className="spin" size={18}/>:<Upload size={18}/>} {busy?'Importando…':video?'Carregar vídeo':'Carregar imagem'}</button><small>{video?'MP4 ou WebM':'PNG, JPG ou WebP'} · até 20 MB · salvo neste dispositivo</small></div>;
}
