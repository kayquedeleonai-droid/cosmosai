import {generationResolutions as availableResolutions,generationSwitch as switchModel} from './magnific-generation.mjs';
import {catalog,validConnection,validateProject} from './graph.mjs';
import {models,findModel,durationOptions,qualityOptions,videoReferenceLimit,switchVideoInputMode,referenceLimit,referenceIndex} from './runware-models.mjs';
import {nameMediaNodes,imageName,renameMention} from './image-mentions.mjs';
const keys=['videoInputMode','model','prompt','imageName','ratio','resolution','quality','duration'];
export const actionSchema={type:'object',additionalProperties:false,properties:{type:{type:'string',enum:['create','update','move','connect']},id:{type:'string'},kind:{type:'string'},settings:{type:'array',items:{type:'object',additionalProperties:false,properties:{key:{type:'string',enum:keys},value:{type:'string'}},required:['key','value']}},x:{type:'number'},y:{type:'number'},source:{type:'string'},target:{type:'string'},port:{type:'string'}},required:['type','id','kind','settings','x','y','source','target','port']};
export const assistantCatalog=models.map(m=>({model:m.label,kind:m.kind,ratios:Object.keys(m.sizes),resolutions:Object.fromEntries(Object.keys(m.sizes).map(r=>[r,availableResolutions(m,r)])),duration:m.kind==='video'?durationOptions(m):[],quality:qualityOptions(m),frameInputs:m.kind==='video'?referenceLimit(m):0,references:m.kind==='video'?videoReferenceLimit(m):referenceLimit(m)}));
export function workflowContext(project){
 if(!project)return null;
 return {id:project.id,name:project.name,nodes:project.nodes.map(n=>({id:n.id,kind:n.data.kind,name:imageName(n),selected:!!n.selected,x:n.position.x,y:n.position.y,hasMedia:!!(n.data.result||n.data.image),settings:keys.filter(k=>typeof n.data[k]==='string').map(k=>({key:k,value:n.data[k]}))})),edges:project.edges.map(e=>({source:e.source,target:e.target,port:e.targetHandle||''}))};
}
export const workflowSignature=project=>JSON.stringify(workflowContext(project));
export function applyWorkflowActions(project,actions){
 if(!Array.isArray(actions)||!actions.length||actions.length>30)throw new Error('Plano inválido: use até 30 ações.');
 let nodes=structuredClone(project.nodes),edges=structuredClone(project.edges);const aliases=new Map();
 const resolve=id=>aliases.get(id)||id;
 for(const a of actions){
  if(!a||!['create','update','move','connect'].includes(a.type))throw new Error('Ação não permitida.');
  if(a.type==='connect'){
   const c={id:crypto.randomUUID(),source:resolve(a.source),target:resolve(a.target),targetHandle:a.port||null};
   const target=nodes.find(n=>n.id===c.target),slot=referenceIndex(c.targetHandle);
   if(target&&slot>=0&&slot<referenceLimit(findModel(target.data.model),target.data.videoInputMode))target.data.referenceSlots=String(Math.max(Number(target.data.referenceSlots)||1,slot+1));
   if(!validConnection(c,nodes,edges))throw new Error('Conexão incompatível, ocupada ou circular.');edges.push(c);continue;
  }
  let node=nodes.find(n=>n.id===resolve(a.id));
  if(a.type==='create'){
   if(nodes.length>=100||!['prompt','generate','video','image','loadvideo','photoshop','compare','upscale'].includes(a.kind)||!a.id||node||aliases.has(a.id))throw new Error('Novo node inválido ou limite atingido.');
   const id=crypto.randomUUID();aliases.set(a.id,id);node={id,type:'studio',position:{x:0,y:0},data:{kind:a.kind},selected:true};nodes.push(node);
   if(['generate','video'].includes(a.kind))Object.assign(node.data,switchModel(node.data,a.kind==='video'?'Seedance 2.5':'Nano Banana Pro'));
  }
  if(!node)throw new Error('Node não encontrado.');
  if(node.data.pendingTask)throw new Error('Aguarde a geração desse node terminar.');
  if(a.type==='move'||a.type==='create'){
   if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||Math.abs(a.x)>100000||Math.abs(a.y)>100000)throw new Error('Posição inválida.');node.position={x:a.x,y:a.y};
  }
  if(a.type==='move')continue;
  if(!Array.isArray(a.settings)||a.settings.length>keys.length)throw new Error('Configurações inválidas.');
  const patch={};for(const s of a.settings){if(!keys.includes(s.key)||typeof s.value!=='string'||s.value.length>(s.key==='prompt'?3000:80)||Object.hasOwn(patch,s.key))throw new Error('Configuração não permitida.');patch[s.key]=s.value;}
  if(patch.prompt!==undefined&&node.data.kind!=='prompt')throw new Error('Escreva o texto em um node Prompt.');
  if(patch.videoInputMode&&patch.videoInputMode!==node.data.videoInputMode)Object.assign(node.data,switchVideoInputMode(node.data,patch.videoInputMode,edges.filter(e=>e.target===node.id)));
  if(patch.model)Object.assign(node.data,switchModel(node.data,patch.model));
  if(patch.imageName){if(/[@\[\]\r\n]/.test(patch.imageName)||patch.imageName.length>48)throw new Error('Nome inválido.');const old=imageName(node);nodes=nodes.map(n=>n.data.kind==='prompt'?{...n,data:{...n.data,prompt:renameMention(n.data.prompt||'',old,patch.imageName)}}:n);node=nodes.find(n=>n.id===node.id);}
  Object.assign(node.data,patch);
  if(['generate','video'].includes(node.data.kind)){
   const m=findModel(node.data.model),d=node.data;
   if(!m||m.kind!==d.kind||!availableResolutions(m,d.ratio).includes(d.resolution)||d.kind==='video'&&!durationOptions(m).includes(d.duration)||d.quality&&!qualityOptions(m).includes(d.quality))throw new Error('Modelo, proporção, resolução ou duração incompatível.');
   if(edges.some(e=>e.target===node.id&&referenceIndex(e.targetHandle)>=referenceLimit(m,d.videoInputMode)))throw new Error('O modelo não aceita todas as referências conectadas.');
  }
 }
 const result={...project,nodes:nameMediaNodes(nodes),edges,updatedAt:Date.now()};validateProject(result);return result;
}
