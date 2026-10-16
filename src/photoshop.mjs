import {nodeImage} from './workflow-cover.mjs';
import {imageName} from './image-mentions.mjs';
export const photoshopSlots=data=>Math.max(1,Math.min(16,Number(data.psSlots)||2));
export const layerHandle=i=>`layer-${i+1}`;
export function photoshopLayers(id,data,nodes,edges){
  return Array.from({length:photoshopSlots(data)},(_,i)=>{
    const edge=edges.find(e=>e.target===id&&e.targetHandle===layerHandle(i));
    const source=nodes.find(n=>n.id===edge?.source);
    return {slot:i,connected:!!edge,name:source?imageName(source):`Camada ${i+1}`,src:nodeImage(source)};
  });
}
export function layerLayout(sizes){
  if(!sizes.length||sizes.length>16)throw new Error('Conecte de 1 a 16 imagens prontas.');
  if(sizes.some(s=>!Number.isInteger(s.width)||!Number.isInteger(s.height)||s.width<1||s.height<1||s.width>16384||s.height>16384))throw new Error('Dimensões de imagem inválidas ou acima de 16.384 px.');
  const width=Math.max(...sizes.map(s=>s.width)),height=Math.max(...sizes.map(s=>s.height));
  if(width*height>20000000||sizes.reduce((sum,s)=>sum+s.width*s.height,0)>34000000)throw new Error('Este PSD excede o limite de memória. Exporte menos imagens por vez (até 34 megapixels somados).');
  return {width,height,offsets:sizes.map(s=>({left:Math.floor((width-s.width)/2),top:Math.floor((height-s.height)/2)}))};
}
