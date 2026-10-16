import {isLocalMedia} from './local-media.mjs';
import {nodeImage} from './workflow-cover.mjs';
import {safeMedia} from './runware-models.mjs';

export const imageName=node=>node.data.imageName?.trim()||node.data.generatedModel||node.data.model||({generate:'Nano Banana Pro',video:'Seedance 2.5',image:'Load Image',loadvideo:'Load Video',upscale:'Magnific',upscalevideo:'Topaz',output:'Output'})[node.data.kind]||'Image';
export function nameMediaNodes(nodes){
 const used=new Set(nodes.map(n=>n.data.imageName?.trim().toLocaleLowerCase()).filter(Boolean));
 return nodes.map(n=>{
  if(n.data.imageName||!['image','loadvideo','generate','video','upscale','upscalevideo','output'].includes(n.data.kind))return n;
  const base=imageName(n);let name=base,i=2;while(used.has(name.toLocaleLowerCase()))name=base+' '+i++;
  used.add(name.toLocaleLowerCase());return {...n,data:{...n.data,imageName:name}};
 });
}

export const mentionToken=name=>/^[\p{L}\p{N}_-]+$/u.test(name)?`@${name}`:`@[${name}]`;
const tokens=()=>/(^|[\s(])(?:@\[([^\]\n]+)\]|@([\p{L}\p{N}_-]+))/gu;
export const renameMention=(prompt,oldName,nextName)=>prompt.replace(tokens(),(token,prefix,bracket,simple)=>(bracket||simple)===oldName?prefix+mentionToken(nextName):token);
export function imageChoices(nodes){return nodes.flatMap(node=>{const video=['video','loadvideo','upscalevideo'].includes(node.data.kind)||node.data.mediaType==='video';const src=video?((safeMedia(node.data.result)||isLocalMedia(node.data.result))?node.data.result:undefined):nodeImage(node);return src?[{id:node.id,name:imageName(node),src,video}]:[];});}
export function mentionQuery(text,caret){
 const match=/(?:^|\s)@([^\[\]@\s]*)$/.exec(text.slice(0,caret));
 return match?{start:caret-match[1].length-1,end:caret,query:match[1]}:null;
}
export function resolveImageMentions(prompt,nodes,targetId,connected=[],model=''){
 const references=[...connected],referenceVideos=[],choices=imageChoices(nodes),seedance=['Seedance 2.0','Seedance 2.5'].includes(model);
 let mentioned=false;
 const text=prompt.replace(tokens(),(_token,prefix,bracket,simple)=>{
  const name=bracket||simple;mentioned=true;
  const matches=choices.filter(item=>item.name===name);
  if(matches.length!==1)throw new Error(`A imagem “${name}” foi removida, está sem resultado ou tem nome duplicado.`);
  const item=matches[0];
  if(item.video&&!seedance)throw new Error('Menções de vídeo exigem Seedance 2.0 ou Seedance 2.5.');
  const pool=item.video?referenceVideos:references;
  let index=pool.indexOf(item.src);if(index<0){index=pool.length;pool.push(item.src);}
  return prefix+(seedance?`@${item.video?'Video':'Image'}${index+1}`:`reference image ${index+1}`);
 });
 return {prompt:text,references,...(seedance&&mentioned?{referenceMode:true,referenceVideos}:{})};
}

export function mentionParts(text,names){
 const known=new Set(names),parts=[];let cursor=0;
 for(const match of text.matchAll(tokens())){
  const start=match.index+match[1].length,end=match.index+match[0].length;
  if(!known.has(match[2]||match[3]))continue;
  if(start>cursor)parts.push({text:text.slice(cursor,start),mention:false});
  parts.push({text:text.slice(start,end),mention:true});cursor=end;
 }
 if(cursor<text.length)parts.push({text:text.slice(cursor),mention:false});
 return parts;
}
