import {reviewStatuses} from './review-status.mjs';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Download,Image,LoaderCircle} from 'lucide-react';
import {downloadMedia} from './media-download.mjs';
export default function ImageNodeMenu({x,y,src,onClose,onCover,onError,onDetach,canDetach,reviewStatus,onReview}:{reviewStatus:string;onReview:(status:string)=>void;x:number;y:number;src:string;onClose:()=>void;onCover:()=>void;onError:(message:string)=>void;onDetach:()=>void;canDetach:boolean}){
  const ref=useRef<HTMLDivElement>(null),lock=useRef(false),[busy,setBusy]=useState(false);
  useEffect(()=>{ref.current?.querySelector('button')?.focus();const outside=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node))onClose();};document.addEventListener('pointerdown',outside);window.addEventListener('resize',onClose);return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',onClose);};},[onClose]);
  return createPortal(<div ref={ref} role="menu" aria-label="Opções da imagem" className="image-node-menu nodrag nopan nowheel" style={{left:Math.max(8,Math.min(x,window.innerWidth-248)),top:Math.max(8,Math.min(y,window.innerHeight-330))}} onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'||e.key==='Tab'){onClose();return;}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const items=Array.from(ref.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const i=items.indexOf(document.activeElement as HTMLButtonElement);items[(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}}}>
    <button role="menuitem" disabled={busy} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{await downloadMedia(src);onClose();}catch(e){onError((e as Error).message);setBusy(false);lock.current=false;}}}>{busy?<LoaderCircle size={15} className="spin"/>:<Download size={15}/>} {busy?'Baixando…':'Baixar imagem'}</button>
    <button role="menuitem" onClick={()=>{onCover();onClose();}}><Image size={15}/>Usar como capa do workflow</button>
    <div className="review-menu-label">Image status</div>
    {reviewStatuses.map(status=><button key={status.value} role="menuitemradio" aria-checked={reviewStatus===status.value} onClick={()=>{onReview(status.value);onClose();}}><span className={`review-dot review-${status.value}`}/>{status.label}{reviewStatus===status.value&&' ✓'}</button>)}
    {canDetach&&<button role="menuitem" onClick={()=>{onDetach();onClose();}}><Image size={15}/>Desanexar imagem</button>}
  </div>,document.body);
}
