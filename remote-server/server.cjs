'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const routines=require('../routine-tools.js'),execution=require('../execution.js'),historyImport=require('../import-analysis.js');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const id=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(s)&&!['__proto__','constructor','prototype'].includes(s);
const fail=(status,message)=>{const error=Error(message);error.status=status;throw error;};
function createRemoteServer({token,file,origins=[],clock=Date.now}={}){
 if(typeof token!=='string'||token.length<32||!/^[A-Za-z0-9_-]+$/.test(token))throw Error('REMOTE_COACH_TOKEN precisa de ao menos 32 caracteres.');
 const initial={students:{}};let state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):initial;
 if(!state||typeof state!=='object'||!state.students||typeof state.students!=='object'||Array.isArray(state.students)||Object.values(state.students).some(s=>!s||!Array.isArray(s.sessions)||!s.versions||!Number.isInteger(s.revision)))throw Error('Arquivo remoto inválido; preserve uma cópia antes de reparar.');
 const commit=next=>{fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(next),{mode:0o600});fs.renameSync(temp,file);state=next;};
 const equal=(a,b)=>{const x=Buffer.from(hash(a)),y=Buffer.from(hash(b));return crypto.timingSafeEqual(x,y);};
 function body(req){return new Promise((resolve,reject)=>{let text='',size=0;req.on('data',chunk=>{size+=chunk.length;if(size>2_000_000){reject(Object.assign(Error('Solicitação maior que 2 MB.'),{status:413}));req.destroy();return;}text+=chunk;});req.on('end',()=>{try{resolve(text?JSON.parse(text):{});}catch{reject(Object.assign(Error('JSON inválido.'),{status:400}));}});req.on('error',reject);});}
 const windows=new Map();
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  try{
   const origin=req.headers.origin;
   if(origin){let same=false;try{const u=new URL(origin);same=['http:','https:'].includes(u.protocol)&&u.host===req.headers.host;}catch{}
    if(!same&&!origins.includes(origin))fail(403,'Origem não autorizada.');res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
   }
   if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET,PUT,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type'});return res.end();}
   const url=new URL(req.url,'http://localhost'),route=url.pathname;
   const staticFiles={'/student/':['student.html','text/html; charset=utf-8'],'/student/app.js':['student.js','application/javascript'],'/student/sw.js':['student-sw.js','application/javascript']};
   if(req.method==='GET'&&staticFiles[route]){const [name,type]=staticFiles[route];res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");res.writeHead(200,{'Content-Type':type});return res.end(fs.readFileSync(path.join(__dirname,name)));}
   const peer=req.socket.remoteAddress||'unknown',now=clock(),window=windows.get(peer);
   if(!window||now-window.start>60000)windows.set(peer,{start:now,count:1});else if(++window.count>180)fail(429,'Muitas solicitações. Aguarde um minuto.');
   if(windows.size>10000)for(const [key,value]of windows)if(now-value.start>60000)windows.delete(key);
   const bearer=/^Bearer ([A-Za-z0-9_\-.]+)$/.exec(req.headers.authorization||'')?.[1]||'';
   if(route.startsWith('/api/coach/')){
    if(!bearer||!equal(bearer,token))fail(401,'Credencial do personal inválida.');
    if(route==='/api/coach/status'&&req.method==='GET')return send(200,{ok:true,version:1});
    const match=/^\/api\/coach\/students\/([A-Za-z0-9_-]+)(?:\/(invite|sessions))?$/.exec(route);if(!match||!id(match[1]))fail(404,'Recurso não encontrado.');
    const sid=match[1],action=match[2],current=Object.hasOwn(state.students,sid)?state.students[sid]:null;
    if(!action&&req.method==='GET')return send(200,{revision:current?.revision||0,profile:current?.profile||null,bundle:current?.versions[current.revision]||null});
    if(!action&&req.method==='PUT'){
     const input=await body(req);const latest=Object.hasOwn(state.students,sid)?state.students[sid]:null;
     if(!Number.isInteger(input.baseRevision)||input.baseRevision!==(latest?.revision||0))fail(409,'A prescrição remota mudou. Confira a revisão atual antes de publicar novamente.');
     if(typeof input.profile?.name!=='string'||!input.profile.name.trim()||input.profile.name.length>120)fail(400,'Nome inválido.');
     let bundle;try{bundle=routines.parseBundle(JSON.stringify(input.bundle),new Set(Array.from({length:500},(_,i)=>'md'+(i+1))));}catch(error){fail(400,error.message);}
     const bindings=input.bindings||[];if(!Array.isArray(bindings)||bindings.length&&bindings.length!==bundle.routines.length||bindings.some(value=>!id(value))||new Set(bindings).size!==bindings.length)fail(400,'Vínculos de rotinas inválidos.');
     const names={};for(const [key,value] of Object.entries(input.names||{})){if(/^md[0-9]+$/.test(key)&&typeof value==='string'&&value.length<=250)names[key]=value;}
     const next=structuredClone(state),revision=(latest?.revision||0)+1;
     next.students[sid]={...(latest||{versions:{},sessions:[],invite:null}),revision,names,bindings:{...latest?.bindings,[revision]:bindings},profile:{name:input.profile.name.trim()},versions:{...latest?.versions,[revision]:bundle}};
     commit(next);return send(200,{revision});
    }
    if(!action&&req.method==='DELETE'){if(!current)fail(404,'Aluno não encontrado.');const next=structuredClone(state);delete next.students[sid];commit(next);return send(200,{deleted:true});}
    if(!current)fail(404,'Publique a prescrição antes de criar o convite.');
    if(action==='invite'&&req.method==='POST'){
     const secret=crypto.randomBytes(32).toString('base64url'),expiresAt=clock()+14*86400000,next=structuredClone(state);next.students[sid].invite={hash:hash(secret),expiresAt};commit(next);return send(201,{token:secret,expiresAt});
    }
    if(action==='invite'&&req.method==='DELETE'){const next=structuredClone(state);next.students[sid].invite=null;commit(next);return send(200,{revoked:true});}
    if(action==='sessions'&&req.method==='GET')return send(200,{sessions:current.sessions});
    fail(405,'Método não permitido.');
   }
   if(route==='/api/student'||route==='/api/student/sessions'){
    const actual=Object.entries(state.students).find(([,s])=>s.invite&&s.invite.expiresAt>clock()&&bearer&&equal(hash(bearer),s.invite.hash));
    if(!actual)fail(401,'Convite inválido, revogado ou expirado.');const [sid,s]=actual;
    if(route==='/api/student'&&req.method==='GET')return send(200,{student:{id:sid,name:s.profile.name},revision:s.revision,names:s.names||{},bundle:s.versions[s.revision]});
    if(route==='/api/student/sessions'&&req.method==='POST'){
     const input=await body(req),latest=state.students[sid];if(!latest.invite||latest.invite.expiresAt<=clock()||latest.invite.hash!==hash(bearer))fail(401,'Convite revogado ou expirado.');
     const bundle=latest.versions[input.revision];if(!bundle)fail(409,'Revisão de treino indisponível. Preserve a fila e contate o personal.');
     const routine=bundle.routines[input.routine];if(!routine)fail(400,'Rotina inválida.');
     const session=validateSession(input,routine,clock());const sourceWorkout=latest.bindings?.[input.revision]?.[input.routine];if(sourceWorkout)session.sourceWorkout=sourceWorkout;const previous=latest.sessions.find(x=>x.id===session.id);
     if(previous){if(JSON.stringify(previous)!==JSON.stringify(session))fail(409,'Identificador já usado com outro registro.');return send(200,{id:previous.id,duplicate:true});}
     const next=structuredClone(state);next.students[sid].sessions.push(session);commit(next);return send(201,{id:session.id});
    }
   }
   fail(404,'Recurso não encontrado.');
  }catch(error){if(!res.headersSent)send(error.status||500,{error:error.status?error.message:'Não foi possível concluir a operação.'});else res.end();}
 });return server;
}
function validateSession(input,routine,now){
 if(!id(input.id)||!Number.isInteger(input.routine)||input.routine<0||!Number.isInteger(input.revision)||input.revision<1||typeof input.date!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(input.date)||!Number.isFinite(Date.parse(input.date))||Date.parse(input.date)>now+86400000||!Array.isArray(input.records)||!input.records.length||input.records.length>300)fail(400,'Registro de sessão inválido.');
 let date;try{date=historyImport.dateISO(input.date);}catch{fail(400,'Data da sessão inválida.');}
 const seen=new Set();const records=input.records.map(r=>{
  const item=routine.items[r?.item],plans=item?.setPlan||Array.from({length:item?.sets||0},()=>({type:'trabalho'})),planned=plans[r?.set-1];
  if(!item||!Number.isInteger(r.item)||!Number.isInteger(r.set)||!planned||seen.has(r.item+':'+r.set))fail(400,'Série fora da prescrição ou repetida.');seen.add(r.item+':'+r.set);
  if(!(r.load===null||typeof r.load==='number'&&Number.isFinite(r.load)&&r.load>=0&&r.load<=2000)||typeof r.reps!=='string'||r.reps.length>40)fail(400,'Carga ou repetições inválidas.');
  const row={exercise:item.exercise,item:r.item,set:r.set,load:r.load,reps:r.reps,rest:planned.rest??item.rest??0,done:true,unit:item.unit||'kg total',type:planned.type||'trabalho',executionMode:item.executionMode||'reps',...(r.durationSeconds!==undefined?{durationSeconds:r.durationSeconds}:{}),...(r.distanceKm!==undefined?{distanceKm:r.distanceKm}:{}),...(r.left!==undefined?{left:r.left,right:r.right}:{}),...(r.blocks!==undefined?{blocks:r.blocks}:{}),...(planned.drops?{drops:planned.drops}:{}),...(planned.miniSets?{miniSets:planned.miniSets}:{}),...(planned.miniRest?{miniRest:planned.miniRest}:{})};
  if(!execution.validRecord(row))fail(400,'Duração, distância ou blocos inválidos.');const message=execution.completionError(row,item);if(message)fail(400,message);
  if(row.blocks)row.blocks=row.blocks.map(b=>({load:b.load,reps:b.reps}));return row;
 });return {id:input.id,title:routine.title,date,revision:input.revision,routine:input.routine,records};
}
if(require.main===module){const server=createRemoteServer({token:process.env.REMOTE_COACH_TOKEN,file:process.env.REMOTE_DATA_FILE||path.join(__dirname,'data/state.json'),origins:(process.env.REMOTE_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean)});server.listen(Number(process.env.PORT)||8787,process.env.HOST||'127.0.0.1',()=>console.log('Serviço remoto iniciado.'));}
module.exports={createRemoteServer,validateSession};
