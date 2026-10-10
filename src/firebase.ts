import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
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
export async function saveCloud(id: string, name: string, graph: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre com Google para salvar na nuvem.');
  if (new TextEncoder().encode(graph).length > 650000) throw new Error('Projeto grande para a nuvem. Exporte um backup local.');
  await setDoc(doc(db, 'users', auth.currentUser.uid, 'projects', id), { name, graph, updatedAt: serverTimestamp() });
}
export async function listCloud() {
  if (!db || !auth?.currentUser) throw new Error('Entre com Google para abrir seus projetos.');
  return (await getDocs(collection(db, 'users', auth.currentUser.uid, 'projects'))).docs.map(d => {
    const data = d.data();
    if (typeof data.graph !== 'string') throw new Error('Um workflow na nuvem está em formato inválido.');
    return { id: d.id, graph: data.graph };
  });
}
