import test from 'node:test';
import assert from 'node:assert/strict';
import {models,switchModel,buildTask,availableResolutions,outputSize,durationOptions} from '../src/runware-models.mjs';
import {estimateCost} from '../src/pricing.mjs';
import {validateProject} from '../src/graph.mjs';
const all=models.filter(m=>m.id.startsWith('minimax:'));
const frame='https://im.runware.ai/image.png';
test('MiniMax switches away from incompatible duration and resolution',()=>{
 assert.equal(all.length,4);
 for(const model of all){
 const data={kind:'video',ratio:'16:9',resolution:'1080p',duration:'4',quality:'high'};
 const next={...data,...switchModel(data,model.label)};
 assert.equal(next.duration,'5');assert.equal(next.quality,undefined);
 assert.ok(availableResolutions(model,next.ratio).includes(next.resolution));
 assert.equal(buildTask({...next,prompt:'Camera slowly pans'},crypto.randomUUID()).model,model.id);
 }
});
test('every advertised MiniMax ratio, resolution and duration makes valid text/frame requests',()=>{
 for(const m of all)for(const ratio of Object.keys(m.sizes))for(const resolution of availableResolutions(m,ratio))for(const duration of durationOptions(m)){
 const input={model:m.label,prompt:'Camera slowly pans',ratio,resolution,duration};
 const text=buildTask(input,crypto.randomUUID()),size=outputSize(m,ratio,resolution);
 assert.deepEqual([text.width,text.height],size);assert.equal(text.resolution,undefined);
 const image=buildTask({...input,references:[frame,frame]},crypto.randomUUID());
 assert.deepEqual(image.inputs.frameImages,[frame,frame]);assert.equal(image.width,undefined);assert.equal(image.height,undefined);
 assert.equal(image.resolution,m.id==='minimax:h3@fast'?undefined:resolution);
 assert.ok(estimateCost(input).reserve>estimateCost(input).usd);
 validateProject({version:1,name:'test',nodes:[{id:'test',position:{x:0,y:0},data:{kind:'video',...input}}],edges:[]});
 }
});
test('MiniMax rejects unsupported tiers and too many frames before charging',()=>{
 const input={model:'MiniMax H3 Fast',prompt:'Camera moves',ratio:'16:9',duration:'5',resolution:'480p'};
 assert.throws(()=>buildTask({...input,resolution:'1080p'},'test'),/Resolução/);
 assert.throws(()=>buildTask({...input,duration:'4'},'test'),/Duração/);
 assert.throws(()=>buildTask({...input,references:[frame,frame,frame]},'test'),/referência/);
 assert.ok(Math.abs(estimateCost({...input,duration:'10'}).usd-.46)<1e-9);
 assert.equal(estimateCost({...input,model:'MiniMax H3',resolution:'1440p',duration:'10'}).usd,1.3);
});
