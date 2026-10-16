import test from 'node:test';
import assert from 'node:assert/strict';
import {duplicateEmpty,emptyDuplicateTarget} from '../src/duplicate-empty.mjs';
test('empty duplicate preserves settings but cannot resume or reuse a paid task or media',()=>{
 const source={id:'a',type:'studio',position:{x:10,y:20},measured:{width:300},data:{kind:'video',model:'Seedance 2.5',ratio:'16:9',resolution:'1080p',duration:'8',quality:'high',referenceSlots:'2',imageName:'Custom',prompt:'secret prompt',result:'media',image:'image',pendingTask:'paid-id',cost:'4',status:'processing',generatedModel:'Other'}};
 const nodes=duplicateEmpty([source],'a','b'),copy=nodes[1];
 assert.deepEqual(copy.data,{kind:'video',model:'Seedance 2.5',ratio:'16:9',resolution:'1080p',duration:'8',quality:'high',referenceSlots:'2',imageName:'Seedance 2.5'});
 assert.deepEqual(copy.position,{x:350,y:20});assert.equal(copy.selected,true);assert.equal(nodes[0].selected,false);assert.equal(source.data.pendingTask,'paid-id');
 assert.equal(copy.measured,undefined);
});
test('prompt duplicates are blank; upscale parameters and node limit are retained',()=>{
 assert.equal(duplicateEmpty([{id:'a',position:{x:0,y:0},data:{kind:'prompt',prompt:'content'}}],'a','b')[1].data.prompt,'');
 const node={id:'a',position:{x:0,y:0},data:{kind:'upscale',model:'Magnific Creative',upscaleFactor:'4x',creativity:'7',hdr:'3',prompt:'remove'}};
 const copy=duplicateEmpty([node],'a','b')[1];assert.equal(copy.data.creativity,'7');assert.equal(copy.data.prompt,undefined);
 assert.throws(()=>duplicateEmpty(Array(100).fill(node),'a','b'),/100/);
});
test('only Alt and primary clicks on the node body trigger empty duplication',()=>{
 const target={closest:selector=>selector==='.react-flow__node'?{getAttribute:()=> 'a'}:null};
 assert.equal(emptyDuplicateTarget({altKey:true,button:0,target}),'a');
 assert.equal(emptyDuplicateTarget({altKey:false,button:0,target}),null);
 assert.equal(emptyDuplicateTarget({altKey:true,button:2,target}),null);
 assert.equal(emptyDuplicateTarget({altKey:true,button:0,target:{closest:()=>({})}}),null);
});
