import {useEffect,useRef,useState} from 'react';
import {ViewportPortal,useReactFlow} from '@xyflow/react';
import {Pencil,Ungroup,X} from 'lucide-react';
import {groupBounds,groupColors,moveGroup} from './node-groups.mjs';
import type {FlowNode,NodeGroup} from './types';

export function GroupFrames({groups,nodes,setNodes,onEdit,onRemove,disabled}:{groups:NodeGroup[];nodes:FlowNode[];setNodes:(update:(nodes:FlowNode[])=>FlowNode[])=>void;onEdit:(group:NodeGroup)=>void;onRemove:(id:string)=>void;disabled:boolean}){
  const {screenToFlowPosition}=useReactFlow();
  const drag=useRef<{start:{x:number;y:number};origins:Record<string,{x:number;y:number}>}|null>(null);
  return <ViewportPortal>{groups.map(group=>{const bounds=groupBounds(group,nodes);return bounds&&<section key={group.id} className="workflow-group" style={{left:bounds.x,top:bounds.y,width:bounds.width,height:bounds.height,'--group-color':group.color} as React.CSSProperties} aria-label={`Grupo ${group.name}`}>
    <header className="workflow-group-header nodrag nopan" onPointerDown={e=>{if(e.button!==0||(e.target as HTMLElement).closest('button'))return;e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);drag.current={start:screenToFlowPosition({x:e.clientX,y:e.clientY}),origins:Object.fromEntries(nodes.filter(n=>group.nodeIds.includes(n.id)).map(n=>[n.id,{...n.position}]))};setNodes(ns=>ns.map(n=>({...n,selected:group.nodeIds.includes(n.id)})));}} onPointerMove={e=>{if(!drag.current)return;const point=screenToFlowPosition({x:e.clientX,y:e.clientY}),{start,origins}=drag.current;setNodes(ns=>moveGroup(ns,origins,{x:point.x-start.x,y:point.y-start.y}));}} onPointerUp={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}>
      <strong title="Arraste para mover o grupo">{group.name}</strong><small>{group.nodeIds.length} nodes</small><button disabled={disabled} aria-label={`Editar grupo ${group.name}`} onClick={()=>onEdit(group)}><Pencil size={13}/></button><button disabled={disabled} aria-label={`Desagrupar ${group.name}`} title="Desagrupar sem excluir nodes" onClick={()=>onRemove(group.id)}><Ungroup size={14}/></button>
    </header>
  </section>;})}</ViewportPortal>;
}
export function GroupDialog({group,onSave,onClose}:{group:NodeGroup;onSave:(group:NodeGroup)=>void;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null),[name,setName]=useState(group.name),[color,setColor]=useState(group.color);
  useEffect(()=>{ref.current?.showModal();ref.current?.querySelector('input')?.focus();},[]);
  return <dialog ref={ref} className="group-dialog" onCancel={e=>{e.preventDefault();onClose();}} onKeyDown={e=>e.stopPropagation()}><form onSubmit={e=>{e.preventDefault();if(name.trim())onSave({...group,name:name.trim(),color});}}><button type="button" className="group-close" aria-label="Fechar grupo" onClick={onClose}><X size={16}/></button><h2>{group.name?'Editar grupo':'Criar grupo'}</h2><label>Nome do grupo<input autoFocus value={name} maxLength={80} placeholder="Ex: Geração de capa" onChange={e=>setName(e.target.value)}/></label><span>Cor</span><div className="group-colors">{groupColors.map((c,i)=><button type="button" key={c} aria-label={`Cor ${['ciano','azul','violeta','rosa','laranja','verde','vermelho','cinza'][i]}`} aria-pressed={c===color} style={{background:c}} onClick={()=>setColor(c)}/>)}</div><p>{group.nodeIds.length} node(s) selecionado(s)</p><footer><button type="button" onClick={onClose}>Cancelar</button><button className="primary" disabled={!name.trim()}>{group.name?'Salvar grupo':'Criar grupo'}</button></footer></form></dialog>;
}
