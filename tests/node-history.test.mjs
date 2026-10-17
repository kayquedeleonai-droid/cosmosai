import test from 'node:test';
import assert from 'node:assert/strict';
import {nodeHistory,withNodeHistory,selectHistory,readNodeHistory,mergeGenerationHistory} from '../src/node-history.mjs';
import {duplicateEmpty} from '../src/duplicate-empty.mjs';
const url=n=>`https://cdn-magnific.freepik.com/${n}.png`;
test('generation keeps prior output and metadata; browsing preserves selected output and review',()=>{
 const old={kind:'generate',result:url(1),generatedModel:'old',generatedResolution:'1K',reviewStatus:'approved'};
 let data=withNodeHistory(old,{result:url(2),generatedModel:'new',generatedResolution:'4K',mediaType:'image'});
 assert.equal(nodeHistory(data).length,2);
 data=withNodeHistory(data,selectHistory(data,0));
 assert.equal(data.result,url(1));assert.equal(data.generatedModel,'old');assert.equal(data.reviewStatus,'approved');
 data=withNodeHistory(data,{result:url(3),generatedModel:'third'});
 assert.deepEqual(nodeHistory(data).map(r=>r.url),[url(1),url(2),url(3)]);
 assert.equal(nodeHistory(withNodeHistory(data,{result:url(3)})).length,3);
 assert.equal(readNodeHistory(JSON.stringify(nodeHistory(data))).length,3);
});
test('history validates URLs, remains bounded and empty duplication clears results',()=>{
 let data={kind:'video'};
 for(let i=0;i<55;i++)data=withNodeHistory(data,{result:url(i),mediaType:'video'});
 assert.equal(nodeHistory(data).length,50);
 assert.equal(selectHistory(data,0).mediaType,'video');
 assert.throws(()=>readNodeHistory(JSON.stringify([{url:'https://evil.test/image',mediaType:'image'}])));
 const copy=duplicateEmpty([{id:'a',position:{x:0,y:0},data}],'a','b')[1];
 assert.equal(copy.data.mediaHistory,undefined);
});
test('historical jobs merge chronologically without changing active result or duplicating URLs',()=>{
 const data={kind:'generate',result:url(2),reviewStatus:'approved'};
 const jobs=[3,2,1].map(i=>({state:'success',result:{url:url(i),mediaType:'image'},model:'GPT Image 2.5 Sunburst',metadata:{resolution:'4K'}}));
 const merged=mergeGenerationHistory(data,jobs);
 assert.equal(merged.result,url(2));
 assert.deepEqual(nodeHistory(merged).map(r=>r.url),[url(1),url(2),url(3)]);
 assert.equal(selectHistory(merged,1).reviewStatus,'approved');
 assert.deepEqual(nodeHistory(mergeGenerationHistory(merged,jobs)),nodeHistory(merged));
});
