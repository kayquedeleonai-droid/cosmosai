import {useEffect,useRef,useState} from 'react';
import {bridgeRequest,readCrop,setPhotoshopConnection} from './photoshop-selection.mjs';
type Config={key:string;client:string;projectId:string};
export default function PhotoshopBridge({projectId,name,onImport,message}:{projectId:string;name:string;onImport:(crop:any,bytes:ArrayBuffer)=>Promise<void>;message:(text:string)=>void}){
 const [open,setOpen]=useState(false),[key,setKey]=useState(''),[config,setConfig]=useState<Config|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const current=useRef({name,onImport,message});current.current={name,onImport,message};
 const client=useRef(crypto.randomUUID());
 useEffect(()=>{
  if(!config)return;let stopped=false,timer:ReturnType<typeof setTimeout>;setPhotoshopConnection(config);
  async function poll(){try{
   await bridgeRequest(config,'/workflow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId,name:current.current.name})});
   if(stopped)return;
   const response=await bridgeRequest(config,'/incoming');if(stopped)return;
   if(response.status!==204){const crop=readCrop(decodeURIComponent(response.headers.get('X-Cosmos-Crop')||''));const bytes=await response.arrayBuffer();if(stopped)return;if(crop.projectId!==projectId)throw new Error('Recorte pertence a outro workflow.');await current.current.onImport(crop,bytes);if(stopped)return;await bridgeRequest(config,'/incoming/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cropId:crop.cropId})});}
   if(!stopped)setError('');
  }catch(e){if(!stopped)setError((e as Error).message||'Conector desconectado.');}finally{if(!stopped)timer=setTimeout(()=>void poll(),2500);}}
  void poll();return()=>{stopped=true;clearTimeout(timer);setPhotoshopConnection(null);void bridgeRequest(config,'/disconnect',{method:'POST'}).catch(()=>{});};
 },[config,projectId]);
 async function connect(){setBusy(true);setError('');try{if(!/^[a-f0-9]{64}$/.test(key.trim()))throw new Error('Cole o código exibido pelo conector local.');const next={key:key.trim(),client:client.current,projectId};await bridgeRequest(next,'/workflow',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId,name})});setConfig(next);setOpen(false);message('Photoshop conectado a este workflow.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <><button className="outline-button" title={error||'Enviar e receber seleções do Photoshop'} onClick={()=>setOpen(true)}>Photoshop{config?(error?' !':' ✓'):''}</button>{open&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-label="Conectar Photoshop"><button className="icon-button" onClick={()=>setOpen(false)}>Fechar</button><h2>Photoshop ↔ Cosmos</h2><p>Envie uma seleção para este workflow e devolva o resultado como nova camada na posição original.</p><p><a href="/cosmos-photoshop-plugin.zip" download>Baixar plugin e conector Windows</a></p><p>Extraia o pacote e siga o LEIA-ME. Inicie o conector e cole o mesmo código aqui e no plugin.</p><label>Código do conector<input className="form-input" type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} /></label>{error&&<p role="alert">{error}</p>}{config?<button className="outline-button" onClick={()=>{setConfig(null);setError('');}}>Desconectar</button>:<button className="primary" disabled={busy} onClick={()=>void connect()}>{busy?'Conectando…':'Conectar este workflow'}</button>}<p>Transferência local · mantenha o documento original aberto. Recortes RGB em 8 bits/sRGB, até 16 megapixels.</p></section></div>}</>;
}
