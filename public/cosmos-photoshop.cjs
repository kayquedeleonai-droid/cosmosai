// Cosmos Photoshop connector for Windows. Requires Node.js 20 or later.
// Run: node cosmos-photoshop.cjs
// Optional: node cosmos-photoshop.cjs "C:\Program Files\Adobe\Adobe Photoshop 2026\Photoshop.exe"
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
function findPhotoshop(){
 const root=path.join(process.env.ProgramFiles||'C:\\Program Files','Adobe');
 return fs.readdirSync(root).filter(n=>/^Adobe Photoshop \d{4}$/.test(n)).sort().reverse().map(n=>path.join(root,n,'Photoshop.exe')).find(p=>fs.existsSync(p));
}
function createConnector(photoshop,openFile){
 const key=crypto.randomBytes(32).toString('hex');
 const origins=new Set(['https://aicosmos.app','https://www.aicosmos.app','https://cosmosai-1e2d6.web.app']);
 const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;
  function reply(status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Connection':'close'});res.end(JSON.stringify(data));}
  if(!origins.has(origin))return reply(403,{error:'Origin rejected'});
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Cosmos-Key');res.setHeader('Access-Control-Allow-Private-Network','true');
  if(req.method==='OPTIONS'&&['/status','/open'].includes(req.url)){res.writeHead(204);return res.end();}
  const supplied=Buffer.from(String(req.headers['x-cosmos-key']||''));const expected=Buffer.from(key);
  if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return reply(401,{error:'Invalid session key'});
  if(req.method==='GET'&&req.url==='/status')return reply(200,{ready:true,version:1});
  if(req.method!=='POST'||req.url!=='/open')return reply(404,{error:'Unknown route'});
  const length=Number(req.headers['content-length']);
  if(req.headers['content-type']!=='application/octet-stream'||!Number.isInteger(length)||length<26||length>134217728||req.headers['transfer-encoding'])return reply(413,{error:'Invalid body size or type'});
  try{
   const parts=[];let bytes=0;
   for await(const chunk of req){bytes+=chunk.length;if(bytes>length)throw new Error('Invalid size');parts.push(chunk);}
   if(bytes!==length)throw new Error('Incomplete file');
   const psd=Buffer.concat(parts);
   if(psd.toString('ascii',0,4)!=='8BPS'||psd.readUInt16BE(4)!==1||psd.readUInt16BE(22)!==8||psd.readUInt16BE(24)!==3)throw new Error('Invalid PSD');
   const directory=path.join(os.tmpdir(),'Cosmos-Photoshop');fs.mkdirSync(directory,{recursive:true});
   const destination=path.join(directory,`Cosmos-${crypto.randomUUID()}.psd`);fs.writeFileSync(destination,psd,{flag:'wx'});
   await openFile(photoshop,destination);reply(200,{opened:true});
  }catch{if(!res.headersSent)reply(400,{error:'Could not open PSD in Photoshop'});}
 });
 server.requestTimeout=120000;server.headersTimeout=10000;server.maxHeadersCount=30;
 return {server,key};
}
module.exports={createConnector};
if(require.main===module){
 try{
  const photoshop=process.argv[2]||findPhotoshop();
  if(!photoshop||!path.isAbsolute(photoshop)||photoshop.startsWith('\\\\')||path.basename(photoshop)!=='Photoshop.exe'||!fs.statSync(photoshop).isFile())throw new Error('Photoshop not found. Pass the full local Photoshop.exe path as the first argument.');
  const {server,key}=createConnector(photoshop,(exe,file)=>new Promise((resolve,reject)=>{const child=spawn(exe,[file],{shell:false,detached:true,stdio:'ignore'});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});}));
  server.on('error',e=>{console.error('Connector could not start:',e.code);process.exitCode=1;});
  server.listen(48879,'127.0.0.1',()=>{console.log('Cosmos Photoshop - local connector ready.');console.log('Paste this private session code in the Photoshop node:');console.log(key);console.log('Keep this window open. Ctrl+C disconnects. Photoshop:',photoshop);});
 }catch(e){console.error(e.message);process.exitCode=1;}
}
