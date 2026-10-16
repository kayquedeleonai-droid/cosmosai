import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nearestConnection,segmentsCross,layoutChangesDuringRun} from '../src/canvas-tools.mjs';
test('generation permits layout and selection changes but blocks graph mutations',()=>{
  const layout=[{type:'position',id:'a',position:{x:100,y:200}},{type:'dimensions',id:'a',dimensions:{width:430,height:430}},{type:'select',id:'a',selected:true}];
  assert.deepEqual(layoutChangesDuringRun([...layout,{type:'remove',id:'a'},{type:'replace',id:'a',item:{}},{type:'add',item:{}}]),layout);
});
const n=(id,kind,x)=>({id,position:{x,y:0},data:{kind,model:kind==='video'?'Seedance 2.5':'Nano Banana Pro'}});
test('knife crosses both directions and endpoints but not disjoint lines',()=>{const a={x:0,y:0},b={x:10,y:10},c={x:0,y:10},d={x:10,y:0};assert.ok(segmentsCross(a,b,c,d));assert.ok(segmentsCross(b,a,d,c));assert.ok(segmentsCross(a,b,b,{x:20,y:0}));assert.ok(!segmentsCross(a,b,{x:20,y:20},{x:30,y:30}));});
test('auto-connect chooses nearest compatible free image slot and skips occupied inputs',()=>{const nodes=[n('a','generate',0),n('b','video',500),n('c','output',900)];assert.deepEqual(nearestConnection('a',nodes,[]),{source:'a',target:'b',targetHandle:'reference'});assert.deepEqual(nearestConnection('a',nodes,[{source:'a',target:'b',targetHandle:'reference'}]),{source:'a',target:'c'});});
test('auto-connect respects output types and avoids self links and cycles',()=>{assert.equal(nearestConnection('a',[n('a','output',0)],[]),null);assert.equal(nearestConnection('v',[n('v','video',0),n('g','generate',500)],[]),null);const nodes=[n('a','generate',0),n('b','generate',500)];assert.equal(nearestConnection('a',nodes,[{source:'b',target:'a',targetHandle:'reference'}]),null);assert.deepEqual(nearestConnection('p',[n('p','prompt',0),n('g','generate',500)],[]),{source:'p',target:'g'});});
