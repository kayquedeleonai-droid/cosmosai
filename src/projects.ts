import {nameMediaNodes,renameMention} from './image-mentions.mjs';
import {validCover} from './workflow-cover.mjs';
import {cleanGroups} from './node-groups.mjs';
import { validateProject } from './graph.mjs';
import type { Project, FlowNode } from './types';

export function cleanProject(input: unknown): Project {
  const p = validateProject(input);
  const named=nameMediaNodes(p.nodes);
  for(const original of p.nodes){
    if(original.data.imageName)continue;
    const next=named.find((n:FlowNode)=>n.id===original.id)?.data.imageName;
    if(!next)continue;
    const legacy=(['video','loadvideo','upscalevideo'].includes(original.data.kind)||original.data.mediaType==='video'?'Vídeo':'Imagem')+' '+original.id.slice(0,8);
    for(const n of named)if(n.data.kind==='prompt'&&n.data.prompt)n.data={...n.data,prompt:renameMention(n.data.prompt,legacy,next)};
  }
  p.nodes=named.map((n:FlowNode)=>n.data.model==='Seedream 5.0 Pro'&&!n.data.pendingTask&&!['1.5K','2K'].includes(n.data.resolution||'')?{...n,data:{...n.data,resolution:'2K'}}:n);
  return {
    version: 1,
    ...(typeof p.deletedAt==='number'&&Number.isFinite(p.deletedAt)&&p.deletedAt>0?{deletedAt:p.deletedAt}:{}),
    ...(validCover(p.coverImage)?{coverImage:p.coverImage}:{}),
    groups: cleanGroups(p.groups,p.nodes),
    id: typeof p.id === 'string' && /^[\w-]{1,80}$/.test(p.id) ? p.id : crypto.randomUUID(),
    name: p.name,
    folder: typeof p.folder === 'string' ? p.folder.slice(0,60) : '',
    updatedAt: typeof p.updatedAt === 'number' && Number.isFinite(p.updatedAt) ? p.updatedAt : Date.now(),
    nodes: p.nodes.map((n: FlowNode) => ({
      id: n.id, type: 'studio', position: n.position,
      data: Object.fromEntries(Object.entries(n.data).filter(([key, value]) =>
        ['reviewStatus','psSlots','flavor','sharpen','smartGrain','ultraDetail','topazResolution','targetFps','interpolation','noise','upscaleFactor','upscaleStyle','creativity','hdr','resemblance','fractality','kind','imageName','videoInputMode','referenceSlots','prompt','image','result','model','ratio','quality','resolution','duration','mediaType','pendingTask','cost','generatedModel','generatedResolution','compareMode','compareSplit','compareOutput'].includes(key) && typeof value === 'string')),
    })) as FlowNode[],
    edges: p.edges.map((e: Project['edges'][number]) => ({ id:e.id, source:e.source, target:e.target, ...(e.targetHandle?{targetHandle:e.targetHandle}:{}) })),
  };
}

export function newProject(example = false): Project {
  return {
    version: 1, id: crypto.randomUUID(), name: example ? 'Entre concreto e natureza' : 'Untitled', updatedAt: Date.now(),
    nodes: example ? [
      { id:'prompt-1',type:'studio',position:{x:0,y:170},data:{kind:'prompt',prompt:'Uma casa brutalista isolada entre montanhas, luz suave do amanhecer, fotografia editorial, tons naturais e atmosfera cinematográfica.'} },
      { id:'generate-1',type:'studio',position:{x:440,y:70},data:{kind:'generate',model:'Nano Banana Pro',ratio:'1:1'} },
      { id:'output-1',type:'studio',position:{x:1000,y:150},data:{kind:'output'} },
    ] : [],
    edges: example ? [{id:'e1',source:'prompt-1',target:'generate-1'}, {id:'e2',source:'generate-1',target:'output-1'}] : [],
  };
}

export const storageKey = (scope: string) => `cosmos:library:${scope}`;
export function readProjects(scope: string): Project[] {
  const raw = localStorage.getItem(storageKey(scope));
  if (raw) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Não foi possível ler seus workflows locais. Exporte seus dados antes de limpar o navegador.');
    return parsed.map(cleanProject);
  }
  if (scope === 'guest') {
    const legacy = localStorage.getItem('cosmos-project');
    if (legacy) return [cleanProject(JSON.parse(legacy))];
  }
  return scope === 'guest' ? [newProject(true)] : [];
}

export function exportProject(project: Project) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(cleanProject(project), null, 2)], {type:'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name.replace(/[^a-z0-9]/gi,'-') || 'cosmos'}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function relativeDate(value: number) {
  const minutes = Math.max(0, Math.floor((Date.now()-value)/60000));
  if (minutes < 1) return 'Agora mesmo';
  if (minutes < 60) return `Há ${minutes} min`;
  if (minutes < 1440) return `Há ${Math.floor(minutes/60)} h`;
  return `Há ${Math.floor(minutes/1440)} dias`;
}
