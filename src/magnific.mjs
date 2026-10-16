import {safeMedia} from './runware-models.mjs';
export const magnificModel='Magnific Creative';
export const magnificStyles={standard:'Padrão',soft_portraits:'Retrato suave',hard_portraits:'Retrato detalhado',art_n_illustration:'Arte e ilustração',videogame_assets:'Games',nature_n_landscapes:'Natureza',films_n_photography:'Cinema e fotografia','3d_renders':'Render 3D',science_fiction_n_horror:'Ficção e horror'};
export function magnificOptions(input){
 const scale_factor=input.upscaleFactor||'2x',optimized_for=input.upscaleStyle||'standard';
 if(!['2x','4x','8x','16x'].includes(scale_factor)||!Object.hasOwn(magnificStyles,optimized_for))throw new Error('Configuração de upscale inválida.');
 const options={scale_factor,optimized_for,engine:'automatic',prompt:input.prompt||''};
 if(typeof options.prompt!=='string'||options.prompt.length>3000)throw new Error('Prompt de upscale inválido.');
 for(const key of ['creativity','hdr','resemblance','fractality']){const value=Number(input[key]??0);if(!Number.isInteger(value)||value< -10||value>10)throw new Error('Os ajustes Magnific devem ficar entre -10 e 10.');options[key]=value;}
 return options;
}
export function magnificTask(input){
 const image=input.reference;
 if(typeof image!=='string'||image.length>28000000||!(safeMedia(image)||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)))throw new Error('Conecte uma imagem válida ao Magnific.');
 return {...magnificOptions(input),image};
}
