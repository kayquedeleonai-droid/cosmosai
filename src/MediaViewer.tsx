import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import DownloadMediaButton from './DownloadMediaButton';

export default function MediaViewer({src,video,time=0,onClose,onError}:{src:string;video:boolean;time?:number;onClose:()=>void;onError:(text:string)=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{ref.current?.close();previous?.focus();};},[]);
 return createPortal(<dialog ref={ref} className="media-viewer" aria-label={video?'Vídeo ampliado':'Imagem ampliada'} onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
  <header><span>{video?'Vídeo':'Imagem'}</span><DownloadMediaButton src={src} video={video} onError={onError}/><button autoFocus aria-label="Fechar visualização" title="Fechar (Esc)" onClick={onClose}><X size={21}/></button></header>
  {video?<video src={src} controls playsInline preload="metadata" onLoadedMetadata={event=>{event.currentTarget.currentTime=time;}}/>:<img src={src} alt="Imagem ampliada do workflow"/>}
 </dialog>,document.body);
}
