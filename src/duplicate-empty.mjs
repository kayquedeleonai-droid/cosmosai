import {nameMediaNodes} from './image-mentions.mjs';
const settings=['kind','model','ratio','resolution','quality','duration','referenceSlots','psSlots','flavor','sharpen','smartGrain','ultraDetail','topazResolution','targetFps','interpolation','noise','upscaleFactor','upscaleStyle','creativity','hdr','resemblance','fractality','compareMode','compareSplit','compareOutput'];
export function duplicateEmpty(nodes,id,newId){
 const source=nodes.find(n=>n.id===id);
 if(!source)throw new Error('Node não encontrado.');
 if(nodes.length>=100)throw new Error('Limite de 100 nodes por workflow.');
 const data=Object.fromEntries(settings.filter(key=>source.data[key]!==undefined).map(key=>[key,source.data[key]]));
 if(data.kind==='prompt')data.prompt='';
 const position={x:source.position.x+(source.measured?.width||source.width||430)+40,y:source.position.y};
 while(nodes.some(n=>Math.abs(n.position.x-position.x)<40&&Math.abs(n.position.y-position.y)<40))position.y+=60;
 return nameMediaNodes([...nodes.map(n=>({...n,selected:false})),{id:newId,type:'studio',position,selected:true,data}]);
}
export function emptyDuplicateTarget(event){
 if(!event.altKey||event.button!==0)return null;
 const target=event.target;
 if(!target?.closest||target.closest('input,textarea,button,select,summary,a,[contenteditable=true],.react-flow__handle,.node-controls'))return null;
 return target.closest('.react-flow__node')?.getAttribute('data-id')||null;
}
