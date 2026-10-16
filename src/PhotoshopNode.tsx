import {useEffect,useRef,useState} from 'react';
import {Handle,Position,useNodes,useEdges,useUpdateNodeInternals,useReactFlow} from '@xyflow/react';
import {Plus,Download,Layers,LoaderCircle,ArrowUp,ArrowDown,Minus} from 'lucide-react';
import {photoshopSlots,photoshopLayers,layerHandle} from './photoshop.mjs';
import {mediaBlob} from './media-download.mjs';
import type {FlowNode,NodeData} from './types';

export default function PhotoshopNode({id,data,selected,update,message}:{id:string;data:NodeData;selected?:boolean;update:(id:string,patch:Partial<NodeData>)=>void;message:(text:string)=>void}){
  const nodes=useNodes<FlowNode>(),edges=useEdges(),internals=useUpdateNodeInternals(),{setEdges}=useReactFlow();
  const rows=photoshopLayers(id,data,nodes,edges),slots=photoshopSlots(data);
  const [busy,setBusy]=useState('');
  const worker=useRef<Worker|null>(null),lock=useRef(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;worker.current?.terminate();};},[]);
  useEffect(()=>internals(id),[id,slots,internals]);
  function swap(a:number,b:number){setEdges(es=>es.map(e=>e.target!==id?e:e.targetHandle===layerHandle(a)?{...e,targetHandle:layerHandle(b)}:e.targetHandle===layerHandle(b)?{...e,targetHandle:layerHandle(a)}:e));}
  async function exportPSD(){
    if(lock.current)return;lock.current=true;setBusy('Preparando…');
    try{
      const items=rows.filter(r=>r.connected);
      if(!items.length||items.some(r=>!r.src))throw new Error('Conecte imagens prontas em todos os slots usados antes de exportar.');
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
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Cosmos-camadas.psd';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);message('PSD com camadas preparado para download.');
    }catch(error){if(alive.current)message((error as Error).message);}
    finally{lock.current=false;if(alive.current)setBusy('');}
  }
  return <article className={`studio-node photoshop-node ${selected?'selected':''}`} style={{'--node-accent':'#65baff'} as React.CSSProperties}>
    <div className="node-title"><span/>Photoshop <small>CAMADAS</small></div>
    
    <div className="photoshop-layers">{rows.map((row,i)=><div className="photoshop-layer" key={i}>
      <Handle id={layerHandle(i)} type="target" position={Position.Left} aria-label={`Imagem da camada ${i+1}`} title={`Camada ${i+1}`} className={`image-port ${row.connected?'port-connected':''}`} style={{top:30+i*48}}/>
      {row.src?<img src={row.src} alt=""/>:<span className="ps-placeholder"><Layers size={15}/></span>}
      <span><b>{row.name}</b><small>{row.src?(i===0?'Camada superior':'Imagem pronta'):row.connected?'Aguardando imagem':'Conecte uma imagem'}</small></span>
      <button className="nodrag" aria-label={`Subir camada ${i+1}`} disabled={!!busy||i===0} onClick={()=>swap(i,i-1)}><ArrowUp size={12}/></button>
      <button className="nodrag" aria-label={`Descer camada ${i+1}`} disabled={!!busy||i===slots-1} onClick={()=>swap(i,i+1)}><ArrowDown size={12}/></button>
    </div>)}</div>
    <button className="reference-add nodrag nopan" style={{top:18+slots*48}} title="Adicionar imagem" aria-label="Adicionar imagem" disabled={!!busy||slots>=16} onClick={()=>update(id,{psSlots:String(slots+1)})}><Plus size={10}/></button>
    <div className="node-controls photoshop-actions nodrag nopan" onKeyDown={e=>e.stopPropagation()}>
      <span className="ps-format" title="Resolução original · imagens centralizadas">PSD · {rows.filter(r=>r.connected).length} camadas</span>
      <button className="ps-remove" title="Remover última entrada vazia" aria-label="Remover última entrada vazia" disabled={!!busy||slots<=1||rows[slots-1].connected} onClick={()=>update(id,{psSlots:String(slots-1)})}><Minus size={12}/></button>
      <button className="ps-download" title="Baixar PSD com camadas" disabled={!!busy||!rows.some(r=>r.src)} onClick={()=>void exportPSD()}>{busy?<LoaderCircle size={12} className="spin"/>:<Download size={12}/>}Baixar PSD</button>
    </div>
    {busy&&<div className="ps-progress" role="status">{busy}</div>}
  </article>;
}
