let keysCache;
export async function verifyUser(token,project,fetcher=fetch) {
  try {
    if(!token||token.length>10000)throw 0;
    const parts=token.split('.');if(parts.length!==3)throw 0;
    const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const payload=JSON.parse(new TextDecoder().decode(decode(parts[1])));
    const now=Math.floor(Date.now()/1000);
    if(header.alg!=='RS256'||!header.kid||payload.aud!==project||payload.iss!==`https://securetoken.google.com/${project}`||!Number.isFinite(payload.exp)||payload.exp<=now||!Number.isFinite(payload.iat)||payload.iat>now+60||!Number.isFinite(payload.auth_time)||payload.auth_time>now+60||typeof payload.sub!=='string'||!payload.sub.length||payload.sub.length>128||payload.email_verified!==true)throw 0;
    if(!keysCache||keysCache.until<Date.now()){
      const res=await fetcher('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
      if(!res.ok)throw 0;keysCache={keys:(await res.json()).keys,until:Date.now()+3600000};
    }
    const jwk=keysCache.keys.find(k=>k.kid===header.kid);if(!jwk)throw 0;
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw 0;
    return payload.sub;
  }catch{throw new Error('Entre com uma conta de e-mail verificado para gerar.');}
}
