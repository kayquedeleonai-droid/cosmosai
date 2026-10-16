import test from 'node:test';
import assert from 'node:assert/strict';
import {applyWorkflowActions,workflowContext,workflowSignature} from '../src/orbi-workflow.mjs';
import {converse} from '../worker/assistant.mjs';
const project=()=>({id:'test',name:'Test',version:1,nodes:[],edges:[]});
const action=(type,id,extra={})=>({type,id,kind:'',settings:[],x:0,y:0,source:'',target:'',port:'',...extra});
const plan=()=>[action('create','p',{kind:'prompt',settings:[{key:'prompt',value:'A cinematic landscape'}]}),action('create','g',{kind:'generate',x:500}),action('connect','',{source:'p',target:'g'})];
test('creates configured connected nodes atomically, without generation or mutation',()=>{
 const before=project(),next=applyWorkflowActions(before,plan());
 assert.equal(before.nodes.length,0);assert.equal(next.nodes.length,2);assert.equal(next.edges.length,1);
 assert.equal(next.nodes[1].data.model,'Nano Banana Pro');assert.equal(next.nodes[1].data.result,undefined);assert.equal(next.nodes[1].data.pendingTask,undefined);
 assert.equal(next.edges[0].source,next.nodes[0].id);
});
test('rejects dangerous actions, unknown settings, incompatible models and occupied ports atomically',()=>{
 for(const bad of [action('generate','g'),action('delete','g'),action('update','g',{settings:[{key:'result',value:'https://bad.test'}]}),action('update','g',{settings:[{key:'model',value:'MiniMax H3'}]}),action('update','g',{settings:[{key:'resolution',value:'1080p'}]}),action('connect','',{source:'p',target:'g'})]){
  const before=project();assert.throws(()=>applyWorkflowActions(before,[...plan(),bad]));assert.equal(before.nodes.length,0);
 }
});
test('context excludes media bytes, urls, costs and pending task tokens; changes invalidate signature',()=>{
 const p=applyWorkflowActions(project(),plan());p.nodes[1].data.result='https://private.test/image';p.nodes[1].data.cost='2';p.nodes[1].data.pendingTask='secret';
 const context=JSON.stringify(workflowContext(p));assert.ok(!context.includes('private.test'));assert.ok(!context.includes('secret'));assert.equal(workflowContext(p).nodes[1].hasMedia,true);
 const signature=workflowSignature(p);p.nodes[0].data.prompt='changed';assert.notEqual(workflowSignature(p),signature);
});
test('renames update mentions and do not erase generated media',()=>{
 const p=applyWorkflowActions(project(),plan());const image=p.nodes[1];image.data.result='https://im.runware.ai/test.png';image.data.imageName='castle';p.nodes[0].data.prompt='Edit @castle';
 const next=applyWorkflowActions(p,[action('update',image.id,{settings:[{key:'imageName',value:'fortress'}]})]);
 assert.equal(next.nodes[0].data.prompt,'Edit @fortress');assert.equal(next.nodes[1].data.result,image.data.result);
});
test('structured response supports plans, rejects incomplete output, and keeps old clients compatible',async()=>{
 const fetcher=async(url,options)=>{const body=JSON.parse(options.body);assert.equal(body.text.format.strict,true);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({text:'Plano pronto',actions:plan()})}]}]});};
 const answer=await converse([{role:'user',content:'Crie um fluxo'}],'test',fetcher,workflowContext(project()));assert.equal(answer.actions.length,3);
 await assert.rejects(converse([{role:'user',content:'Crie um fluxo'}],'test',async()=>Response.json({status:'incomplete',output:[{type:'message',content:[{type:'output_text',text:'{"text":"partial'}]}]}),workflowContext(project())),/incompleto/);
});
