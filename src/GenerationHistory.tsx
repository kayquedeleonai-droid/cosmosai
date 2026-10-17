import {useEffect,useState} from 'react';
import {accountRequest} from './runware';
import {dollars} from './pricing.mjs';
export default function GenerationHistory(){
 const [rows,setRows]=useState<any[]>([]),[offset,setOffset]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setBusy(true);setError('');try{setRows((await accountRequest('history',{offset})).jobs);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{void load();},[offset]);
 async function recover(id:string){setBusy(true);try{await accountRequest('status',{requestId:id});await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="management"><header><h1>Histórico de gerações</h1><p>Pedidos, parâmetros e custos da sua conta.</p><button className="outline-button" disabled={busy} onClick={()=>void load()}>Atualizar</button></header>
 <p className="notice">As mídias ficam em links dos provedores. Baixe os arquivos que deseja conservar. Consultar uma tarefa pendente não cria outra geração.</p>
 {error&&<p role="alert">{error}</p>}{!rows.length&&!busy&&<p>Nenhuma geração encontrada.</p>}
 <div className="history-list">{rows.map(j=><article key={j.id} className="history-card"><div>{j.result?.url&&(j.result.mediaType==='video'?<video src={j.result.url} controls preload="metadata"/>:<img src={j.result.url} alt={'Resultado de '+(j.model||'geração anterior')}/>)}<strong>{j.model||'Geração anterior'}</strong><small>{new Date(j.created).toLocaleString('pt-BR')} · {j.state==='success'?'Concluída':j.state==='error'?'Falhou':'Pendente'}</small></div><div><p>{j.metadata?.prompt||'Prompt não registrado nesta versão.'}</p><small>{[j.metadata?.resolution,j.metadata?.ratio,j.metadata?.duration&&j.metadata.duration+' s',j.metadata?.quality].filter(Boolean).join(' · ')}</small><p>{j.metadata?.provider==='magnific'?'Créditos Magnific · consulte o consumo na sua conta':j.actual!=null?'Custo real: '+dollars(j.actual):'Reserva: '+dollars(j.reserved)+' · custo ainda não informado'}</p>{j.result?.error&&<p role="alert">{j.result.error}</p>}{j.result?.url&&<a className="outline-button" href={j.result.url} target="_blank" rel="noreferrer">Abrir / baixar arquivo</a>}{j.state==='processing'&&<button className="outline-button" disabled={busy} onClick={()=>void recover(j.id)}>Consultar pendência</button>}</div></article>)}</div>
 <div className="pagination"><button className="outline-button" disabled={!offset||busy} onClick={()=>setOffset(Math.max(0,offset-30))}>Anterior</button><span>Página {offset/30+1}</span><button className="outline-button" disabled={rows.length<30||busy} onClick={()=>setOffset(offset+30)}>Próxima</button></div></section>;
}
