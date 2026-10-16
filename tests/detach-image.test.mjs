import test from 'node:test';
import assert from 'node:assert/strict';
import {detachImage} from '../src/detach-image.mjs';
import {validateProject} from '../src/graph.mjs';
test('detach transfers media, name and outgoing connections while preserving generator inputs',()=>{
 const nodes=[{id:'p',position:{x:0,y:0},data:{kind:'prompt',prompt:'hello'}},{id:'g',position:{x:100,y:0},data:{kind:'generate',imageName:'personagem',result:'https://im.runware.ai/a.png'}},{id:'v',position:{x:600,y:0},data:{kind:'video'}}];
 const edges=[{id:'prompt',source:'p',target:'g'},{id:'ref',source:'g',target:'v',targetHandle:'reference'}];
 const result=detachImage(nodes,edges,'g','loaded');
 assert.equal(result.nodes[1].data.result,undefined);assert.equal(result.nodes[3].data.result,nodes[1].data.result);
 assert.equal(result.nodes[3].data.imageName,'personagem');assert.equal(result.edges[1].source,'loaded');assert.equal(result.edges[0].target,'g');
 validateProject({version:1,name:'Test',...result});
 assert.equal(nodes[1].data.imageName,'personagem');
 assert.throws(()=>detachImage(result.nodes,result.edges,'loaded','x'));
});
