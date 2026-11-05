'use strict';
const SHELL='ep-student-shell-v1',FILES=['./','./app.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==location.origin||!u.pathname.startsWith('/student/'))return;event.respondWith(fetch(event.request).catch(async()=>await caches.match(event.request,{ignoreSearch:true})||(event.request.mode==='navigate'?await caches.match(new URL('./',self.registration.scope)):new Response('Arquivo não disponível offline.',{status:503}))));});
