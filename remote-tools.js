/* Etapa 5 — referência OpenGym 8fb98b1: remote.js e sync-merge.js.
   Implementação própria: publicação por revisão e recebimento aditivo de sessões. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(!root.document)return;root.EPRemote=api;
 let connection=null;const revisions=new Map();
 async function request(path,method='GET',body){if(!connection)throw Error('Configure o serviço remoto primeiro.');const response=await fetch(connection.base+path,{method,headers:{Authorization:'Bearer '+connection.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});const value=await response.json();if(!response.ok)throw Error(value.error||'Falha ao conectar ao serviço.');return value;}
 const students=()=>db.students.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join('');
 root.epRemoteSettings=function(){
  openModal('Acesso remoto do aluno','<p>Conecte um serviço de sincronização publicado em HTTPS. Sem um serviço configurado, os dados continuam apenas neste aparelho.</p><form id="epRemoteConnect"><label>Endereço do serviço<input name="base" type="url" required placeholder="https://seu-servico.example" value="'+esc(connection?.base||'')+'"></label><label>Credencial do personal<input name="token" type="password" required autocomplete="off" minlength="32"></label><p class="muted">A credencial fica somente na memória desta aba e não entra em backups.</p><button class="primary">Conectar</button></form><div id="epRemoteActions" class="space"></div>',true);
  document.getElementById('epRemoteConnect').onsubmit=async event=>{
   event.preventDefault();if(busy)return toast('Aguarde a operação em andamento.');busy=true;const form=event.currentTarget,button=form.querySelector('button'),previous=connection;
   try{button.disabled=true;const base=api.serverURL(form.elements.base.value);if(!base)throw Error('Use o endereço HTTPS do serviço, sem caminho, usuário ou senha.');connection={base,token:form.elements.token.value.trim()};await request('/api/coach/status');form.elements.token.value='';revisions.clear();showActions();toast('Serviço remoto conectado.');}
   catch(error){connection=previous;toast(error.message);}finally{busy=false;button.disabled=false;}
  };if(connection)showActions();
 };
 function showActions(){const box=document.getElementById('epRemoteActions');if(!box)return;box.innerHTML='<label>Aluno<select id="epRemoteStudent">'+students()+'</select></label><p>Publicar envia nome do aluno, rotinas e orientações selecionadas. Revise as orientações antes do envio. Avaliações, fotos, contatos e cobranças ficam fora.</p><div class="row wrap"><button id="epPublishRemote" onclick="epRemotePublish()">Publicar prescrição</button><button id="epCreateInvite" onclick="epRemoteInvite()">Criar convite</button><button id="epReceiveRemote" onclick="epRemoteReceive()">Receber sessões</button><button id="epRevokeInvite" onclick="epRemoteRevoke()">Revogar convite</button><button onclick="epRemoteErase()">Apagar cópia remota</button><button onclick="epRemoteDisconnect()">Desconectar</button></div><div id="epRemoteResult" class="notice" role="status"></div>';}
 root.epRemoteDisconnect=()=>{if(busy)return toast('Aguarde a operação em andamento.');connection=null;revisions.clear();const box=document.getElementById('epRemoteActions');if(box)box.innerHTML='Desconectado.';};
 let busy=false;
 async function action(task){if(busy)return;busy=true;const result=document.getElementById('epRemoteResult');try{if(result)result.textContent='Conectando…';await task(result);}catch(error){if(result)result.textContent=error.message;else toast(error.message);}finally{busy=false;}}
 const studentId=()=>{const sid=document.getElementById('epRemoteStudent')?.value;if(!db.students.some(s=>s.id===sid))throw Error('Selecione um aluno.');return sid;};
 root.epRemotePublish=()=>action(async result=>{
  const sid=studentId(),list=db.workouts.filter(w=>w.student===sid);if(!list.length)throw Error('Este aluno ainda não possui rotinas.');
  if(!validDB(db))throw Error('Revise os dados locais antes de publicar.');const bundle=EPRoutines.exportBundle(db,list.map(w=>w.id));
  const remote=await request('/api/coach/students/'+encodeURIComponent(sid)),expected=revisions.get(sid);
  if(remote.revision>0&&expected!==remote.revision&&!confirm('Existe uma prescrição remota na revisão '+remote.revision+'. Substituí-la pelas '+bundle.routines.length+' rotina(s) locais deste aluno? As sessões remotas serão preservadas.')){result.textContent='Publicação cancelada.';return;}
  const names=Object.fromEntries(list.flatMap(w=>w.items.map(i=>[i.exercise,exercise(i.exercise)?.name||i.exercise])));
  const published=await request('/api/coach/students/'+encodeURIComponent(sid),'PUT',{baseRevision:remote.revision,profile:{name:student(sid).name},bundle,names,bindings:list.map(w=>w.id)});revisions.set(sid,published.revision);result.textContent='Prescrição publicada · revisão '+published.revision+'.';
 });
 root.epRemoteInvite=()=>action(async result=>{
  const sid=studentId(),invite=await request('/api/coach/students/'+encodeURIComponent(sid)+'/invite','POST',{}),link=connection.base+'/student/#invite='+encodeURIComponent(invite.token);
  result.innerHTML='<strong>Convite individual</strong><p>Válido até '+esc(new Date(invite.expiresAt).toLocaleString('pt-BR'))+'. Criar novo convite invalida o anterior.</p><label>Copie e envie ao aluno<input readonly value="'+esc(link)+'" onclick="this.select()"></label><p>Quem possui o link pode consultar os treinos e enviar sessões desse aluno. Revogar impede novos acessos ao servidor, mas não apaga cópias já baixadas.</p>';
 });
 root.epRemoteRevoke=()=>action(async result=>{const sid=studentId();if(!confirm('Revogar o convite deste aluno? Os registros pendentes continuarão no aparelho dele.')){result.textContent='Revogação cancelada.';return;}await request('/api/coach/students/'+encodeURIComponent(sid)+'/invite','DELETE');result.textContent='Convite revogado.';});
 root.epRemoteErase=()=>action(async result=>{const sid=studentId();if(!confirm('Apagar a prescrição, os convites e todas as sessões remotas deste aluno? Receba primeiro as sessões que deseja preservar. Os dados locais não serão apagados.')){result.textContent='Exclusão cancelada.';return;}await request('/api/coach/students/'+encodeURIComponent(sid),'DELETE');revisions.delete(sid);result.textContent='Cópia remota apagada. O convite deixou de funcionar.';});
 root.epRemoteReceive=()=>action(async result=>{
  const sid=studentId(),source=connection.base,received=await request('/api/coach/students/'+encodeURIComponent(sid)+'/sessions'),next=api.mergeSessions(db,received.sessions,sid,source,uid);
  if(!validDB(next.data))throw Error('O servidor retornou registros incompatíveis. Nada foi alterado.');const old=db;db=next.data;if(!save()){db=old;throw Error('Não foi possível salvar. O recebimento pode ser tentado novamente.');}result.textContent=next.added+' sessão(ões) recebida(s). O histórico anterior foi preservado.';
 });
 const priorSettings=root.settings;root.settings=()=>priorSettings()+'<section class="card section"><h2>Acesso remoto</h2><p>Publique rotinas e receba as sessões registradas pelo aluno quando houver um serviço configurado.</p><button onclick="epRemoteSettings()">Configurar acesso remoto</button></section>';
 render();
})(typeof globalThis==='undefined'?this:globalThis,function(){
 function serverURL(value){try{const url=new URL(value.trim());if(value.length>2048||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))return null;if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))return null;return url.origin;}catch{return null;}}
 function mergeSessions(data,sessions,sid,source,uid){
  if(!data.students.some(s=>s.id===sid)||!serverURL(source)||!Array.isArray(sessions)||sessions.length>10000)throw Error('Resposta remota inválida.');
  const next=structuredClone(data),receipts=new Set(next.remoteReceipts||[]),ids=new Set(next.sessions.map(s=>s.id)),known=new Map(next.exercises.map(e=>[e.id,e]));let added=0;
  for(const session of sessions){
   if(!session||typeof session.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(session.id)||typeof session.title!=='string'||session.title.length>100||typeof session.date!=='string'||!Number.isFinite(Date.parse(session.date))||!Array.isArray(session.records)||!session.records.length||session.records.length>300)throw Error('Sessão remota inválida.');
   const key=JSON.stringify([source,sid,session.id]);if(receipts.has(key))continue;
   const records=session.records.map(r=>{if(!r||!known.has(r.exercise))throw Error('Exercício remoto desconhecido.');return {...structuredClone(r),name:known.get(r.exercise).name};});
   const id=uid();if(typeof id!=='string'||ids.has(id))throw Error('Não foi possível gerar identificador único.');ids.add(id);
   const workout=next.workouts.find(w=>w.id===session.sourceWorkout&&w.student===sid);
   next.sessions.push({id,...(workout?{workout:workout.id}:{}),student:sid,title:session.title,date:session.date,effort:'',feedback:'Registrado pelo aluno no acesso remoto',records,remoteKey:key});receipts.add(key);added++;
  }next.remoteReceipts=[...receipts];return{data:next,added};
 }
 return {serverURL,mergeSessions};
});
