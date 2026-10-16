import {useEffect,useRef,useState} from 'react';
import {Type} from 'lucide-react';
import {createPortal} from 'react-dom';
import {mentionQuery,mentionToken} from './image-mentions.mjs';

// React Flow publishes node changes through its store on a later render.
// Keep typing synchronous so a controlled textarea never receives its old value
// between keystrokes (which resets the caret and native undo selection).
export default function PromptInput({id,value,disabled,onChange,images=[]}:{id:string;value:string;disabled:boolean;onChange:(value:string)=>void;images?:{id:string;name:string;src:string;video?:boolean}[]}){
  const [draft,setDraft]=useState(value),sent=useRef(value);
  const field=useRef<HTMLTextAreaElement>(null),composing=useRef(false);
  const [query,setQuery]=useState<{start:number;end:number;query:string}|null>(null),[index,setIndex]=useState(0);
  const [position,setPosition]=useState({left:0,top:0});
  const choices=images.filter(image=>image.name.toLocaleLowerCase().includes(query?.query.toLocaleLowerCase()||'')).slice(0,8);
  function locate(element:HTMLTextAreaElement){if(composing.current)return;setQuery(mentionQuery(element.value,element.selectionStart));setIndex(0);const rect=element.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-288)),top:Math.max(8,Math.min(rect.bottom+4,window.innerHeight-330))});}
  function change(text:string){sent.current=text;setDraft(text);onChange(text);}
  function insert(name:string){if(!query||disabled)return;const token=mentionToken(name)+' ',next=draft.slice(0,query.start)+token+draft.slice(query.end);if(next.length>3000)return;change(next);setQuery(null);requestAnimationFrame(()=>{field.current?.focus();field.current?.setSelectionRange(query.start+token.length,query.start+token.length);});}
  useEffect(()=>{const close=()=>setQuery(null);window.addEventListener('resize',close);window.addEventListener('wheel',close);return()=>{window.removeEventListener('resize',close);window.removeEventListener('wheel',close);};},[]);
  useEffect(()=>{if(value!==sent.current){sent.current=value;setDraft(value);}},[value]);
  return <div className="prompt-field"><textarea ref={field} aria-label="Prompt" aria-describedby={`prompt-count-${id}`} aria-controls={query?`mentions-${id}`:undefined} aria-expanded={!!query} aria-autocomplete="list" aria-activedescendant={query&&choices[index]?`mention-${id}-${index}`:undefined} disabled={disabled} className="nodrag nopan nowheel prompt-text" spellCheck value={draft} placeholder="Descreva sua ideia… Use @ para mencionar imagens." maxLength={3000}
    onPointerDown={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();locate(e.currentTarget);}} onDoubleClick={e=>e.stopPropagation()} onContextMenu={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(!query||e.nativeEvent.isComposing)return;if(e.key==='Escape'){e.preventDefault();setQuery(null);}else if(choices.length&&['ArrowDown','ArrowUp','Enter','Tab'].includes(e.key)){e.preventDefault();if(e.key==='ArrowDown')setIndex(i=>(i+1)%choices.length);else if(e.key==='ArrowUp')setIndex(i=>(i+choices.length-1)%choices.length);else insert(choices[index]?.name||choices[0].name);}}} onKeyUp={e=>{e.stopPropagation();if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key))locate(e.currentTarget);}} onBlur={()=>setQuery(null)} onCompositionStart={()=>{composing.current=true;setQuery(null);}} onCompositionEnd={e=>{composing.current=false;locate(e.currentTarget);}}
    onChange={e=>{change(e.target.value);locate(e.target);}}/><div className="prompt-footer"><Type size={13}/><span id={`prompt-count-${id}`}>{draft.length} / 3000</span></div>
    {query&&!disabled&&createPortal(<div className="image-mentions nodrag nopan nowheel" style={position} onPointerDown={e=>e.stopPropagation()}><small>Nodes do workflow · mídia atual</small><div role="listbox" id={`mentions-${id}`} aria-label="Imagens e vídeos para mencionar">{choices.map((image,i)=><button type="button" role="option" aria-selected={i===index} id={`mention-${id}-${i}`} key={image.id} onMouseDown={e=>e.preventDefault()} onClick={e=>{e.stopPropagation();insert(image.name);}}>{image.video?<video src={image.src} muted preload="metadata"/>:<img src={image.src} alt=""/>}<span>{image.name}</span></button>)}</div>{!choices.length&&<p>Nenhuma mídia encontrada. Gere uma imagem ou vídeo e dê um nome pelo título do node.</p>}</div>,document.body)}
  </div>;
}
