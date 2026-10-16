// AIR identifiers and dimensions verified against Runware's model references.
export const models = [
  {label:'Nano Banana Pro',id:'google:4@2',kind:'generate',sizes:{'1:1':[1024,1024],'16:9':[1376,768],'9:16':[768,1376]}},
  {label:'GPT Image 2.5 Sunburst',id:'openai:gpt-image@2.5-sunburst',kind:'generate',sizes:{'1:1':[1024,1024],'16:9':[1536,864],'9:16':[864,1536]}},
  {label:'GPT Image 2.5 Flare',id:'openai:gpt-image@2.5-flare',kind:'generate',sizes:{'1:1':[1024,1024],'16:9':[1536,864],'9:16':[864,1536]}},
  {label:'Seedream 5.0 Pro',id:'bytedance:seedream@5.0-pro',kind:'generate',sizes:{'1:1':[1024,1024],'16:9':[1424,800],'9:16':[800,1424]}},
  {label:'Seedance 2.5',id:'bytedance:seedance@2.5',kind:'video',sizes:{'1:1':[960,960],'16:9':[1280,720],'9:16':[720,1280]}},
  {label:'VEO 3.1',id:'google:3@2',kind:'video',sizes:{'16:9':[1280,720],'9:16':[720,1280]}},
  {label:'Nano Banana 2',id:'google:4@3',kind:'generate',sizes:{'1:1':[1024,1024],'16:9':[1376,768],'9:16':[768,1376]}},
  {label:'Seedance 2.0',id:'bytedance:seedance@2.0',kind:'video',sizes:{'1:1':[960,960],'16:9':[1280,720],'9:16':[720,1280]}},
  {label:'Kling 3.0 Turbo',id:'klingai:kling-video@3.0-turbo',kind:'video',sizes:{'1:1':[960,960],'16:9':[1280,720],'9:16':[720,1280]}},
];
// Resolution pairs from each model's Runware reference, checked 2026-10-10.
// GPT 4K is UHD landscape/portrait only: 4096-square exceeds its pixel budget.
const presets={
  'google:4@2':{'1K':models[0].sizes,'2K':{'1:1':[2048,2048],'16:9':[2752,1536],'9:16':[1536,2752]},'4K':{'1:1':[4096,4096],'16:9':[5504,3072],'9:16':[3072,5504]}},
  gpt:{'1K':models[1].sizes,'2K':{'1:1':[2048,2048],'16:9':[2560,1440],'9:16':[1440,2560]},'4K':{'16:9':[3840,2160],'9:16':[2160,3840]}},
  'bytedance:seedream@5.0-pro':{'1K':models[3].sizes,'2K':{'1:1':[2048,2048],'16:9':[2816,1584],'9:16':[1584,2816]}},
  'bytedance:seedance@2.5':{'480p':{'1:1':[640,640],'16:9':[854,480],'9:16':[480,854]},'720p':models[4].sizes,'1080p':{'1:1':[1440,1440],'16:9':[1920,1080],'9:16':[1080,1920]}},
  'google:3@2':{'720p':models[5].sizes,'1080p':{'16:9':[1920,1080],'9:16':[1080,1920]},'4K':{'16:9':[3840,2160],'9:16':[2160,3840]}},
};
presets['google:4@3']=presets['google:4@2'];
presets['bytedance:seedance@2.0']={'480p':{'1:1':[640,640],'16:9':[864,496],'9:16':[496,864]},'720p':models[7].sizes,'1080p':presets['bytedance:seedance@2.5']['1080p'],'4K':{'1:1':[2880,2880],'16:9':[3840,2160],'9:16':[2160,3840]}};
presets['klingai:kling-video@3.0-turbo']={'720p':models[8].sizes,'1080p':presets['bytedance:seedance@2.5']['1080p']};
export function durationOptions(model){
  const min=model?.id==='klingai:kling-video@3.0-turbo'?3:model?.id==='bytedance:seedance@2.0'?4:0;
  return min?Array.from({length:16-min},(_,i)=>String(i+min)):['4','6','8'];
}
export function resolutionPresets(model){return model?presets[model.id.startsWith('openai:')?'gpt':model.id]:undefined;}
export function availableResolutions(model,ratio){return Object.entries(resolutionPresets(model)||{}).filter(([,sizes])=>Object.hasOwn(sizes,ratio)).map(([key])=>key);}
export function outputSize(model,ratio,resolution){
  const options=resolutionPresets(model);
  const tier=resolution||(model?.kind==='video'?'720p':'1K');
  return options&&Object.hasOwn(options,tier)&&Object.hasOwn(options[tier],ratio)?options[tier][ratio]:undefined;
}
export function findModel(label) {
  const aliases={'Seedance':'Seedance 2.5','VEO':'VEO 3.1','Gerador de imagem':'Nano Banana Pro'};
  return models.find(m=>m.label===(aliases[label]||label)||m.id===label);
}
export function qualityOptions(model){return model?.id.startsWith('openai:')?['auto','low','medium','high','xhigh','max']:[];}
export function switchModel(data,label){
  const model=findModel(label);
  if(!model||model.kind!==data.kind)throw new Error('Modelo incompatível com este node.');
  if(data.pendingTask)throw new Error('Consulte a geração pendente antes de trocar o modelo.');
  const ratio=Object.hasOwn(model.sizes,data.ratio)?data.ratio:(model.kind==='video'?'16:9':'1:1');
  const resolutions=availableResolutions(model,ratio);
  const fallback=model.kind==='video'?'720p':'1K';
  return {...(model.kind==='video'?{duration:durationOptions(model).includes(data.duration)?data.duration:'4'}:{}),model:model.label,ratio,resolution:resolutions.includes(data.resolution)?data.resolution:fallback,quality:qualityOptions(model).includes(data.quality)?data.quality:undefined,status:undefined};
}
// Runware input schemas checked 2026-10-16; video slots are first/last frames.
export function referenceLimit(model){
 if(!model)return 1;
 if(model.kind==='video')return model.id==='klingai:kling-video@3.0-turbo'?1:2;
 if(model.id.startsWith('openai:'))return 16;
 return model.id==='bytedance:seedream@5.0-pro'?10:14;
}
export const referenceHandle=i=>i===0?'reference':`reference-${i+1}`;
export function referenceIndex(handle){if(handle==='reference')return 0;const m=/^reference-([2-9]|1[0-6])$/.exec(handle||'');return m?Number(m[1])-1:-1;}
export function referenceSlots(data){return Math.min(referenceLimit(findModel(data.model||(data.kind==='video'?'Seedance 2.5':'Nano Banana Pro'))),Math.max(1,Number(data.referenceSlots)||1));}
export function collectReferences(node,edges,values){
 const slots=Array.from({length:referenceSlots(node.data)},(_,i)=>{const edge=edges.find(e=>e.target===node.id&&e.targetHandle===referenceHandle(i));if(!edge)return undefined;const value=values.get(edge.source);if(!value?.url||value.mediaType!=='image')throw new Error('Uma referência não retornou imagem.');return value.url;});
 if(node.data.kind==='video'&&slots[1]&&!slots[0])throw new Error('Conecte o frame inicial antes do frame final.');
 return slots.filter(Boolean);
}
export function safeMedia(value) {
  if(typeof value!=='string')return false;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='im.runware.ai'||u.hostname==='vm.runware.ai'||u.hostname==='assets.runware.ai'||u.hostname==='mm.runware.ai'||u.hostname==='ai-statics.freepik.com'||u.hostname==='ai-statics.magnific.com');}catch{return false;}
}
export function validReference(value) {return typeof value==='string'&&(safeMedia(value)||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))&&value.length<=2100000;}
export function buildTask(input,taskUUID) {
  const model=findModel(input.model);
  if(!model)throw new Error('Modelo não suportado. Selecione um modelo Runware.');
  if(typeof input.prompt!=='string'||input.prompt.trim().length<3||input.prompt.length>3000)throw new Error('O prompt deve ter entre 3 e 3000 caracteres.');
  if(!Object.hasOwn(model.sizes,input.ratio))throw new Error('Proporção não suportada por este modelo.');
  const resolution=input.resolution||(model.kind==='video'?'720p':'1K');
  const size=outputSize(model,input.ratio,resolution);
  if(!size)throw new Error('Resolução não suportada para este modelo e proporção.');
  if(input.references!=null&&input.reference!=null)throw new Error('Envie reference ou references, não ambos.');
  const references=input.references??(input.reference!=null?[input.reference]:[]);
  const referenceMode=input.referenceMode===true;
  const seedance=['bytedance:seedance@2.0','bytedance:seedance@2.5'].includes(model.id);
  const referenceVideos=input.referenceVideos??[];
  if(!Array.isArray(referenceVideos)||referenceVideos.some(r=>!safeMedia(r))||referenceVideos.length>(model.id==='bytedance:seedance@2.5'?10:3)||referenceVideos.length&&(!seedance||!referenceMode))throw new Error('Vídeos de referência inválidos ou não suportados pelo modelo.');
  if(referenceMode&&!seedance)throw new Error('Referências multimodais exigem Seedance 2.0 ou 2.5.');
  if(referenceMode&&!['480p','720p'].includes(resolution))throw new Error('Use 480p ou 720p para gerar Seedance com menções de referência.');
  if(!Array.isArray(references)||references.length>(referenceMode?(model.id==='bytedance:seedance@2.5'?30:9):referenceLimit(model))||references.some(r=>!validReference(r)))throw new Error('Imagens de referência inválidas ou acima do limite do modelo.');
  if(referenceMode&&!references.length&&!referenceVideos.length)throw new Error('Adicione uma referência para este modo.');
  if(references.reduce((sum,r)=>sum+r.length,0)>32000000)throw new Error('Referências excedem o limite total de 32 MB.');
  const video=model.kind==='video';
  const task={taskType:video?'videoInference':'imageInference',taskUUID,model:model.id,positivePrompt:input.prompt.trim(),numberResults:1,outputType:'URL',outputFormat:video?'MP4':'PNG',deliveryMethod:'async',includeCost:true};
  if(input.quality!=null){if(!qualityOptions(model).includes(input.quality))throw new Error('Qualidade não suportada por este modelo.');task.settings={quality:input.quality};}
  if(video){
    const duration=Number(input.duration||4);
    if(!durationOptions(model).includes(String(duration)))throw new Error('Duração não suportada por este modelo.');
    if(model.id==='klingai:kling-video@3.0-turbo'&&references.length&&input.prompt.length>2500)throw new Error('Kling com imagem aceita prompts de até 2500 caracteres.');
    task.duration=duration;
    if(referenceMode){task.inputs={...(references.length?{referenceImages:references}:{}),...(referenceVideos.length?{referenceVideos}:{})};task.resolution=resolution;}
    else if(references.length){task.inputs={frameImages:references};task.resolution=model.id==='bytedance:seedance@2.0'&&resolution==='4K'?'4k':resolution;}
    else {task.width=size[0];task.height=size[1];}
  }else {task.width=size[0];task.height=size[1];if(references.length)task.inputs={referenceImages:references};}
  return task;
}
export function readResult(body,taskUUID) {
  const error=body.errors?.find(e=>!e.taskUUID||e.taskUUID===taskUUID);
  if(error)return {state:'error',error:String(error.message||'A Runware recusou a geração.').slice(0,400)};
  const result=body.data?.find(d=>d.taskUUID===taskUUID&&(d.imageURL||d.videoURL))||body.data?.find(d=>d.taskUUID===taskUUID);
  if(result?.status==='error')return {state:'error',error:String(result.error?.message||'Falha na geração.').slice(0,400)};
  const url=result?.imageURL||result?.videoURL;
  if(url){if(!safeMedia(url))return {state:'error',error:'A Runware retornou um endereço de mídia não reconhecido.'};return {state:'success',url,mediaType:result.videoURL?'video':'image',cost:typeof result.cost==='number'?result.cost:undefined};}
  return {state:'processing'};
}
