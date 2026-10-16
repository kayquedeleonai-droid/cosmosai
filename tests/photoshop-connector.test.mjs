import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import connector from '../public/cosmos-photoshop.cjs';
test('local connector rejects foreign origins, bad keys and invalid PSD; opens only generated paths',async()=>{
 let opened=0,created;
 const {server,key}=connector.createConnector('Photoshop.exe',async(exe,file)=>{opened++;created=file;assert.equal(exe,'Photoshop.exe');assert.equal(path.dirname(file),path.join(os.tmpdir(),'Cosmos-Photoshop'));assert.equal(fs.readFileSync(file).toString('ascii',0,4),'8BPS');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal((await fetch(url+'/status',{headers:{Origin:'https://evil.example','X-Cosmos-Key':key}})).status,403);
  assert.equal((await fetch(url+'/status',{headers:{Origin:'https://aicosmos.app','X-Cosmos-Key':'wrong'}})).status,401);
  const headers={Origin:'https://aicosmos.app','X-Cosmos-Key':key,'Content-Type':'application/octet-stream'};
  assert.equal((await fetch(url+'/status',{headers})).status,200);
  const preflight=await fetch(url+'/open',{method:'OPTIONS',headers:{Origin:'https://aicosmos.app'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://aicosmos.app');
  assert.equal((await fetch(url+'/open',{method:'POST',headers,body:Buffer.alloc(26)})).status,400);
  assert.equal(opened,0);
  const body=Buffer.alloc(26);body.write('8BPS');body.writeUInt16BE(1,4);body.writeUInt16BE(8,22);body.writeUInt16BE(3,24);
  assert.equal((await fetch(url+'/open',{method:'POST',headers,body})).status,200);assert.equal(opened,1);
 }finally{await new Promise(resolve=>server.close(resolve));if(created&&path.dirname(created)===path.join(os.tmpdir(),'Cosmos-Photoshop'))fs.unlinkSync(created);}
});
