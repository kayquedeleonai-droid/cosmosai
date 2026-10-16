import {auth} from './firebase';
export const runwareConfigured=Boolean(import.meta.env.VITE_RUNWARE_API_URL);
export type Generation={state:string;url?:string;mediaType?:string;cost?:number;error?:string;requestId?:string};
export async function requestGeneration(path:string,payload:Record<string,unknown>,signal?:AbortSignal):Promise<any>{
  if(!runwareConfigured)throw new Error('O backend Runware ainda não foi ativado.');
  if(!auth?.currentUser)throw new Error('Entre na sua conta para gerar com Runware.');
  const token=await auth.currentUser.getIdToken();
  const response=await fetch(`${import.meta.env.VITE_RUNWARE_API_URL.replace(/\/$/,'')}/${path}`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(payload),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(35000)]):AbortSignal.timeout(35000)});
  const body=await response.json();
  if(!response.ok){const error=new Error(body.error||'Não foi possível acessar a Runware.');Object.assign(error,{notSubmitted:[400,401,403,404,413,429,503].includes(response.status)});throw error;}
  if(path==='generate'||(path==='status'&&body.state!=='processing'))window.dispatchEvent(new Event('cosmos:generation-finished'));
  return body;
}
export async function waitGeneration(requestId:string,signal:AbortSignal,onProgress:()=>void){
  for(let attempt=0;attempt<100;attempt++){
    await new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Consulta interrompida','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},Math.min(5000+attempt*1000,15000));if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});});
    const result=await requestGeneration('status',{requestId},signal);
    if(result.state!=='processing')return result;onProgress();
  }
  throw new Error('A geração ainda está em processamento. Use “Consultar pendência” para recuperar sem gerar novamente.');
}

export const accountRequest=(path:string,payload:Record<string,unknown>={})=>requestGeneration(path,payload);
