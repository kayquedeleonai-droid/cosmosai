import {safeMedia} from '../src/runware-models.mjs';
export async function uploadMedia(media,key){
 if(typeof media!=='string'||media.length>28000000||!/^data:(image\/(png|jpeg|webp)|video\/(mp4|webm));base64,[A-Za-z0-9+/]+={0,2}$/.test(media))throw new Error('Use PNG, JPG, WebP, MP4 ou WebM de até 20 MB.');
 const taskUUID=crypto.randomUUID();
 const response=await fetch('https://api.runware.ai/v1',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify([{taskType:'mediaStorage',taskUUID,operation:'upload',media}]),signal:AbortSignal.timeout(25000)});
 const body=await response.json(),item=body.data?.find(item=>item.taskUUID===taskUUID);
 if(!response.ok||body.errors?.length||!safeMedia(item?.mediaURL))throw new Error('A Runware não concluiu o upload. Tente novamente.');
 return {url:item.mediaURL,mediaType:media.startsWith('data:video/')?'video':'image'};
}
