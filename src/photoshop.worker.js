import {writePsd} from 'ag-psd';
import {layerLayout} from './photoshop.mjs';
self.onmessage=async({data:items})=>{
  const bitmaps=[];
  try{
    for(const item of items){bitmaps.push(await createImageBitmap(item.blob));layerLayout(bitmaps);}
    const {width,height,offsets}=layerLayout(bitmaps);
    const composite=new OffscreenCanvas(width,height),ctx=composite.getContext('2d');
    for(let i=bitmaps.length-1;i>=0;i--)ctx.drawImage(bitmaps[i],offsets[i].left,offsets[i].top);
    const children=bitmaps.map((bitmap,i)=>{
      const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),context=canvas.getContext('2d');context.drawImage(bitmap,0,0);
      return {name:items[i].name,...offsets[i],imageData:context.getImageData(0,0,bitmap.width,bitmap.height)};
    });
    const buffer=writePsd({width,height,imageData:ctx.getImageData(0,0,width,height),children},{generateThumbnail:false});
    if(buffer.byteLength>134217728)throw new Error('PSD acima de 128 MB. Exporte menos camadas por vez.');
    self.postMessage({buffer},[buffer]);
  }catch(error){self.postMessage({error:error.message||'Não foi possível preparar o PSD.'});}
  finally{bitmaps.forEach(b=>b.close());}
};
