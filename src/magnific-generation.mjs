import {safeMedia,findModel,availableResolutions as runwareResolutions,switchModel as runwareSwitch,buildTask} from './runware-models.mjs';
export const magnificImageModels=['GPT Image 2.5 Sunburst','GPT Image 2.5 Flare','Seedream 5.0 Pro'];
export const isMagnificGeneration=model=>magnificImageModels.includes(findModel(model)?.label);
export const isSeedream=model=>findModel(model)?.label==='Seedream 5.0 Pro';
export function generationResolutions(model,ratio){return isSeedream(model?.label)?['1.5K','2K']:isMagnificGeneration(model?.label)?['1K','2K','4K']:runwareResolutions(model,ratio);}
export function generationSwitch(data,label){const patch=runwareSwitch(data,label);const options=generationResolutions(findModel(label),patch.ratio);return {...patch,resolution:options.includes(data.resolution)?data.resolution:isSeedream(label)?'2K':options.includes(patch.resolution)?patch.resolution:options[0]};}
export function magnificGenerationTask(input){
 if(!isMagnificGeneration(input.model))throw new Error('Modelo Magnific inválido.');
 const seedream=isSeedream(input.model),refs=input.references||[];
 if(typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>(seedream?4096:32000))throw new Error('Escreva um prompt válido.');
 if(!Array.isArray(refs)||refs.length>(seedream?10:16)||refs.some(r=>typeof r!=='string'||r.length>28000000||!(safeMedia(r)||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(r))))throw new Error('Referências inválidas para Magnific.');
 if(input.referenceVideos?.length)throw new Error('Este modelo aceita apenas imagens.');
 const ratios={'1:1':'square_1_1','16:9':'widescreen_16_9','9:16':'social_story_9_16','4:3':'classic_4_3','3:4':'traditional_3_4','21:9':seedream?'cinematic_21_9':'film_horizontal_21_9'};
 const ratio=input.ratio||'1:1',resolution=input.resolution||(seedream?'2K':'1K');
 if(!ratios[ratio]||!generationResolutions(findModel(input.model),ratio).includes(resolution))throw new Error(seedream?'Seedream no Magnific aceita 1.5K ou 2K. Selecione a resolução.':'Resolução ou proporção inválida.');
 const quality=!input.quality||input.quality==='auto'?'medium':input.quality;
 if(!seedream&&!['low','medium','high','xhigh','max'].includes(quality))throw new Error('Qualidade inválida.');
 return {prompt:input.prompt,resolution:resolution.toLowerCase(),aspect_ratio:ratios[ratio],...(!seedream?{variant:findModel(input.model).label.includes('Sunburst')?'sunburst':'flare',quality,num_images:1,output_format:'png'}:{}),...(refs.length?{reference_images:refs.map(r=>r.startsWith('data:')?r.split(',')[1]:r)}:{})};
}
export function generationTask(input,id){return isMagnificGeneration(input.model)?magnificGenerationTask(input):buildTask(input,id);}
export function generationEndpoint(model,edit=false){if(!isMagnificGeneration(model))throw new Error('Modelo inválido.');return 'text-to-image/'+(isSeedream(model)?'seedream-v5-pro':'gpt-image-2-5')+(edit?'-edit':'');}
export function jobUsesMagnific(job){const metadata=JSON.parse(job.metadata||'{}');return metadata.provider==='magnific'||['Magnific Creative','Magnific Precision V2','Topaz Starlight Precise 2.5','Topaz Starlight Fast 2'].includes(job.model);}
