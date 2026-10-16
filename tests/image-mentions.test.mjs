import test from 'node:test';
import assert from 'node:assert/strict';
import {imageName,imageChoices,mentionQuery,resolveImageMentions,renameMention} from '../src/image-mentions.mjs';
import {buildTask} from '../src/runware-models.mjs';
const image={id:'source-1',data:{kind:'generate',imageName:'Personagem',result:'https://im.runware.ai/a.png'}};
test('mentions use names, preserve surrounding text and attach each reference once',()=>{
 assert.deepEqual(resolveImageMentions('Use @[Personagem] perto de @[Personagem].',[image],'target'),{prompt:'Use reference image 1 perto de reference image 1.',references:[image.data.result]});
 assert.equal(resolveImageMentions('@[Personagem]',[image],'target',[image.data.result]).references.length,1);
 assert.equal(imageName({id:'abcdef12345',data:{}}),'Image');
 assert.deepEqual(mentionQuery('Texto @Pers',11),{start:6,end:11,query:'Pers'});
 assert.equal(mentionQuery('email@site.com',14),null);
 assert.equal(mentionQuery('@[Personagem]',13),null);
});
test('node mentions bind images and videos to separate Seedance input pools',()=>{
 const video={id:'clip',data:{kind:'loadvideo',mediaType:'video',imageName:'movimento',result:'https://mm.runware.ai/clip.mp4'}};
 const resolved=resolveImageMentions('Use @Personagem com @movimento',[image,video],'target',[],'Seedance 2.5');
 assert.equal(resolved.prompt,'Use @Image1 com @Video1');
 const task=buildTask({...resolved,model:'Seedance 2.5',ratio:'16:9',resolution:'720p',duration:4},crypto.randomUUID());
 assert.deepEqual(task.inputs,{referenceImages:[image.data.result],referenceVideos:[video.data.result]});
 assert.throws(()=>resolveImageMentions('@movimento',[video],'target',[],'Nano Banana Pro'),/exigem/);
 assert.equal(renameMention('@Personagem @Personagem2 email@Personagem','Personagem','Herói'),'@Herói @Personagem2 email@Personagem');
 assert.throws(()=>buildTask({...resolved,model:'Seedance 2.5',ratio:'16:9',resolution:'1080p',duration:4},crypto.randomUUID()),/720p/);
});
test('missing and ambiguous references fail before generation',()=>{
 assert.throws(()=>resolveImageMentions('@[Personagem]',[],'target'),/removida/);
 assert.throws(()=>resolveImageMentions('@[Personagem]',[image,{...image,id:'other'}],'target'),/duplicado/);
 assert.equal(imageChoices([{id:'v',data:{kind:'video',result:'https://vm.runware.ai/a.mp4'}}]).length,1);
 const nodes=Array.from({length:3},(_,i)=>({id:String(i),data:{kind:'image',imageName:`Foto ${i}`,image:`https://im.runware.ai/${i}.png`}}));
 const resolved=resolveImageMentions('Animate @[Foto 0] @[Foto 1] @[Foto 2]',nodes,'target');
 assert.throws(()=>buildTask({...resolved,model:'Seedance 2.5',ratio:'16:9',resolution:'720p',duration:4},crypto.randomUUID()));
});

test('default model names are readable, unique and keep manual names',async()=>{
 const {nameMediaNodes}=await import('../src/image-mentions.mjs');
 const nodes=nameMediaNodes([
 {id:'a',data:{kind:'generate',model:'Nano Banana Pro'}},
 {id:'b',data:{kind:'generate',model:'Nano Banana Pro'}},
 {id:'c',data:{kind:'generate',model:'Other',imageName:'Character'}},
 {id:'d',data:{kind:'video',generatedModel:'Seedance 2.5',model:'VEO 3.1'}},
 ]);
 assert.deepEqual(nodes.map(imageName),['Nano Banana Pro','Nano Banana Pro 2','Character','Seedance 2.5']);
});

test('mention highlighting preserves exact text, Unicode, bracket names and line breaks',async()=>{
 const {mentionParts}=await import('../src/image-mentions.mjs');
 const text='Use @oficina_a e @[Nano Banana Pro]\n(@ação), email@oficina_a e @missing';
 const parts=mentionParts(text,['oficina_a','Nano Banana Pro','ação']);
 assert.equal(parts.map(p=>p.text).join(''),text);
 assert.deepEqual(parts.filter(p=>p.mention).map(p=>p.text),['@oficina_a','@[Nano Banana Pro]','@ação']);
 assert.equal(mentionParts('<script>@missing</script>',[]).some(p=>p.mention),false);
});
