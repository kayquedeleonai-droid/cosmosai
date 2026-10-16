import test from 'node:test';
import assert from 'node:assert/strict';
import {writePsd,readPsd,initializeCanvas} from 'ag-psd';
initializeCanvas(()=>{throw new Error('Canvas not used by this pixel-only test');},(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}));
import {layerLayout,photoshopLayers} from '../src/photoshop.mjs';
import {validConnection,validateProject} from '../src/graph.mjs';
import {nearestConnection} from '../src/canvas-tools.mjs';
const nodes=[{id:'a',position:{x:0,y:0},data:{kind:'image',result:'/demo-landscape.svg',imageName:'Personagem'}},{id:'p',position:{x:500,y:0},data:{kind:'photoshop',psSlots:'3'}},{id:'v',position:{x:0,y:0},data:{kind:'video'}}];
test('Photoshop slots accept images only, reject duplicates, and support nearest connection',()=>{
 const edge={id:'e',source:'a',target:'p',targetHandle:'layer-2'};
 assert.equal(validConnection(edge,nodes,[]),true);
 assert.equal(validConnection(edge,nodes,[edge]),false);
 assert.equal(validConnection({...edge,source:'v'},nodes,[]),false);
 assert.equal(validConnection({...edge,targetHandle:'layer-4'},nodes,[]),false);
 assert.equal(validConnection({...edge,targetHandle:null},nodes,[]),false);
 assert.equal(nearestConnection('a',nodes,[]).targetHandle,'layer-1');
 assert.equal(photoshopLayers('p',nodes[1].data,nodes,[edge])[1].name,'Personagem');
 assert.equal(photoshopLayers('p',nodes[1].data,nodes,[edge])[1].src,'/demo-landscape.svg');
 assert.doesNotThrow(()=>validateProject({version:1,name:'PSD',nodes,edges:[edge]}));
 assert.throws(()=>validateProject({version:1,name:'PSD',nodes:[{...nodes[1],data:{kind:'photoshop',psSlots:'999'}}],edges:[]}));
});
test('PSD layout preserves dimensions, centers layers and bounds memory',()=>{
 assert.deepEqual(layerLayout([{width:200,height:100},{width:80,height:160}]),{width:200,height:160,offsets:[{left:0,top:30},{left:60,top:0}]});
 assert.throws(()=>layerLayout([]));
 assert.throws(()=>layerLayout([{width:16000,height:16000}]));
});
test('PSD export preserves layer names, order, positions and RGBA pixels',()=>{
 const pixel=(r,g,b,a=255)=>({width:1,height:1,data:new Uint8ClampedArray([r,g,b,a])});
 const buffer=writePsd({width:2,height:2,imageData:{width:2,height:2,data:new Uint8ClampedArray(16)},children:[{name:'Personagem á',left:1,top:1,imageData:pixel(255,0,0,128)},{name:'Fundo',left:0,top:0,imageData:pixel(0,255,0)}]});
 const result=readPsd(buffer,{useImageData:true,skipThumbnail:true});
 assert.deepEqual(result.children.map(l=>l.name),['Personagem á','Fundo']);
 assert.equal(result.children[0].left,1);assert.equal(result.children[0].top,1);
 assert.deepEqual([...result.children[0].imageData.data],[255,0,0,128]);
});

