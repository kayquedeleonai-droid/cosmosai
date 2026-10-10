import {useEffect,useState} from 'react';
import {accountRequest} from './runware';
import {dollars} from './pricing.mjs';
type Account={uid:string;email:string;name:string;status:string;daily_usd:number;today_usd:number;generations:number};
export default function AdminPanel(){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[offset,setOffset]=useState(0);
 async function load(){setError('');try{setData(await accountRequest('admin/users',{offset}));}catch(e){setError((e as Error).message);}}
 useEffect(()=>{void load();},[offset]);
 async function save(path:string,payload:Record<string,unknown>){setBusy(true);setError('');try{await accountRequest(path,payload);await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="management"><header><h1>Administração</h1><p>Contas, acesso às gerações e orçamento da plataforma.</p><button className="outline-button" onClick={()=>void load()} disabled={busy}>Atualizar</button></header>
 {error&&<p role="alert" className="notice">{error}</p>}{!data?<p>Carregando contas…</p>:<>
 <div className="metric-grid"><div><small>Contas cadastradas</small><strong>{data.total}</strong></div><div><small>Custo confirmado hoje</small><strong>{dollars(data.usage.actual_usd)}</strong></div><div><small>Confirmado + reservas</small><strong>{dollars(data.usage.committed_usd)}</strong></div></div>
 <form className="budget-form" key={JSON.stringify(data.settings)} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void save('admin/settings',{daily_usd:Number(f.get('budget')),paused:f.get('paused')==='on'});}}>
 <label>Orçamento global diário (US$)<input name="budget" type="number" min="0" max="10000" step=".01" required defaultValue={data.settings.daily_usd}/></label>
 <label><input name="paused" type="checkbox" defaultChecked={!!data.settings.paused}/>Pausar novas gerações para todos</label><button className="primary" disabled={busy}>Salvar controle global</button></form>
 <p className="notice">Dia de cobrança: 00h–24h UTC. Reservamos uma margem antes de enviar cada pedido e conciliamos o custo real depois. A cobrança final por tokens pode superar a estimativa. Os limites de quantidade também continuam ativos. Bloquear impede novas gerações; a pessoa ainda pode acessar e exportar seus workflows.</p>
 <div className="accounts-list">{data.users.map((u:Account)=><AccountRow key={u.uid+u.status+u.daily_usd} user={u} busy={busy} save={save}/>)}</div>
 <div className="pagination"><button className="outline-button" disabled={!offset||busy} onClick={()=>setOffset(Math.max(0,offset-50))}>Anterior</button><span>{offset+1}–{Math.min(offset+50,data.total)} de {data.total}</span><button className="outline-button" disabled={offset+50>=data.total||busy} onClick={()=>setOffset(offset+50)}>Próxima</button></div>
 </>}
 </section>;
}
function AccountRow({user:u,busy,save}:{user:Account;busy:boolean;save:(path:string,payload:Record<string,unknown>)=>Promise<void>}){
 return <form className="account-row" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void save('admin/account',{uid:u.uid,status:f.get('status'),daily_usd:Number(f.get('budget'))});}}>
 <div><strong>{u.name||'Sem nome'}</strong><small>{u.email||u.uid}</small><small>{u.generations} gerações · hoje {dollars(u.today_usd)}</small></div>
 <label>Acesso às gerações<select name="status" defaultValue={u.status}><option value="pending">Aguardando aprovação</option><option value="active">Aprovado</option><option value="blocked">Bloqueado</option></select></label>
 <label>Limite diário (US$)<input name="budget" type="number" min="0" max="1000" step=".01" required defaultValue={u.daily_usd}/></label>
 <button className="outline-button" disabled={busy}>Salvar conta</button></form>;
}
