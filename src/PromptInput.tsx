import {useEffect,useRef,useState} from 'react';
import {Type} from 'lucide-react';

// React Flow publishes node changes through its store on a later render.
// Keep typing synchronous so a controlled textarea never receives its old value
// between keystrokes (which resets the caret and native undo selection).
export default function PromptInput({id,value,disabled,onChange}:{id:string;value:string;disabled:boolean;onChange:(value:string)=>void}){
  const [draft,setDraft]=useState(value),sent=useRef(value);
  useEffect(()=>{if(value!==sent.current){sent.current=value;setDraft(value);}},[value]);
  return <div className="prompt-field"><textarea aria-label="Prompt" aria-describedby={`prompt-count-${id}`} disabled={disabled} className="nodrag nopan nowheel prompt-text" spellCheck value={draft} placeholder="Descreva sua ideia para gerar imagens…" maxLength={3000}
    onPointerDown={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onContextMenu={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} onKeyUp={e=>e.stopPropagation()}
    onChange={e=>{const next=e.target.value;sent.current=next;setDraft(next);onChange(next);}}/><div className="prompt-footer"><Type size={13}/><span id={`prompt-count-${id}`}>{draft.length} / 3000</span></div></div>;
}
