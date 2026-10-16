import {useRef,useState} from 'react';
import {Download,LoaderCircle} from 'lucide-react';
import {downloadMedia} from './media-download.mjs';

export default function DownloadMediaButton({src,video=false,className,onError}:{src:string;video?:boolean;className?:string;onError:(text:string)=>void}){
  const lock=useRef(false),[busy,setBusy]=useState(false);
  const label=busy?'Baixando…':video?'Baixar vídeo':'Baixar imagem';
  return <button className={className} title={label} aria-label={label} aria-busy={busy} disabled={busy} onClick={async()=>{
    if(lock.current)return;lock.current=true;setBusy(true);
    try{await downloadMedia(src,video);}catch(e){onError(e instanceof TypeError?'Não foi possível baixar o arquivo. Verifique sua conexão e tente novamente.':(e as Error).message);}finally{lock.current=false;setBusy(false);}
  }}>{busy?<LoaderCircle className="spin" size={14}/>:<Download size={14}/>}</button>;
}
