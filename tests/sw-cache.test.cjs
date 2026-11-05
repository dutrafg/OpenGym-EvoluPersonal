const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function harness(){
 const events={},buckets=new Map(),scope='https://app.example/',calls=[];let offline=false,skip=0,manifest={assets:['./media/approved-37/md171.webp','./media/approved-37/absent.webp'],bytes:10};let invalidMedia=true,badShell=false;
 const key=value=>typeof value==='string'?value:value.url||value.href;
 const fetcher=async(value,options={})=>{
  const url=key(value);calls.push(url);if(offline)throw new TypeError('offline');
  if(url.endsWith('/offline-assets.json'))return Response.json(manifest);
  if(url.endsWith('/absent.webp')&&invalidMedia)return new Response('<html>Arquivo indisponível</html>',{headers:{'Content-Type':'text/html'}});
  if(url.includes('/media/'))return new Response('image-fixture',{headers:{'Content-Type':'image/webp'}});
  if(url.endsWith('/remote-tools.js')&&badShell)return new Response('<html>Erro</html>',{headers:{'Content-Type':'text/html'}});
  return new Response('shell-fixture',{headers:{'Content-Type':url.endsWith('.js')?'application/javascript':url.endsWith('.html')?'text/html':url.endsWith('.png')?'image/png':url.endsWith('.webmanifest')?'application/manifest+json':'text/plain'}});
 };
 const caches={keys:async()=>[...buckets.keys()],delete:async name=>buckets.delete(name),open:async name=>{
  if(!buckets.has(name))buckets.set(name,new Map());const data=buckets.get(name);
  return {match:async(value,options={})=>{const url=key(value);const found=options.ignoreSearch?[...data.entries()].find(([k])=>k.split('?')[0]===url.split('?')[0])?.[1]:data.get(url);return found?.clone();},put:async(value,response)=>data.set(key(value),response.clone()),addAll:async values=>{const rows=await Promise.all(values.map(async value=>{const response=await fetcher(value);if(!response.ok)throw Error('fetch failed');return[value,response];}));for(const [value,response]of rows)data.set(key(value),response);}};
 }};
 const self={registration:{scope},location:{origin:new URL(scope).origin},clients:{claim:async()=>{}},skipWaiting:async()=>{skip++;},addEventListener:(type,fn)=>events[type]=fn};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),{self,caches,fetch:fetcher,URL,Request,Response,TypeError,Set,Promise});
 const message=async data=>{const rows=[];let pending;events.message({data,ports:[{postMessage:row=>rows.push(row)}],waitUntil:p=>pending=p});if(pending)await pending;return rows;};
 const dispatch=async type=>{let pending;events[type]({waitUntil:p=>pending=p});await pending;};
 const request=async(url,mode='cors',destination='')=>{let pending;events.fetch({request:{url,method:'GET',mode,destination},respondWith:p=>pending=p});return await pending;};
 return {buckets,calls,scope,caches,dispatch,message,request,setOffline:value=>offline=value,setValidMedia:()=>invalidMedia=false,setBadShell:()=>badShell=true,getSkip:()=>skip};
}
test('atualização preserva cache de mídias e não se aplica sem solicitação',async()=>{
 const h=harness();await h.caches.open('evolupersonal-shell-antigo');await h.caches.open('evolupersonal-md500-offline-v3');await h.caches.open('outro-aplicativo');await h.dispatch('install');assert.equal(h.getSkip(),0);await h.dispatch('activate');assert(!h.buckets.has('evolupersonal-shell-antigo'));assert(h.buckets.has('evolupersonal-md500-offline-v3'));assert(h.buckets.has('outro-aplicativo'));await h.message({type:'SKIP_WAITING'});assert.equal(h.getSkip(),1);
});
test('navegação e scripts do shell abrem sem rede; API não entra no cache',async()=>{
 const h=harness();await h.dispatch('install');await h.request(h.scope+'api/private');assert(![...h.buckets.values()].some(data=>data.has(h.scope+'api/private')));h.setOffline(true);assert.equal((await h.request(h.scope+'rota','navigate')).status,200);assert.equal((await h.request(h.scope+'remote-tools.js','cors','script')).status,200);assert.equal((await h.request(h.scope+'nao-baixado.webp','cors','image')).status,503);
});
test('pacote offline rejeita HTML disfarçado de mídia e permite nova tentativa',async()=>{
 const h=harness();let rows=await h.message({type:'CACHE_LIBRARY'});let done=rows.find(r=>r.type==='DONE');assert.equal(done.failedCount,1,'Uma página HTML não deve ser declarada como imagem baixada');h.setValidMedia();rows=await h.message({type:'CACHE_LIBRARY'});done=rows.find(r=>r.type==='DONE');assert.equal(done.failedCount,0);h.setOffline(true);assert.equal((await h.request(h.scope+'media/approved-37/absent.webp','cors','image')).status,200);
});
test('proxy de mídia rejeita host não permitido sem consultar a rede',async()=>{
 const h=harness();const response=await h.request(h.scope+'__offline-media?src='+encodeURIComponent('https://evil.example/private'));assert.equal(response.status,400);assert.equal(h.calls.length,0);
});

test('atualização rejeita HTML no lugar de JavaScript sem ativar a nova versão',async()=>{
 const h=harness();await h.caches.open('evolupersonal-shell-antigo');h.setBadShell();await assert.rejects(h.dispatch('install'),/conteúdo inválido/);assert(h.buckets.has('evolupersonal-shell-antigo'));assert.equal(h.getSkip(),0);
});
