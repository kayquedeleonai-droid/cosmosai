// Local-only Photoshop selection bridge. Node.js 20+. No cloud uploads.
const http=require('node:http'),crypto=require('node:crypto');
const MAX=4096*4096*4,origins=new Set(['https://aicosmos.app','https://www.aicosmos.app','https://cosmosai-1e2d6.web.app','http://127.0.0.1:5173']);
function validateCrop(m){
 if(!m||typeof m.session!=='string'||!/^[\w-]{8,100}$/.test(m.session)||!Number.isInteger(m.documentId)||typeof m.documentName!=='string'||m.documentName.length>200)throw new Error('Documento inválido.');
 for(const k of ['left','top','width','height','documentWidth','documentHeight'])if(!Number.isInteger(m[k])||m[k]<(k==='left'||k==='top'?0:1))throw new Error('Coordenadas inválidas.');
 if(m.width*m.height*4>MAX||m.left+m.width>m.documentWidth||m.top+m.height>m.documentHeight)throw new Error('Seleção fora do documento ou maior que 16 megapixels.');
 return Object.fromEntries(['session','documentId','documentName','left','top','width','height','documentWidth','documentHeight'].map(k=>[k,m[k]]));
}
function createSelectionBridge(){
 const key=crypto.randomBytes(32).toString('hex'),records=new Map();let workflow=null,incoming=null,outgoing=null,uploading=false;
 const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin,browser=origins.has(origin);
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(origin&&!browser)return reply(403,{error:'Origem não autorizada.'});
  if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host||''))return reply(403,{error:'Host inválido.'});
  if(browser){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Cosmos-Key, X-Cosmos-Client, X-Cosmos-Crop');res.setHeader('Access-Control-Expose-Headers','X-Cosmos-Crop');res.setHeader('Access-Control-Allow-Private-Network','true');}
  if(req.method==='OPTIONS'&&browser){res.writeHead(204);return res.end();}
  const supplied=Buffer.from(String(req.headers['x-cosmos-key']||'')),expected=Buffer.from(key);
  if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return reply(401,{error:'Código de conexão inválido. Copie o código do conector.'});
  const client=req.headers['x-cosmos-client'],route=req.url;
  const fresh=()=>workflow&&Date.now()-workflow.seen<10000;
  const owner=()=>browser&&workflow?.client===client;
  async function body(limit){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw new Error('Arquivo muito grande.');chunks.push(chunk);}return Buffer.concat(chunks);}
  function binary(item){res.writeHead(200,{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Cosmos-Crop':encodeURIComponent(JSON.stringify(item.meta))});res.end(item.bytes);}
  try{
   if(req.method==='GET'&&route==='/status')return reply(200,{version:1,workflow:fresh()?{id:workflow.projectId,name:workflow.name}:null,pendingResult:!!outgoing});
   if(req.method==='POST'&&route==='/workflow'){
    if(!browser||typeof client!=='string'||!/^[\w-]{8,100}$/.test(client))return reply(403,{error:'Abra o Cosmos para conectar.'});
    if(fresh()&&workflow.client!==client)return reply(409,{error:'Outro workflow está conectado. Desconecte-o primeiro.'});
    const value=JSON.parse((await body(4096)).toString());
    if(typeof value.projectId!=='string'||!/^[\w-]{1,80}$/.test(value.projectId)||typeof value.name!=='string')throw new Error('Workflow inválido.');
    if(incoming&&incoming.meta.projectId!==value.projectId)return reply(409,{error:'Há uma seleção esperando no workflow anterior. Abra-o para receber.'});
    workflow={client,projectId:value.projectId,name:value.name.slice(0,120),seen:Date.now()};return reply(200,{connected:true});
   }
   if(req.method==='POST'&&route==='/disconnect'&&owner()){workflow=null;return reply(200,{disconnected:true});}
   if(req.method==='POST'&&route==='/crop'){
    if(browser)return reply(403,{error:'Envie a seleção pelo plugin Photoshop.'});
    if(!fresh())return reply(409,{error:'Conecte um workflow aberto no Cosmos primeiro.'});
    if(incoming||uploading)return reply(409,{error:'A seleção anterior ainda está sendo transferida.'});
    if(records.size>=100)return reply(409,{error:'Limite de 100 recortes nesta sessão. Reinicie o conector para começar outra.'});
    const target={...workflow};uploading=true;
    try{
     const crop=validateCrop(JSON.parse(decodeURIComponent(req.headers['x-cosmos-crop']||'')));
     const bytes=await body(MAX);if(bytes.length!==crop.width*crop.height*4)throw new Error('Pixels incompletos.');
     const meta={...crop,cropId:crypto.randomUUID(),projectId:target.projectId};
     records.set(meta.cropId,meta);incoming={meta,bytes};return reply(200,meta);
    }finally{uploading=false;}
   }
   if(req.method==='GET'&&route==='/incoming'&&owner()){
    if(!incoming){res.writeHead(204);return res.end();}
    if(incoming.meta.projectId!==workflow.projectId)return reply(409,{error:'Seleção pertence a outro workflow.'});
    return binary(incoming);
   }
   if(req.method==='POST'&&route==='/incoming/ack'&&owner()){
    const {cropId}=JSON.parse((await body(1024)).toString());if(incoming?.meta.cropId===cropId)incoming=null;return reply(200,{ok:true});
   }
   if(req.method==='POST'&&route==='/result'&&owner()){
    if(outgoing||uploading)return reply(409,{error:'Aplique o resultado anterior no Photoshop primeiro.'});
    const cropId=req.headers['x-cosmos-crop'],meta=records.get(cropId);
    if(!meta||meta.projectId!==workflow.projectId)return reply(409,{error:'Recorte não pertence a esta sessão/workflow. Reenvie a seleção pelo Photoshop.'});
    uploading=true;
    try{const bytes=await body(MAX);if(bytes.length!==meta.width*meta.height*4)throw new Error('Tamanho do resultado inválido.');outgoing={meta:{...meta,resultId:crypto.randomUUID()},bytes};return reply(200,{ready:true});}finally{uploading=false;}
   }
   if(req.method==='GET'&&route==='/result'&&!browser){if(!outgoing){res.writeHead(204);return res.end();}return binary(outgoing);}
   if(req.method==='POST'&&route==='/result/ack'&&!browser){const {resultId}=JSON.parse((await body(1024)).toString());if(outgoing?.meta.resultId===resultId)outgoing=null;return reply(200,{ok:true});}
   return reply(404,{error:'Rota indisponível.'});
  }catch(error){if(!res.headersSent)reply(400,{error:error.message||'Falha na transferência.'});}
 });
 server.requestTimeout=60000;server.headersTimeout=10000;
 return {server,key};
}
module.exports={createSelectionBridge,validateCrop};
if(require.main===module){const {server,key}=createSelectionBridge();server.on('error',e=>{console.error('Não foi possível iniciar:',e.code);process.exitCode=1;});server.listen(48880,'127.0.0.1',()=>{console.log('\nCosmos ↔ Photoshop · conector local\nCole este código no plugin e no botão Photoshop do Cosmos:\n\n'+key+'\n\nMantenha esta janela aberta. Ctrl+C encerra e apaga as transferências pendentes.');});}
