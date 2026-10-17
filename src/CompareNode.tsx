import NodeSelect from './NodeSelect';
import {useState} from 'react';
import {Handle,Position,useNodes,useEdges} from '@xyflow/react';
import {resolveImage} from './compare.mjs';
import type {FlowNode,NodeData} from './types';

export default function CompareNode({id,data,selected,update,running}:{id:string;data:NodeData;selected?:boolean;update:(id:string,patch:Partial<NodeData>)=>void;running:boolean}) {
  const nodes=useNodes<FlowNode>(),edges=useEdges();
  const get=(port:string)=>{const edge=edges.find(e=>e.target===id&&e.targetHandle===port);return edge?resolveImage(edge.source,nodes,edges):undefined;};
  const a=get('a'),b=get('b');
  const mode=data.compareMode||'wipe',split=Number(data.compareSplit??'50');
  const [failed,setFailed]=useState<string[]>([]);
  const image=(url:string,label:string,style?:React.CSSProperties)=><img src={url} alt={`Imagem ${label}`} draggable={false} style={style} onError={()=>setFailed(old=>old.includes(url)?old:[...old,url])}/>;
  const ready=a&&b&&!failed.includes(a)&&!failed.includes(b);
  return <article className={`studio-node node-compare ${selected?'selected':''}`} style={{'--node-accent':'#06bdd5'} as React.CSSProperties}>
    <div className="node-title"><span/>Compare<small>SEM CRÉDITOS</small></div>
    <div className="model-inputs">
      {(['a','b'] as const).map((port,i)=><div className="model-input-row" key={port}><Handle id={port} type="target" position={Position.Left} title={`Entrada Imagem ${port.toUpperCase()}`} aria-label={`Entrada Imagem ${port.toUpperCase()}`} className={`image-port ${edges.some(e=>e.target===id&&e.targetHandle===port)?'port-connected':''}`} style={{top:22+i*34}}/><span>Imagem {port.toUpperCase()}</span><small>{(port==='a'?a:b)?'Pronta':'Conecte uma imagem'}</small></div>)}
      <div className="model-input-row model-output-row"><small>Saída</small><label className="nodrag">Imagem <NodeSelect aria-label="Imagem de saída" disabled={running} value={data.compareOutput||'a'} onChange={e=>update(id,{compareOutput:e.target.value})}><option value="a">A</option><option value="b">B</option></NodeSelect></label><Handle type="source" position={Position.Right} title="Saída de imagem selecionada" aria-label="Saída de imagem selecionada" className={`image-port ${edges.some(e=>e.source===id)?'port-connected':''}`} style={{top:90}}/></div>
    </div>
    <div className="compare-modes nodrag" role="group" aria-label="Modo de comparação">{[['wipe','Divisória'],['side','Lado a lado'],['overlay','Sobreposição']].map(([value,label])=><button key={value} disabled={running} aria-pressed={mode===value} onClick={()=>update(id,{compareMode:value})}>{label}</button>)}</div>
    <div className={`compare-stage compare-${mode} nodrag nowheel`}>
      {ready?(mode==='side'?<><div>{image(a,'A')}<b>A</b></div><div>{image(b,'B')}<b>B</b></div></>:<>{image(b,'B')}{image(a,'A',mode==='wipe'?{clipPath:`inset(0 ${100-split}% 0 0)`}:{opacity:split/100})}<b className="compare-label-a">A</b><b className="compare-label-b">B</b>{mode==='wipe'&&<><div className="compare-divider" style={{left:`${split}%`}}><span>↔</span></div><input className="compare-drag" type="range" min="0" max="100" aria-label="Posição da divisória" value={split} disabled={running} onChange={e=>update(id,{compareSplit:e.target.value})}/></>}</>):<p>{(a&&failed.includes(a))||(b&&failed.includes(b))?'Não foi possível carregar uma imagem. Verifique a origem.':'Conecte duas imagens prontas às entradas A e B. A comparação aparece automaticamente.'}</p>}
    </div>
    <div className="compare-footer nodrag nowheel">{mode!=='side'&&<label>{mode==='wipe'?'Divisória':'Opacidade A'}<input type="range" min="0" max="100" aria-label={mode==='wipe'?'Ajustar divisória':'Opacidade da imagem A'} value={split} disabled={running} onChange={e=>update(id,{compareSplit:e.target.value})}/><output>{split}%</output></label>}<small>Imagens inteiras, sem recorte · comparação local</small></div>
  </article>;
}
