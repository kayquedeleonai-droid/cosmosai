import { useState, type FormEvent } from 'react';
import { Mail, LockKeyhole, LoaderCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { login, emailLogin, resetPassword, authMessage, configured } from './firebase';

export function Wordmark({className = ''}: {className?:string}) {
  return <span className={`wordmark ${className}`} aria-label="Cosmos">COSMOS</span>;
}
function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.6a4.8 4.8 0 0 1-2.1 3.2v2.6H19c2-1.9 3-4.5 3-7.7"/><path fill="#34A853" d="M12 22c2.8 0 5.1-.9 6.8-2.5l-3.3-2.6c-.9.6-2.1.9-3.5.9-2.7 0-5-1.8-5.8-4.3H2.8v2.7A10 10 0 0 0 12 22"/><path fill="#FBBC05" d="M6.2 13.5a6 6 0 0 1 0-3.8V7H2.8a10 10 0 0 0 0 9.2z"/><path fill="#EA4335" d="M12 5.8c1.5 0 2.8.5 3.9 1.5l2.9-2.8A10 10 0 0 0 2.8 7l3.4 2.7A6 6 0 0 1 12 5.8"/></svg>;
}
export default function AuthScreen({onDemo}: {onDemo:()=>void}) {
  const [mode,setMode] = useState<'login'|'create'|'reset'>('login');
  const [email,setEmail] = useState(''); const [password,setPassword] = useState('');
  const [busy,setBusy] = useState(false); const [message,setMessage] = useState('');
  const [showPassword,setShowPassword] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if(mode==='reset') { await resetPassword(email); setMessage('Se houver uma conta com esse e-mail, você receberá instruções de recuperação.'); }
      else await emailLogin(email,password,mode==='create');
    } catch(error) {setMessage(authMessage(error));} finally {setBusy(false);}
  }
  return <main className="auth-screen">
    <div className="universe" aria-hidden="true"/>
    <section className="auth-content">
      <Wordmark className="auth-logo"/>
      <div className="studio-credit"><span>BY</span><div>THE --<br/><b>Future</b><small>/ Studios</small></div></div>
      <form className="auth-card" onSubmit={submit}>
        {mode!=='login' && <h1>{mode==='create'?'Crie sua conta':'Recupere sua senha'}</h1>}
        {mode!=='reset' && <><button className="social-button" type="button" disabled={busy || !configured} onClick={async()=>{setBusy(true);setMessage('');try{await login();}catch(e){setMessage(authMessage(e));}finally{setBusy(false);}}}><GoogleIcon/>Continuar com Google</button>
          <button className="social-button apple" type="button" disabled title="Login Apple ainda não configurado"><svg width="17" height="20" viewBox="0 0 24 28" aria-hidden="true"><path fill="currentColor" d="M17 0c.2 2-1 4.1-2.2 5.3-1.3 1.3-3.2 2.2-4.9 2 .1-1.8 1.1-3.8 2.4-5.1C13.7.8 15.6.1 17 0ZM22 20c-.6 1.5-.9 2.1-1.7 3.4-1.2 1.9-2.9 4.2-5 4.2-1.9.1-2.4-1.2-5-1.2-2.5 0-3.1 1.2-5 1.2-2.1-.1-3.6-2.1-4.8-4C-3 18.3-2 10.3 3 7.9c2.3-1.1 4.1-.4 6.7.3 1 .3 2 .3 3 0 2.4-.8 4.7-1.4 7.1.1.8.5 1.5 1.2 2 2.1-6.3 3.1-5.3 8.7.2 9.6Z"/></svg>Continuar com Apple <span>Em breve</span></button><div className="auth-divider"><span>OU</span></div></>}
        <label className="auth-label" htmlFor="email">E-mail</label><div className="auth-input"><Mail size={17}/><input id="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
        {mode!=='reset' && <><div className="password-label"><label className="auth-label" htmlFor="password">Senha</label>{mode==='login' && <button type="button" className="text-link" onClick={()=>{setMode('reset');setMessage('');}}>Esqueceu a senha?</button>}</div><div className="auth-input"><LockKeyhole size={17}/><input id="password" type={showPassword?'text':'password'} autoComplete={mode==='create'?'new-password':'current-password'} minLength={mode==='create'?6:undefined} placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required/><button type="button" aria-label={showPassword?'Ocultar senha':'Mostrar senha'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></>}
        {message && <p className="auth-message" role="status">{message}</p>}
        <button className="primary auth-submit" disabled={busy || !configured}>{busy?<LoaderCircle className="spin" size={17}/>:mode==='login'?'Entrar':mode==='create'?'Criar conta':'Enviar link de recuperação'}</button>
      </form>
      <p className="auth-switch">{mode==='login'?'Não tem uma conta? ':''}<button onClick={()=>{setMode(mode==='login'?'create':'login');setMessage('');}}>{mode==='login'?'Criar uma':'Voltar para entrar'}</button></p>
      <button className="demo-link" onClick={onDemo}>Explorar a demonstração <ArrowRight size={14}/></button>
    </section>
    <span className="auth-bottom">UM UNIVERSO DE POSSIBILIDADES CRIATIVAS.</span>
  </main>;
}
