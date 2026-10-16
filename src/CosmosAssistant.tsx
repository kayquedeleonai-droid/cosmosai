import {useEffect,useRef,useState} from 'react';
import {X,Send,Volume2,Square,RotateCcw,LoaderCircle} from 'lucide-react';
import {auth} from './firebase';
type Message={role:'user'|'assistant';content:string};
export function Alien(){return <svg className="orbi-alien" viewBox="0 0 64 64" aria-hidden="true"><path d="M14 23C14 5 50 5 50 23c0 16-12 30-18 30S14 39 14 23Z" fill="currentColor"/><ellipse className="orbi-eye" cx="23" cy="29" rx="6" ry="9" transform="rotate(-27 23 29)" fill="#0a1823"/><ellipse className="orbi-eye" cx="41" cy="29" rx="6" ry="9" transform="rotate(27 41 29)" fill="#0a1823"/><path d="M28 43q4 3 8 0" stroke="#16354b" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>;}
const greeting=()=>{const hour=new Date().getHours();return hour>=5&&hour<12?'Bom dia':hour>=12&&hour<18?'Boa tarde':'Boa noite';};
async function chatRequest(path:string,payload:unknown,signal?:AbortSignal){
 if(!auth?.currentUser)throw new Error('Entre na sua conta para conversar.');
 const token=await auth.currentUser.getIdToken();
 const response=await fetch(`${import.meta.env.VITE_RUNWARE_API_URL}/${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(90000)]):AbortSignal.timeout(10000)});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Assistente indisponível.');return data;
}
export default function CosmosAssistant({signedIn}:{signedIn:boolean}){
 const [open,setOpen]=useState(false),[messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState(false),[checking,setChecking]=useState(false),[speaking,setSpeaking]=useState(false);
 const bottom=useRef<HTMLDivElement>(null),field=useRef<HTMLTextAreaElement>(null),trigger=useRef<HTMLButtonElement>(null),controller=useRef<AbortController|null>(null),lock=useRef(false);
 const [hello,setHello]=useState(greeting);
 useEffect(()=>{const timer=setInterval(()=>setHello(greeting()),60000);return()=>{clearInterval(timer);controller.current?.abort();if('speechSynthesis' in window)window.speechSynthesis.cancel();};},[]);
 useEffect(()=>{if(open){field.current?.focus();void check();}else{if('speechSynthesis' in window)window.speechSynthesis.cancel();setSpeaking(false);}},[open,signedIn]);
 useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest'});},[messages,busy]);
 async function check(){setChecking(true);try{const status=await chatRequest('assistant/status',{});setReady(status.ready);setError(status.ready?'':status.message);}catch(e){setReady(false);setError((e as Error).message);}finally{setChecking(false);}}
 function close(){setOpen(false);trigger.current?.focus();}
 async function send(){
  if(lock.current||!draft.trim()||!ready)return;
  lock.current=true;setBusy(true);setError('');
  const outgoing:Message[]=[...messages.slice(-10),{role:'user',content:draft.trim()}];
  const text=draft;setDraft('');setMessages(outgoing);
  const abort=new AbortController();controller.current=abort;
  try{const answer=await chatRequest('assistant',{requestId:crypto.randomUUID(),messages:outgoing},abort.signal);setMessages([...outgoing,{role:'assistant',content:answer.text}]);if(answer.incomplete)setError('Resposta parcial: o limite de tamanho desta resposta foi atingido.');}
  catch(e){if(!abort.signal.aborted){setMessages(outgoing.slice(0,-1));setDraft(text);setError((e as Error).name==='TimeoutError'?'A resposta demorou. A consulta pode ter sido cobrada; não repetimos automaticamente.':(e as Error).message);}}
  finally{lock.current=false;setBusy(false);}
 }
 function speak(text:string){if(!('speechSynthesis' in window))return;window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(text);speech.lang='pt-BR';speech.onend=()=>setSpeaking(false);speech.onerror=()=>setSpeaking(false);setSpeaking(true);window.speechSynthesis.speak(speech);}
 return <aside className="cosmos-assistant" aria-label="Assistente Cosmos" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}}}>
  {open&&<section className="orbi-panel" role="dialog" aria-label="Conversar com Órbi">
   <header><Alien/><div><strong>Órbi</strong><small>Assistente IA · GPT-6 Astra</small></div><button title="Nova conversa" aria-label="Nova conversa" disabled={busy} onClick={()=>{setMessages([]);setError('');setDraft('');window.speechSynthesis?.cancel();setSpeaking(false);}}><RotateCcw size={15}/></button><button aria-label="Fechar assistente" onClick={close}><X size={17}/></button></header>
   <div className="orbi-conversation" role="log" aria-live="polite"><div className="orbi-welcome"><Alien/><h3>{hello}! Sou o Órbi.</h3><p>Vamos dar forma à sua próxima ideia?</p></div>
    {!messages.length&&<div className="orbi-suggestions">{['Me ajude a escrever um prompt','Quero planejar uma cena','Como organizar meu workflow?'].map(text=><button key={text} onClick={()=>{setDraft(text);field.current?.focus();}}>{text}</button>)}</div>}
    {messages.map((m,i)=><div className={`orbi-message orbi-${m.role}`} key={i}><small>{m.role==='user'?'Você':'Órbi'}</small><p>{m.content}</p>{m.role==='assistant'&&'speechSynthesis' in window&&<button aria-label="Ouvir resposta" onClick={()=>speak(m.content)}><Volume2 size={13}/>Ouvir</button>}</div>)}
    {busy&&<p className="orbi-thinking"><LoaderCircle size={14} className="spin"/>Órbi está pensando…</p>}<div ref={bottom}/>
   </div>
   <footer>{error&&<div className="orbi-error" role="status">{error}{!ready&&signedIn&&<button disabled={checking} onClick={()=>void check()}>{checking?'Verificando…':'Verificar conexão'}</button>}</div>}
    {speaking&&<button onClick={()=>{window.speechSynthesis.cancel();setSpeaking(false);}}><Square size={12}/>Parar voz</button>}
    <form onSubmit={e=>{e.preventDefault();void send();}}><textarea ref={field} aria-label="Mensagem para Órbi" placeholder="Converse com o Órbi…" value={draft} maxLength={4000} disabled={busy} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/><button type="submit" aria-label="Enviar mensagem" disabled={busy||!ready||!draft.trim()}><Send size={17}/></button></form>
    <small>Conversas usam créditos OpenAI. Conversa visível nesta sessão. Órbi pode errar.</small>
   </footer>
  </section>}
  <button ref={trigger} className="orbi-launcher" aria-label={open?'Fechar Órbi':'Conversar com Órbi'} aria-expanded={open} onClick={()=>setOpen(!open)}><Alien/>{!open&&<span>{hello}!<small>Vamos conversar?</small></span>}</button>
 </aside>;
}
