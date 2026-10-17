// Pure pixel/geometry operations, shared with the automated round-trip tests.
function selectionBounds(bounds,documentWidth,documentHeight){
 if(!bounds)throw new Error('Faça uma seleção retangular no Photoshop.');
 const left=Math.floor(Number(bounds.left)),top=Math.floor(Number(bounds.top)),right=Math.ceil(Number(bounds.right)),bottom=Math.ceil(Number(bounds.bottom));
 const width=right-left,height=bottom-top;
 if(![left,top,right,bottom,documentWidth,documentHeight].every(Number.isFinite)||left<0||top<0||width<1||height<1||right>documentWidth||bottom>documentHeight)throw new Error('Seleção fora do documento.');
 if(width*height>4096*4096)throw new Error('Use uma seleção de até 16 megapixels.');
 return {left,top,width,height,documentWidth,documentHeight};
}
function paddedRGBA(pixels,info,crop){
 const {width,height,components,left,top}=info;
 if(![3,4].includes(components)||pixels.length!==width*height*components)throw new Error('Formato de pixels não suportado.');
 const x=left-crop.left,y=top-crop.top;
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x+width>crop.width||y+height>crop.height)throw new Error('Photoshop retornou coordenadas inesperadas.');
 const rgba=new Uint8Array(crop.width*crop.height*4);
 for(let row=0;row<height;row++)for(let col=0;col<width;col++){
  const a=(row*width+col)*components,b=((row+y)*crop.width+col+x)*4;
  rgba[b]=pixels[a];rgba[b+1]=pixels[a+1];rgba[b+2]=pixels[a+2];rgba[b+3]=components===4?pixels[a+3]:255;
 }
 return rgba;
}
function validateReturn(meta,record,doc){
 if(!record||meta.session!==record.session||meta.cropId!==record.cropId)throw new Error('Recorte de outra sessão. Envie a seleção novamente.');
 if(!doc||doc.id!==record.documentId||doc.name!==record.documentName)throw new Error('Abra e selecione o documento original antes de trazer o resultado.');
 if(Number(doc.width)!==record.documentWidth||Number(doc.height)!==record.documentHeight)throw new Error('O tamanho do documento mudou. Reenvie uma nova seleção para manter a posição exata.');
 for(const key of ['left','top','width','height','documentId','documentWidth','documentHeight'])if(meta[key]!==record[key])throw new Error('Os dados de posição do recorte não correspondem ao original.');
 return {left:record.left,top:record.top};
}
module.exports={selectionBounds,paddedRGBA,validateReturn};
