import test from 'node:test';
import assert from 'node:assert/strict';
import {withMediaReview} from '../src/review-status.mjs';
import {validateProject} from '../src/graph.mjs';
test('approval belongs to the current media, not its replacement',()=>{
 const data={kind:'generate',result:'/demo-landscape.svg',reviewStatus:'approved'};
 assert.equal(withMediaReview(data,{prompt:'edit'}).reviewStatus,'approved');
 assert.equal(withMediaReview(data,{result:data.result}).reviewStatus,'approved');
 assert.equal(withMediaReview(data,{result:'new-image'}).reviewStatus,'in-progress');
});
test('review status survives serialized workflows and rejects unknown values',()=>{
 const p={version:1,name:'Example',nodes:[{id:'a',position:{x:0,y:0},data:{kind:'generate',reviewStatus:'approved'}}],edges:[]};
 assert.equal(validateProject(JSON.parse(JSON.stringify(p))).nodes[0].data.reviewStatus,'approved');
 p.nodes[0].data.reviewStatus='invalid';
 assert.throws(()=>validateProject(p),/revisão/);
});
