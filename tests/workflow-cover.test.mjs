import test from 'node:test';
import assert from 'node:assert/strict';
import {nodeImage,workflowCover,validCover} from '../src/workflow-cover.mjs';
test('explicit cover remains unchanged when a node generates a new result or is deleted',()=>{
 const coverImage='https://im.runware.ai/chosen.png';
 assert.equal(workflowCover({coverImage,nodes:[{data:{kind:'generate',result:'https://im.runware.ai/new.png'}}]}),coverImage);
 assert.equal(workflowCover(JSON.parse(JSON.stringify({coverImage,nodes:[]}))),coverImage);
});
test('legacy workflows choose an image, skip videos and reject unsafe covers',()=>{
 const video={data:{kind:'video',result:'https://im.runware.ai/video.mp4'}},image={data:{kind:'generate',result:'/demo-landscape.svg'}};
 assert.equal(nodeImage(video),undefined);assert.equal(validCover('javascript:alert(1)'),false);
 assert.equal(workflowCover({coverImage:'https://evil.example/track',nodes:[video,image]}),'/demo-landscape.svg');
});
