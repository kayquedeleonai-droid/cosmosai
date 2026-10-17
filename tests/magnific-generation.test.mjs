import test from 'node:test';
import assert from 'node:assert/strict';
import {magnificGenerationTask,generationEndpoint,jobUsesMagnific} from '../src/magnific-generation.mjs';
import {createMagnific,pollMagnific,readMagnific} from '../worker/magnific.mjs';
import {safeMedia} from '../src/runware-models.mjs';

test('provider failures retain the actual reason without suggesting an unverified credit problem',()=>{
 const failed=readMagnific({data:{status:'FAILED',error:{message:'Invalid reference image',code:'INVALID_IMAGE'}}});
 assert.equal(failed.error,'Magnific: Invalid reference image');assert.equal(failed.providerCode,'INVALID_IMAGE');
 const unspecified=readMagnific({data:{status:'FAILED',generated:[]}});
 assert.match(unspecified.error,/não informou o motivo/);assert.equal(unspecified.error.includes('créditos'),false);
 assert.equal(readMagnific({data:{status:'FAILED',message:'Failed at https://example.com/private?token=secret'}}).error.includes('secret'),false);
});

test('GPT results accept the Magnific CDN without accepting lookalike or unsafe URLs',()=>{
 const url='https://cdn-magnific.freepik.com/generated/result.png?signature=test';
 assert.deepEqual(readMagnific({data:{status:'COMPLETED',generated:[url]}},'GPT Image 2.5 Sunburst'),{state:'success',url,mediaType:'image'});
 for(const value of ['http://cdn-magnific.freepik.com/result.png','https://cdn-magnific.freepik.com.evil.test/result.png','https://user:password@cdn-magnific.freepik.com/result.png','https://evil.test/result.png'])assert.equal(safeMedia(value),false);
 const rejected=readMagnific({data:{status:'COMPLETED',generated:['https://evil.test/image.png?private=secret']}});
 assert.equal(rejected.mediaHost,'evil.test');assert.equal(JSON.stringify(rejected).includes('secret'),false);
});
test('generation payloads keep model variants, reference order and provider resolution limits',()=>{
 const input={model:'GPT Image 2.5 Sunburst',prompt:'A vase',resolution:'4K',ratio:'16:9',quality:'max',references:['data:image/png;base64,AAAA','https://im.runware.ai/ref.png']};
 const task=magnificGenerationTask(input);
 assert.equal(task.variant,'sunburst');assert.equal(task.quality,'max');assert.equal(task.num_images,1);
 assert.deepEqual(task.reference_images,['AAAA','https://im.runware.ai/ref.png']);
 assert.equal(magnificGenerationTask({...input,model:'GPT Image 2.5 Flare'}).variant,'flare');
 assert.throws(()=>magnificGenerationTask({...input,model:'Seedream 5.0 Pro'}),/1.5K/);
 assert.equal(magnificGenerationTask({...input,model:'Seedream 5.0 Pro',resolution:'1.5K'}).resolution,'1.5k');
 assert.equal(generationEndpoint(input.model,true),'text-to-image/gpt-image-2-5-edit');
});

test('Seedream edit keeps the data URI prefix while GPT accepts raw base64',async()=>{
 const reference='data:image/png;base64,AAAA';
 const input={model:'Seedream 5.0 Pro',prompt:'Edit the image',references:[reference,'https://cdn-magnific.freepik.com/ref.png'],resolution:'2K'};
 const task=magnificGenerationTask(input);
 assert.deepEqual(task.reference_images,input.references);
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(url,'https://api.magnific.com/v1/ai/text-to-image/seedream-v5-pro-edit');
   assert.equal(JSON.parse(options.body).reference_images[0],reference);
   return Response.json({data:{task_id:'test-task',status:'IN_PROGRESS'}});
  };
  await createMagnific(task,'test-key',input.model);
 }finally{globalThis.fetch=original;}
 assert.equal(magnificGenerationTask({...input,model:'GPT Image 2.5 Sunburst'}).reference_images[0],'AAAA');
 assert.equal(readMagnific({data:{status:'FAILED',message:'invalid url '+ 'A'.repeat(100)}}).error.includes('A'.repeat(80)),false);
});
test('old Runware tasks keep their provider after model migration',()=>{
 assert.equal(jobUsesMagnific({model:'GPT Image 2.5 Flare',metadata:'{}'}),false);
 assert.equal(jobUsesMagnific({model:'Seedream 5.0 Pro',metadata:'{"provider":"magnific"}'}),true);
 assert.equal(jobUsesMagnific({model:'Magnific Creative',metadata:'{}'}),true);
});
test('Magnific generation and edit polling use the same endpoint without uploads or fallback',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json({data:{task_id:'task-id',status:'IN_PROGRESS'}});};
 try{
 const model='GPT Image 2.5 Flare',task=magnificGenerationTask({model,prompt:'Edit',references:['data:image/png;base64,AAAA']});
 await createMagnific(task,'test-key',model);
 await pollMagnific({model,metadata:JSON.stringify({providerTaskId:'task-id',hasReference:true})},'test-key');
 assert.equal(calls.length,2);
 assert.equal(calls[0].url,'https://api.magnific.com/v1/ai/text-to-image/gpt-image-2-5-edit');
 assert.equal(calls[1].url,calls[0].url+'/task-id');
 assert.deepEqual(JSON.parse(calls[0].options.body).reference_images,['AAAA']);
 }finally{globalThis.fetch=original;}
});
