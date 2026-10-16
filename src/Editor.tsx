import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position, SelectionMode, addEdge, useEdgesState, useEdges, useUpdateNodeInternals, useNodesState, useReactFlow, type NodeProps, type Connection } from '@xyflow/react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Cloud, Copy, Download, FolderOpen, Image as ImageIcon, LoaderCircle, Maximize2, MoreHorizontal, Play, Plus, Search, Settings2, Sparkles, Trash2, Type, Upload, Video, Workflow, X, Box, ScanLine, Wrench, LogIn, MessageSquare, HelpCircle, MousePointer2, Hand } from 'lucide-react';
import { catalog, orderGraph, validConnection } from './graph.mjs';
import { cleanProject, exportProject } from './projects';
import { DEMO_IMAGE, type FlowNode, type Kind, type NodeData, type Project } from './types';
import { Wordmark } from './AuthScreen';
import { models, findModel, buildTask, availableResolutions, outputSize, switchModel, qualityOptions, durationOptions, referenceLimit, referenceSlots, referenceHandle, referenceIndex, collectReferences } from './runware-models.mjs';
import {estimateCost,dollars} from './pricing.mjs';
import {listCloudVersions} from './firebase';
import CompareNode from './CompareNode';
import {runwareConfigured, requestGeneration, waitGeneration} from './runware';

type Actions = {update:(id:string,patch:Partial<NodeData>)=>void; run:(id?:string)=>void; message:(text:string)=>void; running:boolean};
const NodeActions=createContext<Actions>({update:()=>{},run:()=>{},message:()=>{},running:false});
const nodeTypes={studio:StudioNode};

function VideoPreview({src,onShape}:{src:string;onShape:(ratio:number)=>void}){
  const ref=useRef<HTMLVideoElement>(null);
  const [playing,setPlaying]=useState(false),[muted,setMuted]=useState(false),[duration,setDuration]=useState(0),[time,setTime]=useState(0);
  useEffect(()=>{setPlaying(false);setDuration(0);setTime(0);},[src]);
  return <div className="video-preview-player nodrag nowheel"><video ref={ref} src={src} preload="metadata" playsInline muted={muted} onLoadedMetadata={e=>{const v=e.currentTarget;if(v.videoWidth&&v.videoHeight)onShape(v.videoWidth/v.videoHeight);setDuration(Number.isFinite(v.duration)?v.duration:0);}} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onTimeUpdate={e=>setTime(e.currentTarget.currentTime)}/><div className="video-playback">
    <button aria-label={playing?'Pausar vídeo':'Reproduzir vídeo'} title={playing?'Pausar vídeo':'Reproduzir vídeo'} onClick={()=>{const v=ref.current;if(v){if(v.paused)void v.play().catch(()=>setPlaying(false));else v.pause();}}}>{playing?'Ⅱ':<Play size={12}/>}</button>
    <input type="range" aria-label="Posição do vídeo" min={0} max={duration||1} step={.1} value={Math.min(time,duration||1)} disabled={!duration} onChange={e=>{if(ref.current)ref.current.currentTime=Number(e.target.value);setTime(Number(e.target.value));}}/>
    <button aria-label={muted?'Ativar áudio':'Silenciar vídeo'} title={muted?'Ativar áudio':'Silenciar vídeo'} onClick={()=>setMuted(!muted)}>{muted?'Som off':'Som on'}</button>
    <button aria-label="Vídeo em tela cheia" title="Vídeo em tela cheia" onClick={()=>{const v=ref.current;if(v)void v.parentElement?.requestFullscreen?.().catch(()=>{});}}><Maximize2 size={12}/></button>
  </div></div>;
}

function previewCost(data:NodeData,model:string|undefined){try{return model?estimateCost({...data,model}):null;}catch{return null;}}
function hasQuote(kind:string){return kind==='generate'||kind==='video';}
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
  const resolution=data.resolution||(data.kind==='video'?'720p':'1K');
  const quote=hasQuote(data.kind)?previewCost({...data,references:connections.filter(e=>e.target===id&&referenceIndex(e.targetHandle)>=0).map(()=>true)},model?.label):null;
  const size=outputSize(model,data.ratio||(data.kind==='video'?'16:9':'1:1'),resolution);
  const isVideo=data.mediaType==='video'||data.kind==='video';
  const hasModelInputs=['generate','video'].includes(data.kind);
  const slots=referenceSlots(data),limit=referenceLimit(model);
  const updateInternals=useUpdateNodeInternals();
  const [mediaShape,setMediaShape]=useState<{src:string;ratio:number}|null>(null);
  const requestedRatio=(data.ratio||(isVideo?'16:9':'1:1')).split(':').map(Number);
  const aspect=src&&mediaShape?.src===src?mediaShape.ratio:requestedRatio[0]/requestedRatio[1];
  useEffect(()=>{updateInternals(id);},[id,slots,aspect,updateInternals]);
  function changeModel(value:string){const next=findModel(value),cap=referenceLimit(next);if(connections.some(e=>e.target===id&&referenceIndex(e.targetHandle)>=cap)){message('Desconecte as referências extras antes de trocar para este modelo.');return;}update(id,{...switchModel(data,value),referenceSlots:String(Math.min(slots,cap))});}
  if(data.kind==='compare')return <CompareNode id={id} data={data} selected={selected} update={update} running={running}/>;
  return <article className={`studio-node node-${data.kind} ${selected?'selected':''} ${busy?'executing':''}`} style={{'--node-accent':meta.color} as React.CSSProperties}>
    <div className="node-title"><span/>{label}{data.kind==='upscale'?<small>DEMO</small>:null}</div>
    {hasModelInputs?<>
      <Handle type="target" position={Position.Left} title="Prompt · texto" aria-label="Entrada de prompt" className="text-port" style={{top:16}}/>
      {Array.from({length:slots},(_,i)=><Handle key={referenceHandle(i)} id={referenceHandle(i)} type="target" position={Position.Left} title={isVideo?(i===0?'Frame inicial':'Frame final'):`Imagem de referência ${i+1}`} aria-label={isVideo?(i===0?'Frame inicial':'Frame final'):`Imagem de referência ${i+1}`} className="image-port" style={{top:44+i*28}}/>)}
      {slots<limit&&<button className="reference-add nodrag nopan" style={{top:72+(slots-1)*28}} title={isVideo?'Adicionar frame final':`Adicionar referência (${slots}/${limit})`} aria-label="Adicionar referência de imagem" disabled={running||!!data.pendingTask} onClick={()=>update(id,{referenceSlots:String(slots+1)})}><Plus size={10}/></button>}
    </>:meta.input&&<Handle type="target" position={Position.Left} title={`Entrada: ${meta.input}`} className={meta.input==='text'?'text-port':'image-port'}/>}
    {meta.output&&<Handle type="source" position={Position.Right} title={`Saída de ${outputLabel.toLowerCase()}`} aria-label={`Saída de ${outputLabel.toLowerCase()}`} className={`${meta.output}-port`} style={hasModelInputs?{top:16}:undefined}/>}

    {data.kind==='prompt'?<><textarea aria-label="Prompt" disabled={running} className="nodrag nowheel prompt-text" value={data.prompt||''} placeholder="Descreva sua ideia para gerar imagens…" maxLength={3000} onChange={e=>update(id,{prompt:e.target.value})}/><div className="prompt-footer"><Type size={13}/><span>{data.prompt?.length||0} / 3000</span></div></>:
      data.kind==='image'?<label className="node-upload nodrag">{src?<img src={src} alt="Imagem de referência"/>:<><Upload size={25}/><strong>Adicionar imagem</strong><span>PNG, JPG ou WebP · até 1,5 MB</span></>}<input type="file" aria-label="Carregar imagem" accept="image/png,image/jpeg,image/webp" disabled={running} onChange={e=>{upload(e.target.files?.[0]);e.target.value='';}}/></label>:
      <div className={`node-preview ratio-${(data.ratio||'1:1').replace(':','-')}`} style={hasModelInputs?{height:Math.max(430/aspect,slots*28+70)}:undefined}>{src?<>{isVideo?<VideoPreview src={src} onShape={ratio=>setMediaShape({src:src!,ratio})}/>:<img src={src} alt="Resultado do workflow" onLoad={e=>{const v=e.currentTarget;if(v.naturalWidth&&v.naturalHeight)setMediaShape({src:src!,ratio:v.naturalWidth/v.naturalHeight});}}/>}{src===DEMO_IMAGE&&<span className="preview-label">ILUSTRAÇÃO DEMONSTRATIVA</span>}</>:<span>{hasModelInputs?(promptConnected?'Pronto para gerar'+(imageConnected?' com imagem de referência':''):'Conecte um prompt para gerar'):data.kind==='output'?'Conecte uma imagem para visualizar':data.kind==='upscale'?'Conecte uma imagem para ampliar':'Conecte um prompt para gerar'}</span>}{hasModelInputs&&busy&&<div className="cosmos-generating" role="status"><div className="cosmos-orbits" aria-hidden="true"><i/><i/><i/><b/></div><strong>{data.kind==='video'?'Criando seu vídeo':'Criando sua imagem'}</strong><span>{label} · {data.status==='Aguardando Runware…'?'Processando na Runware':'Enviando geração'}</span></div>}</div>}
    {hasModelInputs&&((data.status&&data.status!=='Concluído'&&!busy)||data.pendingTask&&!busy)&&<div className="generation-status" role="status">{busy&&<LoaderCircle className="spin" size={13}/>}<span>{data.status||(data.pendingTask?'Geração pendente · clique para consultar':'')}</span></div>}
    {data.kind!=='prompt'&&data.kind!=='image'&&<div className="node-controls nodrag">
      {data.kind==='generate'||data.kind==='video'?<><select className="model-select" title={model?.label} aria-label={data.kind==='video'?'Modelo de vídeo':'Modelo de imagem'} value={model?.label||''} disabled={running||!!data.pendingTask} onChange={e=>changeModel(e.target.value)}>{models.filter(m=>m.kind===data.kind).map(m=><option key={m.id} value={m.label}>{m.label}</option>)}</select><select aria-label="Proporção da geração" value={data.ratio||(data.kind==='video'?'16:9':'1:1')} disabled={running||(data.kind==='video'&&imageConnected)} title={data.kind==='video'&&imageConnected?'A proporção segue o frame inicial':'Proporção da geração'} onChange={e=>{const ratio=e.target.value;const options=availableResolutions(model,ratio);update(id,{ratio,resolution:options.includes(resolution)?resolution:options[0]});}}>{Object.keys(model?.sizes||{'1:1':[],'16:9':[],'9:16':[]}).map(r=><option key={r}>{r}</option>)}</select><select className="resolution-select" aria-label="Resolução da geração" title="Resolução da geração" disabled={running} value={resolution} onChange={e=>update(id,{resolution:e.target.value})}>{availableResolutions(model,data.ratio||(data.kind==='video'?'16:9':'1:1')).map(r=><option key={r} value={r}>{r}</option>)}</select>{data.kind==='video'&&<select aria-label="Duração do vídeo" value={data.duration||'4'} disabled={running} onChange={e=>update(id,{duration:e.target.value})}>{durationOptions(model).map(d=><option key={d} value={d}>{d} s</option>)}</select>}<details className="node-settings"><summary aria-label="Configurações do modelo"><Settings2 size={14}/></summary><div><strong>{label}</strong><p>Estimativa: {quote?dollars(quote.usd):'indisponível'}{quote?.variable?' · variável':''}</p>{data.cost&&<p>Última geração: {dollars(Number(data.cost))}</p>}{data.generatedModel&&src&&<p>Resultado: {data.generatedModel} · {data.generatedResolution}</p>}<p>{isVideo?'Entradas azuis: frame inicial e, quando disponível, final.':`Até ${limit} imagens de referência. Use + para adicionar entradas.`}</p>{slots>1&&<button disabled={running||!!data.pendingTask||connections.some(e=>e.target===id&&e.targetHandle===referenceHandle(slots-1))} onClick={()=>update(id,{referenceSlots:String(slots-1)})}>Remover última entrada vazia</button>}{qualityOptions(model).length>0&&<label>Qualidade<select aria-label="Qualidade da geração" value={data.quality||'auto'} disabled={running||!!data.pendingTask} onChange={e=>update(id,{quality:e.target.value})}>{qualityOptions(model).map(q=><option key={q} value={q}>{{auto:'Automática',low:'Baixa',medium:'Média',high:'Alta',xhigh:'Muito alta',max:'Máxima'}[q as string]||q}</option>)}</select></label>}<p>Geração pela Runware. Consome créditos da conta conectada.</p><span>{resolution} · {data.kind==='video'&&imageConnected?'proporção do frame inicial':size?.join(' × ')+' px'}</span><p>Resoluções maiores podem consumir mais créditos.</p></div></details></>:<span className="node-state">{data.status|| (data.kind==='upscale'?'Demonstração · sem ampliação real':'Saída de mídia')}</span>}
      {src&&<a className="node-download" title={isVideo?'Abrir vídeo':'Abrir imagem'} aria-label={isVideo?'Abrir vídeo':'Abrir imagem'} href={src} target="_blank" rel="noreferrer" download={src===DEMO_IMAGE?'cosmos-demo.svg':isVideo?'cosmos-video.mp4':'cosmos-imagem.png'}><Download size={14}/></a>}
      {data.kind!=='output'&&<button className="node-play" title="Gerar este node; reutilizar resultados das entradas" aria-label={data.pendingTask?'Consultar geração pendente':'Gerar '+label} disabled={running} onClick={()=>run(id)}>{busy?<LoaderCircle className="spin" size={14}/>:<Play size={14} fill="currentColor"/>}</button>}
    </div>}
  </article>;
}

type MenuChoice={label:string;kind:Kind;model?:string};
const groups=[
  {label:'Gerar 3D',icon:Box,items:[] as MenuChoice[]},
  {label:'Upscale de Imagem',icon:ScanLine,items:[{label:'Upscale',kind:'upscale'}] as MenuChoice[]},
  {label:'Utilitários',icon:Wrench,items:[{label:'Comparar imagens',kind:'compare'},{label:'Resultado',kind:'output'}] as MenuChoice[]},
  {label:'Entrada / Saída',icon:LogIn,items:[{label:'Carregar imagem',kind:'image'},{label:'Resultado',kind:'output'}] as MenuChoice[]},
  {label:'Texto / IA',icon:MessageSquare,items:[{label:'Prompt',kind:'prompt'}] as MenuChoice[]},
];
function NodeMenu({x,y,onAdd,onClose}: {x:number;y:number;onAdd:(choice:MenuChoice)=>void;onClose:()=>void}){
  const [search,setSearch]=useState('');const [expanded,setExpanded]=useState('');
  const choices=[{label:'Gerar imagem',kind:'generate',model:'Nano Banana Pro'} as MenuChoice,{label:'Gerar vídeo',kind:'video',model:'Seedance 2.5'} as MenuChoice,{label:'Prompt',kind:'prompt'} as MenuChoice,...groups.flatMap(g=>g.items)].filter((item,index,items)=>items.findIndex(i=>i.label===item.label)===index);
  return <div className="node-menu" role="dialog" aria-label="Adicionar node" style={{left:Math.max(8,Math.min(x,window.innerWidth-310)),top:Math.max(70,Math.min(y,window.innerHeight-430))}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')onClose();}}>
    <div className="node-search"><Search size={15}/><input autoFocus aria-label="Buscar nodes" placeholder="Buscar nodes…" value={search} onChange={e=>setSearch(e.target.value)}/><button aria-label="Fechar menu de nodes" onClick={onClose}><X size={13}/></button></div>
    <div className="node-menu-items">{search?choices.filter(c=>c.label.toLowerCase().includes(search.toLowerCase())).map(c=><button key={c.label} onClick={()=>onAdd(c)}>{c.label}<Plus size={12}/></button>):<>
      <button className="featured" onClick={()=>onAdd({label:'Prompt',kind:'prompt'})}>Prompt</button>
      <button onClick={()=>onAdd({label:'Gerar imagem',kind:'generate',model:'Nano Banana Pro'})}>Gerar imagem <small>RUNWARE</small></button>
      <button onClick={()=>onAdd({label:'Gerar vídeo',kind:'video',model:'Seedance 2.5'})}>Gerar vídeo <small>RUNWARE</small></button>
      {groups.map(group=><div className="node-menu-group" key={group.label}><button aria-expanded={expanded===group.label} onClick={()=>setExpanded(expanded===group.label?'':group.label)}>{expanded===group.label?<ChevronDown size={12}/>:<ChevronRight size={12}/>}<group.icon size={14}/><strong>{group.label}</strong></button>{expanded===group.label&&<div className="node-submenu">{group.items.length?group.items.map(item=><button key={item.label} onClick={()=>onAdd(item)}>{item.label}<Plus size={12}/></button>):<p>Modelos 3D disponíveis em uma próxima etapa.</p>}</div>}</div>)}
    </>}</div>
    {search&&!choices.some(c=>c.label.toLowerCase().includes(search.toLowerCase()))&&<p className="menu-empty">Nenhum node encontrado.</p>}
  </div>;
}

type Props={storageScope:string;initial:Project;folders:string[];onBack:()=>void;onSave:(project:Project)=>boolean;onCloudSave:(project:Project)=>Promise<void>;message:(text:string)=>void;signedIn:boolean};
export default function Editor(props:Props){return <ReactFlowProvider><Canvas {...props}/></ReactFlowProvider>;}
function Canvas({storageScope,initial,folders,onBack,onSave,onCloudSave,message,signedIn}:Props){
  const baseline=useRef(initial);
  const viewportKey=`cosmos:viewport:${storageScope}:${initial.id}`;
  const [savedViewport]=useState(()=>{try{const v=JSON.parse(localStorage.getItem(viewportKey)||'null');return v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.zoom)&&v.zoom>=.15&&v.zoom<=1.75?v:undefined;}catch{return undefined;}});

  const [nodes,setNodes,onNodesChange]=useNodesState<FlowNode>(initial.nodes);
  const [edges,setEdges,onEdgesChange]=useEdgesState(initial.edges);
  const displayEdges=useMemo(()=>edges.map(edge=>{
    const kind=nodes.find(node=>node.id===edge.source)?.data.kind;
    const output=kind?catalog[kind].output:undefined;
    return {...edge,style:{stroke:output==='text'?'#ed3b9c':output==='video'?'#ac8bfa':'#06bdd5',strokeWidth:2,strokeDasharray:'5 8'}};
  }),[edges,nodes]);
  const [name,setName]=useState(initial.name);const [folder,setFolder]=useState(initial.folder||'');
  const [cloudStatus,setCloudStatus]=useState(signedIn?'Aguardando sincronização':'Local');
  const [versions,setVersions]=useState<{id:string;graph:string;name:string}[]|null>(null);
  const cloudSaveRef=useRef(onCloudSave);cloudSaveRef.current=onCloudSave;
  const [running,setRunning]=useState(false);const runLock=useRef(false);const abortRun=useRef<AbortController|null>(null);
  useEffect(()=>()=>abortRun.current?.abort(),[]);const [saving,setSaving]=useState(false);const [saved,setSaved]=useState(true);
  const [menu,setMenu]=useState<{x:number;y:number}|null>(null);const [help,setHelp]=useState(false);
  const [canvasMode,setCanvasMode]=useState<'pan'|'select'>('pan');
  const {screenToFlowPosition,fitView}=useReactFlow();
  const snapshot=useMemo(()=>cleanProject({...baseline.current,name,folder,nodes,edges,updatedAt:Date.now()}),[name,folder,nodes,edges]);
  const latest=useRef(snapshot);latest.current=snapshot;
  const selectedNodes=nodes.filter(n=>n.selected);
  const active=selectedNodes[0];
  const undoStack=useRef<Project[]>([]),redoStack=useRef<Project[]>([]),previousEdit=useRef(snapshot),historySkip=useRef(false);
  const [,refreshHistory]=useState(0);
  useEffect(()=>{
    const signature=(p:Project)=>JSON.stringify({...p,updatedAt:0});
    if(signature(snapshot)===signature(previousEdit.current))return;
    if(historySkip.current){historySkip.current=false;previousEdit.current=snapshot;return;}
    if(running){previousEdit.current=snapshot;return;}
    const timer=setTimeout(()=>{undoStack.current=[...undoStack.current.slice(-19),previousEdit.current];redoStack.current=[];previousEdit.current=snapshot;refreshHistory(v=>v+1);},400);
    return()=>clearTimeout(timer);
  },[snapshot,running]);
  function historyMove(redo=false){
    if(running)return;const stack=redo?redoStack:undoStack;const p=stack.current.pop();if(!p)return;
    (redo?undoStack:redoStack).current.push(latest.current);historySkip.current=true;
    setNodes(p.nodes);setEdges(p.edges);setName(p.name);setFolder(p.folder||'');refreshHistory(v=>v+1);
  }
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=='z')return;const t=e.target as HTMLElement;if(t.closest('input,textarea,select,[contenteditable=true]'))return;e.preventDefault();historyMove(e.shiftKey);};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[running]);

  useEffect(()=>{
    if(!signedIn)return;
    setCloudStatus('Alterações locais');
    const timer=setTimeout(()=>{const current=snapshot;setCloudStatus('Salvando na nuvem…');void cloudSaveRef.current(current).then(()=>{if(latest.current===current)setCloudStatus('Salvo na nuvem');}).catch(e=>{setCloudStatus((e as Error).message);});},2500);
    return()=>clearTimeout(timer);
  },[snapshot,signedIn]);
  useEffect(()=>{
    const flush=()=>{if(signedIn)void cloudSaveRef.current(latest.current).catch(()=>{});};
    window.addEventListener('online',flush);return()=>window.removeEventListener('online',flush);
  },[signedIn]);
  useEffect(()=>{if(!signedIn)return;
    const controller=new AbortController();
    void (async()=>{for(const n of initial.nodes.filter(n=>n.data.pendingTask)){
      try{let r=await requestGeneration('status',{requestId:n.data.pendingTask},controller.signal);
       if(r.state==='processing')r=await waitGeneration(n.data.pendingTask!,controller.signal,()=>update(n.id,{status:'Aguardando Runware…'}));
       if(r.state==='success')update(n.id,{pendingTask:undefined,result:r.url,mediaType:r.mediaType,cost:r.cost!=null?String(r.cost):undefined,generatedModel:n.data.model,generatedResolution:n.data.resolution,status:'Concluído'});
       else if(r.state==='error')update(n.id,{pendingTask:undefined,status:r.error});
      }catch(e){if(!controller.signal.aborted)message((e as Error).message);}
    }})();return()=>controller.abort();
  },[signedIn]);

  const update=useCallback((id:string,patch:Partial<NodeData>)=>setNodes(ns=>ns.map(n=>n.id===id?{...n,data:{...n.data,...patch}}:n)),[setNodes]);
  useEffect(()=>{setSaved(false);const timer=setTimeout(()=>setSaved(onSave(snapshot)),500);return()=>clearTimeout(timer);},[snapshot,onSave]);
  useEffect(()=>{
    const flush=()=>{onSave(latest.current);};
    const hide=()=>{if(document.visibilityState==='hidden')flush();};
    window.addEventListener('pagehide',flush);window.addEventListener('beforeunload',flush);document.addEventListener('visibilitychange',hide);
    return()=>{window.removeEventListener('pagehide',flush);window.removeEventListener('beforeunload',flush);document.removeEventListener('visibilitychange',hide);};
  },[onSave]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(e.key==='Escape'){setMenu(null);setHelp(false);if(!target.closest('input,textarea,select,[contenteditable],[role=dialog]'))setCanvasMode('pan');}if(!running&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!target.closest('input,textarea,select,[contenteditable],[role=dialog]')){const key=e.key.toLowerCase();if(key==='v'||key==='h'){e.preventDefault();setCanvasMode(key==='v'?'select':'pan');setMenu(null);}}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!running)setMenu({x:window.innerWidth/2-150,y:window.innerHeight/2-170});}if(e.key==='Tab'&&target===document.body&&!running){e.preventDefault();setMenu({x:window.innerWidth/2-150,y:window.innerHeight/2-170});}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[running]);
  function addNode(choice:MenuChoice){if(nodes.length>=100){message('Limite de 100 nodes por workflow.');return;}const point=menu||{x:window.innerWidth/2,y:window.innerHeight/2};setNodes(ns=>[...ns.map(n=>({...n,selected:false})),{id:crypto.randomUUID(),type:'studio',position:screenToFlowPosition(point),selected:true,data:{kind:choice.kind,...(choice.model?{model:choice.model}:{}),...(choice.kind==='prompt'?{prompt:''}:choice.kind==='video'?{ratio:'16:9',duration:'4'}:{ratio:'1:1'})}}]);setMenu(null);}
  async function run(targetId?:string){
    if(runLock.current)return;
    let currentId='';
    try{
      let ordered=orderGraph(nodes,edges) as FlowNode[];
      if(targetId){const needed=new Set<string>();const visit=(id:string)=>{if(needed.has(id))return;needed.add(id);const n=nodes.find(n=>n.id===id);if(id!==targetId&&n?.data.result&&!n.data.pendingTask&&hasQuote(n.data.kind))return;for(const e of edges.filter(e=>e.target===id))visit(e.source);};visit(targetId);ordered=ordered.filter(n=>needed.has(n.id));}
      if(!ordered.length)throw new Error('Adicione nodes ao workflow.');
      const paid=ordered.some(n=>['generate','video'].includes(n.data.kind));
      const resuming=ordered.some(n=>n.data.pendingTask);
      if(paid&&(!runwareConfigured||!signedIn))throw new Error(!runwareConfigured?'Runware: aguardando ativação do backend.':'Entre na sua conta para usar os modelos Runware.');
      for(const n of ordered){
        if(n.data.pendingTask||((resuming||(!!targetId&&n.id!==targetId))&&n.data.result&&hasQuote(n.data.kind)))continue;
        if(n.data.kind==='compare'){if(!['a','b'].every(port=>edges.some(e=>e.target===n.id&&e.targetHandle===port)))throw new Error('Conecte as imagens A e B ao Comparar.');continue;}
        if(catalog[n.data.kind].input&&!edges.some(e=>e.target===n.id&&!e.targetHandle))throw new Error('Conecte a entrada principal de '+(n.data.model||catalog[n.data.kind].label)+'.');
        if(n.data.kind==='prompt'&&!n.data.prompt?.trim())throw new Error('Escreva um prompt antes de gerar.');
        if(n.data.kind==='image'&&!n.data.image)throw new Error('Carregue uma imagem antes de gerar.');
        if(n.data.kind==='upscale'&&paid)throw new Error('Upscale real ainda não está integrado. Remova esse node antes de gerar.');
        if(['generate','video'].includes(n.data.kind)){
          if(n.data.kind==='video'&&edges.some(e=>e.target===n.id&&e.targetHandle==='reference-2')&&!edges.some(e=>e.target===n.id&&e.targetHandle==='reference'))throw new Error('Conecte o frame inicial antes do frame final.');
          const source=nodes.find(source=>source.id===edges.find(e=>e.target===n.id&&!e.targetHandle)?.source);
          buildTask({model:n.data.model||(n.data.kind==='video'?'Seedance 2.5':'Nano Banana Pro'),prompt:source?.data.prompt||'',ratio:n.data.ratio||(n.data.kind==='video'?'16:9':'1:1'),duration:n.data.duration,resolution:n.data.resolution,quality:n.data.quality},crypto.randomUUID());
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
          if((resuming||(!!targetId&&n.id!==targetId))&&!n.data.pendingTask&&n.data.result){output={url:n.data.result,mediaType:n.data.mediaType||'image'};values.set(n.id,output);update(n.id,{status:'Concluído'});continue;}
          const references=n.data.pendingTask?[]:collectReferences(n,edges,values);
          const requestId=n.data.pendingTask||crypto.randomUUID();
          update(n.id,{pendingTask:requestId});
          // Persist before submission so reloads can recover the same paid task.
          const pendingProject=cleanProject({...latest.current,nodes:latest.current.nodes.map(item=>item.id===n.id?{...item,data:{...item.data,pendingTask:requestId}}:item)});
          if(!onSave(pendingProject)){update(n.id,{pendingTask:n.data.pendingTask});throw new Error('Não foi possível salvar a tarefa. Geração não enviada.');}
          let result= n.data.pendingTask? await requestGeneration('status',{requestId},controller.signal):await requestGeneration('generate',{requestId,model:n.data.model||(n.data.kind==='video'?'Seedance 2.5':'Nano Banana Pro'),prompt:input?.url,ratio:n.data.ratio||(n.data.kind==='video'?'16:9':'1:1'),duration:n.data.duration,resolution:n.data.resolution,quality:n.data.quality,references,projectId:initial.id,nodeId:n.id},controller.signal);
          if(result.state==='processing')result=await waitGeneration(requestId,controller.signal,()=>update(n.id,{status:'Aguardando Runware…'}));
          if(result.state==='error'){update(n.id,{pendingTask:undefined});throw new Error(result.error||'Falha na geração.');}
          if(!result.url)throw new Error('Resultado ainda indisponível. Consulte a pendência.');
          output={url:result.url,mediaType:result.mediaType||'image'};update(n.id,{pendingTask:undefined,cost:result.cost!=null?String(result.cost):undefined,generatedModel:n.data.model||'Nano Banana Pro',generatedResolution:n.data.resolution||(n.data.kind==='video'?'720p':'1K')});
        }else if(n.data.kind==='compare'){const selected=edges.find(e=>e.target===n.id&&e.targetHandle===(n.data.compareOutput||'a'))?.source;output=selected?values.get(selected)!:undefined!;}else output=input!;
        if(!output?.url)throw new Error('A entrada não retornou mídia.');
        values.set(n.id,output);update(n.id,{status:'Concluído',...(n.data.kind!=='prompt'?{result:output.url,mediaType:output.mediaType}:{})});
      }
      message(paid?'Geração concluída pela Runware.':'Workflow concluído.');
    }catch(e){if(currentId)update(currentId,{status:'Verifique a geração',...((e as {notSubmitted?:boolean}).notSubmitted?{pendingTask:undefined}:{})});message((e as Error).message);}finally{runLock.current=false;setRunning(false);}
  }
  function back(){if(onSave(latest.current)){if(signedIn)void onCloudSave(latest.current).catch(e=>message(e.message));onBack();}}
  return <NodeActions.Provider value={{update,run:(id)=>void run(id),message,running}}><main className="editor">
    <header className="editor-header"><div className="editor-heading"><button className="icon-button" aria-label="Voltar aos workflows" title="Voltar aos workflows" disabled={running} onClick={back}><ArrowLeft size={19}/></button><Wordmark/><span className="header-divider"/><input aria-label="Nome do workflow" value={name} maxLength={120} onChange={e=>setName(e.target.value)} placeholder="Untitled"/><select aria-label="Pasta do workflow" value={folder} onChange={e=>setFolder(e.target.value)}><option value="">Sem pasta</option>{folders.map(f=><option key={f}>{f}</option>)}</select></div><div className="editor-actions"><button className="icon-button" aria-label="Desfazer" title="Desfazer (Ctrl+Z)" disabled={running||!undoStack.current.length} onClick={()=>historyMove()}>↶</button><button className="icon-button" aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)" disabled={running||!redoStack.current.length} onClick={()=>historyMove(true)}>↷</button><span className="save-status" title={cloudStatus}>{saved?<Check size={13}/>:<LoaderCircle size={13}/>}<span>{saved?cloudStatus:'Salvando localmente…'}</span></span><button className="outline-button" disabled={!signedIn||running} onClick={()=>void listCloudVersions(initial.id).then(setVersions).catch(e=>message(e.message))}>Versões</button><button className="icon-button" aria-label="Exportar workflow"  title="Exportar workflow" onClick={()=>exportProject(snapshot)}><Download size={17}/></button><button className="outline-button cloud-save" disabled={saving||running} onClick={async()=>{setSaving(true);try{await onCloudSave(snapshot);setCloudStatus('Salvo na nuvem');}catch(e){message((e as Error).message);}finally{setSaving(false);}}}>{saving?<LoaderCircle className="spin" size={15}/>:<Cloud size={15}/>}<span>Salvar na nuvem</span></button><button className="primary run-button" disabled={running} onClick={()=>void run()}>{running?<LoaderCircle className="spin" size={15}/>:<Play size={14} fill="currentColor"/>}<span>{running?'Executando':nodes.some(n=>n.data.pendingTask)?'Consultar pendência':'Gerar fluxo'}</span><small>RUNWARE</small></button></div></header>
    {!['Local','Aguardando sincronização','Alterações locais','Salvando na nuvem…','Salvo na nuvem'].includes(cloudStatus)&&<div className="cloud-warning" role="alert">{cloudStatus} <button onClick={()=>exportProject(latest.current)}>Exportar backup</button></div>}
    <div className={`flow-canvas mode-${canvasMode}`}><ReactFlow nodes={nodes} edges={displayEdges} nodeTypes={nodeTypes} onNodesChange={running?undefined:onNodesChange} onEdgesChange={running?undefined:onEdgesChange} onConnect={(c:Connection)=>setEdges(es=>addEdge(c,es))} isValidConnection={c=>validConnection(c,nodes,edges)} onPaneContextMenu={e=>{e.preventDefault();if(!running)setMenu({x:e.clientX,y:e.clientY});}} onPaneClick={()=>setMenu(null)} defaultViewport={savedViewport} onMoveEnd={(_,viewport)=>{try{localStorage.setItem(viewportKey,JSON.stringify(viewport));}catch{/* Keep the canvas usable if storage is unavailable. */}}} fitView={!savedViewport} fitViewOptions={{padding:.18,maxZoom:.85}} minZoom={.15} maxZoom={1.75} selectionOnDrag={canvasMode==='select'&&!running} selectionMode={SelectionMode.Partial} panOnDrag={canvasMode==='select'?[1]:true} nodesDraggable={!running} nodesConnectable={!running} elementsSelectable={!running} deleteKeyCode={running||menu?null:['Delete','Backspace']} defaultEdgeOptions={{type:'default',style:{stroke:'#ed3b9c',strokeWidth:2,strokeDasharray:'5 8'}}} proOptions={{hideAttribution:true}}><Background gap={20} size={1} color="#262629"/><Controls showInteractive={false}/></ReactFlow>
      {!nodes.length&&<div className="empty-canvas"><Workflow size={32}/><h1>O que vamos criar?</h1><p>Todo universo começa com uma ideia.</p><button className="outline-button" onClick={()=>setMenu({x:window.innerWidth/2-140,y:window.innerHeight/2-100})}><Plus size={16}/>Adicionar primeiro node</button></div>}
      <div className="canvas-toolbar"><button className={canvasMode==='select'?'active':''} aria-label="Selecionar nodes" aria-pressed={canvasMode==='select'} title="Selecionar por retângulo (V)" disabled={running} onClick={()=>{setCanvasMode('select');setMenu(null);}}><MousePointer2 size={18}/></button><button className={canvasMode==='pan'?'active':''} aria-label="Mover canvas" aria-pressed={canvasMode==='pan'} title="Mover canvas (H ou Esc)" onClick={()=>setCanvasMode('pan')}><Hand size={18}/></button><span/><button className={menu?'active':''} aria-label="Adicionar node" title="Adicionar node (Ctrl+K)" disabled={running} onClick={()=>setMenu(menu?null:{x:80,y:140})}><Plus size={20}/></button><span/><button aria-label="Enquadrar canvas" title="Enquadrar canvas" onClick={()=>void fitView({padding:.2,duration:300,maxZoom:1})}><Maximize2 size={17}/></button><button aria-label="Ajuda do editor" title="Ajuda do editor" onClick={()=>setHelp(!help)}><HelpCircle size={18}/></button></div>
      <div className="canvas-info">{canvasMode==='select'?'Seleção · arraste no fundo': 'Mover · V para selecionar'} <span>·</span> {nodes.length} nodes <span>·</span> {edges.length} conexões <i/> {signedIn?'Workspace pessoal':'Modo demo'}</div>
      <div className="canvas-watermark"><Wordmark/> <span>BETA</span></div>
      {active&&!running&&<div className="selection-toolbar"><span>{selectedNodes.length>1?`${selectedNodes.length} nodes selecionados`:active.data.model||catalog[active.data.kind].label}</span><button aria-label="Duplicar seleção" title="Duplicar seleção" onClick={()=>{if(nodes.length+selectedNodes.length>100)return message('Limite de 100 nodes por workflow.');const ids=new Map(selectedNodes.map(n=>[n.id,crypto.randomUUID()]));setNodes(ns=>[...ns.map(n=>({...n,selected:false})),...selectedNodes.map(n=>({...n,id:ids.get(n.id)!,position:{x:n.position.x+50,y:n.position.y+70},data:{...n.data,status:undefined,pendingTask:undefined},selected:true}))]);setEdges(es=>[...es.map(e=>({...e,selected:false})),...es.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(e=>({...e,id:crypto.randomUUID(),source:ids.get(e.source)!,target:ids.get(e.target)!,selected:false}))]);}}><Copy size={15}/></button><button aria-label="Excluir seleção" title="Excluir seleção" onClick={()=>{const ids=new Set(selectedNodes.map(n=>n.id));setNodes(ns=>ns.filter(n=>!ids.has(n.id)));setEdges(es=>es.filter(e=>!ids.has(e.source)&&!ids.has(e.target)));}}><Trash2 size={15}/></button></div>}
      {help&&<div className="editor-help"><button className="icon-button" aria-label="Fechar ajuda" onClick={()=>setHelp(false)}><X size={15}/></button><h2>Ideias que se conectam.</h2><p><b>Adicionar:</b> botão +, clique direito ou Ctrl+K.</p><p><b>Conectar:</b> arraste da saída de um node até a entrada de outro. Texto (rosa) conecta ao Prompt; imagem (azul) conecta à Imagem de referência ou ao Resultado; vídeo (violeta) conecta ao Resultado.</p><p><b>Selecionar (V):</b> arraste no fundo para selecionar os nodes que tocam o retângulo. Arraste a seleção para mover o grupo.</p><p><b>Navegar (H ou Esc):</b> arraste o fundo. No modo seleção, use o botão do meio do mouse para navegar. Use a roda para zoom.</p><p><b>Excluir:</b> selecione um node ou conexão e pressione Delete.</p><small>Gerar consome créditos Runware. A entrada rosa recebe o prompt e a azul recebe uma imagem de referência opcional. Vídeos aceitam 4, 6 ou 8 segundos. Upscale continua demonstrativo.</small></div>}
    </div>
    {versions&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-label="Versões do workflow"><button className="icon-button" onClick={()=>setVersions(null)}>Fechar</button><h2>Versões na nuvem</h2><p>Até 10 pontos de recuperação, agrupados em intervalos de 5 minutos. Exporte a versão atual antes de restaurar.</p>{versions.length?versions.map(v=><button key={v.id} className="outline-button full-width" onClick={()=>{try{const p=cleanProject(JSON.parse(v.graph));exportProject(latest.current);setNodes(p.nodes);setEdges(p.edges);setName(p.name);setFolder(p.folder||'');setVersions(null);message('Versão restaurada. Backup anterior exportado.');}catch(e){message((e as Error).message);}}}>{new Date(JSON.parse(v.graph).updatedAt).toLocaleString('pt-BR')} · {v.name}</button>):<p>Nenhuma versão anterior salva.</p>}</section></div>}
    {menu&&<NodeMenu {...menu} onAdd={addNode} onClose={()=>setMenu(null)}/>}
  </main></NodeActions.Provider>;
}
