import {useEffect,useRef,useState} from 'react';
import {Download,RefreshCw,X} from 'lucide-react';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function PwaControls(){
 const [install,setInstall]=useState<InstallEvent|null>(null),[installed,setInstalled]=useState(()=>matchMedia('(display-mode: standalone)').matches);
 const [help,setHelp]=useState(false),[available,setAvailable]=useState(false),[working,setWorking]=useState(false),[error,setError]=useState('');
 const registration=useRef<ServiceWorkerRegistration|null>(null),changed=useRef(false);
 useEffect(()=>{
  const prompt=(event:Event)=>{event.preventDefault();setInstall(event as InstallEvent);};
  const done=()=>{setInstalled(true);setInstall(null);setHelp(false);};
  window.addEventListener('beforeinstallprompt',prompt);window.addEventListener('appinstalled',done);
  if(!import.meta.env.PROD||!('serviceWorker' in navigator))return()=>{window.removeEventListener('beforeinstallprompt',prompt);window.removeEventListener('appinstalled',done);};
  let disposed=false;const hadController=!!navigator.serviceWorker.controller;
  const controller=()=>{if(hadController){changed.current=true;setAvailable(true);setWorking(false);}};
  navigator.serviceWorker.addEventListener('controllerchange',controller);
  const check=()=>{if(document.visibilityState==='visible')void registration.current?.update().catch(()=>{});};
  void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{
   if(disposed)return;registration.current=reg;if(reg.waiting)setAvailable(true);
   reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(!disposed&&worker.state==='installed'&&navigator.serviceWorker.controller)setAvailable(true);});});
  }).catch(()=>{if(!disposed)setError('Não foi possível preparar as atualizações. Reabra o app com internet.');});
  const timer=setInterval(check,5*60*1000);document.addEventListener('visibilitychange',check);
  return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',check);navigator.serviceWorker.removeEventListener('controllerchange',controller);window.removeEventListener('beforeinstallprompt',prompt);window.removeEventListener('appinstalled',done);};
 },[]);
 async function update(){
  setError('');if(!navigator.onLine){setError('Conecte-se à internet para atualizar.');return;}
  const save=new Event('cosmos:before-update',{cancelable:true});
  if(!window.dispatchEvent(save)){setError('Finalize a geração e confirme que o workflow foi salvo antes de atualizar.');return;}
  if(changed.current){window.location.reload();return;}
  const worker=registration.current?.waiting;if(!worker){setAvailable(false);return;}
  setWorking(true);
  const activated=()=>{if(worker.state==='activated'){worker.removeEventListener('statechange',activated);const flush=new Event('cosmos:before-update',{cancelable:true});if(window.dispatchEvent(flush))window.location.reload();else{setWorking(false);setError('Salve o workflow e clique em atualizar novamente.');}}};
  worker.addEventListener('statechange',activated);worker.postMessage({type:'ACTIVATE_UPDATE'});
 }
 return <aside className="pwa-controls" aria-label="Aplicativo Cosmos">
  {available?<button disabled={working} onClick={()=>void update()}><RefreshCw size={14}/>{working?'Atualizando…':'Atualização disponível · Atualizar agora'}</button>:!installed&&<button onClick={async()=>{if(!install){setHelp(!help);return;}try{await install.prompt();await install.userChoice;setInstall(null);}catch{setHelp(true);}}}><Download size={14}/>Instalar Cosmos</button>}
  {help&&<div className="pwa-help"><button aria-label="Fechar instruções" onClick={()=>setHelp(false)}><X size={14}/></button><strong>Cosmos no Windows</strong><p>Abra aicosmos.app no Microsoft Edge ou Google Chrome e use a opção de instalar aplicativo no menu ou na barra de endereço.</p><p>O Cosmos abre em uma janela própria. Gerações e sincronização precisam de internet.</p></div>}
  {error&&<p role="alert">{error}</p>}
 </aside>;
}
