import {isMagnificGeneration} from './magnific-generation.mjs';
import {safeMedia} from './runware-models.mjs';
export const magnificModel='Magnific Creative';
export const precisionModel='Magnific Precision V2';
export const topazModels=['Topaz Starlight Precise 2.5','Topaz Starlight Fast 2'];
export const isMagnificModel=model=>isMagnificGeneration(model)||[magnificModel,precisionModel,...topazModels].includes(model);
export const isUpscale=kind=>kind==='upscale'||kind==='upscalevideo';
export const upscaleModel=data=>data.model||(data.kind==='upscalevideo'?topazModels[0]:magnificModel);
export function magnificEndpoint(model){if(model===precisionModel)return 'image-upscaler-precision-v2';if(topazModels.includes(model))return 'video-upscaler-topaz';if(!model||model===magnificModel)return 'image-upscaler';throw new Error('Modelo de upscale inválido.');}
function number(input,key,fallback,min,max,integer=true){const n=Number(input[key]??fallback);if(!Number.isFinite(n)||n<min||n>max||integer&&!Number.isInteger(n))throw new Error('Ajuste inválido: '+key);return n;}

export const magnificStyles={standard:'Padrão',soft_portraits:'Retrato suave',hard_portraits:'Retrato detalhado',art_n_illustration:'Arte e ilustração',videogame_assets:'Games',nature_n_landscapes:'Natureza',films_n_photography:'Cinema e fotografia','3d_renders':'Render 3D',science_fiction_n_horror:'Ficção e horror'};
export function magnificOptions(input){
 const model=upscaleModel(input);magnificEndpoint(model);
 if(topazModels.includes(model)){
  const resolution=input.topazResolution||'2k';if(!['720p','1k','2k','4k'].includes(resolution))throw new Error('Resolução Topaz inválida.');
  const options={enhancement_model:model===topazModels[1]?'starlight_fast_2':'starlight_precise_2_5',resolution,noise:number(input,'noise',0,0,1,false)};
  if(input.targetFps&&input.targetFps!=='original'){options.target_fps=number(input,'targetFps',30,15,60);options.frame_interpolation=input.interpolation||'apollo';if(!['apollo','chronos'].includes(options.frame_interpolation))throw new Error('Interpolação inválida.');}
  return options;
 }
 if(model===precisionModel){
  const scale_factor=Number(String(input.upscaleFactor||'2x').replace('x','')),flavor=input.flavor||'photo';
  if(!Number.isInteger(scale_factor)||scale_factor<2||scale_factor>16||!['sublime','photo','photo_denoiser'].includes(flavor))throw new Error('Configuração Precision inválida.');
  return {scale_factor,flavor,sharpen:number(input,'sharpen',7,0,100),smart_grain:number(input,'smartGrain',7,0,100),ultra_detail:number(input,'ultraDetail',30,0,100)};
 }

 const scale_factor=input.upscaleFactor||'2x',optimized_for=input.upscaleStyle||'standard';
 if(!['2x','4x','8x','16x'].includes(scale_factor)||!Object.hasOwn(magnificStyles,optimized_for))throw new Error('Configuração de upscale inválida.');
 const options={scale_factor,optimized_for,engine:'automatic',prompt:input.prompt||''};
 if(typeof options.prompt!=='string'||options.prompt.length>3000)throw new Error('Prompt de upscale inválido.');
 for(const key of ['creativity','hdr','resemblance','fractality']){const value=Number(input[key]??0);if(!Number.isInteger(value)||value< -10||value>10)throw new Error('Os ajustes Magnific devem ficar entre -10 e 10.');options[key]=value;}
 return options;
}
export function magnificTask(input){
 const image=input.reference;
 if(topazModels.includes(upscaleModel(input))){if(!safeMedia(image))throw new Error('Conecte um vídeo válido ao Topaz.');return {...magnificOptions(input),video:image};}
 if(typeof image!=='string'||image.length>28000000||!(safeMedia(image)||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)))throw new Error('Conecte uma imagem válida ao Magnific.');
 return {...magnificOptions(input),image};
}
