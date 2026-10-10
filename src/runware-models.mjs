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
export function safeMedia(value) {
  if(typeof value!=='string')return false;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='im.runware.ai'||u.hostname==='vm.runware.ai'||u.hostname==='assets.runware.ai');}catch{return false;}
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
  if(input.reference!=null&&!validReference(input.reference))throw new Error('Imagem de referência inválida.');
  const video=model.kind==='video';
  const task={taskType:video?'videoInference':'imageInference',taskUUID,model:model.id,positivePrompt:input.prompt.trim(),numberResults:1,outputType:'URL',outputFormat:video?'MP4':'PNG',deliveryMethod:'async',includeCost:true};
  if(input.quality!=null){if(!qualityOptions(model).includes(input.quality))throw new Error('Qualidade não suportada por este modelo.');task.settings={quality:input.quality};}
  if(video){
    const duration=Number(input.duration||4);
    if(!durationOptions(model).includes(String(duration)))throw new Error('Duração não suportada por este modelo.');
    if(model.id==='klingai:kling-video@3.0-turbo'&&input.reference&&input.prompt.length>2500)throw new Error('Kling com imagem aceita prompts de até 2500 caracteres.');
    task.duration=duration;
    if(input.reference){task.inputs={frameImages:[input.reference]};task.resolution=model.id==='bytedance:seedance@2.0'&&resolution==='4K'?'4k':resolution;}
    else {task.width=size[0];task.height=size[1];}
  }else {task.width=size[0];task.height=size[1];if(input.reference)task.inputs={referenceImages:[input.reference]};}
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
