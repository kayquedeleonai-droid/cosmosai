import test from 'node:test';
import assert from 'node:assert/strict';
import {switchModel,buildTask} from '../src/runware-models.mjs';
test('switching models resets incompatible resolutions, ratios and quality',()=>{
 assert.deepEqual(switchModel({kind:'generate',ratio:'1:1',resolution:'4K',quality:'max'},'Seedream 5.0 Pro'),{model:'Seedream 5.0 Pro',ratio:'1:1',resolution:'1K',quality:undefined,status:undefined});
 const video=switchModel({kind:'video',ratio:'1:1',resolution:'480p'},'VEO');assert.equal(video.ratio,'16:9');assert.equal(video.resolution,'720p');
 const gpt=switchModel({kind:'generate',ratio:'16:9',resolution:'2K',quality:'high'},'GPT Image 2.5 Flare');assert.equal(gpt.resolution,'2K');assert.equal(gpt.quality,'high');
 assert.throws(()=>switchModel({kind:'generate'},'VEO'));
 assert.throws(()=>switchModel({kind:'video',pendingTask:'pending'},'VEO'));
});
test('quality uses provider settings only when supported',()=>{
 const input={model:'GPT Image 2.5 Flare',prompt:'A quiet forest',ratio:'1:1',quality:'high'};
 assert.equal(buildTask(input,crypto.randomUUID()).settings.quality,'high');
 assert.throws(()=>buildTask({...input,quality:'invented'},crypto.randomUUID()));
 assert.throws(()=>buildTask({...input,model:'Nano Banana Pro'},crypto.randomUUID()));
});
