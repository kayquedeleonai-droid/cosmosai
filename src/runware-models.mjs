// AIR identifiers and dimensions verified against Runware's model references.
export const models = [
  {label:'Nano Banana Pro',id:'google:4@2',kind:'generate',sizes:{'1:1':[1024,1024],'16:9':[1376,768],'9:16':[768,1376]}},
  {label:'GPT Image 2.5 Sunburst',id:'openai:gpt-image@2.5-sunburst',kind:'generate',sizes:{'1:1':[1024,1024],'16:9':[1536,864],'9:16':[864,1536]}},
  {label:'GPT Image 2.5 Flare',id:'openai:gpt-image@2.5-flare',kind:'generate',sizes:{'1:1':[1024,1024],'16:9':[1536,864],'9:16':[864,1536]}},
  {label:'Seedream 5.0 Pro',id:'bytedance:seedream@5.0-pro',kind:'generate',sizes:{'1:1':[1024,1024],'16:9':[1424,800],'9:16':[800,1424]}},
  {label:'Seedance 2.5',id:'bytedance:seedance@2.5',kind:'video',sizes:{'1:1':[960,960],'16:9':[1280,720],'9:16':[720,1280]}},
  {label:'VEO 3.1',id:'google:3@2',kind:'video',sizes:{'16:9':[1280,720],'9:16':[720,1280]}},
];
export function findModel(label) {
  const aliases={'Seedance':'Seedance 2.5','VEO':'VEO 3.1','Gerador de imagem':'Nano Banana Pro'};
  return models.find(m=>m.label===(aliases[label]||label)||m.id===label);
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
  const size=model.sizes[input.ratio];
  if(!size)throw new Error('Proporção não suportada por este modelo.');
  if(input.reference!=null&&!validReference(input.reference))throw new Error('Imagem de referência inválida.');
  const video=model.kind==='video';
  const task={taskType:video?'videoInference':'imageInference',taskUUID,model:model.id,positivePrompt:input.prompt.trim(),numberResults:1,outputType:'URL',outputFormat:video?'MP4':'PNG',deliveryMethod:'async',includeCost:true};
  if(video){
    const duration=Number(input.duration||4);
    if(![4,6,8].includes(duration))throw new Error('Duração inválida. Use 4, 6 ou 8 segundos.');
    task.duration=duration;
    if(input.reference){task.inputs={frameImages:[input.reference]};task.resolution='720p';}
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
