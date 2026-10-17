const {app,core,imaging,constants}=require('photoshop');
const {selectionBounds,paddedRGBA,validateReturn}=require('./crop-core.js');
const session=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),records=new Map(),applied=new Set();
const $=id=>document.getElementById(id);let busy=false;
async function request(path,options={}){
 const key=$('key').value.trim();if(!/^[a-f0-9]{64}$/.test(key))throw new Error('Cole o código do conector local.');
 const response=await fetch('http://127.0.0.1:48880'+path,{...options,headers:{'X-Cosmos-Key':key,...options.headers}});
 if(!response.ok){let detail;try{detail=(await response.json()).error;}catch{}throw new Error(detail||'Não foi possível acessar o conector.');}
 return response;
}
async function action(fn){if(busy)return;busy=true;for(const id of ['connect','send','receive'])$(id).disabled=true;try{await fn();}catch(e){$('status').textContent=e.message||String(e);}finally{busy=false;for(const id of ['connect','send','receive'])$(id).disabled=false;}}
$('connect').addEventListener('click',()=>action(async()=>{const state=await(await request('/status')).json();$('connection').textContent=state.workflow?'Workflow: '+state.workflow.name:'Conector pronto. Conecte um workflow no Cosmos.';$('status').textContent='Conexão verificada.';}));
$('send').addEventListener('click',()=>action(async()=>{
 $('status').textContent='Lendo a seleção…';
 const state=await(await request('/status')).json();if(!state.workflow)throw new Error('Conecte primeiro o workflow no Cosmos.');
 let crop,rgba;
 await core.executeAsModal(async()=>{
  const doc=app.activeDocument;if(!doc)throw new Error('Abra um documento e faça uma seleção.');
  if(doc.mode!==constants.DocumentMode.RGB)throw new Error('Use um documento RGB para esta versão do plugin.');
  const bounds=selectionBounds(doc.selection.bounds,Number(doc.width),Number(doc.height));
  if(doc.selection.solid===false)throw new Error('Use uma seleção retangular sólida, sem feather, para transferir o recorte 1:1.');
  crop={...bounds,documentId:doc.id,documentName:doc.name,session};
  const image=await imaging.getPixels({documentID:doc.id,sourceBounds:{left:bounds.left,top:bounds.top,right:bounds.left+bounds.width,bottom:bounds.top+bounds.height},colorSpace:'RGB',colorProfile:'sRGB IEC61966-2.1',componentSize:8,applyAlpha:false});
  try{
   if(image.level&&image.level!==0)throw new Error('A seleção foi reduzida pelo Photoshop. Tente novamente em resolução original.');
   const pixels=await image.imageData.getData({chunky:true});
   rgba=paddedRGBA(pixels,{width:image.imageData.width,height:image.imageData.height,components:image.imageData.components,left:image.sourceBounds.left,top:image.sourceBounds.top},crop);
  }finally{image.imageData.dispose();}
 },{commandName:'Cosmos: capturar seleção'});
 $('status').textContent='Enviando para o workflow…';
 const result=await(await request('/crop',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Cosmos-Crop':encodeURIComponent(JSON.stringify(crop))},body:rgba.buffer})).json();
 records.set(result.cropId,result);$('status').textContent='Seleção enviada: '+crop.width+' × '+crop.height+' px.\nPosição: '+crop.left+', '+crop.top+'.';
}));
$('receive').addEventListener('click',()=>action(async()=>{
 $('status').textContent='Buscando resultado…';const response=await request('/result');
 if(response.status===204)throw new Error('Envie uma imagem pelo menu do node no Cosmos primeiro.');
 const meta=JSON.parse(decodeURIComponent(response.headers.get('X-Cosmos-Crop'))),record=records.get(meta.cropId);
 if(!applied.has(meta.resultId)){
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length!==meta.width*meta.height*4)throw new Error('Resultado incompleto. Tente novamente.');
  await core.executeAsModal(async context=>{
   const doc=app.activeDocument,targetBounds=validateReturn(meta,record,doc);
   const suspension=await context.hostControl.suspendHistory({documentID:doc.id,name:'Cosmos: receber recorte'});
   let imageData,committed=false;
   try{
    imageData=await imaging.createImageDataFromBuffer(bytes,{width:meta.width,height:meta.height,components:4,colorSpace:'RGB',colorProfile:'sRGB IEC61966-2.1'});
    const layer=await doc.createLayer({name:'Cosmos · '+meta.width+'×'+meta.height+' · '+meta.left+','+meta.top});
    await imaging.putPixels({documentID:doc.id,layerID:layer.id,imageData,replace:true,targetBounds});
    committed=true;
   }finally{if(imageData)imageData.dispose();await context.hostControl.resumeHistory(suspension,committed);}
  },{commandName:'Cosmos: retornar seleção'});
  applied.add(meta.resultId);
 }
 await request('/result/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resultId:meta.resultId})});
 $('status').textContent='Nova camada criada na posição original.\nUse uma máscara para revelar o ajuste.';
}));
