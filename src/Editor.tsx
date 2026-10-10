import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position, addEdge, useEdgesState, useNodesState, useReactFlow, type NodeProps, type Connection } from '@xyflow/react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Cloud, Copy, Download, FolderOpen, Image as ImageIcon, LoaderCircle, Maximize2, MoreHorizontal, Play, Plus, Search, Settings2, Sparkles, Trash2, Type, Upload, Video, Workflow, X, Box, ScanLine, Wrench, LogIn, MessageSquare, HelpCircle } from 'lucide-react';
import { catalog, orderGraph, validConnection } from './graph.mjs';
import { cleanProject, exportProject } from './projects';
import { DEMO_IMAGE, type FlowNode, type Kind, type NodeData, type Project } from './types';
import { Wordmark } from './AuthScreen';

type Actions = {update:(id:string,patch:Partial<NodeData>)=>void; run:()=>void; message:(text:string)=>void; running:boolean};
const NodeActions=createContext<Actions>({update:()=>{},run:()=>{},message:()=>{},running:false});
const nodeTypes={studio:StudioNode};

function StudioNode({id,data,selected}:NodeProps<FlowNode>){
  const {update,run,message,running}=useContext(NodeActions);
  const meta=catalog[data.kind];
  const label=data.kind==='generate'?(data.model||'Nano Banana Pro'):data.kind==='video'?(data.model||'Seedance'):meta.label;
  function upload(file?:File){if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1500000){message('Use PNG, JPG ou WebP de até 1,5 MB.');return;}const reader=new FileReader();reader.onerror=()=>message('Não foi possível ler a imagem.');reader.onload=()=>update(id,{image:String(reader.result),result:undefined});reader.readAsDataURL(file);}
  const src=data.result||data.image;
  return <article className={`studio-node node-${data.kind} ${selected?'selected':''} ${data.status==='Executando…'?'executing':''}`} style={{'--node-accent':meta.color} as React.CSSProperties}>
    <div className="node-title"><span/>{label}{data.kind==='generate'||data.kind==='upscale'?<small>DEMO</small>:data.kind==='video'?<small>API PENDENTE</small>:null}</div>
    {meta.input&&<Handle type="target" position={Position.Left} title={`Entrada: ${meta.input}`} className={meta.input==='text'?'text-port':'image-port'}/>}
    {meta.output&&<Handle type="source" position={Position.Right} title={`Saída: ${meta.output}`} className={meta.output==='text'?'text-port':'image-port'}/>}
    {data.kind==='prompt'?<><textarea aria-label="Prompt" disabled={running} className="nodrag nowheel prompt-text" value={data.prompt||''} placeholder="Descreva sua ideia para gerar imagens…" maxLength={8000} onChange={e=>update(id,{prompt:e.target.value})}/><div className="prompt-footer"><Type size={13}/><span>{data.prompt?.length||0} / 8000</span></div></>:
      data.kind==='image'?<label className="node-upload nodrag">{src?<img src={src} alt="Imagem de referência"/>:<><Upload size={25}/><strong>Adicionar imagem</strong><span>PNG, JPG ou WebP · até 1,5 MB</span></>}<input type="file" aria-label="Carregar imagem" accept="image/png,image/jpeg,image/webp" disabled={running} onChange={e=>{upload(e.target.files?.[0]);e.target.value='';}}/></label>:
      <div className={`node-preview ratio-${(data.ratio||'1:1').replace(':','-')}`}>{src?<><img src={src} alt="Resultado do workflow"/>{src===DEMO_IMAGE&&<span className="preview-label">ILUSTRAÇÃO DEMONSTRATIVA</span>}</>:<span>{data.kind==='video'?'Conecte um prompt · modelo ainda não integrado':data.kind==='output'?'Conecte uma imagem para visualizar':data.kind==='upscale'?'Conecte uma imagem para ampliar':'Conecte um prompt para gerar'}</span>}</div>}
    {data.kind!=='prompt'&&data.kind!=='image'&&<div className="node-controls nodrag">
      {data.kind==='generate'||data.kind==='video'?<><span className="node-chip">× 1</span><select aria-label="Proporção da prévia" value={data.ratio||'1:1'} disabled={running} onChange={e=>update(id,{ratio:e.target.value})}><option>1:1</option><option>16:9</option><option>9:16</option></select><details className="node-settings"><summary aria-label="Configurações do modelo"><Settings2 size={14}/></summary><div><strong>{label}</strong><p>{data.kind==='video'?'Este node guarda a etapa de vídeo. Conecte um provedor para executar.':'Teste o encadeamento com uma ilustração fixa, sem consumir créditos.'}</p><span>Prévia: {data.ratio||'1:1'}</span></div></details></>:<span className="node-state">{data.status|| (data.kind==='upscale'?'Demonstração · sem ampliação real':'Saída de imagem')}</span>}
      {src&&<a className="node-download" title="Baixar imagem" aria-label="Baixar imagem" href={src} download={src.startsWith('data:')?'cosmos-imagem':'cosmos-demo.svg'}><Download size={14}/></a>}
      {data.kind!=='output'&&<button className="node-play" title={data.kind==='video'?'Modelo ainda não conectado':'Testar workflow completo'} aria-label="Testar workflow a partir do node" disabled={running||data.kind==='video'} onClick={run}>{data.status==='Executando…'?<LoaderCircle className="spin" size={14}/>:<Play size={14} fill="currentColor"/>}</button>}
    </div>}
  </article>;
}

type MenuChoice={label:string;kind:Kind;model?:string};
const groups=[
  {label:'Gerar Imagem',icon:ImageIcon,items:[{label:'Nano Banana Pro',kind:'generate',model:'Nano Banana Pro'},{label:'Gerador de imagem',kind:'generate',model:'Gerador de imagem'}] as MenuChoice[]},
  {label:'Gerar Vídeo',icon:Video,items:[{label:'Seedance',kind:'video',model:'Seedance'},{label:'VEO',kind:'video',model:'VEO'}] as MenuChoice[]},
  {label:'Gerar 3D',icon:Box,items:[] as MenuChoice[]},
  {label:'Upscale de Imagem',icon:ScanLine,items:[{label:'Upscale',kind:'upscale'}] as MenuChoice[]},
  {label:'Utilitários',icon:Wrench,items:[{label:'Resultado',kind:'output'}] as MenuChoice[]},
  {label:'Entrada / Saída',icon:LogIn,items:[{label:'Carregar imagem',kind:'image'},{label:'Resultado',kind:'output'}] as MenuChoice[]},
  {label:'Texto / IA',icon:MessageSquare,items:[{label:'Prompt',kind:'prompt'}] as MenuChoice[]},
];
function NodeMenu({x,y,onAdd,onClose}: {x:number;y:number;onAdd:(choice:MenuChoice)=>void;onClose:()=>void}){
  const [search,setSearch]=useState('');const [expanded,setExpanded]=useState('');
  const choices=[{label:'Prompt',kind:'prompt'} as MenuChoice,...groups.flatMap(g=>g.items)].filter((item,index,items)=>items.findIndex(i=>i.label===item.label)===index);
  return <div className="node-menu" role="dialog" aria-label="Adicionar node" style={{left:Math.max(8,Math.min(x,window.innerWidth-310)),top:Math.max(70,Math.min(y,window.innerHeight-430))}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')onClose();}}>
    <div className="node-search"><Search size={15}/><input autoFocus aria-label="Buscar nodes" placeholder="Buscar nodes…" value={search} onChange={e=>setSearch(e.target.value)}/><button aria-label="Fechar menu de nodes" onClick={onClose}><X size={13}/></button></div>
    <div className="node-menu-items">{search?choices.filter(c=>c.label.toLowerCase().includes(search.toLowerCase())).map(c=><button key={c.label} onClick={()=>onAdd(c)}>{c.label}<Plus size={12}/></button>):<>
      <button className="featured" onClick={()=>onAdd({label:'Prompt',kind:'prompt'})}>Prompt</button>
      <button onClick={()=>onAdd({label:'Nano Banana Pro',kind:'generate',model:'Nano Banana Pro'})}>Nano Banana Pro <small>DEMO</small></button>
      <button onClick={()=>onAdd({label:'VEO',kind:'video',model:'VEO'})}>VEO <small>EM BREVE</small></button>
      {groups.map(group=><div className="node-menu-group" key={group.label}><button aria-expanded={expanded===group.label} onClick={()=>setExpanded(expanded===group.label?'':group.label)}>{expanded===group.label?<ChevronDown size={12}/>:<ChevronRight size={12}/>}<group.icon size={14}/><strong>{group.label}</strong></button>{expanded===group.label&&<div className="node-submenu">{group.items.length?group.items.map(item=><button key={item.label} onClick={()=>onAdd(item)}>{item.label}<Plus size={12}/></button>):<p>Modelos 3D disponíveis em uma próxima etapa.</p>}</div>}</div>)}
    </>}</div>
    {search&&!choices.some(c=>c.label.toLowerCase().includes(search.toLowerCase()))&&<p className="menu-empty">Nenhum node encontrado.</p>}
  </div>;
}

type Props={initial:Project;folders:string[];onBack:()=>void;onSave:(project:Project)=>boolean;onCloudSave:(project:Project)=>Promise<void>;message:(text:string)=>void;signedIn:boolean};
export default function Editor(props:Props){return <ReactFlowProvider><Canvas {...props}/></ReactFlowProvider>;}
function Canvas({initial,folders,onBack,onSave,onCloudSave,message,signedIn}:Props){
  const baseline=useRef(initial);
  const [nodes,setNodes,onNodesChange]=useNodesState<FlowNode>(initial.nodes);
  const [edges,setEdges,onEdgesChange]=useEdgesState(initial.edges);
  const [name,setName]=useState(initial.name);const [folder,setFolder]=useState(initial.folder||'');
  const [running,setRunning]=useState(false);const [saving,setSaving]=useState(false);const [saved,setSaved]=useState(true);
  const [menu,setMenu]=useState<{x:number;y:number}|null>(null);const [help,setHelp]=useState(false);
  const {screenToFlowPosition,fitView}=useReactFlow();
  const snapshot=useMemo(()=>cleanProject({...baseline.current,name,folder,nodes,edges,updatedAt:Date.now()}),[name,folder,nodes,edges]);
  const latest=useRef(snapshot);latest.current=snapshot;
  const active=nodes.find(n=>n.selected);
  const update=useCallback((id:string,patch:Partial<NodeData>)=>setNodes(ns=>ns.map(n=>n.id===id?{...n,data:{...n.data,...patch}}:n)),[setNodes]);
  useEffect(()=>{setSaved(false);const timer=setTimeout(()=>setSaved(onSave(snapshot)),500);return()=>clearTimeout(timer);},[snapshot,onSave]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(e.key==='Escape'){setMenu(null);setHelp(false);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!running)setMenu({x:window.innerWidth/2-150,y:window.innerHeight/2-170});}if(e.key==='Tab'&&target===document.body&&!running){e.preventDefault();setMenu({x:window.innerWidth/2-150,y:window.innerHeight/2-170});}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[running]);
  function addNode(choice:MenuChoice){if(nodes.length>=100){message('Limite de 100 nodes por workflow.');return;}const point=menu||{x:window.innerWidth/2,y:window.innerHeight/2};setNodes(ns=>[...ns.map(n=>({...n,selected:false})),{id:crypto.randomUUID(),type:'studio',position:screenToFlowPosition(point),selected:true,data:{kind:choice.kind,...(choice.model?{model:choice.model}:{}),...(choice.kind==='prompt'?{prompt:''}:{})}}]);setMenu(null);}
  async function run(){
    try{
      const ordered=orderGraph(nodes,edges) as FlowNode[];
      if(!ordered.length)throw new Error('Adicione nodes para criar seu primeiro fluxo.');
      if(ordered.some(n=>n.data.kind==='video'))throw new Error('O modelo de vídeo ainda não está conectado. Remova esse node para testar o fluxo de imagem.');
      for(const n of ordered){if(catalog[n.data.kind].input&&!edges.some(e=>e.target===n.id))throw new Error(`Conecte uma entrada ao node ${catalog[n.data.kind].label}.`);if(n.data.kind==='prompt'&&!n.data.prompt?.trim())throw new Error('Escreva um prompt antes de executar.');if(n.data.kind==='image'&&!n.data.image)throw new Error('Carregue uma imagem antes de executar.');}
      setRunning(true);setMenu(null);const values=new Map<string,string>();
      setNodes(ns=>ns.map(n=>({...n,data:{...n.data,status:undefined,result:undefined}})));
      for(const n of ordered){update(n.id,{status:'Executando…'});await new Promise(resolve=>setTimeout(resolve,450));const source=edges.find(e=>e.target===n.id)?.source;const input=source?values.get(source):undefined;const output=n.data.kind==='prompt'?n.data.prompt!:n.data.kind==='image'?n.data.image!:n.data.kind==='generate'?DEMO_IMAGE:input!;values.set(n.id,output);update(n.id,{status:'Concluído',...(n.data.kind!=='prompt'?{result:output}:{})});}
      message('Demonstração concluída. Nenhuma API foi chamada.');
    }catch(e){message((e as Error).message);}finally{setRunning(false);}
  }
  function back(){if(onSave(latest.current))onBack();}
  return <NodeActions.Provider value={{update,run:()=>void run(),message,running}}><main className="editor">
    <header className="editor-header"><div className="editor-heading"><button className="icon-button" aria-label="Voltar aos workflows" title="Voltar aos workflows" disabled={running} onClick={back}><ArrowLeft size={19}/></button><Wordmark/><span className="header-divider"/><input aria-label="Nome do workflow" value={name} maxLength={120} onChange={e=>setName(e.target.value)} placeholder="Untitled"/><select aria-label="Pasta do workflow" value={folder} onChange={e=>setFolder(e.target.value)}><option value="">Sem pasta</option>{folders.map(f=><option key={f}>{f}</option>)}</select></div><div className="editor-actions"><span className="save-status">{saved?<Check size={13}/>:<LoaderCircle size={13}/>}<span>{saved?'Salvo localmente':'Salvando…'}</span></span><button className="icon-button" aria-label="Exportar workflow" title="Exportar workflow" onClick={()=>exportProject(snapshot)}><Download size={17}/></button><button className="outline-button cloud-save" disabled={saving||running} onClick={async()=>{setSaving(true);try{await onCloudSave(snapshot);}catch(e){message((e as Error).message);}finally{setSaving(false);}}}>{saving?<LoaderCircle className="spin" size={15}/>:<Cloud size={15}/>}<span>Salvar na nuvem</span></button><button className="primary run-button" disabled={running} onClick={()=>void run()}>{running?<LoaderCircle className="spin" size={15}/>:<Play size={14} fill="currentColor"/>}<span>{running?'Executando':'Testar fluxo'}</span><small>DEMO</small></button></div></header>
    <div className="flow-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={running?undefined:onNodesChange} onEdgesChange={running?undefined:onEdgesChange} onConnect={(c:Connection)=>setEdges(es=>addEdge(c,es))} isValidConnection={c=>validConnection(c,nodes,edges)} onPaneContextMenu={e=>{e.preventDefault();if(!running)setMenu({x:e.clientX,y:e.clientY});}} onPaneClick={()=>setMenu(null)} fitView fitViewOptions={{padding:.18,maxZoom:.85}} minZoom={.15} maxZoom={1.75} nodesDraggable={!running} nodesConnectable={!running} elementsSelectable={!running} deleteKeyCode={running||menu?null:['Delete','Backspace']} defaultEdgeOptions={{type:'default',style:{stroke:'#ed3b9c',strokeWidth:2,strokeDasharray:'5 8'}}} proOptions={{hideAttribution:true}}><Background gap={20} size={1} color="#262629"/><Controls showInteractive={false}/></ReactFlow>
      {!nodes.length&&<div className="empty-canvas"><Workflow size={32}/><h1>O que vamos criar?</h1><p>Todo universo começa com uma ideia.</p><button className="outline-button" onClick={()=>setMenu({x:window.innerWidth/2-140,y:window.innerHeight/2-100})}><Plus size={16}/>Adicionar primeiro node</button></div>}
      <div className="canvas-toolbar"><button className={menu?'active':''} aria-label="Adicionar node" title="Adicionar node (Ctrl+K)" disabled={running} onClick={()=>setMenu(menu?null:{x:80,y:140})}><Plus size={20}/></button><span/><button aria-label="Enquadrar canvas" title="Enquadrar canvas" onClick={()=>void fitView({padding:.2,duration:300,maxZoom:1})}><Maximize2 size={17}/></button><button aria-label="Ajuda do editor" title="Ajuda do editor" onClick={()=>setHelp(!help)}><HelpCircle size={18}/></button></div>
      <div className="canvas-info">{nodes.length} nodes <span>·</span> {edges.length} conexões <i/> {signedIn?'Workspace pessoal':'Modo demo'}</div>
      <div className="canvas-watermark"><Wordmark/> <span>BETA</span></div>
      {active&&!running&&<div className="selection-toolbar"><span>{active.data.model||catalog[active.data.kind].label}</span><button aria-label="Duplicar node" title="Duplicar node" onClick={()=>{if(nodes.length>=100)return message('Limite de 100 nodes por workflow.');setNodes(ns=>[...ns.map(n=>({...n,selected:false})),{...active,id:crypto.randomUUID(),position:{x:active.position.x+50,y:active.position.y+70},data:{...active.data,status:undefined},selected:true}]);}}><Copy size={15}/></button><button aria-label="Excluir node" title="Excluir node" onClick={()=>{setNodes(ns=>ns.filter(n=>n.id!==active.id));setEdges(es=>es.filter(e=>e.source!==active.id&&e.target!==active.id));}}><Trash2 size={15}/></button></div>}
      {help&&<div className="editor-help"><button className="icon-button" aria-label="Fechar ajuda" onClick={()=>setHelp(false)}><X size={15}/></button><h2>Ideias que se conectam.</h2><p><b>Adicionar:</b> botão +, clique direito ou Ctrl+K.</p><p><b>Conectar:</b> arraste da saída de um node até a entrada de outro. Texto conecta a geração; imagem conecta ao resultado.</p><p><b>Navegar:</b> arraste o fundo e use a roda para zoom.</p><p><b>Excluir:</b> selecione um node ou conexão e pressione Delete.</p><small>A geração usa uma ilustração fixa. Upscale repassa a imagem sem ampliá-la. Nenhuma API é consumida.</small></div>}
    </div>
    {menu&&<NodeMenu {...menu} onAdd={addNode} onClose={()=>setMenu(null)}/>}
  </main></NodeActions.Provider>;
}
