'use strict';
const SERIES_TYPES={aquecimento:'Aquecimento',feeder:'Preparatória · feeder',trabalho:'Trabalho',principal:'Principal · top set',backoff:'Back-off'};
const LOAD_UNITS=['kg total','kg por halter','kg por lado','placas da máquina','peso corporal'];
const isWork=s=>['trabalho','principal'].includes(s.type);
const validLoad=x=>x===null||(Number.isFinite(x)&&x>=0&&x<=2000);
function legacySeries(i){return Array.from({length:i.sets},()=>({type:'trabalho',mode:'fixed',load:i.load,reps:i.reps,rest:i.rest,percent:100,reference:'base',rir:null}));}
function planFor(i){return i.setPlan||legacySeries(i);}
function migrateDB(data){const d=structuredClone(data);d.version=2;return d;}
function validDB(d){try{
 if(!d||![1,2].includes(d.version))return false;
 const projected=structuredClone(d);projected.version=VERSION;
 for(let wi=0;wi<d.workouts.length;wi++){
  const w=d.workouts[wi];
  for(let n=0;n<w.items.length;n++){
   const i=w.items[n];if(!Number.isInteger(i.sets)||i.sets<1||i.sets>20||!validLoad(i.load))return false;
   if(i.unit!==undefined&&!LOAD_UNITS.includes(i.unit))return false;
   if(i.alternatives!==undefined){
    const original=d.exercises.find(e=>e.id===i.exercise);
    if(!Array.isArray(i.alternatives)||i.alternatives.length>5||new Set(i.alternatives).size!==i.alternatives.length||
       i.alternatives.some(a=>typeof a!=='string'||a===i.exercise||
         !d.exercises.some(e=>e.id===a&&e.group===original?.group)))return false;
   }
   if(i.setPlan!==undefined){
    if(!Array.isArray(i.setPlan)||i.setPlan.length<1||i.setPlan.length>30||i.sets!==i.setPlan.filter(isWork).length||i.sets<1||i.sets>20)return false;
    if(!i.setPlan.every((s,k)=>s&&Object.hasOwn(SERIES_TYPES,s.type)&&['fixed','percent'].includes(s.mode)&&validLoad(s.load)&&typeof s.reps==='string'&&s.reps.trim()&&s.reps.length<=40&&Number.isInteger(s.rest)&&s.rest>=0&&s.rest<=3600&&(s.rir===null||Number.isInteger(s.rir)&&s.rir>=0&&s.rir<=10)&&Number.isFinite(s.percent)&&s.percent>0&&s.percent<=100&&(s.reference==='base'||Number.isInteger(s.reference)&&s.reference>=0&&s.reference<k&&isWork(i.setPlan[s.reference]))&&(s.type!=='backoff'||s.mode==='percent'&&Number.isInteger(s.reference))))return false;
   }
   if(i.progression!==undefined){const p=i.progression;if(!p||(p.scheme!==undefined&&!['linear','double'].includes(p.scheme))||(p.deloadAfter!==undefined&&(!Number.isInteger(p.deloadAfter)||p.deloadAfter<2||p.deloadAfter>6))||(p.deloadPercent!==undefined&&(!Number.isFinite(p.deloadPercent)||p.deloadPercent<5||p.deloadPercent>30))||!['off','all','principal'].includes(p.criterion)||!Number.isInteger(p.min)||!Number.isInteger(p.max)||p.min<1||p.max<p.min||p.max>100||!Number.isFinite(p.increment)||p.increment<=0||p.increment>100)return false;}
   const pi=projected.workouts[wi].items[n];pi.sets=planFor(i).length;pi.load=i.load===null?0:i.load;
  }
 }
 const cleanRecord=r=>{if(!validLoad(r.load)||(r.type!==undefined&&!Object.hasOwn(SERIES_TYPES,r.type))||(r.rir!==undefined&&r.rir!==null&&(!Number.isInteger(r.rir)||r.rir<0||r.rir>10))||(r.plannedLoad!==undefined&&!validLoad(r.plannedLoad)))throw Error();r.load=r.load===null?0:r.load;};
 for(const s of projected.sessions)s.records.forEach(cleanRecord);
 for(const x of Object.values(projected.drafts))x.records.forEach(cleanRecord);
 // The legacy structural validator enforces foreign keys, uniqueness and limits.
 if(!validBaseDB(projected))return false;
 for(const [id,draft]of Object.entries(d.drafts)){
  const w=d.workouts.find(w=>w.id===id);
  if(draft.substitutions!==undefined){
   if(!draft.substitutions||typeof draft.substitutions!=='object'||Array.isArray(draft.substitutions)||
      !Object.entries(draft.substitutions).every(([index,alt])=>/^(0|[1-9][0-9]*)$/.test(index)&&
        Number(index)<w.items.length&&w.items[Number(index)].alternatives?.includes(alt)))return false;
  }
  const expected=w.items.flatMap((i,n)=>planFor(i).map((s,k)=>({item:n,set:k+1,exercise:draft.substitutions?.[n]||i.exercise,type:s.type})));
  if(draft.records.some((r,k)=>!expected[k]||r.item!==expected[k].item||r.set!==expected[k].set||r.exercise!==expected[k].exercise||(r.type!==undefined&&r.type!==expected[k].type)))return false;
  for(const r of draft.records){const item=w.items[r.item];if(item.setPlan){const s=item.setPlan[r.set-1];if(r.type!==s.type||r.mode!==s.mode||r.percent!==s.percent||r.reference!==s.reference||r.rest!==s.rest||r.targetRir!==s.rir||typeof r.manualLoad!=='boolean')return false;}}
 }
 return true;
 }catch(e){return false;}}
function resolvedLoad(s,i,records=[]){if(s.mode!=='percent')return s.load;const base=s.reference==='base'?i.load:records[s.reference]?.load;return base===null||base===undefined?null:Math.round(base*s.percent)/100;}
function makeDraft(w){return {records:w.items.flatMap((i,n)=>{const rows=[];planFor(i).forEach((s,k)=>{const load=resolvedLoad(s,i,rows);rows.push({exercise:i.exercise,name:exercise(i.exercise)?.name||'Exercício',item:n,set:k+1,type:s.type,mode:s.mode,percent:s.percent,reference:s.reference,plannedLoad:load,load,plannedReps:s.reps,reps:'',rest:s.rest,rir:null,targetRir:s.rir,unit:i.unit||'kg total',manualLoad:false,done:false});});return rows;})};}
function counts(items){const c={preparatory:0,work:0,backoff:0};items.forEach(i=>planFor(i).forEach(s=>{if(isWork(s))c.work++;else if(s.type==='backoff')c.backoff++;else c.preparatory++;}));return c;}
function planSummary(items){const c=counts(items);return c.work+' de trabalho · '+c.preparatory+' preparatórias · '+c.backoff+' back-off';}
function ensurePlan(n){const i=editor.items[n];if(!i.setPlan)i.setPlan=legacySeries(i);return i;}
function syncWorkCount(i){i.sets=i.setPlan.filter(isWork).length;}
function editItem(n,key,value){const i=editor.items[n];i[key]=key==='load'?(value===''?null:Number(value)):value;}
function editSeries(n,k,key,value){const i=ensurePlan(n),s=i.setPlan[k];if(['load','rir'].includes(key))s[key]=value===''?null:Number(value);else if(['percent','rest'].includes(key))s[key]=Number(value);else if(key==='reference')s[key]=value==='base'?'base':Number(value);else s[key]=value;
 if(key==='type'){
  if(value==='backoff'){const candidates=i.setPlan.slice(0,k).map((s,j)=>isWork(s)?j:-1).filter(j=>j>=0);if(!candidates.length){s.type='trabalho';toast('Adicione uma série de trabalho antes do back-off.');}else{s.mode='percent';s.percent=70;s.reference=candidates.at(-1);s.rest=30;}}
  else if(s.reference!=='base'&&!isWork(i.setPlan[s.reference]))s.reference='base';
  syncWorkCount(i);renderItems();
 }
 if(key==='mode')renderItems();
}
function addSeries(n){const i=ensurePlan(n);if(i.setPlan.length>=30)return toast('Limite de 30 séries por exercício.');i.setPlan.push({type:'trabalho',mode:'fixed',load:i.load,reps:i.reps,rest:i.rest,percent:100,reference:'base',rir:null});syncWorkCount(i);renderItems();}
function removeSeries(n,k){const i=ensurePlan(n);if(i.setPlan.some(s=>s.mode==='percent'&&s.reference===k))return toast('Altere primeiro o back-off que usa esta série como referência.');i.setPlan.splice(k,1);for(const s of i.setPlan)if(Number.isInteger(s.reference)&&s.reference>k)s.reference--;syncWorkCount(i);renderItems();}
function applyPreparatory(n){const i=ensurePlan(n),g=exercise(i.exercise)?.group;const first=!editor.items.slice(0,n).some(j=>exercise(j.exercise)?.group===g);const work=i.setPlan.filter(isWork);if(!work.length)return toast('Mantenha pelo menos uma série de trabalho.');
 const row=(type,percent,reps)=>({type,mode:'percent',load:null,reps,rest:60,percent,reference:'base',rir:null});
 i.setPlan=[...(first?[row('aquecimento',45,'10')]:[]),row('feeder',65,'6'),...work];syncWorkCount(i);renderItems();toast('Preparatórias inseridas: 45% e 65%, editáveis. Revise a carga base e os descansos.');}
function progressionEdit(n,key,value){const i=editor.items[n];i.progression=i.progression||{criterion:'off',min:5,max:9,increment:1};i.progression[key]=['criterion','scheme'].includes(key)?value:Number(value);if(key==='scheme'&&value==='double'&&i.progression.criterion==='off')i.progression.criterion='all';if(key==='scheme')renderItems();}

function altEditorHTML(item,n){
 const added=item.alternatives||[],base=exercise(item.exercise),eligible=catalog.filter(e=>e.group===base?.group&&e.id!==item.exercise&&!added.includes(e.id));
 return '<details class="space"><summary>Exercícios substitutos (até 5)</summary><p class="muted">Selecione movimentos do mesmo grupo muscular. A troca vale apenas para a sessão, não altera a prescrição.</p>'+
 (eligible.length&&added.length<5?'<div class="row wrap"><select id="altPick-'+n+'" aria-label="Exercício substituto">'+eligible.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name)+'</option>').join('')+'</select>'+
 '<button type="button" onclick="addAlternative('+n+')">Adicionar</button></div>':'')+
 (added.length?added.map(id=>'<div class="listrow"><span>'+esc(exercise(id)?.name||id)+'</span><button type="button" onclick="removeAlternative('+n+',\''+esc(id)+'\')">Remover</button></div>').join(''):'<p class="muted">Sem substitutos cadastrados.</p>')+
 '</details>';
}

function renderItems(){document.getElementById('editorItems').innerHTML='<div class="notice"><strong>'+planSummary(editor.items)+'</strong><br>Preparatórias são adicionais às séries de trabalho. Carga em branco significa não definida. O descanso abaixo é antes da série.</div>'+editor.items.map((i,n)=>{
 const rows=planFor(i),p=i.progression||{criterion:'off',min:5,max:9,increment:1};
 return '<section class="exrow"><div class="between"><h3>'+(n+1)+'. '+esc(exercise(i.exercise)?.name)+'</h3><div><button type="button" onclick="moveItem('+n+',-1)" '+(!n?'disabled':'')+' aria-label="Mover para cima">↑</button> <button type="button" onclick="moveItem('+n+',1)" '+(n===editor.items.length-1?'disabled':'')+' aria-label="Mover para baixo">↓</button> <button type="button" onclick="editor.items.splice('+n+',1);renderItems()">Remover exercício</button></div></div>'+altEditorHTML(i,n)+'<div class="fields"><label>Carga base<input type="number" min="0" max="2000" step="any" value="'+(i.load??'')+'" oninput="editItem('+n+',\'load\',this.value)"></label><label>Unidade<select onchange="editItem('+n+',\'unit\',this.value)">'+LOAD_UNITS.map(u=>'<option '+((i.unit||'kg total')===u?'selected':'')+'>'+u+'</option>').join('')+'</select></label><div class="space"><button type="button" onclick="applyPreparatory('+n+')">Aplicar aquecimento / feeder</button></div></div>'+rows.map((s,k)=>'<div class="serieseditor"><div class="between"><strong>Série '+(k+1)+'</strong><button type="button" onclick="removeSeries('+n+','+k+')">Remover série</button></div><div class="fields"><label>Tipo<select onchange="editSeries('+n+','+k+',\'type\',this.value)">'+Object.entries(SERIES_TYPES).map(([v,l])=>'<option value="'+v+'" '+(s.type===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label><label>Repetições / tempo<input required maxlength="40" value="'+esc(s.reps)+'" oninput="editSeries('+n+','+k+',\'reps\',this.value)"></label><label>Descanso antes (s)<input required type="number" min="0" max="3600" value="'+s.rest+'" oninput="editSeries('+n+','+k+',\'rest\',this.value)"></label><label>Carga<select '+(s.type==='backoff'?'disabled':'')+' onchange="editSeries('+n+','+k+',\'mode\',this.value)"><option value="fixed" '+(s.mode==='fixed'?'selected':'')+'>Fixa</option><option value="percent" '+(s.mode==='percent'?'selected':'')+'>Percentual</option></select></label>'+(s.mode==='percent'?'<label>Percentual da referência<input required type="number" min="1" max="100" step="any" value="'+s.percent+'" oninput="editSeries('+n+','+k+',\'percent\',this.value)"></label><label>Referência<select onchange="editSeries('+n+','+k+',\'reference\',this.value)">'+(s.type!=='backoff'?'<option value="base" '+(s.reference==='base'?'selected':'')+'>Carga base do exercício</option>':'')+rows.slice(0,k).map((t,j)=>!isWork(t)?'':'<option value="'+j+'" '+(s.reference===j?'selected':'')+'>Série '+(j+1)+' · '+SERIES_TYPES[t.type]+'</option>').join('')+'</select></label>':'<label>Carga planejada<input type="number" min="0" max="2000" step="any" value="'+(s.load??'')+'" oninput="editSeries('+n+','+k+',\'load\',this.value)"></label>')+'<label>RIR alvo (opcional)<input type="number" min="0" max="10" value="'+(s.rir??'')+'" oninput="editSeries('+n+','+k+',\'rir\',this.value)"></label></div></div>').join('')+'<button type="button" onclick="addSeries('+n+')">+ Série de trabalho</button><details class="space"><summary>Progressão para a próxima sessão</summary><div class="fields"><label>Critério<select onchange="progressionEdit('+n+',\'criterion\',this.value)">'+[['off','Desativada'],['all','Todas as séries de trabalho'],['principal','Série principal']].map(([v,l])=>'<option value="'+v+'" '+(p.criterion===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label><label>Método<select onchange="progressionEdit('+n+',\'scheme\',this.value)">'+
 [['linear','Progressão de carga'],['double','Dupla progressão · repetições → carga']].map(([v,label])=>
 '<option value="'+v+'" '+((p.scheme||'linear')===v?'selected':'')+'>'+label+'</option>').join('')+
 '</select></label><label>Falhas para sugerir deload<input type="number" min="2" max="6" value="'+(p.deloadAfter??3)+'" oninput="progressionEdit('+n+',\'deloadAfter\',this.value)"></label>'+
 '<label>Deload sugerido (%)<input type="number" min="5" max="30" step="any" value="'+(p.deloadPercent??10)+'" oninput="progressionEdit('+n+',\'deloadPercent\',this.value)"></label>'+
 '<label>Repetições mínimas<input type="number" min="1" max="100" value="'+p.min+'" oninput="progressionEdit('+n+',\'min\',this.value)"></label><label>Repetições máximas<input type="number" min="1" max="100" value="'+p.max+'" oninput="progressionEdit('+n+',\'max\',this.value)"></label><label>Incremento de carga<input type="number" min="0.01" max="100" step="any" value="'+p.increment+'" oninput="progressionEdit('+n+',\'increment\',this.value)"></label></div><p class="muted">Gera uma sugestão após a sessão; o personal revisa antes de mudar o treino.</p></details></section>';
 }).join('');}

function substitutePickHTML(w,d,i,n){
 if(!i.alternatives?.length)return '';
 const current=d.substitutions?.[n]||i.exercise;
 const options=[i.exercise,...i.alternatives].map(id=>'<option value="'+esc(id)+'" '+(id===current?'selected':'')+'>'+esc(exercise(id)?.name||id)+'</option>').join('');
 return '<div class="space"><label>Exercício nesta sessão<select aria-label="Substituição do exercício '+(n+1)+'" onchange="chooseSubstitute(\''+esc(w.id)+'\','+n+',this.value)">'+options+'</select></label>'+
 '<p class="muted">A troca não altera a prescrição. Séries concluídas impedem alterações nesta posição.</p></div>';
}

function previousSetRecord(studentId,exerciseId,setNo,workoutId,sessions=db.sessions,expectedUnit='kg total'){
 const rows=[];
 for(const session of sessions||[]){
  if(session.student!==studentId||session.workout!==workoutId||!Array.isArray(session.records))continue;
  for(const record of session.records){
   const unit=record.unit||'kg total';
   if(record.exercise===exerciseId&&record.set===setNo&&record.done===true&&Number.isFinite(record.load)&&record.load>=0&&unit===expectedUnit)rows.push({record,session});
  }
 }
 rows.sort((a,b)=>Number(b.session.workout===workoutId)-Number(a.session.workout===workoutId)||Date.parse(b.session.date)-Date.parse(a.session.date));
 return rows[0]||null;
}
function previousPerformanceHTML(w,d,item,index,record,rowIndex){
 if(record.done)return '';
 const exerciseId=d.substitutions?.[index]||item.exercise;
 const unit=record.unit||item.unit||'kg total';
 const previous=previousSetRecord(w.student,exerciseId,record.set,w.id,db.sessions,unit);
 if(!previous)return '';
 const p=previous.record;
 return '<div class="between muted space"><small>Última execução: '+esc(p.load)+' '+esc(unit)+(p.reps?' × '+esc(p.reps)+' rep.':'')+' · '+date(previous.session.date)+'</small><button type="button" onclick="applyPreviousLoad(\''+esc(w.id)+'\','+rowIndex+','+p.load+')">Usar carga anterior</button></div>';
}
function applyPreviousLoad(workoutId,rowIndex,load){
 const w=db.workouts.find(x=>x.id===workoutId),d=db.drafts[workoutId],r=d?.records[rowIndex];
 if(!w||!r||r.done||!Number.isFinite(load)||load<0||load>2000)return toast('Não foi possível aplicar a carga anterior.');
 r.load=load;r.manualLoad=true;save();render();toast('Carga anterior aplicada para esta série.');
}
function estimated1RMForRecord(record){
 const load=record&&record.load,reps=record&&record.reps;
 if(!record||record.done!==true||!Number.isFinite(load)||load<=0||typeof reps!=='string'||!/^\s*\d{1,2}\s*$/.test(reps))return null;
 const count=Number(reps.trim());if(count<1||count>12)return null;
 return Math.round(load*(1+count/30)*10)/10;
}
function previousBestEstimated1RM(studentId,exerciseId,sessions=db.sessions){
 let best=null;
 for(const session of sessions||[]){
  if(session.student!==studentId||!Array.isArray(session.records))continue;
  for(const record of session.records)if(record.exercise===exerciseId){
   const estimate=estimated1RMForRecord(record);
   if(estimate!==null&&(best===null||estimate>best))best=estimate;
  }
 }
 return best;
}
function personalRecordHTML(w,d,item,index,record){
 if(!record.done)return '';
 const exerciseId=d.substitutions?.[index]||item.exercise;
 const estimate=estimated1RMForRecord(record),best=previousBestEstimated1RM(w.student,exerciseId);
 return estimate!==null&&(best===null||estimate>best)?'<div class="notice" role="status"><strong>Nova melhor marca estimada:</strong> '+estimate+' kg de 1RM</div>':'';
}
function sessionView(w){const d=db.drafts[w.id]||(db.drafts[w.id]=makeDraft(w)),done=d.records.filter(r=>r.done).length;
 return '<section class="card section"><h2>'+esc(w.title)+'</h2><span id="count-'+esc(w.id)+'">'+done+'/'+d.records.length+' séries</span><p class="muted">'+planSummary(w.items)+'</p>'+(w.notes?'<p>'+esc(w.notes)+'</p>':'')+'<div class="progress"><div id="progress-'+esc(w.id)+'" style="width:'+(done/d.records.length*100)+'%"></div></div>'+w.items.map((i,n)=>'<div class="exrow"><div class="between"><h3>'+(n+1)+'. '+esc(exercise(d.substitutions?.[n]||i.exercise)?.name)+'</h3><button onclick="showMotion(\''+esc(d.substitutions?.[n]||i.exercise)+'\')">Ver GIF</button></div>'+substitutePickHTML(w,d,i,n)+d.records.map((r,k)=>r.item!==n?'':'<div class="executionseries"><div class="between"><strong>'+r.set+' · '+esc(SERIES_TYPES[r.type||'trabalho'])+'</strong><span class="pill">'+esc(r.unit||i.unit||'kg total')+'</span></div>'+personalRecordHTML(w,d,i,n,r)+'<p class="muted">Meta: '+esc(r.plannedReps||i.reps)+(r.targetRir==null?'':' · RIR '+r.targetRir)+(r.mode==='percent'?' · '+r.percent+'% '+(r.reference==='base'?'da carga base':'da série '+(r.reference+1)):'')+' · carga planejada: '+(r.plannedLoad===null?'não definida':r.plannedLoad??i.load)+'</p><div class="fields"><label>Carga realizada<input id="record-load-'+w.id+'-'+k+'" aria-label="Carga realizada série '+r.set+'" type="number" min="0" max="2000" step="any" value="'+(r.load??'')+'" '+(r.done?'disabled':'')+' onchange="recordChange(\''+w.id+'\','+k+',\'load\',this)"></label><label>Repetições / tempo realizados<input maxlength="40" value="'+esc(r.reps)+'" '+(r.done?'disabled':'')+' onchange="recordChange(\''+w.id+'\','+k+',\'reps\',this)"></label><label>RIR realizado<input type="number" min="0" max="10" value="'+(r.rir??'')+'" '+(r.done?'disabled':'')+' onchange="recordChange(\''+w.id+'\','+k+',\'rir\',this)"></label></div>'+previousPerformanceHTML(w,d,i,n,r,k)+'<div class="row wrap space"><button onclick="startTimer('+r.rest+')">Descansar antes · '+r.rest+'s</button><label class="completed"><input type="checkbox" '+(r.done?'checked':'')+' onchange="recordChange(\''+w.id+'\','+k+',\'done\',this)"> Concluída</label></div></div>').join('')+'</div>').join('')+'<button class="primary" onclick="finishModal(\''+w.id+'\')">Concluir treino</button></section>';}
function updateDependentLoads(w,d,item){const rows=d.records.filter(r=>r.item===item);for(const r of rows){if(r.mode!=='percent'||r.done)continue;const base=r.reference==='base'?w.items[item].load:rows[r.reference]?.load;const next=base==null?null:Math.round(base*r.percent)/100;r.plannedLoad=next;if(!r.manualLoad)r.load=next;}}
function recordChange(id,k,field,el){const w=db.workouts.find(w=>w.id===id),d=db.drafts[id],r=d.records[k];
 if(field==='load'||field==='rir'){const x=el.value===''?null:Number(el.value);if(!el.validity.valid||(field==='load'?!validLoad(x):x!==null&&(!Number.isInteger(x)||x<0||x>10))){el.value=r[field]??'';return toast('Informe um valor válido.');}r[field]=x;if(field==='load'){r.manualLoad=true;updateDependentLoads(w,d,r.item);}}
 else if(field==='reps'){if(!el.value.trim())return toast('Informe as repetições ou o tempo realizados.');r.reps=el.value.trim();}
 else{if(el.checked&&!r.reps.trim()){el.checked=false;return toast('Registre as repetições ou o tempo antes de concluir a série.');}r.done=el.checked;}
 save();render();
}
function progressionSuggestions(w,records){return w.items.flatMap((i,n)=>{
 const p=i.progression;if(!p||p.criterion==='off')return[];const rows=records.filter(r=>r.item===n&&isWork({type:r.type||'trabalho'})&&(p.criterion!=='principal'||r.type==='principal'));
 if(!rows.length||rows.some(r=>r.exercise!==i.exercise))return[];const eligible=rows.every(r=>r.done&&/^\d+$/.test(r.reps)&&Number(r.reps)>=p.max&&r.load!==null&&(!Number.isFinite(r.targetRir)||r.rir!==null&&r.rir!==undefined&&r.rir>=r.targetRir));
 if(!eligible)return[];return[exercise(i.exercise)?.name+': revisar aumento de '+p.increment+' '+(i.unit||'kg total')+'; critério '+(p.criterion==='all'?'todas as séries':'série principal')+' atingido.'];
 });}

function doubleProgressionStatus(item,rows){
 const p=item.progression;
 if(!p||p.scheme!=='double'||p.criterion==='off')return null;
 const selected=rows.filter(r=>isWork({type:r.type||'trabalho'})&&(p.criterion!=='principal'||r.type==='principal'));
 if(!selected.length||selected.some(r=>!r.done||r.exercise!==item.exercise||!Number.isFinite(r.load)||
   !/^[0-9]{1,3}$/.test(String(r.reps))||Number(r.reps)<1||Number(r.reps)>100))return null;
 if(selected.some(r=>Number(r.reps)<p.min))return 'below';
 if(selected.some(r=>Number.isFinite(r.targetRir)&&
   (r.rir===null||r.rir===undefined||r.rir<r.targetRir)))return 'rir';
 return selected.every(r=>Number(r.reps)>=p.max)?'max':'middle';
}
function advancedProgressionSuggestions(w,records,history=[]){
 return w.items.flatMap((item,index)=>{
  const p=item.progression;
  if(!p||p.scheme!=='double'||p.criterion==='off')return[];
  const status=doubleProgressionStatus(item,records.filter(r=>r.item===index));
  if(!status||status==='max')return[]; // Regra existente sugere incremento quando todas as metas foram cumpridas.
  const name=exercise(item.exercise)?.name||'Exercício';
  if(status==='middle')return[name+': mantenha a carga e tente progredir as repetições dentro de '+p.min+'–'+p.max+'.'];
  if(status==='rir')return[name+': mantenha a carga até atingir a margem de repetições em reserva (RIR) prescrita.'];
  let consecutive=1;
  const prior=(Array.isArray(history)?history:[]).filter(s=>s.workout===w.id&&s.student===w.student&&Array.isArray(s.records))
    .slice().sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
  for(const session of prior){
   if(doubleProgressionStatus(item,session.records.filter(r=>r.item===index))!=='below')break;
   consecutive++;
  }
  const threshold=p.deloadAfter??3,percent=p.deloadPercent??10;
  return consecutive>=threshold?
   [name+': '+consecutive+' sessões consecutivas abaixo de '+p.min+' repetições. Considere deload de '+percent+'% após revisão do personal.']:
   [name+': abaixo da faixa de '+p.min+'–'+p.max+' repetições ('+consecutive+'/'+threshold+' sessões). Mantenha a carga e revise a recuperação.'];
 });
}

function addItem(){const i={exercise:document.getElementById('exercisePick').value,sets:3,reps:'10–12',load:null,rest:60,unit:'kg total'};i.setPlan=legacySeries(i).map(s=>({...s,mode:'percent',percent:100,reference:'base'}));editor.items.push(i);renderItems();}
function showSession(id){const s=db.sessions.find(s=>s.id===id);if(!s)return;openModal('Registro da sessão','<h3>'+esc(s.title)+'</h3><p>'+date(s.date)+'</p>'+s.records.map(r=>'<div class="exrow"><strong>'+esc(r.name)+' · '+r.set+' · '+esc(SERIES_TYPES[r.type||'trabalho'])+'</strong><p>Carga realizada: '+(r.load??'não definida')+' '+esc(r.unit||'kg total')+' · '+esc(r.reps)+' repetições / tempo'+(r.rir==null?'':' · RIR '+r.rir)+'</p>'+(r.plannedReps?'<small>Meta: '+esc(r.plannedReps)+' · carga planejada: '+(r.plannedLoad??'não definida')+'</small>':'')+'</div>').join('')+(s.suggestions?.length?'<h3>Sugestões para revisão do personal</h3>'+s.suggestions.map(t=>'<p>'+esc(t)+'</p>').join(''):'')+'<p>'+esc(s.feedback||'')+'</p>',true);}
