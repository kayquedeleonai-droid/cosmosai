import test from 'node:test';
import assert from 'node:assert/strict';
import {validConnection,validateProject} from '../src/graph.mjs';
import {resolveImage} from '../src/compare.mjs';
const node=(id,kind,extra={})=>({id,position:{x:0,y:0},data:{kind,...extra}});
const nodes=[node('a','image',{image:'data:image/png;base64,YQ=='}),node('b','generate',{result:'/demo-landscape.svg'}),node('c','compare'),node('p','prompt'),node('v','video'),node('d','compare')];
const edges=[{id:'a-c',source:'a',target:'c',targetHandle:'a'},{id:'b-c',source:'b',target:'c',targetHandle:'b'}];

test('Load Image comparisons prefer the current imported or pasted image over legacy content',()=>{
 const local='/__cosmos_media/12345678-1234-1234-1234-123456789abc';
 const updated=nodes.map(n=>n.id==='a'?{...n,data:{...n.data,result:local}}:n);
 assert.equal(resolveImage('c',updated,edges),local);
 assert.equal(resolveImage('c',updated.map(n=>n.id==='a'?{...n,data:{...n.data,result:'https://cdn-magnific.freepik.com/new.png'}}:n),edges),'https://cdn-magnific.freepik.com/new.png');
});
test('comparison has two independent image-only inputs and rejects cycles',()=>{
  assert.equal(validConnection(edges[0],nodes,[]),true);
  assert.equal(validConnection(edges[1],nodes,[edges[0]]),true);
  assert.equal(validConnection({...edges[1],targetHandle:'a'},nodes,[edges[0]]),false);
  for(const source of ['p','v'])assert.equal(validConnection({...edges[0],source},nodes,[]),false);
  assert.equal(validConnection({source:'a',target:'c'},nodes,[]),false);
  assert.equal(validConnection({source:'d',target:'c',targetHandle:'a'},nodes,[{source:'c',target:'d',targetHandle:'b'}]),false);
});
test('comparison resolves the selected existing image and never falls back to stale results',()=>{
  assert.equal(resolveImage('c',nodes,edges),nodes[0].data.image);
  const selected=nodes.map(n=>n.id==='c'?{...n,data:{...n.data,compareOutput:'b',result:nodes[0].data.image}}:n);
  assert.equal(resolveImage('c',selected,edges),'/demo-landscape.svg');
  assert.equal(resolveImage('c',selected,[edges[0]]),undefined);
  assert.equal(resolveImage('v',nodes,edges),undefined);
});
test('comparison chains follow selection and protect against malformed cycles',()=>{
  assert.equal(resolveImage('d',nodes,[...edges,{source:'c',target:'d',targetHandle:'a'}]),nodes[0].data.image);
  assert.equal(resolveImage('c',nodes,[{source:'d',target:'c',targetHandle:'a'},{source:'c',target:'d',targetHandle:'a'}]),undefined);
});
test('comparison settings and ports survive valid imports and reject invalid settings',()=>{
  const p={version:1,name:'Compare',nodes,edges};assert.equal(validateProject(p),p);
  for(const extra of [{compareMode:'invalid'},{compareSplit:'101'},{compareSplit:'NaN'},{compareOutput:'c'}])assert.throws(()=>validateProject({...p,nodes:[node('c','compare',extra)],edges:[]}));
  assert.doesNotThrow(()=>validateProject({...p,nodes:[node('c','compare',{compareMode:'overlay',compareSplit:'35',compareOutput:'b'})],edges:[]}));
});
