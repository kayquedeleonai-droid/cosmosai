import type {Project} from './types';
type Bridge={read:()=>Project;apply:(actions:unknown[],signature:string)=>void};
let active:Bridge|null=null;
export function registerOrbi(bridge:Bridge){active=bridge;return()=>{if(active===bridge)active=null;};}
export function readOrbi(){return active?.read()||null;}
export function applyOrbi(actions:unknown[],signature:string){if(!active)throw new Error('Abra o workflow para aplicar o plano.');active.apply(actions,signature);}
