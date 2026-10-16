import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTask,findModel,videoReferenceLimit,referenceSlots,referenceHandle,collectReferences,switchVideoInputMode,videoSlotLabel} from '../src/runware-models.mjs';
import {resolveImageMentions} from '../src/image-mentions.mjs';
import {validateProject,validConnection} from '../src/graph.mjs';
const url='https://im.runware.ai/first.png',last='https://im.runware.ai/last.png';
test('frame labels and collection preserve roles regardless of edge order; last-only fails',()=>{
 const n={id:'v',data:{kind:'video',model:'Seedance 2.5'}};
 assert.equal(referenceSlots(n.data),2);assert.equal(videoSlotLabel(n.data,0),'First frame');assert.equal(videoSlotLabel(n.data,1),'Last frame');
 const values=new Map([['a',{url,mediaType:'image'}],['b',{url:last,mediaType:'image'}]]),edges=[{source:'b',target:'v',targetHandle:'reference-2'},{source:'a',target:'v',targetHandle:'reference'}];
 assert.deepEqual(collectReferences(n,edges,values),[url,last]);assert.throws(()=>collectReferences(n,edges.slice(0,1),values),/inicial/);
});
test('reference mode is model specific, cannot reinterpret connected frames, and survives JSON',()=>{
 const data={kind:'video',model:'Seedance 2.5',resolution:'1080p'};
 assert.throws(()=>switchVideoInputMode(data,'references',[{targetHandle:'reference'}]),/Desconecte/);
 const next={...data,...switchVideoInputMode(data,'references')};assert.equal(next.resolution,'720p');assert.equal(videoSlotLabel(next,0),'Reference 1');
 assert.equal(videoReferenceLimit(findModel('MiniMax H3 Max Turbo')),0);assert.throws(()=>switchVideoInputMode({...data,model:'MiniMax H3 Max Turbo'},'references'),/apenas/);
 const node={id:'v',position:{x:0,y:0},data:{...next,referenceSlots:'30'}};
 assert.equal(referenceSlots(node.data),30);assert.equal(referenceHandle(29),'reference-30');
 const p=JSON.parse(JSON.stringify({version:1,name:'test',nodes:[node],edges:[]}));assert.equal(validateProject(p).nodes[0].data.videoInputMode,'references');
 assert.ok(validConnection({source:'a',target:'v',targetHandle:'reference-30'},[node,{id:'a',data:{kind:'image'}}],[]));
});
test('provider requests send only the selected input family, including all supported H3 variants',()=>{
 for(const model of ['Seedance 2.5','Seedance 2.0','MiniMax H3','MiniMax H3 Fast','MiniMax H3 Max']){
  const m=findModel(model),resolution=m.defaultResolution||'720p',input={model,prompt:'A cinematic scene',ratio:'16:9',resolution,duration:'6',references:[url,last]};
  const frames=buildTask({...input,videoInputMode:'frames'},crypto.randomUUID());assert.deepEqual(frames.inputs,{frameImages:[url,last]});
  const refs=buildTask({...input,videoInputMode:'references'},crypto.randomUUID());assert.deepEqual(refs.inputs,{referenceImages:[url,last]});
  if(['MiniMax H3 Fast','MiniMax H3 Max'].includes(model)){assert.equal(refs.resolution,undefined);assert.ok(refs.width&&refs.height);}else assert.equal(refs.resolution,resolution);
  assert.throws(()=>buildTask({...input,referenceMode:true,videoInputMode:'frames'},crypto.randomUUID()),/combinados/);
 }
});
test('mentions never silently convert connected first/last frames into reference images',()=>{
 const image={id:'a',data:{kind:'image',imageName:'hero',result:url}};
 assert.throws(()=>resolveImageMentions('Animate @hero',[image],'v',[last],'Seedance 2.5'),/First\/Last/);
 assert.throws(()=>resolveImageMentions('Animate @hero',[image],'v',[],'MiniMax H3','frames'),/First\/Last/);
 const result=resolveImageMentions('Animate @hero',[image],'v',[last],'MiniMax H3','references');assert.equal(result.referenceMode,true);assert.deepEqual(result.references,[last,url]);
});
