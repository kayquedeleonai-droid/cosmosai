import {useEffect,useRef,useState} from 'react';
import {Handle,Position,useNodes,useEdges,useUpdateNodeInternals,useReactFlow} from '@xyflow/react';
import {Plus,Download,ExternalLink,Layers,LoaderCircle,ArrowUp,ArrowDown,Minus} from 'lucide-react';
import {photoshopSlots,photoshopLayers,layerHandle} from './photoshop.mjs';
import {mediaBlob} from './media-download.mjs';
import type {FlowNode,NodeData} from './types';

let connectorKey='';
const bridge='http://127.0.0.1:48879';
export default function PhotoshopNode({id,data,selected,update,message}:{id:string;data:NodeData;selected?:boolean;update:(id:string,patch:Partial<NodeData>)=>void;message:(text:string)=>void}){
  const nodes=useNodes<FlowNode>(),edges=useEdges(),internals=useUpdateNodeInternals(),{setEdges}=useReactFlow();
  const rows=photoshopLayers(id,data,nodes,edges),slots=photoshopSlots(data);
  const [busy,setBusy]=useState(''),[setup,setSetup]=useState(false),[key,setKey]=useState(connectorKey);
  const worker=useRef<Worker|null>(null),lock=useRef(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;worker.current?.terminate();};},[]);
  useEffect(()=>internals(id),[id,slots,internals]);
  function swap(a:number,b:number){setEdges(es=>es.map(e=>e.target!==id?e:e.targetHandle===layerHandle(a)?{...e,targetHandle:layerHandle(b)}:e.targetHandle===layerHandle(b)?{...e,targetHandle:layerHandle(a)}:e));}
  async function exportPSD(open:boolean){
    if(lock.current)return;lock.current=true;setBusy('Preparando…');
    try{
      const items=rows.filter(r=>r.connected);
      if(!items.length||items.some(r=>!r.src))throw new Error('Conecte imagens prontas em todos os slots usados antes de exportar.');
      if(open){
        setSetup(true);
        if(!/^[a-f0-9]{64}$/i.test(key.trim()))throw new Error('Inicie o conector e cole o código de conexão abaixo.');
        try{const r=await fetch(bridge+'/status',{headers:{'X-Cosmos-Key':key.trim()},signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error();}
        catch{throw new Error('Conector desconectado ou código inválido. Inicie o conector e permita o acesso à rede local, se o navegador pedir.');}
        connectorKey=key.trim();
      }
      const files:{name:string;blob:Blob}[]=[];let bytes=0;
      for(const item of items){
        const {blob}=await mediaBlob(item.src!);bytes+=blob.size;
        if(bytes>100*1024*1024)throw new Error('As imagens excedem 100 MB. Exporte menos camadas por vez.');
        if(!alive.current)return;
        files.push({name:item.name,blob});setBusy(`Preparando ${files.length}/${items.length}…`);
      }
      setBusy('Montando camadas…');
      const buffer=await new Promise<ArrayBuffer>((resolve,reject)=>{
        const w=new Worker(new URL('./photoshop.worker.js',import.meta.url),{type:'module'});worker.current=w;
        w.onmessage=({data:result})=>{w.terminate();worker.current=null;result.error?reject(new Error(result.error)):resolve(result.buffer);};
        w.onerror=()=>{w.terminate();worker.current=null;reject(new Error('Não foi possível montar o PSD. Tente menos camadas.'));};w.postMessage(files);
      });
      if(!alive.current)return;
      const blob=new Blob([buffer],{type:'image/vnd.adobe.photoshop'});
      if(open){
        setBusy('Abrindo Photoshop…');
        const r=await fetch(bridge+'/open',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Cosmos-Key':key.trim()},body:blob,signal:AbortSignal.timeout(120000)});
        if(!r.ok)throw new Error('O conector não conseguiu abrir o PSD. Verifique o Photoshop ou use Baixar PSD.');
        message('PSD enviado ao Photoshop com as camadas.');
      }else{
        const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Cosmos-camadas.psd';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);message('PSD com camadas preparado para download.');
      }
    }catch(error){if(alive.current)message((error as Error).message);}
    finally{lock.current=false;if(alive.current)setBusy('');}
  }
  return <article className={`studio-node photoshop-node ${selected?'selected':''}`} style={{'--node-accent':'#65baff'} as React.CSSProperties}>
    <div className="node-title"><span/>Photoshop <small>CAMADAS</small></div>
    <header><Layers size={17}/><strong>Composição em camadas</strong></header>
    <div className="photoshop-layers">{rows.map((row,i)=><div className="photoshop-layer" key={i}>
      <Handle id={layerHandle(i)} type="target" position={Position.Left} aria-label={`Imagem da camada ${i+1}`} title={`Camada ${i+1}`} className={`image-port ${row.connected?'port-connected':''}`} style={{top:65+i*52}}/>
      {row.src?<img src={row.src} alt=""/>:<span className="ps-placeholder"><Layers size={15}/></span>}
      <span><b>{row.name}</b><small>{row.src?(i===0?'Camada superior':'Imagem pronta'):row.connected?'Aguardando imagem':'Conecte uma imagem'}</small></span>
      <button className="nodrag" aria-label={`Subir camada ${i+1}`} disabled={!!busy||i===0} onClick={()=>swap(i,i-1)}><ArrowUp size={12}/></button>
      <button className="nodrag" aria-label={`Descer camada ${i+1}`} disabled={!!busy||i===slots-1} onClick={()=>swap(i,i+1)}><ArrowDown size={12}/></button>
    </div>)}</div>
    <div className="photoshop-actions nodrag nopan" onKeyDown={e=>e.stopPropagation()}>
      <div className="ps-slot-actions"><button disabled={!!busy||slots>=16} onClick={()=>update(id,{psSlots:String(slots+1)})}><Plus size={13}/>Imagem</button><button title="Remover última entrada vazia" aria-label="Remover última entrada vazia" disabled={!!busy||slots<=1||rows[slots-1].connected} onClick={()=>update(id,{psSlots:String(slots-1)})}><Minus size={13}/></button></div>
      <p>Resolução original · imagens centralizadas · sem créditos</p>
      <div className="ps-export-actions"><button disabled={!!busy} onClick={()=>void exportPSD(false)}><Download size={14}/>Baixar PSD</button><button disabled={!!busy} onClick={()=>void exportPSD(true)}><ExternalLink size={14}/>Abrir no Photoshop</button></div>
      {busy&&<div className="ps-progress" role="status"><LoaderCircle size={13} className="spin"/>{busy}</div>}
      <details open={setup} onToggle={e=>setSetup(e.currentTarget.open)}><summary>Conectar Photoshop · Windows</summary><p>Requer Node.js 20 ou superior instalado. Baixe o conector e execute o comando abaixo no PowerShell. Mantenha a janela aberta e cole aqui o código exibido. Depois clique em “Abrir no Photoshop”.</p><a href="/cosmos-photoshop.cjs" download>Baixar conector Windows</a><p>Se precisar iniciar pelo terminal:</p><code>node "$HOME\Downloads\cosmos-photoshop.cjs"</code><input aria-label="Código do conector Photoshop" placeholder="Cole o código do conector" type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} disabled={!!busy}/><small>O PSD é salvo na pasta temporária Cosmos-Photoshop do seu computador. Salve uma cópia no Photoshop para conservar o projeto.</small></details>
    </div>
  </article>;
}
