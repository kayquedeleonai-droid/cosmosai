import test from 'node:test';
import assert from 'node:assert/strict';
import { orderGraph, validConnection, validateProject } from '../src/graph.mjs';
const node = (id,kind) => ({ id, position:{x:0,y:0}, data:{kind} });
test('orders dependencies even when nodes arrive out of order',()=>{const nodes=[node('c','output'),node('b','generate'),node('a','prompt')];assert.deepEqual(orderGraph(nodes,[{source:'a',target:'b'},{source:'b',target:'c'}]).map(n=>n.id),['a','b','c']);});
test('rejects incompatible ports, self links and occupied inputs',()=>{const nodes=[node('a','prompt'),node('b','generate'),node('c','image'),node('d','output')];assert.equal(validConnection({source:'a',target:'b'},nodes,[]),true);assert.equal(validConnection({source:'a',target:'d'},nodes,[]),false);assert.equal(validConnection({source:'b',target:'b'},nodes,[]),false);assert.equal(validConnection({source:'c',target:'d'},nodes,[{source:'b',target:'d'}]),false);});
test('rejects cycles between compatible image nodes',()=>{const nodes=[node('a','upscale'),node('b','upscale')];assert.equal(validConnection({source:'b',target:'a'},nodes,[{source:'a',target:'b'}]),false);assert.throws(()=>orderGraph(nodes,[{source:'a',target:'b'},{source:'b',target:'a'}]),/ciclos/);});
test('rejects malformed imported projects and dangling edges',()=>{assert.throws(()=>validateProject({version:1,name:'x',nodes:[node('a','unknown')],edges:[]}));assert.throws(()=>validateProject({version:1,name:'x',nodes:[node('a','image')],edges:[{id:'e',source:'a',target:'missing'}]}));assert.throws(()=>validateProject({version:1,name:'x',nodes:[{...node('a','image'),data:{kind:'image',image:'javascript:alert(1)'}}],edges:[]}));});
test('accepts valid project and rejects duplicate ids',()=>{const p={version:1,name:'test',nodes:[node('a','prompt'),node('b','generate')],edges:[{id:'e',source:'a',target:'b'}]};assert.equal(validateProject(p),p);assert.throws(()=>validateProject({...p,nodes:[node('a','prompt'),node('a','prompt')],edges:[]}));});
test('keeps legacy projects valid while validating persisted preview fields',()=>{
  const p={version:1,name:'Legacy',nodes:[node('a','generate')],edges:[]};
  assert.equal(validateProject(p),p);
  assert.doesNotThrow(()=>validateProject({...p,nodes:[{...node('a','generate'),data:{kind:'generate',model:'Nano Banana Pro',ratio:'16:9',result:'/demo-landscape.svg'}}]}));
  assert.throws(()=>validateProject({...p,nodes:[{...node('a','generate'),data:{kind:'generate',result:'https://external.example/track.png'}}]}));
  assert.throws(()=>validateProject({...p,nodes:[{...node('a','generate'),data:{kind:'generate',ratio:'999:0'}}]}));
});
test('video consumes text and cannot feed an image input',()=>{
  const nodes=[node('p','prompt'),node('v','video'),node('o','output')];
  assert.equal(validConnection({source:'p',target:'v'},nodes,[]),true);
  assert.equal(validConnection({source:'v',target:'o'},nodes,[]),false);
});
test('rejects repeated edge identifiers even with different targets',()=>{
  assert.throws(()=>validateProject({version:1,name:'Duplicate',nodes:[node('p','prompt'),node('a','generate'),node('b','generate')],edges:[{id:'same',source:'p',target:'a'},{id:'same',source:'p',target:'b'}]}));
});
