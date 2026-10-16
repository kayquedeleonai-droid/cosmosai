import {nodeImage} from './workflow-cover.mjs';
import {imageName} from './image-mentions.mjs';
export function detachImage(nodes,edges,id,newId){
 const original=nodes.find(n=>n.id===id),src=nodeImage(original);
 if(!original||!src||original.data.kind==='image'||original.data.pendingTask)throw new Error('Selecione uma imagem gerada e concluída para desanexar.');
 if(nodes.length>=100)throw new Error('Limite de 100 nodes por workflow.');
 const name=imageName(original);
 const data={...original.data};delete data.result;delete data.image;delete data.status;delete data.cost;delete data.generatedModel;delete data.generatedResolution;
 data.imageName=`Gerador ${id.slice(0,8)}`;
 const detached={id:newId,type:'studio',position:{x:original.position.x+480,y:original.position.y},selected:true,data:{kind:'image',result:src,mediaType:'image',imageName:name}};
 return {nodes:[...nodes.map(n=>n.id===id?{...n,selected:false,data}:{...n,selected:false}),detached],edges:edges.map(e=>e.source===id?{...e,source:newId}:e)};
}
