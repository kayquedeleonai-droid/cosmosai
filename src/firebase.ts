import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDocs, collection, serverTimestamp, runTransaction } from 'firebase/firestore';
const config = { apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID };
export const configured = Object.values(config).every(Boolean);
const app = configured ? initializeApp(config) : null;
export const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
export const login = () => { if (!auth) throw new Error('Configure o Firebase primeiro.'); return signInWithPopup(auth, new GoogleAuthProvider()); };
export const logout = () => auth && signOut(auth);
export function emailLogin(email: string, password: string, create = false) {
  if (!auth) throw new Error('O login ainda não foi configurado.');
  return create ? createUserWithEmailAndPassword(auth,email,password) : signInWithEmailAndPassword(auth,email,password);
}
export function resetPassword(email: string) {
  if (!auth) throw new Error('O login ainda não foi configurado.');
  return sendPasswordResetEmail(auth,email);
}
export function authMessage(error: unknown) {
  const code = (error as {code?: string}).code;
  const messages: Record<string,string> = {
    'auth/invalid-credential':'E-mail ou senha incorretos.',
    'auth/email-already-in-use':'Este e-mail já tem uma conta. Entre ou recupere sua senha.',
    'auth/invalid-email':'Informe um e-mail válido.',
    'auth/weak-password':'Use uma senha com pelo menos 6 caracteres.',
    'auth/popup-closed-by-user':'O login foi cancelado. Você pode tentar novamente.',
    'auth/popup-blocked':'Seu navegador bloqueou a janela de login. Permita pop-ups e tente novamente.',
    'auth/too-many-requests':'Muitas tentativas. Aguarde um pouco e tente novamente.',
    'auth/network-request-failed':'Não foi possível conectar. Verifique sua conexão.',
    'auth/operation-not-allowed':'Esta forma de login ainda não está disponível.',
  };
  return messages[code || ''] || 'Não foi possível entrar agora. Tente novamente.';
}
const cloudVersions=new Map<string,string>();
const saveQueues=new Map<string,Promise<void>>();
export async function saveCloud(id:string,name:string,graph:string){
 if(!db||!auth?.currentUser)throw new Error('Entre para salvar na nuvem.');
 if(new TextEncoder().encode(graph).length>650000)throw new Error('Projeto grande para a nuvem. Exporte um backup local.');
 const uid=auth.currentUser.uid,key=uid+'/'+id,ref=doc(db,'users',uid,'projects',id);
 const prior=saveQueues.get(key)||Promise.resolve();
 const pending=prior.catch(()=>{}).then(async()=>{
  if(auth?.currentUser?.uid!==uid)throw new Error('A conta mudou; salvamento interrompido.');
  await runTransaction(db!,async tx=>{
   const current=await tx.get(ref),old=current.data();
   if(old?.graph===graph)return;
   if(old&&old.graph!==cloudVersions.get(key))throw new Error('Conflito: outra aba ou dispositivo alterou este workflow. Exporte sua versão antes de atualizar a nuvem.');
   if(old)tx.set(doc(db!,'users',uid,'projects',id,'versions',String(Math.floor(Date.now()/300000)%10)),{name:old.name,graph:old.graph,updatedAt:serverTimestamp()});
   tx.set(ref,{name,graph,updatedAt:serverTimestamp()});
  });
  cloudVersions.set(key,graph);
 });
 saveQueues.set(key,pending);try{await pending;}finally{if(saveQueues.get(key)===pending)saveQueues.delete(key);}
}
export async function listCloudVersions(id:string){
 if(!db||!auth?.currentUser)throw new Error('Entre para consultar versões.');
 return (await getDocs(collection(db,'users',auth.currentUser.uid,'projects',id,'versions'))).docs.map(d=>({id:d.id,...d.data()})) as {id:string;graph:string;name:string}[];
}
export async function listCloud() {
  if (!db || !auth?.currentUser) throw new Error('Entre com Google para abrir seus projetos.');
  return (await getDocs(collection(db, 'users', auth.currentUser.uid, 'projects'))).docs.map(d => {
    const data = d.data();
    if (typeof data.graph !== 'string') throw new Error('Um workflow na nuvem está em formato inválido.');
    cloudVersions.set(auth!.currentUser!.uid+'/'+d.id,data.graph);
    return { id: d.id, graph: data.graph };
  });
}

export async function saveCollection(name:string){
 if(!db||!auth?.currentUser)throw new Error('Entre para salvar o projeto na nuvem.');
 const uid=auth.currentUser.uid;
 name=name.trim();if(!name||name.length>60)throw new Error('Nome de projeto inválido.');
 const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(name))),b=>b.toString(16).padStart(2,'0')).join('');
 if(auth.currentUser?.uid!==uid)throw new Error('A conta mudou; salvamento interrompido.');
 await setDoc(doc(db,'users',uid,'collections',id),{name,updatedAt:serverTimestamp()});
}
export async function listCollections(){
 if(!db||!auth?.currentUser)return [];
 return (await getDocs(collection(db,'users',auth.currentUser.uid,'collections'))).docs.map(d=>d.data().name).filter((name):name is string=>typeof name==='string'&&name.length>0&&name.length<=60);
}
