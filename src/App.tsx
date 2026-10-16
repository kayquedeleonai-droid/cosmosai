import RunwareBalance from './RunwareBalance';
import DownloadMediaButton from './DownloadMediaButton';
import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { Workflow, Images, FolderOpen, MessageSquare, Settings2, Plus, Clock3, MoreHorizontal, Download, Copy, ArrowUpRight, LogOut, Cloud, RefreshCw, X, LoaderCircle, Search, Upload, Check } from 'lucide-react';
import { auth, configured, listCloud, logout, saveCloud } from './firebase';
import AuthScreen, { Wordmark } from './AuthScreen';
import Editor from './Editor';
import {runwareConfigured} from './runware';
import { cleanProject, exportProject, newProject, readProjects, relativeDate, storageKey } from './projects';
import AdminPanel from './AdminPanel';
import GenerationHistory from './GenerationHistory';
import {accountRequest} from './runware';
import type { Project } from './types';

type Page = 'workflows'|'gallery'|'albums'|'admin'|'history';
export default function App() {
  const [user,setUser] = useState<User|null>(null);
  const [ready,setReady] = useState(!auth);
  const [demo,setDemo] = useState(false);
  useEffect(()=>{if(auth)return onAuthStateChanged(auth,u=>{setUser(u);setReady(true);});},[]);
  if(!ready) return <div className="app-loading"><Wordmark/><LoaderCircle className="spin" size={20}/></div>;
  if(!user && !demo) return <AuthScreen onDemo={()=>setDemo(true)}/>;
  return <Workspace key={user?.uid || 'guest'} user={user} onExit={async()=>{await logout();setDemo(false);}}/>;
}

function Workspace({user,onExit}: {user:User|null;onExit:()=>Promise<void>}) {
  const scope = user?.uid || 'guest';
  const [account,setAccount]=useState<any>(null);
  useEffect(()=>{if(!user||!runwareConfigured)return;accountRequest('me').then(setAccount).catch(()=>{});},[user]);
  const [initial] = useState(()=>{try{return {projects:readProjects(scope),error:''};}catch(e){return {projects:[] as Project[],error:(e as Error).message};}});
  const [projects,setProjects] = useState(initial.projects);
  const projectsRef = useRef(projects);
  const [navigation] = useState(()=>{try{const value=JSON.parse(localStorage.getItem(`cosmos:navigation:${scope}`)||'{}');return value&&typeof value==='object'?value:{};}catch{return {};}});
  const [page,setPage] = useState<Page>(['workflows','gallery','albums','admin','history'].includes(navigation.page)?navigation.page:'workflows');
  const [active,setActive] = useState<string|null>(typeof navigation.active==='string'?navigation.active:null);
  const [filter,setFilter] = useState(typeof navigation.filter==='string'?navigation.filter:'Todos');
  const [search,setSearch] = useState(typeof navigation.search==='string'?navigation.search:'');
  const [modal,setModal] = useState<'settings'|'folder'|'feedback'|null>(['settings','feedback'].includes(navigation.modal)?navigation.modal:null);
  useEffect(()=>{try{localStorage.setItem(`cosmos:navigation:${scope}`,JSON.stringify({page,active,filter,search,modal:modal==='folder'?null:modal}));}catch{/* Navigation persistence must not block editing. */}},[scope,page,active,filter,search,modal]);
  const [folderName,setFolderName] = useState('');
  const [toast,setToast] = useState(initial.error);
  const [busy,setBusy] = useState(false);
  const [cloudReady,setCloudReady]=useState(!user);
  const [folders,setFolders] = useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem(`cosmos:folders:${scope}`)||'[]').filter((s:unknown)=>typeof s==='string');}catch{return [];}});
  const [feedback,setFeedback] = useState(()=>localStorage.getItem(`cosmos:feedback:${scope}`)||'');
  const importRef = useRef<HTMLInputElement>(null);
  const message = useCallback((value:string)=>setToast(value),[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),6500);return()=>clearTimeout(timer);},[toast]);
  const persist = useCallback((next:Project[])=>{
    localStorage.setItem(storageKey(scope),JSON.stringify(next));
    projectsRef.current=next;setProjects(next);
  },[scope]);
  const upsert = useCallback((p:Project)=>{
    const next=projectsRef.current.some(item=>item.id===p.id)?projectsRef.current.map(item=>item.id===p.id?p:item):[p,...projectsRef.current];
    try{persist(next);return true;}catch{message('O armazenamento local está cheio. Exporte um backup do workflow antes de sair.');return false;}
  },[persist,message]);
  useEffect(()=>{
    if(!user)return;
    let cancelled=false;setBusy(true);
    listCloud().then(rows=>{
      if(cancelled)return;
      const merged=new Map(projectsRef.current.map(p=>[p.id,p]));
      for(const row of rows){const p=cleanProject(JSON.parse((row as {graph:string}).graph));p.id=row.id;const previous=merged.get(p.id);if(!previous || p.updatedAt>previous.updatedAt)merged.set(p.id,p);}
      persist([...merged.values()]);
    }).catch(()=>{if(!cancelled)message('Não foi possível sincronizar a nuvem. Seus workflows locais continuam disponíveis.');}).finally(()=>{if(!cancelled){setBusy(false);setCloudReady(true);}});
    return()=>{cancelled=true;};
  },[user,persist,message]);
  async function sync(){if(!user){setModal('settings');return;}setBusy(true);try{
    const rows=await listCloud();const merged=new Map(projectsRef.current.map(p=>[p.id,p]));
    for(const row of rows){const p=cleanProject(JSON.parse((row as {graph:string}).graph));p.id=row.id;const old=merged.get(p.id);if(!old || p.updatedAt>old.updatedAt)merged.set(p.id,p);}
    persist([...merged.values()]);message('Workflows da nuvem atualizados.');
  }catch{message('Não foi possível sincronizar. Tente novamente.');}finally{setBusy(false);}}
  const cloudSave=useCallback(async(p:Project)=>{if(!user){message('Entre na sua conta para salvar na nuvem. A demo salva neste dispositivo.');return;}await saveCloud(p.id,p.name,JSON.stringify(cleanProject(p)));},[user,message]);
  function create(example=false){const p=newProject(example);p.folder=filter==='Todos'?'':filter;if(upsert(p))setActive(p.id);}
  function addFolder(){const name=folderName.trim();if(!name)return;if(name==='Todos'||allFolders.includes(name)){message('Já existe uma pasta com esse nome.');return;}const next=[...folders,name];try{localStorage.setItem(`cosmos:folders:${scope}`,JSON.stringify(next));setFolders(next);setFilter(name);setPage('workflows');setModal(null);setFolderName('');}catch{message('Não foi possível salvar a pasta neste dispositivo.');}}
  const allFolders=[...new Set([...folders,...projects.map(p=>p.folder||'').filter(Boolean)])];
  const current=projects.find(p=>p.id===active);
  const filtered=projects.filter(p=>(filter==='Todos'||p.folder===filter)&&p.name.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>b.updatedAt-a.updatedAt);
  const media=projects.flatMap(p=>p.nodes.filter(n=>n.data.result||n.data.image).map(n=>({id:`${p.id}-${n.id}`,src:n.data.result||n.data.image!,project:p,mediaType:n.data.mediaType||'image'})));

  return <div className="app-shell">
    {current&&!cloudReady?<div className="app-loading"><Wordmark/><span>Sincronizando seu workflow…</span></div>:current ? <Editor isAdmin={!!account?.isAdmin} key={current.id} storageScope={scope} initial={current} folders={allFolders} onBack={()=>setActive(null)} onSave={upsert} onCloudSave={cloudSave} message={message} signedIn={!!user}/> : <>
      <aside className="sidebar">
        <button className="sidebar-brand" onClick={()=>{setPage('workflows');setFilter('Todos');}} aria-label="Cosmos — início"><Wordmark/></button>
        <nav aria-label="Navegação principal">
          <button className={page==='workflows'?'active':''} onClick={()=>setPage('workflows')}><Workflow size={20}/>Workflows</button>
          <button className={page==='gallery'?'active':''} onClick={()=>setPage('gallery')}><Images size={20}/>Galeria</button>
          <button className={page==='albums'?'active':''} onClick={()=>setPage('albums')}><FolderOpen size={20}/>Álbuns</button>
          {user&&<button className={page==='history'?'active':''} onClick={()=>setPage('history')}><Clock3 size={20}/>Histórico</button>}
          {account?.isAdmin&&<button className={page==='admin'?'active':''} onClick={()=>setPage('admin')}><Settings2 size={20}/>Administração</button>}
          <button onClick={()=>setModal('feedback')}><MessageSquare size={20}/>Feedback</button>
          <button onClick={()=>setModal('settings')}><Settings2 size={20}/>Configurações</button>
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-tip"><span className="tiny-dot"/> {user?'Workspace pessoal':'Modo demonstração'}<small>{user?'Seu universo criativo.':'Explore sem consumir APIs.'}</small></div><div className="profile"><span className="planet-avatar" aria-hidden="true"/><div><strong>{user?.displayName || user?.email?.split('@')[0] || 'Explorador'}</strong><small>{account?.isAdmin?'Administrador':user?'Conta pessoal':'Visitante'}</small></div><button aria-label={user?'Sair da conta':'Voltar ao login'} title={user?'Sair da conta':'Voltar ao login'} onClick={()=>void onExit().catch(()=>message('Não foi possível sair. Tente novamente.'))}><LogOut size={16}/></button></div></div>
      </aside>
      <main className="dashboard">
        {account?.isAdmin&&<div className="dashboard-balance"><RunwareBalance/></div>}
        {account&&!account.isAdmin&&account.account.status!=='active'&&<p className="notice" role="status">{account.account.status==='blocked'?'Suas gerações estão bloqueadas.':'Sua conta aguarda aprovação para gerar.'} Você pode organizar seus workflows.</p>}
        {page==='admin'&&(account?.isAdmin?<AdminPanel/>:<p>Acesso exclusivo do administrador.</p>)}
        {page==='history'&&user&&<GenerationHistory/>}
        {['workflows','gallery','albums'].includes(page)&&<header className="dashboard-header"><div><h1>{page==='workflows'?'Workflows':page==='gallery'?'Galeria':'Álbuns'}</h1><p>{page==='workflows'?'Crie e organize seus fluxos de geração de imagens.':page==='gallery'?'Suas referências e resultados, em um só lugar.':'Organize seus universos criativos por projeto.'}</p></div><button className="primary" onClick={()=>page==='albums'?setModal('folder'):create()}><Plus size={18}/>{page==='albums'?'Novo álbum':'Novo Workflow'}</button></header>}
        {page==='workflows' && <>
          <div className="workflows-toolbar"><div className="folder-tabs"><button className={filter==='Todos'?'active':''} onClick={()=>setFilter('Todos')}>Todos</button>{allFolders.map(folder=><button key={folder} className={filter===folder?'active':''} onClick={()=>setFilter(folder)}>{folder}</button>)}<button onClick={()=>setModal('folder')}><Plus size={12}/> Pasta</button></div><div className="workflow-actions"><div className="search-compact"><Search size={15}/><input aria-label="Buscar workflows" placeholder="Buscar" value={search} onChange={e=>setSearch(e.target.value)}/></div><button className="icon-button" aria-label="Importar workflow" title="Importar workflow" onClick={()=>importRef.current?.click()}><Upload size={17}/></button><button className="icon-button" aria-label="Atualizar nuvem" title="Atualizar nuvem" disabled={busy} onClick={()=>void sync()}><RefreshCw className={busy?'spin':''} size={17}/></button></div></div>
          <div className="workflow-grid">{filtered.map(p=>{
            const cover=p.nodes.find(n=>n.data.result || n.data.image);const image=cover?.data.result||cover?.data.image;
            return <article className="workflow-card" key={p.id}><button className="workflow-open" onClick={()=>setActive(p.id)} aria-label={`Abrir ${p.name || 'Untitled'}`}>{image?<img src={image} alt=""/>:<Workflow className="workflow-placeholder" size={34}/>}<div className="workflow-card-caption"><strong>{p.name || 'Untitled'}</strong><small><Clock3 size={11}/>{relativeDate(p.updatedAt)}</small></div></button><details className="card-options"><summary aria-label={`Opções de ${p.name}`}><MoreHorizontal size={17}/></summary><div><button onClick={()=>{upsert({...p,id:crypto.randomUUID(),name:`${p.name} — cópia`.slice(0,120),updatedAt:Date.now()});message('Workflow duplicado.');}}><Copy size={13}/>Duplicar</button><button onClick={()=>exportProject(p)}><Download size={13}/>Exportar JSON</button></div></details></article>;
          })}</div>
          {!filtered.length && <div className="empty-state"><Workflow size={38}/><h2>{search?'Nenhum workflow encontrado':'Seu próximo universo começa aqui'}</h2><p>{search?'Tente buscar por outro nome.':'Adicione nodes, conecte ideias e explore seu primeiro fluxo.'}</p><button className="outline-button" onClick={()=>create(true)}>Abrir um exemplo <ArrowUpRight size={15}/></button></div>}
          <div className="dashboard-note"><span className="tiny-dot"/> {busy?'Sincronizando seus workflows…':`${projects.length} workflow${projects.length===1?'':'s'} neste workspace`}<span>{runwareConfigured?'Modelos via Runware':'Runware · aguardando ativação'}</span></div>
        </>}
        {page==='gallery' && (media.length?<div className="gallery-grid">{media.map(item=><article key={item.id}><button onClick={()=>setActive(item.project.id)}>{item.mediaType==='video'?<video src={item.src} muted preload="metadata"/>:<img src={item.src} alt={`Resultado de ${item.project.name}`}/>}</button><div><span>{item.project.name}</span><DownloadMediaButton src={item.src} video={item.mediaType==='video'} onError={message}/></div>{item.src==='/demo-landscape.svg'&&<small>Ilustração demonstrativa</small>}</article>)}</div>:<div className="empty-state"><Images size={38}/><h2>Espaço para suas criações</h2><p>Imagens enviadas e resultados dos workflows aparecem aqui.</p><button className="outline-button" onClick={()=>setPage('workflows')}>Abrir workflows <ArrowUpRight size={15}/></button></div>)}
        {page==='albums' && (allFolders.length?<div className="album-grid">{allFolders.map(folder=><button className="album-card" key={folder} onClick={()=>{setFilter(folder);setPage('workflows');}}><FolderOpen size={35}/><strong>{folder}</strong><span>{projects.filter(p=>p.folder===folder).length} workflows</span></button>)}</div>:<div className="empty-state"><FolderOpen size={38}/><h2>Um lugar para cada ideia</h2><p>Crie pastas para reunir seus workflows por projeto.</p><button className="outline-button" onClick={()=>setModal('folder')}><Plus size={15}/>Criar primeiro álbum</button></div>)}
      </main>
    </>}
    {modal && <div className="modal-backdrop" onClick={()=>setModal(null)}><section className="modal" role="dialog" aria-modal="true" aria-label={modal==='folder'?'Nova pasta':modal==='feedback'?'Feedback':'Configurações'} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')setModal(null);}}><button className="modal-close icon-button" aria-label="Fechar" onClick={()=>setModal(null)}><X size={19}/></button>
      {modal==='folder' && <form onSubmit={e=>{e.preventDefault();addFolder();}}><FolderOpen className="modal-symbol" size={28}/><h2>Um novo espaço</h2><p>Organize seus workflows em uma pasta.</p><label htmlFor="folderName">Nome da pasta</label><input autoFocus id="folderName" className="form-input" placeholder="Ex.: Campanha de lançamento" value={folderName} maxLength={60} onChange={e=>setFolderName(e.target.value)} required/><button className="primary full-width">Criar pasta</button></form>}
      {modal==='feedback' && <><MessageSquare className="modal-symbol" size={28}/><h2>Ideias para o Cosmos</h2><p>Guarde sugestões para a próxima versão. Esta nota fica apenas neste dispositivo.</p><textarea aria-label="Sugestão" className="form-input feedback-input" value={feedback} maxLength={5000} placeholder="O que tornaria seu processo criativo melhor?" onChange={e=>setFeedback(e.target.value)}/><button className="primary full-width" onClick={()=>{try{localStorage.setItem(`cosmos:feedback:${scope}`,feedback);message('Nota salva neste dispositivo.');setModal(null);}catch{message('Não foi possível salvar a nota.');}}}><Check size={15}/>Salvar nota</button></>}
      {modal==='settings' && <><Settings2 className="modal-symbol" size={28}/><h2>Seu workspace</h2><p>Ferramentas e conexões do Cosmos.</p><div className="settings-row"><Cloud size={20}/><div><strong>Firebase</strong><small>{configured?'Projeto conectado':'Não configurado'} · {user?'Conta autenticada':'Visitante'}</small></div><span className="connection-dot"/></div><div className="settings-row"><Workflow size={20}/><div><strong>Geração por IA</strong><small>{runwareConfigured?'Runware conectada · créditos por geração':'Runware · backend aguardando ativação'}</small></div></div><p className="notice">Nano Banana Pro, GPT Image 2.5, Seedream Pro, Seedance 2.5 e VEO. A geração requer login e consome créditos Runware. Apple ainda não está disponível.</p><button className="outline-button full-width" onClick={()=>void onExit().catch(()=>message('Não foi possível sair.'))}><LogOut size={15}/>{user?'Sair da conta':'Entrar na minha conta'}</button></>}
    </section></div>}
    <input hidden ref={importRef} type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>5000000)throw new Error('Use um arquivo de até 5 MB.');const p=cleanProject(JSON.parse(await file.text()));p.id=crypto.randomUUID();p.updatedAt=Date.now();if(upsert(p)){setActive(p.id);message('Workflow importado.');}}catch(err){message((err as Error).message);}}}/>
    {toast && <div className="toast" role="status">{toast}<button aria-label="Fechar mensagem" onClick={()=>setToast('')}><X size={15}/></button></div>}
  </div>;
}

