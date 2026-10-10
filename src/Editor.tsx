import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position, addEdge, useEdgesState, useEdges, useNodesState, useReactFlow, type NodeProps, type Connection } from '@xyflow/react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Cloud, Copy, Download, FolderOpen, Image as ImageIcon, LoaderCircle, Maximize2, MoreHorizontal, Play, Plus, Search, Settings2, Sparkles, Trash2, Type, Upload, Video, Workflow, X, Box, ScanLine, Wrench, LogIn, MessageSquare, HelpCircle } from 'lucide-react';
import { catalog, orderGraph, validConnection } from './graph.mjs';
import { cleanProject, exportProject } from './projects';
import { DEMO_IMAGE, type FlowNode, type Kind, type NodeData, type Project } from './types';
import { Wordmark } from './AuthScreen';
import { models, findModel, buildTask } from './runware-models.mjs';
import {runwareConfigured, requestGeneration, waitGeneration} from './runware';

type Actions = {update:(id:string,patch:Partial<NodeData>)=>void; run:(id?:string)=>void; message:(text:string)=>void; running:boolean};
const NodeActions=createContext<Actions>({update:()=>{},run:()=>{},message:()=>{},running:false});
const nodeTypes={studio:StudioNode};

function StudioNode({id,data,selected}:NodeProps<FlowNode>){
  const {update,run,message,running}=useContext(NodeActions);
  const meta=catalog[data.kind];
  const connections=useEdges();
  const promptConnected=connections.some(e=>e.target===id&&!e.targetHandle);
  const imageConnected=connections.some(e=>e.target===id&&e.targetHandle==='reference');
  const busy=data.status==='Executando…'||data.status==='Aguardando Runware…';
  const outputLabel=meta.output==='text'?'Texto':meta.output==='video'?'Vídeo':'Imagem';
  const label=data.kind==='generate'?(data.model||'Nano Banana Pro'):data.kind==='video'?(data.model||'Seedance'):meta.label;
  function upload(file?:File){if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1500000){message('Use PNG, JPG ou WebP de até 1,5 MB.');return;}const reader=new FileReader();reader.onerror=()=>message('Não foi possível ler a imagem.');reader.onload=()=>update(id,{image:String(reader.result),result:undefined});reader.readAsDataURL(file);}
  const src=data.result||data.image;
  const model=findModel(data.model||(data.kind==='video'?'Seedance 2.5':'Nano Banana Pro'));
  const isVideo=data.mediaType==='video'||data.kind==='video';
  const hasModelInputs=['generate','video'].includes(data.kind);
  return <article className={`studio-node node-${data.kind} ${selected?'selected':''} ${busy?'executing':''}`} style={{'--node-accent':meta.color} as React.CSSProperties}>
    <div className="node-title"><span/>{label}{['generate','video'].includes(data.kind)?<small>RUNWARE</small>:data.kind==='upscale'?<small>DEMO</small>:null}</div>
    {hasModelInputs?<div className="model-inputs">
      <div className="model-input-row prompt-input"><Handle type="target" position={Position.Left} title="Entrada de prompt" aria-label="Entrada de prompt" className="text-port" style={{top:22}}/><Type size={13}/><span>Prompt</span><small>{promptConnected?'Conectado':'Obrigatório'}</small></div>
      <div className="model-input-row reference-input"><Handle id="reference" type="target" position={Position.Left} title="Entrada de imagem de referência" aria-label="Entrada de imagem de referência" className="image-port" style={{top:56}}/><ImageIcon size={13}/><span>Imagem</span><small>{imageConnected?'Conectada':data.kind==='video'?'Frame inicial · opcional':'Referência · opcional'}</small></div>
      <div className={`model-input-row model-output-row ${meta.output}-output`}><small>Saída</small><span>{outputLabel}</span>{isVideo?<Video size={13}/>:<ImageIcon size={13}/>}</div>
    </div>:meta.input&&<Handle type="target" position={Position.Left} title={`Entrada: ${meta.input}`} className={meta.input==='text'?'text-port':'image-port'}/>}
    {meta.output&&<Handle type="source" position={Position.Right} title={`Saída de ${outputLabel.toLowerCase()}`} aria-label={`Saída de ${outputLabel.toLowerCase()}`} className={`${meta.output}-port`} style={hasModelInputs?{top:90}:undefined}/>}
    {data.kind==='prompt'?<><textarea aria-label="Prompt" disabled={running} className="nodrag nowheel prompt-text" value={data.prompt||''} placeholder="Descreva sua ideia para gerar imagens…" maxLength={3000} onChange={e=>update(id,{prompt:e.target.value})}/><div className="prompt-footer"><Type size={13}/><span>{data.prompt?.length||0} / 3000</span></div></>:
      data.kind==='image'?<label className="node-upload nodrag">{src?<img src={src} alt="Imagem de referência"/>:<><Upload size={25}/><strong>Adicionar imagem</strong><span>PNG, JPG ou WebP · até 1,5 MB</span></>}<input type="file" aria-label="Carregar imagem" accept="image/png,image/jpeg,image/webp" disabled={running} onChange={e=>{upload(e.target.files?.[0]);e.target.value='';}}/></label>:
      <div className={`node-preview ratio-${(data.ratio||'1:1').replace(':','-')}`}>{src?<>{isVideo?<video className="nodrag nowheel" src={src} controls preload="metadata"/>:<img src={src} alt="Resultado do workflow"/>}{src===DEMO_IMAGE&&<span className="preview-label">ILUSTRAÇÃO DEMONSTRATIVA</span>}</>:<span>{hasModelInputs?(promptConnected?'Pronto para gerar'+(imageConnected?' com imagem de referência':''):'Conecte um node Prompt à entrada rosa'):data.kind==='output'?'Conecte uma imagem para visualizar':data.kind==='upscale'?'Conecte uma imagem para ampliar':'Conecte um prompt para gerar'}</span>}</div>}
    {hasModelInputs&&(data.status||data.pendingTask)&&<div className="generation-status" role="status">{busy&&<LoaderCircle className="spin" size={13}/>}<span>{data.status||(data.pendingTask?'Geração pendente · clique para consultar':'')}</span></div>}
    {data.kind!=='prompt'&&data.kind!=='image'&&<div className="node-controls nodrag">
      {data.kind==='generate'||data.kind==='video'?<><span className="node-chip">× 1</span><select aria-label="Proporção da geração" value={data.ratio||(data.kind==='video'?'16:9':'1:1')} disabled={running} onChange={e=>update(id,{ratio:e.target.value})}>{Object.keys(model?.sizes||{'1:1':[],'16:9':[],'9:16':[]}).map(r=><option key={r}>{r}</option>)}</select>{data.kind==='video'&&<select aria-label="Duração do vídeo" value={data.duration||'4'} disabled={running} onChange={e=>update(id,{duration:e.target.value})}><option value="4">4 s</option><option value="6">6 s</option><option value="8">8 s</option></select>}<details className="node-settings"><summary aria-label="Configurações do modelo"><Settings2 size={14}/></summary><div><strong>{label}</strong><p>Geração pela Runware. Consome créditos da conta conectada.</p><span>Proporção: {data.ratio||'1:1'}</span></div></details></>:<span className="node-state">{data.status|| (data.kind==='upscale'?'Demonstração · sem ampliação real':'Saída de mídia')}</span>}
      {src&&<a className="node-download" title={isVideo?'Abrir vídeo':'Abrir imagem'} aria-label={isVideo?'Abrir vídeo':'Abrir imagem'} href={src} target="_blank" rel="noreferrer" download={src===DEMO_IMAGE?'cosmos-demo.svg':isVideo?'cosmos-video.mp4':'cosmos-imagem.png'}><Download size={14}/></a>}
      {data.kind!=='output'&&<button className="node-play" title="Gerar este node e suas entradas" aria-label={data.pendingTask?'Consultar geração pendente':'Gerar '+label} disabled={running} onClick={()=>run(id)}>{busy?<LoaderCircle className="spin" size={14}/>:<Play size={14} fill="currentColor"/>}</button>}
    </div>}
  </article>;
}

type MenuChoice={label:string;kind:Kind;model?:string};
const groups=[
  {label:'Gerar Imagem',icon:ImageIcon,items:models.filter(m=>m.kind==='generate').map(m=>({label:m.label,kind:'generate',model:m.label})) as MenuChoice[]},
  {label:'Gerar Vídeo',icon:Video,items:models.filter(m=>m.kind==='video').map(m=>({label:m.label,kind:'video',model:m.label})) as MenuChoice[]},
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
      <button onClick={()=>onAdd({label:'Nano Banana Pro',kind:'generate',model:'Nano Banana Pro'})}>Nano Banana Pro <small>RUNWARE</small></button>
      <button onClick={()=>onAdd({label:'VEO',kind:'video',model:'VEO'})}>VEO 3.1 <small>RUNWARE</small></button>
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
  const displayEdges=useMemo(()=>edges.map(edge=>{
    const kind=nodes.find(node=>node.id===edge.source)?.data.kind;
    const output=kind?catalog[kind].output:undefined;
    return {...edge,style:{stroke:output==='text'?'#ed3b9c':output==='video'?'#ac8bfa':'#06bdd5',strokeWidth:2,strokeDasharray:'5 8'}};
  }),[edges,nodes]);
  const [name,setName]=useState(initial.name);const [folder,setFolder]=useState(initial.folder||'');
  const [running,setRunning]=useState(false);const runLock=useRef(false);const abortRun=useRef<AbortController|null>(null);
  useEffect(()=>()=>abortRun.current?.abort(),[]);const [saving,setSaving]=useState(false);const [saved,setSaved]=useState(true);
  const [menu,setMenu]=useState<{x:number;y:number}|null>(null);const [help,setHelp]=useState(false);
  const {screenToFlowPosition,fitView}=useReactFlow();
  const snapshot=useMemo(()=>cleanProject({...baseline.current,name,folder,nodes,edges,updatedAt:Date.now()}),[name,folder,nodes,edges]);
  const latest=useRef(snapshot);latest.current=snapshot;
  const active=nodes.find(n=>n.selected);
  const update=useCallback((id:string,patch:Partial<NodeData>)=>setNodes(ns=>ns.map(n=>n.id===id?{...n,data:{...n.data,...patch}}:n)),[setNodes]);
  useEffect(()=>{setSaved(false);const timer=setTimeout(()=>setSaved(onSave(snapshot)),500);return()=>clearTimeout(timer);},[snapshot,onSave]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(e.key==='Escape'){setMenu(null);setHelp(false);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!running)setMenu({x:window.innerWidth/2-150,y:window.innerHeight/2-170});}if(e.key==='Tab'&&target===document.body&&!running){e.preventDefault();setMenu({x:window.innerWidth/2-150,y:window.innerHeight/2-170});}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[running]);
  function addNode(choice:MenuChoice){if(nodes.length>=100){message('Limite de 100 nodes por workflow.');return;}const point=menu||{x:window.innerWidth/2,y:window.innerHeight/2};setNodes(ns=>[...ns.map(n=>({...n,selected:false})),{id:crypto.randomUUID(),type:'studio',position:screenToFlowPosition(point),selected:true,data:{kind:choice.kind,...(choice.model?{model:choice.model}:{}),...(choice.kind==='prompt'?{prompt:''}:choice.kind==='video'?{ratio:'16:9',duration:'4'}:{ratio:'1:1'})}}]);setMenu(null);}
  async function run(targetId?:string){
    if(runLock.current)return;
    let currentId='';
    try{
      let ordered=orderGraph(nodes,edges) as FlowNode[];
      if(targetId){const needed=new Set([targetId]);let changed=true;while(changed){changed=false;for(const e of edges)if(needed.has(e.target)&&!needed.has(e.source)){needed.add(e.source);changed=true;}}ordered=ordered.filter(n=>needed.has(n.id));}
      if(!ordered.length)throw new Error('Adicione nodes ao workflow.');
      const paid=ordered.some(n=>['generate','video'].includes(n.data.kind));
      const resuming=ordered.some(n=>n.data.pendingTask);
      if(paid&&(!runwareConfigured||!signedIn))throw new Error(!runwareConfigured?'Runware: aguardando ativação do backend.':'Entre na sua conta para usar os modelos Runware.');
      for(const n of ordered){
        if(n.data.pendingTask||(resuming&&n.data.result&&['generate','video'].includes(n.data.kind)))continue;
        if(catalog[n.data.kind].input&&!edges.some(e=>e.target===n.id&&!e.targetHandle))throw new Error('Conecte a entrada principal de '+(n.data.model||catalog[n.data.kind].label)+'.');
        if(n.data.kind==='prompt'&&!n.data.prompt?.trim())throw new Error('Escreva um prompt antes de gerar.');
        if(n.data.kind==='image'&&!n.data.image)throw new Error('Carregue uma imagem antes de gerar.');
        if(n.data.kind==='upscale'&&paid)throw new Error('Upscale real ainda não está integrado. Remova esse node antes de gerar.');
        if(['generate','video'].includes(n.data.kind)){
          const source=nodes.find(source=>source.id===edges.find(e=>e.target===n.id&&!e.targetHandle)?.source);
          buildTask({model:n.data.model||(n.data.kind==='video'?'Seedance 2.5':'Nano Banana Pro'),prompt:source?.data.prompt||'',ratio:n.data.ratio||(n.data.kind==='video'?'16:9':'1:1'),duration:n.data.duration},crypto.randomUUID());
        }
      }
      runLock.current=true;setRunning(true);setMenu(null);const controller=new AbortController();abortRun.current=controller;
      const values=new Map<string,{url:string;mediaType:string}>();
      for(const n of ordered){
        currentId=n.id;update(n.id,{status:'Executando…'});
        const source=edges.find(e=>e.target===n.id&&!e.targetHandle)?.source;
        const input=source?values.get(source):undefined;
        let output={url:'',mediaType:'image'};
        if(n.data.kind==='prompt')output={url:n.data.prompt!,mediaType:'text'};
        else if(n.data.kind==='image')output={url:n.data.image!,mediaType:'image'};
        else if(['generate','video'].includes(n.data.kind)){
          if(resuming&&!n.data.pendingTask&&n.data.result){output={url:n.data.result,mediaType:n.data.mediaType||'image'};values.set(n.id,output);update(n.id,{status:'Concluído'});continue;}
          const requestId=n.data.pendingTask||crypto.randomUUID();
          update(n.id,{pendingTask:requestId});
          // Persist before submission so reloads can recover the same paid task.
          const pendingProject=cleanProject({...latest.current,nodes:latest.current.nodes.map(item=>item.id===n.id?{...item,data:{...item.data,pendingTask:requestId}}:item)});
          if(!onSave(pendingProject)){update(n.id,{pendingTask:n.data.pendingTask});throw new Error('Não foi possível salvar a tarefa. Geração não enviada.');}
          const referenceId=edges.find(e=>e.target===n.id&&e.targetHandle==='reference')?.source;
          const reference=referenceId?values.get(referenceId)?.url:undefined;
          let result= n.data.pendingTask? await requestGeneration('status',{requestId},controller.signal):await requestGeneration('generate',{requestId,model:n.data.model||(n.data.kind==='video'?'Seedance 2.5':'Nano Banana Pro'),prompt:input?.url,ratio:n.data.ratio||(n.data.kind==='video'?'16:9':'1:1'),duration:n.data.duration,reference},controller.signal);
          if(result.state==='processing')result=await waitGeneration(requestId,controller.signal,()=>update(n.id,{status:'Aguardando Runware…'}));
          if(result.state==='error'){update(n.id,{pendingTask:undefined});throw new Error(result.error||'Falha na geração.');}
          if(!result.url)throw new Error('Resultado ainda indisponível. Consulte a pendência.');
          output={url:result.url,mediaType:result.mediaType||'image'};update(n.id,{pendingTask:undefined});
        }else output=input!;
        if(!output?.url)throw new Error('A entrada não retornou mídia.');
        values.set(n.id,output);update(n.id,{status:'Concluído',...(n.data.kind!=='prompt'?{result:output.url,mediaType:output.mediaType}:{})});
      }
      message(paid?'Geração concluída pela Runware.':'Workflow concluído.');
    }catch(e){if(currentId)update(currentId,{status:'Verifique a geração',...((e as {notSubmitted?:boolean}).notSubmitted?{pendingTask:undefined}:{})});message((e as Error).message);}finally{runLock.current=false;setRunning(false);}
  }
  function back(){if(onSave(latest.current))onBack();}
  return <NodeActions.Provider value={{update,run:(id)=>void run(id),message,running}}><main className="editor">
    <header className="editor-header"><div className="editor-heading"><button className="icon-button" aria-label="Voltar aos workflows" title="Voltar aos workflows" disabled={running} onClick={back}><ArrowLeft size={19}/></button><Wordmark/><span className="header-divider"/><input aria-label="Nome do workflow" value={name} maxLength={120} onChange={e=>setName(e.target.value)} placeholder="Untitled"/><select aria-label="Pasta do workflow" value={folder} onChange={e=>setFolder(e.target.value)}><option value="">Sem pasta</option>{folders.map(f=><option key={f}>{f}</option>)}</select></div><div className="editor-actions"><span className="save-status">{saved?<Check size={13}/>:<LoaderCircle size={13}/>}<span>{saved?'Salvo localmente':'Salvando…'}</span></span><button className="icon-button" aria-label="Exportar workflow" title="Exportar workflow" onClick={()=>exportProject(snapshot)}><Download size={17}/></button><button className="outline-button cloud-save" disabled={saving||running} onClick={async()=>{setSaving(true);try{await onCloudSave(snapshot);}catch(e){message((e as Error).message);}finally{setSaving(false);}}}>{saving?<LoaderCircle className="spin" size={15}/>:<Cloud size={15}/>}<span>Salvar na nuvem</span></button><button className="primary run-button" disabled={running} onClick={()=>void run()}>{running?<LoaderCircle className="spin" size={15}/>:<Play size={14} fill="currentColor"/>}<span>{running?'Executando':nodes.some(n=>n.data.pendingTask)?'Consultar pendência':'Gerar fluxo'}</span><small>RUNWARE</small></button></div></header>
    <div className="flow-canvas"><ReactFlow nodes={nodes} edges={displayEdges} nodeTypes={nodeTypes} onNodesChange={running?undefined:onNodesChange} onEdgesChange={running?undefined:onEdgesChange} onConnect={(c:Connection)=>setEdges(es=>addEdge(c,es))} isValidConnection={c=>validConnection(c,nodes,edges)} onPaneContextMenu={e=>{e.preventDefault();if(!running)setMenu({x:e.clientX,y:e.clientY});}} onPaneClick={()=>setMenu(null)} fitView fitViewOptions={{padding:.18,maxZoom:.85}} minZoom={.15} maxZoom={1.75} nodesDraggable={!running} nodesConnectable={!running} elementsSelectable={!running} deleteKeyCode={running||menu?null:['Delete','Backspace']} defaultEdgeOptions={{type:'default',style:{stroke:'#ed3b9c',strokeWidth:2,strokeDasharray:'5 8'}}} proOptions={{hideAttribution:true}}><Background gap={20} size={1} color="#262629"/><Controls showInteractive={false}/></ReactFlow>
      {!nodes.length&&<div className="empty-canvas"><Workflow size={32}/><h1>O que vamos criar?</h1><p>Todo universo começa com uma ideia.</p><button className="outline-button" onClick={()=>setMenu({x:window.innerWidth/2-140,y:window.innerHeight/2-100})}><Plus size={16}/>Adicionar primeiro node</button></div>}
      <div className="canvas-toolbar"><button className={menu?'active':''} aria-label="Adicionar node" title="Adicionar node (Ctrl+K)" disabled={running} onClick={()=>setMenu(menu?null:{x:80,y:140})}><Plus size={20}/></button><span/><button aria-label="Enquadrar canvas" title="Enquadrar canvas" onClick={()=>void fitView({padding:.2,duration:300,maxZoom:1})}><Maximize2 size={17}/></button><button aria-label="Ajuda do editor" title="Ajuda do editor" onClick={()=>setHelp(!help)}><HelpCircle size={18}/></button></div>
      <div className="canvas-info">{nodes.length} nodes <span>·</span> {edges.length} conexões <i/> {signedIn?'Workspace pessoal':'Modo demo'}</div>
      <div className="canvas-watermark"><Wordmark/> <span>BETA</span></div>
      {active&&!running&&<div className="selection-toolbar"><span>{active.data.model||catalog[active.data.kind].label}</span><button aria-label="Duplicar node" title="Duplicar node" onClick={()=>{if(nodes.length>=100)return message('Limite de 100 nodes por workflow.');setNodes(ns=>[...ns.map(n=>({...n,selected:false})),{...active,id:crypto.randomUUID(),position:{x:active.position.x+50,y:active.position.y+70},data:{...active.data,status:undefined,pendingTask:undefined},selected:true}]);}}><Copy size={15}/></button><button aria-label="Excluir node" title="Excluir node" onClick={()=>{setNodes(ns=>ns.filter(n=>n.id!==active.id));setEdges(es=>es.filter(e=>e.source!==active.id&&e.target!==active.id));}}><Trash2 size={15}/></button></div>}
      {help&&<div className="editor-help"><button className="icon-button" aria-label="Fechar ajuda" onClick={()=>setHelp(false)}><X size={15}/></button><h2>Ideias que se conectam.</h2><p><b>Adicionar:</b> botão +, clique direito ou Ctrl+K.</p><p><b>Conectar:</b> arraste da saída de um node até a entrada de outro. Texto (rosa) conecta ao Prompt; imagem (azul) conecta à Imagem de referência ou ao Resultado; vídeo (violeta) conecta ao Resultado.</p><p><b>Navegar:</b> arraste o fundo e use a roda para zoom.</p><p><b>Excluir:</b> selecione um node ou conexão e pressione Delete.</p><small>Gerar consome créditos Runware. A entrada rosa recebe o prompt e a azul recebe uma imagem de referência opcional. Vídeos aceitam 4, 6 ou 8 segundos. Upscale continua demonstrativo.</small></div>}
    </div>
    {menu&&<NodeMenu {...menu} onAdd={addNode} onClose={()=>setMenu(null)}/>}
  </main></NodeActions.Provider>;
}
