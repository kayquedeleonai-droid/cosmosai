import test from 'node:test';
import assert from 'node:assert/strict';
import {models,buildTask,readResult,safeMedia,availableResolutions,findModel} from '../src/runware-models.mjs';
import {validConnection,validateProject} from '../src/graph.mjs';
import worker from '../worker/index.mjs';
import {verifyUser} from '../worker/auth.mjs';
test('all supported models build real async tasks with a single result',()=>{
 for(const model of models){const t=buildTask({model:model.label,prompt:'Uma paisagem cinematográfica',ratio:'16:9',duration:'4'},crypto.randomUUID());assert.equal(t.model,model.id);assert.equal(t.numberResults,1);assert.equal(t.deliveryMethod,'async');assert.ok(t.width>0);}
});
test('reference frames use resolution instead of conflicting dimensions',()=>{const t=buildTask({model:'VEO',prompt:'Uma câmera avança',ratio:'16:9',reference:'https://im.runware.ai/test.png'},crypto.randomUUID());assert.equal(t.width,undefined);assert.equal(t.resolution,'720p');assert.equal(t.inputs.frameImages.length,1);});
test('reject unsupported models, ratios, prompt sizes and unsafe reference URLs',()=>{const input={model:'Nano Banana Pro',prompt:'A sunset',ratio:'1:1'};for(const patch of [{model:'invented'},{ratio:'4:99'},{prompt:'x'.repeat(3001)},{reference:'https://evil.example/p.png'}])assert.throws(()=>buildTask({...input,...patch},crypto.randomUUID()));assert.equal(safeMedia('https://im.runware.ai.evil.test/a'),false);assert.equal(safeMedia('http://im.runware.ai/a'),false);});
test('poll parser matches task IDs, errors and video results',()=>{assert.equal(readResult({data:[{taskUUID:'other',imageURL:'https://im.runware.ai/a'}]},'one').state,'processing');assert.equal(readResult({errors:[{taskUUID:'one',message:'Balance low'}]},'one').error,'Balance low');assert.equal(readResult({data:[{taskUUID:'one',videoURL:'https://vm.runware.ai/a.mp4'}]},'one').mediaType,'video');});
test('prompt and reference use distinct ports with independent occupancy',()=>{const nodes=['prompt','image','generate'].map((kind,i)=>({id:String(i),position:{x:0,y:0},data:{kind}}));const edges=[{id:'p',source:'0',target:'2'}];assert.equal(validConnection({source:'1',target:'2',targetHandle:'reference'},nodes,edges),true);assert.equal(validConnection({source:'0',target:'2',targetHandle:'reference'},nodes,edges),false);assert.doesNotThrow(()=>validateProject({version:1,name:'Multi',nodes,edges:[...edges,{id:'r',source:'1',target:'2',targetHandle:'reference'}]}));});
test('backend denies foreign origins and unsigned requests before provider access',async()=>{const env={ALLOWED_ORIGINS:'https://aicosmos.app',RUNWARE_API_KEY:'test',DB:{}};assert.equal((await worker.fetch(new Request('https://api.test/generate',{method:'POST',headers:{Origin:'https://evil.test'}}),env)).status,403);assert.equal((await worker.fetch(new Request('https://api.test/generate',{method:'POST',headers:{Origin:'https://aicosmos.app'},body:'{}'}),env)).status,401);await assert.rejects(()=>verifyUser('forged','cosmosai-1e2d6'));});
test('resolution selection maps to model-specific exact dimensions',()=>{
 const input={prompt:'A mountain landscape',ratio:'16:9'};
 for(const [model,resolution,size] of [['Nano Banana Pro','4K',[5504,3072]],['Seedream 5.0 Pro','2K',[2816,1584]],['GPT Image 2.5 Flare','4K',[3840,2160]],['Seedance 2.5','480p',[854,480]],['Seedance 2.5','1080p',[1920,1080]],['VEO','4K',[3840,2160]]]){
   const task=buildTask({...input,model,resolution},crypto.randomUUID());assert.deepEqual([task.width,task.height],size);assert.equal(task.resolution,undefined);
 }
});
test('video references preserve the selected resolution without conflicting dimensions',()=>{
 for(const model of ['Seedance 2.5','VEO']){const task=buildTask({model,prompt:'A camera moves',ratio:'9:16',resolution:'1080p',reference:'https://im.runware.ai/test.png'},crypto.randomUUID());assert.equal(task.resolution,'1080p');assert.equal(task.width,undefined);assert.equal(task.height,undefined);}
});
test('unsupported resolution combinations are rejected and excluded from UI choices',()=>{
 assert.deepEqual(availableResolutions(findModel('Seedream 5.0 Pro'),'1:1'),['1K','2K']);
 assert.deepEqual(availableResolutions(findModel('GPT Image 2.5 Sunburst'),'1:1'),['1K','2K']);
 assert.deepEqual(availableResolutions(findModel('VEO'),'16:9'),['720p','1080p','4K']);
 for(const [model,resolution,ratio] of [['Seedream 5.0 Pro','4K','16:9'],['VEO','480p','16:9'],['GPT Image 2.5 Sunburst','4K','1:1'],['Nano Banana Pro','__proto__','1:1']])assert.throws(()=>buildTask({model,resolution,ratio,prompt:'A mountain'},crypto.randomUUID()),/Resolução/);
});

test('new models enforce their resolutions, durations and reference constraints',()=>{
 const base={prompt:'A cinematic sunset',ratio:'16:9'};
 assert.equal(buildTask({...base,model:'Nano Banana 2',resolution:'4K'},crypto.randomUUID()).width,5504);
 assert.equal(buildTask({...base,model:'Seedance 2.0',resolution:'480p',duration:'15'},crypto.randomUUID()).width,864);
 const ref={...base,reference:'https://im.runware.ai/test.png'};
 assert.equal(buildTask({...ref,model:'Seedance 2.0',resolution:'4K'},crypto.randomUUID()).resolution,'4k');
 assert.equal(buildTask({...ref,model:'Kling 3.0 Turbo',duration:'3'},crypto.randomUUID()).inputs.frameImages[0],ref.reference);
 for(const patch of [{resolution:'4K'},{duration:'16'},{prompt:'x'.repeat(2501)}])assert.throws(()=>buildTask({...ref,model:'Kling 3.0 Turbo',...patch},crypto.randomUUID()));
});
