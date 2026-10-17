export function readCrop(value){
 if(typeof value!=='string'||value.length>4096)throw new Error('Origem Photoshop inválida.');
 const m=JSON.parse(value);
 if(!m||typeof m.cropId!=='string'||!/^[\w-]{8,100}$/.test(m.cropId)||typeof m.session!=='string'||typeof m.projectId!=='string'||typeof m.documentName!=='string'||!Number.isInteger(m.documentId))throw new Error('Origem Photoshop inválida.');
 for(const k of ['left','top','width','height','documentWidth','documentHeight'])if(!Number.isInteger(m[k])||m[k]<(k==='left'||k==='top'?0:1))throw new Error('Posição Photoshop inválida.');
 if(m.width*m.height>4096*4096||m.left+m.width>m.documentWidth||m.top+m.height>m.documentHeight)throw new Error('Recorte Photoshop inválido.');
 return m;
}
