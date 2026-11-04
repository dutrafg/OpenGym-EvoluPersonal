/* EvoluPersonal — rotinas A–G e exportação local para impressão/PDF. */
(function(){
 'use strict';
 const LETTERS=['A','B','C','D','E','F','G'];
 let activeSlot=null;
 const api=window.EvoluPrograms={boot,view,create,editWorkout,exportProgramPDF,exportEvolutionPDF,removeProgram,renameProgram,openEvolution};
 function data(){return db.trainingPrograms||(db.trainingPrograms=[])}
 function key(){return crypto.randomUUID?crypto.randomUUID():'program-'+Date.now()+'-'+Math.random().toString(16).slice(2)}
 function safe(v){return esc(v)}
 function validPrograms(d){
  if(d.trainingPrograms===undefined)return true;
  if(!Array.isArray(d.trainingPrograms))return false;
  const ids=new Set(),used=new Set();
  return d.trainingPrograms.every(p=>{
   if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||
      typeof p.student!=='string'||!d.students.some(s=>s.id===p.student)||!p.slots||typeof p.slots!=='object'||
      Array.isArray(p.slots)||Object.keys(p.slots).some(k=>!LETTERS.includes(k)))return false;
   ids.add(p.id);
   return Object.entries(p.slots).every(([letter,wid])=>{
    if(typeof wid!=='string'||used.has(wid))return false;
    const w=d.workouts.find(x=>x.id===wid);
    if(!w||w.student!==p.student)return false;
    used.add(wid);return true;
   });
  });
 }
 function navButton(){
  const el=document.getElementById('nav');if(!el||mode!=='coach')return;
  el.insertAdjacentHTML('beforeend','<button id="myProgramsNav" '+(page==='programs'&&mode==='coach'?'class="active" aria-current="page"':'')+' onclick="go(\'programs\')">▦ Meus treinos</button>');
 }
 function boot(){
  if(!Array.isArray(db.trainingPrograms))db.trainingPrograms=[];
  const oldNav=window.nav;
  window.nav=function(){oldNav();navButton()};
  const oldRender=window.render;
  window.render=function(){
   if(page!=='programs')return oldRender();
   nav();document.getElementById('app').innerHTML=view();bind();return;
  };
  if(typeof window.validDB==='function'){
   const oldValid=window.validDB;
   window.validDB=function(d){return oldValid(d)&&validPrograms(d)};
  }
  const oldWorkoutModal=window.workoutModal;
  window.workoutModal=function(id,studentId){
   oldWorkoutModal(id,studentId);
   if(!activeSlot)return;
   const form=document.getElementById('workForm');if(!form)return;
   const original=form.onsubmit,context={...activeSlot};activeSlot=null;
   form.onsubmit=function(e){
    original.call(this,e);
    const program=data().find(p=>p.id===context.programId);
    const target=typeof editor!=='undefined'&&editor?db.workouts.find(w=>w.id===editor.id):null;
    if(!program||!target||target.student!==program.student||!program.slots)return;
    for(const other of data())for(const letter of Object.keys(other.slots||{}))
      if(other.slots[letter]===target.id&&(other.id!==program.id||letter!==context.letter))delete other.slots[letter];
    program.slots[context.letter]=target.id;
    if(!validPrograms(db)){delete program.slots[context.letter];toast('A rotina não pôde ser vinculada a este aluno.');return}
    save();render();
   };
  };
  const oldDelete=window.deleteWorkout;
  window.deleteWorkout=function(id){
   oldDelete(id);
   for(const p of data())for(const letter of Object.keys(p.slots||{}))
    if(p.slots[letter]===id&&!db.workouts.some(w=>w.id===id))delete p.slots[letter];
   save();
  };
  const oldClear=window.clearData;
  if(typeof oldClear==='function')window.clearData=function(){
   oldClear();
   if(!db.students.length&&!db.workouts.length){db.trainingPrograms=[];save();render()}
  };
  const oldImport=window.importData;
  if(typeof oldImport==='function')window.importData=async function(input){
   await oldImport(input);
   if(!Array.isArray(db.trainingPrograms))db.trainingPrograms=[];
   save();
  };
  const oldInsights=window.insightsView;
  if(typeof oldInsights==='function')window.insightsView=function(){
   return oldInsights().replace('<button class="primary" onclick="exportInsights()">Exportar CSV</button>',
    '<div class="row wrap"><button onclick="exportInsights()">Exportar CSV</button><button class="primary" onclick="EvoluPrograms.exportEvolutionPDF()">Exportar evolução em PDF</button></div>');
  };
  if(!validPrograms(db))db.trainingPrograms=[];
  save();render();
 }
 function create(){
  if(!db.students.length){toast('Cadastre um aluno antes de criar uma rotina.');studentModal();return}
  const options=db.students.map(s=>'<option value="'+safe(s.id)+'">'+safe(s.name)+'</option>').join('');
  openModal('Criar rotina de treinos','<form id="programForm"><div class="fields"><label class="full">Nome da rotina<input name="name" required maxlength="100" placeholder="Ex.: Hipertrofia — ciclo 1"></label><label class="full">Aluno<select name="student">'+options+'</select></label></div><p class="muted">A rotina pode conter até sete treinos independentes, de A a G. Cada treino mantém o próprio histórico de carga.</p><div class="modalfoot"><button type="button" onclick="closeModal()">Cancelar</button><button class="primary">Criar rotina</button></div></form>');
  document.getElementById('programForm').onsubmit=e=>{
   e.preventDefault();const values=Object.fromEntries(new FormData(e.target)),name=String(values.name||'').trim();
   if(!name)return toast('Informe o nome da rotina.');
   data().push({id:key(),name,student:values.student,slots:{},createdAt:new Date().toISOString()});
   if(!validPrograms(db)){data().pop();return toast('Não foi possível criar a rotina.')}
   save();closeModal();render();toast('Rotina criada. Agora adicione os treinos A–G.');
  };
 }
 function openEvolution(studentId){insightStudent=studentId;go('insights')}
 function renameProgram(id){
  const p=data().find(x=>x.id===id);if(!p)return;
  const name=prompt('Nome da rotina',p.name);if(name===null)return;
  const clean=name.trim();if(!clean)return toast('O nome da rotina não pode ficar vazio.');
  p.name=clean.slice(0,100);save();render();toast('Nome da rotina atualizado.');
 }
 function removeProgram(id){
  const p=data().find(x=>x.id===id);if(!p)return;
  if(!confirm('Remover a rotina "'+p.name+'" da lista? Os treinos e sessões existentes serão preservados.'))return;
  db.trainingPrograms=data().filter(x=>x.id!==id);save();render();toast('Rotina removida; histórico preservado.');
 }
 function editWorkout(programId,letter){
  const p=data().find(x=>x.id===programId);if(!p||!LETTERS.includes(letter))return;
  activeSlot={programId,letter};
  const wid=p.slots?.[letter];window.workoutModal(wid||null,p.student);
 }
 function view(){
  const programs=data();
  const cards=programs.length?programs.map(p=>{
   const s=student(p.student),filled=LETTERS.filter(letter=>p.slots?.[letter]&&db.workouts.some(w=>w.id===p.slots[letter]));
   const slots=LETTERS.map(letter=>{
    const w=db.workouts.find(x=>x.id===p.slots?.[letter]);
    return '<div class="listrow"><div><strong>Treino '+letter+'</strong><p class="muted">'+(w?safe(w.title):'Ainda não criado')+(w?' · '+w.items.length+' exercício(s)':'')+'</p></div><button onclick="EvoluPrograms.editWorkout(\''+safe(p.id)+'\',\''+letter+'\')">'+(w?'Editar':'Criar')+'</button></div>';
   }).join('');
   return '<section class="card section"><div class="between"><div><div class="eyebrow">ROTINA DE TREINO</div><h2>'+safe(p.name)+'</h2><p class="muted">Aluno: '+safe(s?.name||'Aluno')+' · '+filled.length+'/7 treinos configurados</p></div><div class="row wrap"><button onclick="EvoluPrograms.renameProgram(\''+safe(p.id)+'\')">Renomear</button><button onclick="EvoluPrograms.openEvolution(\''+safe(p.student)+'\')">Ver evolução</button><button onclick="EvoluPrograms.exportProgramPDF(\''+safe(p.id)+'\')">Exportar PDF</button><button class="quiet" onclick="EvoluPrograms.removeProgram(\''+safe(p.id)+'\')">Remover rotina</button></div></div><div class="section">'+slots+'</div></section>';
  }).join(''):'<div class="empty">Nenhuma rotina criada. Monte um ciclo de A a G e atribua ao aluno.</div>';
  return heading('PRESCRIÇÃO','Meus treinos','Crie rotinas A–G por aluno, cada uma com treinos e histórico próprios.','<button class="primary" onclick="EvoluPrograms.create()">+ Criar rotina</button>')+
   '<div class="notice">Cada treino da rotina é ligado a um aluno e mantém seus registros separados. A Evolução reúne os dados do aluno selecionado, independentemente do treino A–G.</div>'+cards;
 }
 function printWindow(title,body){
  const win=window.open('','_blank');if(!win){toast('Permita a abertura da janela para gerar o PDF.');return}
  win.document.open();win.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+safe(title)+'</title><style>*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#172334;margin:24px}h1{font-size:22px;margin:0 0 6px}h2{font-size:16px;margin:22px 0 8px}p{margin:5px 0}.meta{color:#53657a;margin-bottom:18px}.card{border:1px solid #cbd5e1;border-radius:8px;padding:12px;margin:12px 0;break-inside:avoid}.table{width:100%;border-collapse:collapse;margin:8px 0 16px}.table th,.table td{border:1px solid #cbd5e1;padding:6px;text-align:left;vertical-align:top}.table th{background:#edf2f7}.muted{color:#617187}.right{text-align:right}@page{size:auto;margin:14mm}@media print{body{margin:0}}</style></head><body>'+body+'<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),250));</script></body></html>');
  win.document.close();
 }
 function exportProgramPDF(id){
  const p=data().find(x=>x.id===id);if(!p)return toast('Rotina não encontrada.');
  const s=student(p.student),sections=LETTERS.map(letter=>{
   const w=db.workouts.find(x=>x.id===p.slots?.[letter]);
   if(!w)return '';
   const rows=w.items.flatMap(item=>{
    const ex=exercise(item.exercise),plan=planFor(item);
    return plan.map((set,index)=>{
     const type=SERIES_TYPES[set.type]||'Trabalho';
     const load=set.mode==='percent'?set.percent+'% '+(set.reference==='base'?'da carga base':'da série '+(set.reference+1)):set.load===null?'A definir':set.load+' '+(item.unit||'kg total');
     return '<tr><td>'+safe(ex?.name||'Exercício')+'</td><td>'+type+' '+(index+1)+'</td><td>'+safe(set.reps||item.reps)+'</td><td>'+safe(load)+'</td><td>'+(set.rest||0)+' s</td><td>'+(set.rir??'—')+'</td></tr>';
    });
   }).join('');
   return '<section class="card"><h2>Treino '+letter+' — '+safe(w.title)+'</h2>'+(w.notes?'<p>'+safe(w.notes)+'</p>':'')+'<table class="table"><thead><tr><th>Exercício</th><th>Série</th><th>Repetições</th><th>Carga prescrita</th><th>Descanso</th><th>RIR</th></tr></thead><tbody>'+rows+'</tbody></table></section>';
  }).join('');
  const body='<h1>'+safe(p.name)+'</h1><p class="meta">Aluno: '+safe(s?.name||'Aluno')+' · Emitido em '+new Date().toLocaleDateString('pt-BR')+'</p>'+(sections||'<p>Esta rotina ainda não tem treinos cadastrados.</p>');
  printWindow('EvoluPersonal — '+p.name,body);
 }
 function exportEvolutionPDF(){
  if(!window.EvoluInsights)return toast('O módulo de evolução não está disponível.');
  const data=EvoluInsights.aggregate(db,insightStudent),label=insightStudent==='all'?'Todos os alunos':student(insightStudent)?.name||'Aluno';
  const rows=(data.rows||[]).map(r=>'<tr><td>'+safe(new Date(r.date).toLocaleDateString('pt-BR'))+'</td><td>'+safe(student(r.student)?.name||'Aluno')+'</td><td>'+safe(r.title)+'</td><td>'+safe(r.name)+'</td><td>'+safe(r.set)+'</td><td>'+safe(r.load)+'</td><td>'+safe(r.reps??'—')+'</td><td>'+safe(r.volume)+'</td><td>'+safe(r.estimated1RM??'—')+'</td></tr>').join('');
  const weeks=(data.weeks||[]).map(w=>'<tr><td>'+safe(w.start)+'</td><td>'+w.sessions+'</td><td>'+w.sets+'</td><td>'+safe(w.volume)+' kg</td></tr>').join('');
  const body='<h1>Evolução de treinos</h1><p class="meta">Aluno: '+safe(label)+' · Emitido em '+new Date().toLocaleDateString('pt-BR')+'</p><div class="card"><strong>'+data.sessions+'</strong> sessões · <strong>'+data.loggedSets+'</strong> séries · <strong>'+safe(data.totalVolume)+' kg</strong> de volume · <strong>'+data.personalRecords+'</strong> novos máximos estimados</div><h2>Resumo semanal</h2><table class="table"><thead><tr><th>Semana</th><th>Sessões</th><th>Séries</th><th>Volume</th></tr></thead><tbody>'+weeks+'</tbody></table><h2>Registros por série</h2><table class="table"><thead><tr><th>Data</th><th>Aluno</th><th>Treino</th><th>Exercício</th><th>Série</th><th>Carga</th><th>Reps/tempo</th><th>Volume</th><th>1RM estimada</th></tr></thead><tbody>'+rows+'</tbody></table>';
  printWindow('EvoluPersonal — Evolução de treinos',body);
 }
 function bind(){}
})();
EvoluPrograms.boot();
