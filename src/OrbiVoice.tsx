import {useEffect,useRef,useState} from 'react';
import {Mic,MicOff,Volume2} from 'lucide-react';
// Web Speech remains vendor-prefixed in some Chromium installations.
export default function OrbiVoice({disabled,onText,onError,autoVoice,setAutoVoice}:{disabled:boolean;onText:(text:string)=>void;onError:(error:string)=>void;autoVoice:boolean;setAutoVoice:(value:boolean)=>void}){
 const [listening,setListening]=useState(false);
 const recognition=useRef<any>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const Speech=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
 function stop(){recognition.current?.abort();recognition.current=null;if(timer.current)clearTimeout(timer.current);setListening(false);}
 useEffect(()=>()=>{recognition.current?.abort();if(timer.current)clearTimeout(timer.current);},[]);
 useEffect(()=>{if(disabled)stop();},[disabled]);
 useEffect(()=>{const hide=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);},[]);
 function start(){
  if(listening){stop();return;}if(!Speech)return;
  window.speechSynthesis?.cancel();onError('');
  const r=new Speech();recognition.current=r;r.lang='pt-BR';r.continuous=false;r.interimResults=false;
  r.onresult=(event:any)=>{if(recognition.current!==r)return;const text=Array.from(event.results as any).map((v:any)=>v[0].transcript).join(' ');onText(text);};
  r.onerror=(event:any)=>{if(recognition.current!==r)return;onError(event.error==='not-allowed'?'Permita o microfone nas configurações do navegador.':event.error==='no-speech'?'Não ouvi nenhuma fala. Tente novamente.':'Ditado indisponível neste navegador. Você pode digitar a mensagem.');stop();};
  r.onend=()=>{if(recognition.current===r){recognition.current=null;setListening(false);}if(timer.current)clearTimeout(timer.current);};
  try{r.start();setListening(true);timer.current=setTimeout(stop,45000);}catch{stop();onError('Não foi possível iniciar o microfone.');}
 }
 return <div className="orbi-voice"><div><button type="button" disabled={disabled||!Speech} aria-pressed={listening} title={Speech?'Ditar mensagem em português':'Ditado não disponível neste navegador'} onClick={start}>{listening?<MicOff size={14}/>:<Mic size={14}/>} {listening?'Parar microfone':'Ditar'}</button>{'speechSynthesis' in window&&<button type="button" aria-pressed={autoVoice} onClick={()=>{setAutoVoice(!autoVoice);if(autoVoice)window.speechSynthesis.cancel();}}><Volume2 size={14}/> Voz {autoVoice?'ativada':'desativada'}</button>}</div><small>{listening?'Ouvindo… Fale e revise antes de enviar.':Speech?'Ditado pelo navegador; o áudio pode ser processado pelo provedor dele.':'Ditado não disponível aqui. Use um navegador compatível ou digite.'}</small></div>;
}
