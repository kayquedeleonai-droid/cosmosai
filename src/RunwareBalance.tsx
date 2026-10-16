import {useEffect,useRef,useState} from 'react';
import {RefreshCw,Wallet} from 'lucide-react';
import {accountRequest} from './runware';
type Balance={amount:number;currency:string;freeBalance?:number;updatedAt:number};
const usd=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD'}).format(value);
export default function RunwareBalance(){
  const [balance,setBalance]=useState<Balance|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const active=useRef(true),pending=useRef(false),failures=useRef(0),nextRefresh=useRef(0);
  async function refresh(){if(pending.current)return;pending.current=true;setLoading(true);try{const result=await accountRequest('admin/balance');failures.current=0;if(active.current){setBalance(result);setError('');}}catch(cause){failures.current++;if(active.current)setError(cause instanceof Error?cause.message:'Não foi possível atualizar o saldo.');}finally{nextRefresh.current=Date.now()+Math.min(60000,5000*2**Math.min(failures.current,4));pending.current=false;if(active.current)setLoading(false);}}
  useEffect(()=>{active.current=true;void refresh();const update=()=>{if(document.visibilityState==='visible')void refresh();};const timer=setInterval(()=>{if(Date.now()>=nextRefresh.current)update();},1000);document.addEventListener('visibilitychange',update);window.addEventListener('cosmos:generation-finished',update);return()=>{active.current=false;clearInterval(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('cosmos:generation-finished',update);};},[]);
  const detail=balance?`Consultado às ${new Date(balance.updatedAt).toLocaleTimeString('pt-BR')}.${balance.freeBalance?` Créditos gratuitos informados: ${usd(balance.freeBalance)}.`:''}`:'';
  return <button className={`runware-balance ${error?'stale':''}`} onClick={()=>void refresh()} disabled={loading} aria-label="Atualizar saldo Runware" title={`${error?`${error} ${balance?'O valor exibido é da última consulta. ':''}`:''}${detail} Clique para atualizar.`}><Wallet size={15}/><span><small>Saldo Runware</small><strong>{balance?usd(balance.amount):loading?'Consultando…':'Indisponível'}{error&&balance?' *':''}</strong></span><RefreshCw size={12} className={loading&&!balance?'spin':''}/></button>;
}

