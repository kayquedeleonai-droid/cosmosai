const CACHE='cosmos-shell-__VERSION__';
const ASSETS=__ASSETS__;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
// Activation is requested by the user; never interrupt an editing session.
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());if(event.data?.type==='LOCAL_MEDIA_READY')event.ports[0]?.postMessage(true);});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(/^\/__cosmos_media\/[0-9a-f-]{36}$/.test(url.pathname)){
  event.respondWith(caches.open('cosmos-local-media-v1').then(async cache=>(await cache.match(url.pathname))||new Response('Mídia local indisponível neste dispositivo',{status:404})));return;
 }
 // Only cache public app assets. Auth, APIs, workflows and generated media stay out.
 if(request.mode==='navigate'){
  if(url.pathname.startsWith('/__/'))return;
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match('/index.html'))||fetch(request)));return;
 }
 if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(request)));
});
