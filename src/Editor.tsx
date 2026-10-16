import PhotoshopNode from './PhotoshopNode';
import MagnificControls from './MagnificControls';
import {magnificModel,magnificOptions,isUpscale,upscaleModel,topazModels} from './magnific.mjs';
import LoadMedia,{uploadMediaFile} from './LoadMedia';
import {detachImage} from './detach-image.mjs';
import {imageChoices,imageName,renameMention,resolveImageMentions} from './image-mentions.mjs';
import ImageNodeMenu from './ImageNodeMenu';
import {nodeImage} from './workflow-cover.mjs';
import RunwareBalance from './RunwareBalance';
import PromptInput from './PromptInput';
import NodeSelect from './NodeSelect';
import KnifeTool from './KnifeTool';
import {nearestConnection,layoutChangesDuringRun} from './canvas-tools.mjs';
import {GroupFrames,GroupDialog} from './NodeGroups';
import {assignGroup} from './node-groups.mjs';
import type {NodeGroup} from './types';
import MediaViewer from './MediaViewer';
import DownloadMediaButton from './DownloadMediaButton';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position, SelectionMode, addEdge, useEdgesState, useEdges, useUpdateNodeInternals, useNodesState, useNodes, useReactFlow, type NodeProps, type Connection } from '@xyflow/react';
import { Scissors, Group, ArrowLeft, Check, ChevronDown, ChevronRight, Cloud, Copy, Download, FolderOpen, Image as ImageIcon, LoaderCircle, Maximize2, MoreHorizontal, Play, Pause, Plus, Search, Settings2, Sparkles, Trash2, Type, Upload, Video, Workflow, X, Box, ScanLine, Wrench, LogIn, MessageSquare, HelpCircle, MousePointer2, Hand } from 'lucide-react';
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

function ImageName({id,data,nodes,disabled,onRename,onError}:{id:string;data:NodeData;nodes:FlowNode[];disabled:boolean;onRename:(name:string)=>void;onError:(message:string)=>void}){
 const name=imageName({id,data}),[draft,setDraft]=useState(name);
 useEffect(()=>setDraft(name),[name]);
 function save(){const next=draft.trim();if(!next||next.length>60||/[\[\]\n@]/.test(next)||nodes.some(node=>node.id!==id&&['image','video'].includes(catalog[node.data.kind]?.output||'')&&imageName(node).toLocaleLowerCase()===next.toLocaleLowerCase())){setDraft(name);onError('Use um nome único de até 60 caracteres, sem @ ou colchetes.');return;}if(next!==name)onRename(next);}
 return <input className="image-name nodrag nopan" aria-label="Nome do node" title="Nome para mencionar no Prompt com @" disabled={disabled} maxLength={60} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={save} onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}if(e.key==='Escape'){e.preventDefault();setDraft(name);}}}/>;
}

export function VideoPreview({src,onShape}:{src:string;onShape:(ratio:number)=>void}){
  const ref=useRef<HTMLVideoElement>(null);
  const clickTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>clearTimeout(clickTimer.current),[]);
  const [playing,setPlaying]=useState(false);
  const {message}=useContext(NodeActions);
  useEffect(()=>{setPlaying(false);},[src]);
  function togglePlayback(){const v=ref.current;if(v){if(v.paused)void v.play().catch(()=>message('Não foi possível reproduzir este vídeo.'));else v.pause();}}
  return <div className="video-preview-player nodrag nowheel"><video ref={ref} src={src} preload="metadata" playsInline onClick={event=>{clearTimeout(clickTimer.current);if(event.detail===1)clickTimer.current=setTimeout(togglePlayback,250);}} onDoubleClick={()=>clearTimeout(clickTimer.current)} onLoadedMetadata={e=>{const v=e.currentTarget;if(v.videoWidth&&v.videoHeight)onShape(v.videoWidth/v.videoHeight);}} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}/><div className="video-playback">
    <button aria-label={playing?'Pausar vídeo':'Reproduzir vídeo'} title={playing?'Pausar vídeo':'Reproduzir vídeo'} onClick={togglePlayback}>{playing?<Pause size={15} fill="currentColor"/>:<Play size={15} fill="currentColor"/>}</button>
  </div></div>;
}

function previewCost(data:NodeData,model:string|undefined){try{return model?estimateCost({...data,model}):null;}catch{return null;}}
function hasQuote(kind:string){return kind==='generate'||kind==='video'||isUpscale(kind);}
function StudioNode({id,data,selected}:NodeProps<FlowNode>){
  const {update,run,message,running}=useContext(NodeActions);
  const [viewer,setViewer]=useState<{src:string;video:boolean;time:number}|null>(null);
  const nodeElement=useRef<HTMLElement>(null);
  const allNodes=useNodes<FlowNode>();
  const images=useMemo(()=>imageChoices(allNodes),[allNodes]);
  const meta=catalog[data.kind];
  const connections=useEdges();
  const promptConnected=connections.some(e=>e.target===id&&!e.targetHandle);
  const imageConnected=connections.some(e=>e.target===id&&e.targetHandle==='reference');
  const busy=data.status==='Executando…'||data.status==='Aguardando Runware…'||data.status==='Aguardando Magnific…';
  const outputLabel=meta.output==='text'?'Texto':meta.output==='video'?'Vídeo':'Imagem';
  const label=data.kind==='generate'?(data.model||'Nano Banana Pro'):data.kind==='video'?(data.model||'Seedance'):meta.label;
  function upload(file?:File){if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1500000){message('Use PNG, JPG ou WebP de até 1,5 MB.');return;}const reader=new FileReader();reader.onerror=()=>message('Não foi possível ler a imagem.');reader.onload=()=>update(id,{image:String(reader.result),result:undefined});reader.readAsDataURL(file);}
  const src=data.result||data.image;
  const model=findModel(data.model||(data.kind==='video'?'Seedance 2.5':'Nano Banana Pro'));
  const resolution=data.resolution||(data.kind==='video'?'720p':'1K');
  const quote=hasQuote(data.kind)?previewCost({...data,references:connections.filter(e=>e.target===id&&referenceIndex(e.targetHandle)>=0).map(()=>true)},model?.label):null;
  const size=outputSize(model,data.ratio||(data.kind==='video'?'16:9':'1:1'),resolution);
  const isVideo=data.mediaType==='video'||data.kind==='video'||data.kind==='loadvideo'||data.kind==='upscalevideo';
  const hasModelInputs=['generate','video'].includes(data.kind);
  const slots=referenceSlots(data),limit=referenceLimit(model);
  const updateInternals=useUpdateNodeInternals();
  const [mediaShape,setMediaShape]=useState<{src:string;ratio:number}|null>(null);
  const requestedRatio=(data.ratio||(isVideo?'16:9':'1:1')).split(':').map(Number);
  const aspect=src&&mediaShape?.src===src?mediaShape.ratio:requestedRatio[0]/requestedRatio[1];
  useEffect(()=>{updateInternals(id);},[id,slots,aspect,updateInternals]);
  function changeModel(value:string){const next=findModel(value),cap=referenceLimit(next);if(connections.some(e=>e.target===id&&referenceIndex(e.targetHandle)>=cap)){message('Desconecte as referências extras antes de trocar para este modelo.');return;}update(id,{...switchModel(data,value),referenceSlots:String(Math.min(slots,cap))});}
  function expand(){if(!src)return;const player=nodeElement.current?.querySelector('video');const time=player?.currentTime||0;player?.pause();setViewer({src,video:isVideo,time});}
  if(data.kind==='photoshop')return <PhotoshopNode id={id} data={data} selected={selected} update={update} message={message}/>;
  if(data.kind==='compare')return <CompareNode id={id} data={data} selected={selected} update={update} running={running}/>;
  return <article ref={nodeElement} onDoubleClick={event=>{if((event.target as HTMLElement).closest('button,select,input,textarea,summary,.node-controls,.react-flow__handle'))return;if(src){event.preventDefault();event.stopPropagation();expand();}}} className={`studio-node node-${data.kind} ${selected?'selected':''} ${busy?'executing':''}`} style={{'--node-accent':meta.color} as React.CSSProperties}>
    <div className="node-title"><span/>{['image','video'].includes(meta.output||'')?<ImageName id={id} data={data} nodes={allNodes} disabled={running} onRename={name=>update(id,{imageName:name})} onError={message}/>:label}{['image','video'].includes(meta.output||'')&&<small>{label}</small>}{isUpscale(data.kind)?<small>MAGNIFIC</small>:null}</div>
    {hasModelInputs?<>
      <Handle type="target" position={Position.Left} title="Prompt · texto" aria-label="Entrada de prompt" className={`text-port ${promptConnected?'port-connected':''}`} style={{top:16}}/>
      {Array.from({length:slots},(_,i)=><Handle key={referenceHandle(i)} id={referenceHandle(i)} type="target" position={Position.Left} title={isVideo?(i===0?'Frame inicial':'Frame final'):`Imagem de referência ${i+1}`} aria-label={isVideo?(i===0?'Frame inicial':'Frame final'):`Imagem de referência ${i+1}`} className={`image-port ${connections.some(e=>e.target===id&&e.targetHandle===referenceHandle(i))?'port-connected':''}`} style={{top:44+i*28}}/>)}
      {slots<limit&&<button className="reference-add nodrag nopan" style={{top:72+(slots-1)*28}} title={isVideo?'Adicionar frame final':`Adicionar referência (${slots}/${limit})`} aria-label="Adicionar referência de imagem" disabled={running||!!data.pendingTask} onClick={()=>update(id,{referenceSlots:String(slots+1)})}><Plus size={10}/></button>}
    </>:meta.input&&<Handle type="target" position={Position.Left} title={`Entrada: ${meta.input}`} className={`${meta.input==='text'?'text-port':meta.input==='video'?'video-port':'image-port'} ${connections.some(e=>e.target===id&&!e.targetHandle)?'port-connected':''}`}/>}
    {meta.output&&<Handle type="source" position={Position.Right} title={`Saída de ${outputLabel.toLowerCase()}`} aria-label={`Saída de ${outputLabel.toLowerCase()}`} className={`${meta.output}-port ${connections.some(e=>e.source===id)?'port-connected':''}`} style={hasModelInputs?{top:16}:undefined}/>}

    {data.kind==='prompt'?<PromptInput images={images} id={id} value={data.prompt||''} disabled={running} onChange={prompt=>update(id,{prompt})}/>:['image','loadvideo'].includes(data.kind)?<>{src&&<div className="loaded-preview">{isVideo?<VideoPreview src={src} onShape={()=>{}}/>:<img src={src} alt={imageName({id,data})}/>}</div>}<LoadMedia video={isVideo} disabled={running} onLoaded={url=>update(id,{result:url,image:undefined,mediaType:isVideo?'video':'image'})} onError={message}/></>:
      <div className={`node-preview ratio-${(data.ratio||'1:1').replace(':','-')}`} style={hasModelInputs||isUpscale(data.kind)?{height:Math.max(430/aspect,slots*28+70)}:undefined}>{src?<>{isVideo?<VideoPreview src={src} onShape={ratio=>setMediaShape({src:src!,ratio})}/>:<img src={src} alt="Resultado do workflow" onLoad={e=>{const v=e.currentTarget;if(v.naturalWidth&&v.naturalHeight)setMediaShape({src:src!,ratio:v.naturalWidth/v.naturalHeight});}}/>}{src===DEMO_IMAGE&&<span className="preview-label">ILUSTRAÇÃO DEMONSTRATIVA</span>}</>:<span>{hasModelInputs?(promptConnected?'Pronto para gerar'+(imageConnected?' com imagem de referência':''):'Conecte um prompt para gerar'):data.kind==='output'?'Conecte uma imagem para visualizar':isUpscale(data.kind)?(isVideo?'Conecte um vídeo para ampliar':'Conecte uma imagem para ampliar'):'Conecte um prompt para gerar'}</span>}{(hasModelInputs||isUpscale(data.kind))&&busy&&<div className="cosmos-generating" role="status"><div className="cosmos-orbits" aria-hidden="true"><i/><i/><i/><b/></div><strong>{data.kind==='video'?'Criando seu vídeo':'Criando sua imagem'}</strong><span>{label} · {data.status?.startsWith('Aguardando')?'Processando no provedor':'Enviando geração'}</span></div>}</div>}
    {(hasModelInputs||isUpscale(data.kind))&&((data.status&&data.status!=='Concluído'&&!busy)||data.pendingTask&&!busy)&&<div className="generation-status" role="status">{busy&&<LoaderCircle className="spin" size={13}/>}<span>{data.status||(data.pendingTask?'Geração pendente · clique para consultar':'')}</span></div>}
    {data.kind!=='prompt'&&data.kind!=='image'&&data.kind!=='loadvideo'&&<div className="node-controls nodrag">
      {data.kind==='generate'||data.kind==='video'?<><NodeSelect className="model-select" title={model?.label} aria-label={data.kind==='video'?'Modelo de vídeo':'Modelo de imagem'} value={model?.label||''} disabled={running||!!data.pendingTask} onChange={e=>changeModel(e.target.value)}>{models.filter(m=>m.kind===data.kind).map(m=><option key={m.id} value={m.label}>{m.label}</option>)}</NodeSelect><NodeSelect aria-label="Proporção da geração" value={data.ratio||(data.kind==='video'?'16:9':'1:1')} disabled={running||(data.kind==='video'&&imageConnected)} title={data.kind==='video'&&imageConnected?'A proporção segue o frame inicial':'Proporção da geração'} onChange={e=>{const ratio=e.target.value;const options=availableResolutions(model,ratio);update(id,{ratio,resolution:options.includes(resolution)?resolution:options[0]});}}>{Object.keys(model?.sizes||{'1:1':[],'16:9':[],'9:16':[]}).map(r=><option key={r}>{r}</option>)}</NodeSelect><NodeSelect className="resolution-select" aria-label="Resolução da geração" title="Resolução da geração" disabled={running} value={resolution} onChange={e=>update(id,{resolution:e.target.value})}>{availableResolutions(model,data.ratio||(data.kind==='video'?'16:9':'1:1')).map(r=><option key={r} value={r}>{r}</option>)}</NodeSelect>{data.kind==='video'&&<NodeSelect aria-label="Duração do vídeo" value={data.duration||'4'} disabled={running} onChange={e=>update(id,{duration:e.target.value})}>{durationOptions(model).map(d=><option key={d} value={d}>{d} s</option>)}</NodeSelect>}<details className="node-settings"><summary aria-label="Configurações do modelo"><Settings2 size={14}/></summary><div><strong>{label}</strong><p>Estimativa: {quote?dollars(quote.usd):'indisponível'}{quote?.variable?' · variável':''}</p>{data.cost&&<p>Última geração: {dollars(Number(data.cost))}</p>}{data.generatedModel&&src&&<p>Resultado: {data.generatedModel} · {data.generatedResolution}</p>}<p>{isVideo?'Entradas azuis: frame inicial e, quando disponível, final.':`Até ${limit} imagens de referência. Use + para adicionar entradas.`}</p>{slots>1&&<button disabled={running||!!data.pendingTask||connections.some(e=>e.target===id&&e.targetHandle===referenceHandle(slots-1))} onClick={()=>update(id,{referenceSlots:String(slots-1)})}>Remover última entrada vazia</button>}{qualityOptions(model).length>0&&<label>Qualidade<NodeSelect aria-label="Qualidade da geração" value={data.quality||'auto'} disabled={running||!!data.pendingTask} onChange={e=>update(id,{quality:e.target.value})}>{qualityOptions(model).map(q=><option key={q} value={q}>{{auto:'Automática',low:'Baixa',medium:'Média',high:'Alta',xhigh:'Muito alta',max:'Máxima'}[q as string]||q}</option>)}</NodeSelect></label>}<p>Geração pela Runware. Consome créditos da conta conectada.</p><span>{resolution} · {data.kind==='video'&&imageConnected?'proporção do frame inicial':size?.join(' × ')+' px'}</span><p>Resoluções maiores podem consumir mais créditos.</p></div></details></>:isUpscale(data.kind)?<MagnificControls data={data} disabled={running||!!data.pendingTask} update={patch=>update(id,patch)}/>:<span className="node-state">{data.status||'Saída de mídia'}</span>}
      {src&&<button className="node-expand" title="Ampliar (duplo clique na mídia)" aria-label={isVideo?'Ampliar vídeo':'Ampliar imagem'} onClick={expand}><Maximize2 size={12}/></button>}
      {src&&<DownloadMediaButton src={src} video={isVideo} className="node-download" onError={message}/>}
      {data.kind!=='output'&&<button className="node-play" title={isUpscale(data.kind)?'Aplicar upscale à mídia conectada':'Gerar este node; reutilizar resultados das entradas'} aria-label={data.pendingTask?'Consultar geração pendente':isUpscale(data.kind)?'Aplicar upscale':'Gerar '+label} disabled={running} onClick={()=>run(id)}>{busy?<LoaderCircle className="spin" size={14}/>:isUpscale(data.kind)?<ScanLine size={14}/>:<Play size={14} fill="currentColor"/>}</button>}
    </div>}
    {viewer&&<MediaViewer {...viewer} onClose={()=>setViewer(null)} onError={message}/>}
  </article>;
}

type MenuChoice={label:string;kind:Kind;model?:string};
function NodeMenu({x,y,onAdd,onClose}: {x:number;y:number;onAdd:(choice:MenuChoice)=>void;onClose:()=>void}){
  const [search,setSearch]=useState('');
  const choices:MenuChoice[]=[{label:'Photoshop · camadas',kind:'photoshop'},{label:'Carregar imagem',kind:'image'},{label:'Carregar vídeo',kind:'loadvideo'},{label:'Prompt',kind:'prompt'},{label:'Gerar imagem',kind:'generate',model:'Nano Banana Pro'},{label:'Gerar vídeo',kind:'video',model:'Seedance 2.5'},{label:'Upscale Magnific',kind:'upscale',model:magnificModel},{label:'Upscale Topaz · vídeo',kind:'upscalevideo',model:topazModels[0]}];
  return <div className="node-menu" role="dialog" aria-label="Adicionar node" style={{left:Math.max(8,Math.min(x,window.innerWidth-310)),top:Math.max(70,Math.min(y,window.innerHeight-350))}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape')onClose();}}>
    <div className="node-search"><Search size={15}/><input autoFocus aria-label="Buscar nodes" placeholder="Buscar nodes…" value={search} onChange={e=>setSearch(e.target.value)}/><button aria-label="Fechar menu de nodes" onClick={onClose}><X size={13}/></button></div>
    <div className="node-menu-items">{choices.filter(c=>c.label.toLowerCase().includes(search.trim().toLowerCase())).map(c=><button key={c.kind} className={c.kind==='prompt'?'featured':undefined} onClick={()=>onAdd(c)}>{c.label}{c.model&&<small>{isUpscale(c.kind)?'MAGNIFIC':'RUNWARE'}</small>}</button>)}</div>
    {search&&!choices.some(c=>c.label.toLowerCase().includes(search.trim().toLowerCase()))&&<p className="menu-empty">Nenhum node encontrado.</p>}
  </div>;
}

type Props={isAdmin?:boolean;storageScope:string;initial:Project;folders:string[];onBack:()=>void;onSave:(project:Project)=>boolean;onCloudSave:(project:Project)=>Promise<void>;message:(text:string)=>void;signedIn:boolean};
export default function Editor(props:Props){return <ReactFlowProvider><Canvas {...props}/></ReactFlowProvider>;}
function Canvas({isAdmin,storageScope,initial,folders,onBack,onSave,onCloudSave,message,signedIn}:Props){
  const baseline=useRef(initial);
  const [coverImage,setCoverImage]=useState(initial.coverImage);
  const [imageMenu,setImageMenu]=useState<{x:number;y:number;src:string;nodeId:string}|null>(null);
  const closeImageMenu=useCallback(()=>setImageMenu(null),[]);
  const viewportKey=`cosmos:viewport:${storageScope}:${initial.id}`;
  const [savedViewport]=useState(()=>{try{const v=JSON.parse(localStorage.getItem(viewportKey)||'null');return v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.zoom)&&v.zoom>=.15&&v.zoom<=1.75?v:undefined;}catch{return undefined;}});

  const [nodes,setNodes,onNodesChange]=useNodesState<FlowNode>(initial.nodes);
  const [edges,setEdges,onEdgesChange]=useEdgesState(initial.edges);
  const [nodeGroups,setNodeGroups]=useState<NodeGroup[]>(initial.groups||[]);
  const [groupDialog,setGroupDialog]=useState<NodeGroup|null>(null);
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
  const [canvasMode,setCanvasMode]=useState<'pan'|'select'|'knife'>('pan');
  const {screenToFlowPosition,fitView}=useReactFlow();
  const [dropping,setDropping]=useState(false),[fileHover,setFileHover]=useState(false);
  const dropLock=useRef(false),canvasAlive=useRef(true);
  useEffect(()=>{canvasAlive.current=true;return()=>{canvasAlive.current=false;};},[]);

  const snapshot=useMemo(()=>cleanProject({...baseline.current,name,folder,nodes,edges,coverImage,groups:nodeGroups,updatedAt:Date.now()}),[name,folder,nodes,edges,nodeGroups,coverImage]);
  const latest=useRef(snapshot);latest.current=snapshot;
  const selectedNodes=nodes.filter(n=>n.selected);
  const active=selectedNodes[0];
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(running||groupDialog||e.ctrlKey||e.metaKey||e.altKey||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable],dialog,[role=dialog]'))return;const key=e.key.toLowerCase();if(key==='k'){e.preventDefault();setCanvasMode('knife');setMenu(null);}if(key==='c'){e.preventDefault();if(selectedNodes.length!==1)return message('Selecione um único node para conectar.');const connection=nearestConnection(selectedNodes[0].id,nodes,edges);if(!connection)return message('Nenhuma entrada compatível livre encontrada.');setEdges(es=>addEdge(connection,es));}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[nodes,edges,running,groupDialog]);
  function createGroup(){if(!selectedNodes.length)return message('Selecione os nodes para criar um grupo.');setMenu(null);setGroupDialog({id:crypto.randomUUID(),name:'',color:'#06bdd5',nodeIds:selectedNodes.map(n=>n.id)});}
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(!(e.ctrlKey||e.metaKey)||e.key.toLowerCase()!=='g'||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable],dialog'))return;e.preventDefault();if(!running&&!groupDialog)createGroup();};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[nodes,running,groupDialog]);
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
    setCoverImage(p.coverImage);setNodes(p.nodes);setEdges(p.edges);setNodeGroups(p.groups||[]);setName(p.name);setFolder(p.folder||'');refreshHistory(v=>v+1);
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
       if(r.state==='processing')r=await waitGeneration(n.data.pendingTask!,controller.signal,()=>update(n.id,{status:isUpscale(n.data.kind)?'Aguardando Magnific…':'Aguardando Runware…'}));
       if(r.state==='success')update(n.id,{pendingTask:undefined,result:r.url,mediaType:r.mediaType,cost:r.cost!=null?String(r.cost):undefined,generatedModel:n.data.model,generatedResolution:n.data.resolution,status:'Concluído'});
       else if(r.state==='error')update(n.id,{pendingTask:undefined,status:r.error});
      }catch(e){if(!controller.signal.aborted)message((e as Error).message);}
    }})();return()=>controller.abort();
  },[signedIn]);

  const update=useCallback((id:string,patch:Partial<NodeData>)=>setNodes(ns=>{const original=ns.find(n=>n.id===id);const oldName=original?imageName(original):'';return ns.map(n=>{if(n.id===id)return {...n,data:{...n.data,...patch}};if(patch.imageName&&n.data.kind==='prompt'&&n.data.prompt)return {...n,data:{...n.data,prompt:renameMention(n.data.prompt,oldName,patch.imageName)}};return n;});}),[setNodes]);
  useEffect(()=>{
    const prepareUpdate=(event:Event)=>{if(runLock.current||!onSave(latest.current))event.preventDefault();};
    window.addEventListener('cosmos:before-update',prepareUpdate);
    return()=>window.removeEventListener('cosmos:before-update',prepareUpdate);
  },[onSave]);
  useEffect(()=>{setSaved(false);const timer=setTimeout(()=>setSaved(onSave(snapshot)),500);return()=>clearTimeout(timer);},[snapshot,onSave]);
  useEffect(()=>{
    const flush=()=>{onSave(latest.current);};
    const hide=()=>{if(document.visibilityState==='hidden')flush();};
    window.addEventListener('pagehide',flush);window.addEventListener('beforeunload',flush);document.addEventListener('visibilitychange',hide);
    return()=>{window.removeEventListener('pagehide',flush);window.removeEventListener('beforeunload',flush);document.removeEventListener('visibilitychange',hide);};
  },[onSave]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(e.key==='Escape'){setMenu(null);setHelp(false);if(!target.closest('input,textarea,select,[contenteditable],[role=dialog]'))setCanvasMode('pan');}if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&!target.closest('input,textarea,select,[contenteditable],[role=dialog]')){const key=e.key.toLowerCase();if(key==='v'||key==='h'){e.preventDefault();setCanvasMode(key==='v'?'select':'pan');setMenu(null);}}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setMenu({x:window.innerWidth/2-150,y:window.innerHeight/2-170});}if(e.key==='Tab'&&target===document.body){e.preventDefault();setMenu({x:window.innerWidth/2-150,y:window.innerHeight/2-170});}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[running]);
  async function dropFiles(event:React.DragEvent){
    if(!event.dataTransfer.types.includes('Files'))return;
    event.preventDefault();event.stopPropagation();setFileHover(false);
    if(dropLock.current){message('Aguarde o envio das imagens anteriores.');return;}
    const files=Array.from(event.dataTransfer.files);
    const room=100-latest.current.nodes.length;
    if(room<=0){message('Limite de 100 nodes por workflow.');return;}
    if(files.length>room){message('Não há espaço para todos os arquivos. Limite de 100 nodes por workflow.');return;}
    const point=screenToFlowPosition({x:event.clientX,y:event.clientY});
    dropLock.current=true;setDropping(true);setMenu(null);
    let count=0;
    try{
      for(const file of files){
        if(!canvasAlive.current)break;
        if(latest.current.nodes.length>=100){message('Limite de 100 nodes por workflow.');break;}
        try{
          const url=await uploadMediaFile(file);
          if(!canvasAlive.current)break;
          const id=crypto.randomUUID(),position={x:point.x+(count%3)*360,y:point.y+Math.floor(count/3)*340};
          setNodes(ns=>{
            if(ns.length>=100)return ns;
            const base=file.name.replace(/\.[^.]+$/,'').replace(/[@\[\]\r\n]/g,' ').trim().slice(0,48)||'Imagem';
            const names=new Set(ns.map(n=>imageName(n).toLocaleLowerCase()));
            let name=base,index=2;while(names.has(name.toLocaleLowerCase()))name=base+' '+index++;
            return [...ns.map(n=>({...n,selected:false})),{id,type:'studio',position,selected:true,data:{kind:'image',result:url,imageName:name,mediaType:'image'}}];
          });
          count++;
        }catch(error){if(canvasAlive.current)message(file.name+': '+(error as Error).message);}
      }
    }finally{dropLock.current=false;if(canvasAlive.current)setDropping(false);}
  }
  function addNode(choice:MenuChoice){if(nodes.length>=100){message('Limite de 100 nodes por workflow.');return;}const point=menu||{x:window.innerWidth/2,y:window.innerHeight/2};setNodes(ns=>[...ns.map(n=>({...n,selected:false})),{id:crypto.randomUUID(),type:'studio',position:screenToFlowPosition(point),selected:true,data:{kind:choice.kind,...(choice.model?{model:choice.model}:{}),...(choice.kind==='prompt'?{prompt:''}:['video','upscalevideo'].includes(choice.kind)?{ratio:'16:9',duration:'4'}:{ratio:'1:1'})}}]);setMenu(null);}
  async function run(targetId?:string){
    if(runLock.current)return;
    let currentId='';
    try{
      let ordered=(orderGraph(nodes,edges) as FlowNode[]).filter(n=>n.data.kind!=='photoshop');
      if(targetId){const needed=new Set<string>();const visit=(id:string)=>{if(needed.has(id))return;needed.add(id);const n=nodes.find(n=>n.id===id);if(id!==targetId&&n?.data.result&&!n.data.pendingTask&&hasQuote(n.data.kind))return;for(const e of edges.filter(e=>e.target===id))visit(e.source);};visit(targetId);ordered=ordered.filter(n=>needed.has(n.id));}
      if(!ordered.length)throw new Error('Adicione nodes ao workflow.');
      const paid=ordered.some(n=>hasQuote(n.data.kind));
      const resuming=ordered.some(n=>n.data.pendingTask);
      if(paid&&(!runwareConfigured||!signedIn))throw new Error(!runwareConfigured?'Runware: aguardando ativação do backend.':'Entre na sua conta para usar os modelos Runware.');
      for(const n of ordered){
        if(n.data.pendingTask||((resuming||(!!targetId&&n.id!==targetId))&&n.data.result&&hasQuote(n.data.kind)))continue;
        if(n.data.kind==='compare'){if(!['a','b'].every(port=>edges.some(e=>e.target===n.id&&e.targetHandle===port)))throw new Error('Conecte as imagens A e B ao Comparar.');continue;}
        if(catalog[n.data.kind].input&&!edges.some(e=>e.target===n.id&&!e.targetHandle))throw new Error('Conecte a entrada principal de '+(n.data.model||catalog[n.data.kind].label)+'.');
        if(n.data.kind==='prompt'&&!n.data.prompt?.trim())throw new Error('Escreva um prompt antes de gerar.');
        if(['image','loadvideo'].includes(n.data.kind)&&!(n.data.result||n.data.image))throw new Error('Carregue uma imagem antes de gerar.');
        if(isUpscale(n.data.kind)){magnificOptions(n.data);if(!isAdmin)throw new Error('O Magnific está disponível para a conta proprietária.');}
        if(['generate','video'].includes(n.data.kind)){
          if(n.data.kind==='video'&&edges.some(e=>e.target===n.id&&e.targetHandle==='reference-2')&&!edges.some(e=>e.target===n.id&&e.targetHandle==='reference'))throw new Error('Conecte o frame inicial antes do frame final.');
          const source=nodes.find(source=>source.id===edges.find(e=>e.target===n.id&&!e.targetHandle)?.source);
          const mentionInput=resolveImageMentions(source?.data.prompt||'',nodes,n.id,edges.filter(e=>e.target===n.id&&referenceIndex(e.targetHandle)>=0).map(e=>nodeImage(nodes.find(x=>x.id===e.source))).filter(Boolean),n.data.model||'');
          buildTask({...mentionInput,model:n.data.model||(n.data.kind==='video'?'Seedance 2.5':'Nano Banana Pro'),ratio:n.data.ratio||(n.data.kind==='video'?'16:9':'1:1'),duration:n.data.duration,resolution:n.data.resolution,quality:n.data.quality},crypto.randomUUID());
        }
      }
      runLock.current=true;setRunning(true);setMenu(null);if(canvasMode==='knife')setCanvasMode('select');const controller=new AbortController();abortRun.current=controller;
      const values=new Map<string,{url:string;mediaType:string}>();
      for(const n of ordered){
        currentId=n.id;update(n.id,{status:'Executando…'});
        const source=edges.find(e=>e.target===n.id&&!e.targetHandle)?.source;
        const input=source?values.get(source):undefined;
        let output={url:'',mediaType:'image'};
        if(n.data.kind==='prompt')output={url:n.data.prompt!,mediaType:'text'};
        else if(['image','loadvideo'].includes(n.data.kind))output={url:(n.data.result||n.data.image)!,mediaType:n.data.kind==='loadvideo'?'video':'image'};
        else if(hasQuote(n.data.kind)){
          if((resuming||(!!targetId&&n.id!==targetId))&&!n.data.pendingTask&&n.data.result){output={url:n.data.result,mediaType:n.data.mediaType||'image'};values.set(n.id,output);update(n.id,{status:'Concluído'});continue;}
          const mentionInput=isUpscale(n.data.kind)?{prompt:n.data.prompt||'',references:[]}:n.data.pendingTask?{prompt:input?.url,references:[]}:resolveImageMentions(input?.url||'',nodes,n.id,collectReferences(n,edges,values),n.data.model||'');
          const references=mentionInput.references;
          const requestId=n.data.pendingTask||crypto.randomUUID();
          update(n.id,{pendingTask:requestId});
          // Persist before submission so reloads can recover the same paid task.
          const pendingProject=cleanProject({...latest.current,nodes:latest.current.nodes.map(item=>item.id===n.id?{...item,data:{...item.data,pendingTask:requestId}}:item)});
          if(!onSave(pendingProject)){update(n.id,{pendingTask:n.data.pendingTask});throw new Error('Não foi possível salvar a tarefa. Geração não enviada.');}
          let result= n.data.pendingTask? await requestGeneration('status',{requestId},controller.signal):await requestGeneration('generate',isUpscale(n.data.kind)?{...n.data,requestId,model:upscaleModel(n.data),reference:input?.url,projectId:initial.id,nodeId:n.id}:{requestId,model:n.data.model||(n.data.kind==='video'?'Seedance 2.5':'Nano Banana Pro'),ratio:n.data.ratio||(n.data.kind==='video'?'16:9':'1:1'),duration:n.data.duration,resolution:n.data.resolution,quality:n.data.quality,...mentionInput,references,projectId:initial.id,nodeId:n.id},controller.signal);
          if(result.state==='processing')result=await waitGeneration(requestId,controller.signal,()=>update(n.id,{status:isUpscale(n.data.kind)?'Aguardando Magnific…':'Aguardando Runware…'}));
          if(result.state==='error'){update(n.id,{pendingTask:undefined});throw new Error(result.error||'Falha na geração.');}
          if(!result.url)throw new Error('Resultado ainda indisponível. Consulte a pendência.');
          output={url:result.url,mediaType:result.mediaType||'image'};update(n.id,{pendingTask:undefined,cost:result.cost!=null?String(result.cost):undefined,generatedModel:isUpscale(n.data.kind)?upscaleModel(n.data):n.data.model||'Nano Banana Pro',generatedResolution:isUpscale(n.data.kind)?String(n.data.kind==='upscalevideo'?(n.data.topazResolution||'2k'):(n.data.upscaleFactor||'2x')):n.data.resolution||(n.data.kind==='video'?'720p':'1K')});
        }else if(n.data.kind==='compare'){const selected=edges.find(e=>e.target===n.id&&e.targetHandle===(n.data.compareOutput||'a'))?.source;output=selected?values.get(selected)!:undefined!;}else output=input!;
        if(!output?.url)throw new Error('A entrada não retornou mídia.');
        values.set(n.id,output);update(n.id,{status:'Concluído',...(n.data.kind!=='prompt'?{result:output.url,mediaType:output.mediaType}:{})});
      }
      message(paid?'Geração concluída.':'Workflow concluído.');
    }catch(e){if(currentId)update(currentId,{status:'Verifique a geração',...((e as {notSubmitted?:boolean}).notSubmitted?{pendingTask:undefined}:{})});message((e as Error).message);}finally{runLock.current=false;setRunning(false);window.dispatchEvent(new Event('cosmos:generation-finished'));}
  }
  function back(){if(onSave(latest.current)){if(signedIn)void onCloudSave(latest.current).catch(e=>message(e.message));onBack();}}
  return <NodeActions.Provider value={{update,run:(id)=>void run(id),message,running}}><main className="editor">
    <header className="editor-header"><div className="editor-heading"><button className="icon-button" aria-label="Voltar aos workflows" title="Voltar aos workflows" disabled={running} onClick={back}><ArrowLeft size={19}/></button><Wordmark/><span className="header-divider"/><input aria-label="Nome do workflow" value={name} maxLength={120} onChange={e=>setName(e.target.value)} placeholder="Untitled"/><select aria-label="Pasta do workflow" value={folder} onChange={e=>setFolder(e.target.value)}><option value="">Sem pasta</option>{folders.map(f=><option key={f}>{f}</option>)}</select></div><div className="editor-actions">{isAdmin&&<RunwareBalance/>}<button className="icon-button" aria-label="Desfazer" title="Desfazer (Ctrl+Z)" disabled={running||!undoStack.current.length} onClick={()=>historyMove()}>↶</button><button className="icon-button" aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)" disabled={running||!redoStack.current.length} onClick={()=>historyMove(true)}>↷</button><span className="save-status" title={cloudStatus}>{saved?<Check size={13}/>:<LoaderCircle size={13}/>}<span>{saved?cloudStatus:'Salvando localmente…'}</span></span><button className="outline-button" disabled={!signedIn||running} onClick={()=>void listCloudVersions(initial.id).then(setVersions).catch(e=>message(e.message))}>Versões</button><button className="icon-button" aria-label="Exportar workflow"  title="Exportar workflow" onClick={()=>exportProject(snapshot)}><Download size={17}/></button><button className="outline-button cloud-save" disabled={saving||running} onClick={async()=>{setSaving(true);try{await onCloudSave(snapshot);setCloudStatus('Salvo na nuvem');}catch(e){message((e as Error).message);}finally{setSaving(false);}}}>{saving?<LoaderCircle className="spin" size={15}/>:<Cloud size={15}/>}<span>Salvar na nuvem</span></button><button className="primary run-button" disabled={running} onClick={()=>void run()}>{running?<LoaderCircle className="spin" size={15}/>:<Play size={14} fill="currentColor"/>}<span>{running?'Executando':nodes.some(n=>n.data.pendingTask)?'Consultar pendência':'Gerar fluxo'}</span><small>RUNWARE</small></button></div></header>
    {!['Local','Aguardando sincronização','Alterações locais','Salvando na nuvem…','Salvo na nuvem'].includes(cloudStatus)&&<div className="cloud-warning" role="alert">{cloudStatus} <button onClick={()=>exportProject(latest.current)}>Exportar backup</button></div>}
    <div className={`flow-canvas mode-${canvasMode}`} onDragOver={e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';setFileHover(true);}}} onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setFileHover(false);}} onDrop={e=>void dropFiles(e)}>{(fileHover||dropping)&&<div className="canvas-file-drop" role="status">{dropping?'Enviando imagens à Runware…':'Solte para criar Load Image · PNG, JPG ou WebP até 20 MB'}</div>}<ReactFlow nodes={nodes} edges={displayEdges} nodeTypes={nodeTypes} onNodesChange={changes=>onNodesChange(running?layoutChangesDuringRun(changes):changes)} onEdgesChange={running?undefined:onEdgesChange} onConnect={(c:Connection)=>setEdges(es=>addEdge(c,es))} isValidConnection={c=>validConnection(c,nodes,edges)} onPaneContextMenu={e=>{e.preventDefault();setImageMenu(null);setMenu({x:e.clientX,y:e.clientY});}} onPaneClick={()=>{setMenu(null);setImageMenu(null);}} onNodeContextMenu={(event,node)=>{if((event.target as HTMLElement).closest('input,textarea'))return;const src=nodeImage(node);if(src){event.preventDefault();event.stopPropagation();setMenu(null);setImageMenu({x:event.clientX,y:event.clientY,src,nodeId:node.id});}else{event.preventDefault();event.stopPropagation();setImageMenu(null);setMenu({x:event.clientX,y:event.clientY});}}} defaultViewport={savedViewport} onMoveEnd={(_,viewport)=>{try{localStorage.setItem(viewportKey,JSON.stringify(viewport));}catch{/* Keep the canvas usable if storage is unavailable. */}}} fitView={!savedViewport} fitViewOptions={{padding:.18,maxZoom:.85}} minZoom={.15} maxZoom={1.75} selectionOnDrag={canvasMode==='select'} selectionMode={SelectionMode.Partial} panOnDrag={canvasMode==='select'?[1]:true} nodesDraggable nodesConnectable={!running} elementsSelectable deleteKeyCode={running||menu||groupDialog||imageMenu?null:['Delete','Backspace']} defaultEdgeOptions={{type:'default',style:{stroke:'#ed3b9c',strokeWidth:2,strokeDasharray:'5 8'}}} proOptions={{hideAttribution:true}}><Background gap={20} size={1} color="#262629"/><Controls showInteractive={false}/><GroupFrames groups={snapshot.groups||[]} nodes={nodes} setNodes={setNodes} disabled={running} onEdit={setGroupDialog} onRemove={id=>setNodeGroups(gs=>gs.filter(g=>g.id!==id))}/></ReactFlow>
      {canvasMode==='knife'&&!running&&<KnifeTool onCut={ids=>{if(ids.size)setEdges(es=>es.filter(e=>!ids.has(e.id)));}}/>}
      {!nodes.length&&<div className="empty-canvas"><Workflow size={32}/><h1>O que vamos criar?</h1><p>Todo universo começa com uma ideia.</p><button className="outline-button" onClick={()=>setMenu({x:window.innerWidth/2-140,y:window.innerHeight/2-100})}><Plus size={16}/>Adicionar primeiro node</button></div>}
      <div className="canvas-toolbar"><button className={canvasMode==='select'?'active':''} aria-label="Selecionar nodes" aria-pressed={canvasMode==='select'} title="Selecionar por retângulo (V)" onClick={()=>{setCanvasMode('select');setMenu(null);}}><MousePointer2 size={18}/></button><button className={canvasMode==='pan'?'active':''} aria-label="Mover canvas" aria-pressed={canvasMode==='pan'} title="Mover canvas (H ou Esc)" onClick={()=>setCanvasMode('pan')}><Hand size={18}/></button><button className={canvasMode==='knife'?'active':''} aria-label="Cortar conexões" aria-pressed={canvasMode==='knife'} title="Cortar conexões (K)" disabled={running} onClick={()=>{setCanvasMode('knife');setMenu(null);}}><Scissors size={18}/></button><span/><button className={menu?'active':''} aria-label="Adicionar node" title="Adicionar node (Ctrl+K)" onClick={()=>setMenu(menu?null:{x:80,y:140})}><Plus size={20}/></button><span/><button aria-label="Enquadrar canvas" title="Enquadrar canvas" onClick={()=>void fitView({padding:.2,duration:300,maxZoom:1})}><Maximize2 size={17}/></button><button aria-label="Ajuda do editor" title="Ajuda do editor" onClick={()=>setHelp(!help)}><HelpCircle size={18}/></button></div>
      <div className="canvas-info">{canvasMode==='knife'?'Cortar conexões':canvasMode==='select'?'Seleção · arraste no fundo': 'Mover · V para selecionar'} <span>·</span> {nodes.length} nodes <span>·</span> {edges.length} conexões <i/> {signedIn?'Workspace pessoal':'Modo demo'}</div>
      <div className="canvas-watermark"><Wordmark/> <span>BETA</span></div>
      {active&&!running&&<div className="selection-toolbar"><span>{selectedNodes.length>1?`${selectedNodes.length} nodes selecionados`:active.data.model||catalog[active.data.kind].label}</span><button aria-label="Criar grupo" title="Criar grupo (Ctrl+G)" onClick={createGroup}><Group size={15}/></button><button aria-label="Duplicar seleção" title="Duplicar seleção" onClick={()=>{if(nodes.length+selectedNodes.length>100)return message('Limite de 100 nodes por workflow.');const ids=new Map(selectedNodes.map(n=>[n.id,crypto.randomUUID()]));setNodes(ns=>[...ns.map(n=>({...n,selected:false})),...selectedNodes.map(n=>({...n,id:ids.get(n.id)!,position:{x:n.position.x+50,y:n.position.y+70},data:{...n.data,status:undefined,pendingTask:undefined},selected:true}))]);setEdges(es=>[...es.map(e=>({...e,selected:false})),...es.filter(e=>ids.has(e.source)&&ids.has(e.target)).map(e=>({...e,id:crypto.randomUUID(),source:ids.get(e.source)!,target:ids.get(e.target)!,selected:false}))]);}}><Copy size={15}/></button><button aria-label="Excluir seleção" title="Excluir seleção" onClick={()=>{const ids=new Set(selectedNodes.map(n=>n.id));setNodes(ns=>ns.filter(n=>!ids.has(n.id)));setEdges(es=>es.filter(e=>!ids.has(e.source)&&!ids.has(e.target)));}}><Trash2 size={15}/></button></div>}
      {help&&<div className="editor-help"><button className="icon-button" aria-label="Fechar ajuda" onClick={()=>setHelp(false)}><X size={15}/></button><h2>Ideias que se conectam.</h2><p><b>Adicionar:</b> botão +, clique direito ou Ctrl+K.</p><p><b>Conectar:</b> arraste da saída de um node até a entrada de outro. Texto (rosa) conecta ao Prompt; imagem (azul) conecta à Imagem de referência ou ao Resultado; vídeo (violeta) conecta ao Resultado.</p><p><b>Selecionar (V):</b> arraste no fundo para selecionar os nodes que tocam o retângulo. Arraste a seleção para mover o grupo.</p><p><b>Navegar (H ou Esc):</b> arraste o fundo. No modo seleção, use o botão do meio do mouse para navegar. Use a roda para zoom.</p><p><b>Agrupar (Ctrl+G):</b> selecione nodes, escolha nome e cor. Arraste o título do grupo para mover todos juntos. Desagrupar preserva os nodes.</p><p><b>Cortar (K):</b> desenhe uma linha sobre as conexões para removê-las.</p><p><b>Conectar (C):</b> selecione um node para ligar sua saída à entrada compatível livre mais próxima.</p><p><b>Excluir:</b> selecione um node ou conexão e pressione Delete.</p><small>Gerar consome créditos Runware. A entrada rosa recebe o prompt e a azul recebe uma imagem de referência opcional. Vídeos aceitam 4, 6 ou 8 segundos. Upscale continua demonstrativo.</small></div>}
    </div>
    {groupDialog&&<GroupDialog group={groupDialog} onClose={()=>setGroupDialog(null)} onSave={group=>{setNodeGroups(gs=>assignGroup(gs,group));setGroupDialog(null);}}/>}
    {versions&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-label="Versões do workflow"><button className="icon-button" onClick={()=>setVersions(null)}>Fechar</button><h2>Versões na nuvem</h2><p>Até 10 pontos de recuperação, agrupados em intervalos de 5 minutos. Exporte a versão atual antes de restaurar.</p>{versions.length?versions.map(v=><button key={v.id} className="outline-button full-width" onClick={()=>{try{const p=cleanProject(JSON.parse(v.graph));exportProject(latest.current);setCoverImage(p.coverImage);setNodes(p.nodes);setEdges(p.edges);setNodeGroups(p.groups||[]);setName(p.name);setFolder(p.folder||'');setVersions(null);message('Versão restaurada. Backup anterior exportado.');}catch(e){message((e as Error).message);}}}>{new Date(JSON.parse(v.graph).updatedAt).toLocaleString('pt-BR')} · {v.name}</button>):<p>Nenhuma versão anterior salva.</p>}</section></div>}
    {imageMenu&&<ImageNodeMenu {...imageMenu} canDetach={!running&&nodes.some(n=>n.id===imageMenu.nodeId&&n.data.kind!=='image'&&!n.data.pendingTask)} onDetach={()=>{try{const next=detachImage(nodes,edges,imageMenu.nodeId,crypto.randomUUID());setNodes(next.nodes as FlowNode[]);setEdges(next.edges);message('Imagem movida para um node independente.');}catch(error){message((error as Error).message);}}} onClose={closeImageMenu} onError={message} onCover={()=>{setCoverImage(imageMenu.src);message('Capa do workflow atualizada.');}}/>}
    {menu&&<NodeMenu {...menu} onAdd={addNode} onClose={()=>setMenu(null)}/>}
  </main></NodeActions.Provider>;
}
