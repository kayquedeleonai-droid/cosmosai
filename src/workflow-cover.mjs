import {safeMedia} from './runware-models.mjs';
export function validCover(src){return typeof src==='string'&&(src==='/demo-landscape.svg'||safeMedia(src)||/^data:image\/(png|jpeg|webp);base64,/.test(src));}
export function nodeImage(node){if(!node||['video','loadvideo','upscalevideo'].includes(node.data.kind)||node.data.mediaType==='video'||node.data.kind==='prompt')return undefined;const src=node.data.result||node.data.image;return validCover(src)?src:undefined;}
export function workflowCover(project){return validCover(project.coverImage)?project.coverImage:project.nodes.map(nodeImage).find(Boolean);}
