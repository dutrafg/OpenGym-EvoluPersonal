/* Etapa 4 — implementação própria. Referência OpenGym 8fb98b1:
   import-csv.js (CSV por cabeçalhos), muscles.js e muscle-targets.js. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(!root.document)return;root.EPImportAnalysis=api;
 let staged=null,revision=0;
 const studentOptions=()=>db.students.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join('');
 root.epImportHistory=function(){
  staged=null;revision++;
  if(!db.students.length)return toast('Cadastre o aluno de destino primeiro.');
  openModal('Importar histórico CSV','<p>CSV com data, exercício e repetições ou duração. Cabeçalhos do EvoluPersonal, Strong e Hevy são reconhecidos. Datas em formato ISO (AAAA-MM-DD), cargas em kg e duração em segundos. Máximo: 2 MB e 5.000 séries.</p><p>O arquivo inteiro será conferido antes de adicionar sessões. Alunos, rotinas e registros atuais são preservados.</p><label>Arquivo CSV<input type="file" id="epHistoryFile" accept=".csv,text/csv"></label><div id="epHistoryPreview" role="status" class="space"></div>',true);
  document.getElementById('epHistoryFile').onchange=async event=>{
   staged=null;const token=++revision,file=event.target.files[0],box=document.getElementById('epHistoryPreview');if(!file)return;
   try{
    if(file.size>2_000_000)throw Error('O arquivo excede 2 MB.');
    const text=await file.text();if(token!==revision||!box.isConnected)return;
    const parsed=api.parseHistory(text),known=new Map(catalog.map(e=>[e.id,e])),names=[...new Set(parsed.rows.map(r=>r.exerciseName))];
    if(names.length>100)throw Error('Importe lotes com até 100 exercícios distintos para revisar as associações.');
    const mapping=Object.create(null);for(const name of names){const rows=parsed.rows.filter(r=>r.exerciseName===name),ids=[...new Set(rows.map(r=>r.exerciseId).filter(Boolean))];const exact=catalog.filter(e=>api.normalize(e.name)===api.normalize(name));if(ids.length===1&&known.has(ids[0]))mapping[name]=ids[0];else if(!ids.length&&exact.length===1)mapping[name]=exact[0].id;}
    staged={parsed,mapping};
    box.innerHTML='<strong>'+parsed.rows.length+' série(s) · '+names.length+' exercício(s)</strong><p>Confira as associações e escolha o aluno. Nomes sem correspondência precisam de seleção manual.</p><label>Aluno de destino<select id="epHistoryStudent">'+studentOptions()+'</select></label><div class="notice">Cada linha deve representar uma série. Unidades são preservadas quando declaradas; na ausência de unidade, confirme a interpretação abaixo.</div><label>Unidade das linhas sem unidade<select id="epHistoryUnit">'+LOAD_UNITS.map(u=>'<option>'+esc(u)+'</option>').join('')+'</select></label>'+names.map((name,n)=>'<label class="space">'+esc(name)+'<select data-import-name="'+n+'"><option value="">Selecione o exercício correspondente</option>'+catalog.map(e=>'<option value="'+esc(e.id)+'" '+(mapping[name]===e.id?'selected':'')+'>'+esc(e.name)+'</option>').join('')+'</select></label>').join('')+'<div class="modalfoot"><button type="button" onclick="closeModal()">Cancelar</button><button class="primary" onclick="epConfirmHistoryImport()">Conferir e importar sessões</button></div>';
    staged.names=names;
   }catch(error){if(token!==revision)return;staged=null;if(box.isConnected)box.textContent=error.message;}
  };
 };
 root.epConfirmHistoryImport=function(){
  if(!staged)return;
  try{
   const sid=document.getElementById('epHistoryStudent')?.value,unit=document.getElementById('epHistoryUnit')?.value;
   if(!db.students.some(s=>s.id===sid))throw Error('Selecione um aluno válido.');
   const mapping=Object.fromEntries(staged.names.map((name,n)=>[name,document.querySelector('[data-import-name="'+n+'"]').value]));
   const result=api.mergeHistory(db,staged.parsed,mapping,sid,unit,uid);
   if(!validDB(result.data))throw Error('Há registros incompatíveis com o aplicativo. Nada foi importado.');
   if(!result.added)return toast('Nenhuma sessão nova: '+result.duplicates+' sessão(ões) já importada(s).');
   const old=db;db=result.data;if(!save()){db=old;return;}
   staged=null;closeModal();render();toast(result.added+' sessão(ões) importada(s); '+result.duplicates+' duplicada(s) ignorada(s).');
  }catch(error){toast(error.message);}
 };
 root.epMuscleAnalysis=function(){
  if(!db.students.length)return toast('Cadastre um aluno primeiro.');
  const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate()-(now.getDay()+6)%7),end=new Date(start);end.setDate(start.getDate()+6);
  const key=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  openModal('Séries por grupo muscular','<div class="fields"><label>Aluno<select id="epMuscleStudent" onchange="epUpdateMuscleAnalysis()">'+studentOptions()+'</select></label><label>De<input id="epMuscleFrom" type="date" value="'+key(start)+'" onchange="epUpdateMuscleAnalysis()"></label><label>Até<input id="epMuscleTo" type="date" value="'+key(end)+'" onchange="epUpdateMuscleAnalysis()"></label></div><div id="epMuscleResult" class="space" role="status"></div><p class="muted">Contagem pelo grupo cadastrado no catálogo. Uma série unilateral conta uma vez; blocos de drop/rest-pause não viram séries adicionais. Aquecimento, preparatórias e cardio ficam separados. Não estima participação de músculos secundários nem recomenda volume ideal.</p>',true);epUpdateMuscleAnalysis();
 };
 root.epUpdateMuscleAnalysis=function(){
  const box=document.getElementById('epMuscleResult');if(!box)return;
  try{
   const result=api.groupAnalysis(db,document.getElementById('epMuscleStudent').value,document.getElementById('epMuscleFrom').value,document.getElementById('epMuscleTo').value);
   box.innerHTML='<p><strong>'+result.working+' séries de trabalho</strong> em '+result.sessions+' sessão(ões).</p><div class="insight-scroll"><table class="insight-table"><thead><tr><th>Grupo cadastrado</th><th>Séries</th></tr></thead><tbody>'+Object.entries(result.groups).map(([group,count])=>'<tr><th scope="row">'+esc(group)+'</th><td>'+count+'</td></tr>').join('')+'</tbody></table></div><p class="muted">Aquecimento/preparatórias: '+result.preparatory+' · Cardio: '+result.cardio+' · Sem grupo identificado: '+result.unknown+'</p>';
  }catch(error){box.textContent=error.message;}
 };
 const panel=()=>'<section class="card section"><h2>Histórico e distribuição muscular</h2><div class="row wrap"><button onclick="epImportHistory()">Importar histórico CSV</button><button onclick="epMuscleAnalysis()">Séries por grupo muscular</button></div></section>';
 const priorInsights=root.insightsView;root.insightsView=()=>panel()+priorInsights();
 const priorSettings=root.settings;root.settings=()=>priorSettings()+panel();
 render();
})(typeof globalThis==='undefined'?this:globalThis,function(){
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 function csv(text){
  if(typeof text!=='string'||text.length>2_000_000)throw Error('CSV inválido ou maior que 2 MB.');
  text=text.replace(/^\uFEFF/,'');const head=text.split(/[\r\n]/,1)[0].replace(/"(?:[^"]|"")*"/g,'');const sep=(head.match(/;/g)||[]).length>(head.match(/,/g)||[]).length?';':',';
  const rows=[];let row=[],field='',quoted=false,closed=false;
  const finish=()=>{row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';closed=false;if(rows.length>5001)throw Error('Limite de 5.000 séries por arquivo.');};
  for(let n=0;n<text.length;n++){
   const c=text[n];if(quoted){if(c==='"'){if(text[n+1]==='"'){field+='"';n++;}else{quoted=false;closed=true;}}else field+=c;continue;}
   if(c==='"'){if(field||closed)throw Error('Aspas fora de posição no CSV.');quoted=true;}
   else if(c===sep){row.push(field);field='';closed=false;}
   else if(c==='\r'||c==='\n'){if(c==='\r'&&text[n+1]==='\n')n++;finish();}
   else{if(closed)throw Error('Texto após fechamento de aspas no CSV.');field+=c;}
  }
  if(quoted)throw Error('Campo com aspas não fechado.');finish();
  if(rows.length<2)throw Error('O CSV precisa de cabeçalho e ao menos uma série.');
  if(rows.some(r=>r.length!==rows[0].length))throw Error('Há linhas com número incorreto de colunas.');return rows;
 }
 const aliases={sourceStudent:['aluno','student','student id'],date:['data','date','start time','workout date'],exerciseName:['exercicio','exercise name','exercise title','exercise'],exerciseId:['id do exercicio','exercise id'],title:['treino','workout name','title'],load:['carga kg','weight kg','weight'],reps:['repeticoes','reps','repetitions'],seconds:['duracao s','duration seconds','seconds'],distance:['distancia km','distance km'],mode:['modo','mode'],unit:['unidade','unit','weight unit'],type:['tipo de serie','set type'],session:['id da sessao','session id'],blocks:['blocos adicionais']};
 function number(value,max,integer=false,optional=true){
  const s=String(value??'').trim();if(!s&&optional)return null;
  if(!/^\d+(?:[.,]\d+)?$/.test(s))throw Error('Valor numérico inválido: '+s.slice(0,40));
  const n=Number(s.replace(',','.'));if(!Number.isFinite(n)||n>max||integer&&!Number.isInteger(n))throw Error('Valor fora do limite: '+s.slice(0,40));return n;
 }
 function dateISO(value){
  const s=value.trim(),m=/^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(s);
  if(!m)throw Error('Use datas ISO: AAAA-MM-DD ou AAAA-MM-DDTHH:mm:ss.');
  const time=/[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);if(time&&(+time[1]>23||+time[2]>59||+(time[3]||0)>59))throw Error('Horário inválido.');
  const calendar=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));if(calendar.getUTCFullYear()!==+m[1]||calendar.getUTCMonth()!==+m[2]-1||calendar.getUTCDate()!==+m[3])throw Error('Data inexistente.');
  const stamp=new Date(s.length===10?s+'T00:00:00':s.replace(' ','T'));if(!Number.isFinite(stamp.getTime()))throw Error('Data inválida.');return stamp.toISOString();
 }
 function parseHistory(text){
  const table=csv(text),headers=table.shift().map(normalize),columns={};
  for(const [key,names] of Object.entries(aliases)){const matches=headers.flatMap((h,i)=>names.includes(h)?[i]:[]);if(matches.length>1)throw Error('Há colunas ambíguas para '+key+'.');if(matches.length)columns[key]=matches[0];}
  if(columns.date===undefined||columns.exerciseName===undefined||columns.reps===undefined&&columns.seconds===undefined)throw Error('Cabeçalhos necessários: data, exercício e repetições ou duração em segundos.');
  const rows=table.map((row,index)=>{
   const get=k=>columns[k]===undefined?'':row[columns[k]].trim();
   try{
    const exerciseName=get('exerciseName');if(!exerciseName||exerciseName.length>250)throw Error('Nome de exercício ausente ou longo demais.');
    const seconds=number(get('seconds'),86400,true),distance=number(get('distance'),1000),reps=number(get('reps'),500,true),load=number(get('load'),2000);
    let mode=get('mode')||((seconds??0)>0?(distance??0)>0?'cardio':'timed':'reps');if(!['reps','timed','cardio'].includes(mode))throw Error('Modo inválido.');
    if(mode==='reps'&&!(reps>0)||mode!=='reps'&&!(seconds>0))throw Error('Informe repetições ou duração realizadas maiores que zero.');
    const rawType=normalize(get('type')),type=({'warmup':'aquecimento','warm up':'aquecimento','normal':'trabalho','failure':'trabalho','drop':'drop','restpause':'restpause','aquecimento':'aquecimento','feeder':'feeder','trabalho':'trabalho','principal':'principal','backoff':'backoff','back off':'backoff'})[rawType]||(rawType?null:'trabalho');if(!type)throw Error('Tipo de série não reconhecido.');
    let blocks=[];if(get('blocks')){try{blocks=JSON.parse(get('blocks'));}catch{throw Error('Blocos adicionais inválidos.');}if(!Array.isArray(blocks)||blocks.length>5||blocks.some(b=>!b||typeof b.load!=='number'||!Number.isFinite(b.load)||b.load<0||b.load>2000||!Number.isInteger(b.reps)||b.reps<1||b.reps>500))throw Error('Blocos adicionais fora dos limites.');blocks=blocks.map(b=>({load:b.load,reps:b.reps}));}
    const title=get('title')||'Treino importado';if(title.length>100)throw Error('Título maior que 100 caracteres.');
    return {sourceStudent:get('sourceStudent'),date:dateISO(get('date')),exerciseName,exerciseId:get('exerciseId'),title,load,reps,seconds,distance,mode,type,unit:get('unit'),session:get('session'),blocks};
   }catch(error){throw Error('Linha '+(index+2)+': '+error.message);}
  });if(new Set(rows.map(r=>r.sourceStudent).filter(Boolean)).size>1)throw Error('O arquivo contém vários alunos. Exporte um aluno por arquivo para evitar misturar os históricos.');return {rows};
 }
 const units=['kg total','kg por halter','kg por lado','placas da máquina','peso corporal'];
 function mergeHistory(data,parsed,mapping,sid,defaultUnit,uid){
  if(!data.students.some(s=>s.id===sid)||!units.includes(defaultUnit))throw Error('Aluno ou unidade inválidos.');
  const known=new Map(data.exercises.map(e=>[e.id,e])),groups=new Map();
  for(const row of parsed.rows){
   const exercise=mapping[row.exerciseName];if(!known.has(exercise))throw Error('Selecione o exercício correspondente a '+row.exerciseName+'.');
   const unit=row.unit==='kg'?'kg total':row.unit||defaultUnit;if(!units.includes(unit))throw Error('Unidade não suportada: '+row.unit+'. Converta o arquivo para kg ou unidades do EvoluPersonal.');
   const key=JSON.stringify([row.date,row.title,row.session]);if(!groups.has(key))groups.set(key,{date:row.date,title:row.title,sourceSession:row.session,records:[],exercises:[]});
   const group=groups.get(key);if(!group.exercises.includes(exercise))group.exercises.push(exercise);const item=group.exercises.indexOf(exercise);
   group.records.push({exercise,name:known.get(exercise).name,item,set:group.records.filter(r=>r.item===item).length+1,load:row.load,reps:row.mode==='reps'?String(row.reps):row.seconds+' s'+(row.mode==='cardio'?' · '+(row.distance||0)+' km':''),rest:0,done:true,unit,type:row.type,executionMode:row.mode,...(row.mode==='reps'?{}:{durationSeconds:row.seconds,distanceKm:row.distance??0}),...(row.blocks.length?{blocks:row.blocks}:{})});
  }
  const next=structuredClone(data),seen=new Set(next.sessions.filter(s=>s.student===sid&&s.importSignature).map(s=>s.importSignature)),ids=new Set(next.sessions.map(s=>s.id));let added=0,duplicates=0;
  for(const group of groups.values()){
   const signature=JSON.stringify([group.date,group.title,group.sourceSession,group.records.map(({name,...record})=>record)]);if(seen.has(signature)){duplicates++;continue;}
   const id=uid();if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(id)||['__proto__','constructor','prototype'].includes(id)||ids.has(id))throw Error('Não foi possível gerar identificador novo.');
   next.sessions.push({id,student:sid,title:group.title,date:group.date,effort:'',feedback:'Importado de CSV',records:group.records,importSignature:signature});ids.add(id);seen.add(signature);added++;
  }return {data:next,added,duplicates};
 }
 function groupAnalysis(data,sid,from,to){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw Error('Selecione um intervalo de datas válido.');dateISO(from);dateISO(to);
  const begin=new Date(from+'T00:00:00'),end=new Date(to+'T00:00:00');end.setDate(end.getDate()+1);
  const groups=Object.fromEntries(['Peito','Costas','Pernas','Ombros','Braços','Core'].map(g=>[g,0])),known=new Map(data.exercises.map(e=>[e.id,e])),result={groups,working:0,preparatory:0,cardio:0,unknown:0,sessions:0};
  for(const s of data.sessions){const date=new Date(s.date);if(s.student!==sid||date<begin||date>=end||!Number.isFinite(+date))continue;result.sessions++;
   for(const r of s.records){if(!r.done)continue;if(['aquecimento','feeder'].includes(r.type)){result.preparatory++;continue;}const mode=r.executionMode||data.workouts?.find(w=>w.id===s.workout)?.items?.[r.item]?.executionMode;if(mode==='cardio'){result.cardio++;continue;}
    const group=known.get(r.exercise)?.group;if(!Object.hasOwn(groups,group)){result.unknown++;continue;}groups[group]++;result.working++;
   }
  }return result;
 }
 return {normalize,csv,dateISO,parseHistory,mergeHistory,groupAnalysis};
});
