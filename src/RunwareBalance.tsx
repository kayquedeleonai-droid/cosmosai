import {useEffect,useRef,useState} from 'react';
import {RefreshCw,Wallet} from 'lucide-react';
import {accountRequest} from './runware';
type Balance={amount:number;currency:string;freeBalance?:number;updatedAt:number};
const usd=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD'}).format(value);
export default function RunwareBalance(){
  const [balance,setBalance]=useState<Balance|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(false);
  const active=useRef(true),pending=useRef(false);
  async function refresh(){if(pending.current)return;pending.current=true;setLoading(true);try{const result=await accountRequest('admin/balance');if(active.current){setBalance(result);setError(false);}}catch{if(active.current)setError(true);}finally{pending.current=false;if(active.current)setLoading(false);}}
  useEffect(()=>{active.current=true;void refresh();const update=()=>{if(document.visibilityState==='visible')void refresh();};const timer=setInterval(update,60000);document.addEventListener('visibilitychange',update);window.addEventListener('cosmos:generation-finished',update);return()=>{active.current=false;clearInterval(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('cosmos:generation-finished',update);};},[]);
  const detail=balance?`Consultado às ${new Date(balance.updatedAt).toLocaleTimeString('pt-BR')}.${balance.freeBalance?` Créditos gratuitos informados: ${usd(balance.freeBalance)}.`:''}`:'';
  return <button className={`runware-balance ${error?'stale':''}`} onClick={()=>void refresh()} disabled={loading} aria-label="Atualizar saldo Runware" title={`${error?'Não foi possível atualizar. O valor exibido é da última consulta. ':''}${detail} Clique para atualizar.`}><Wallet size={15}/><span><small>Saldo Runware</small><strong>{balance?usd(balance.amount):loading?'Consultando…':'Indisponível'}{error&&balance?' *':''}</strong></span><RefreshCw size={12} className={loading?'spin':''}/></button>;
}

