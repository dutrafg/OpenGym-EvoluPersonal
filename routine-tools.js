/* EvoluPersonal — etapa 3. Implementação própria. Referência OpenGym
   8fb98b16861a2728652302a7e6e30c50548493a0: favourites.js, plates.js, plan-share.js. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root.document)return;
  root.EPRoutines=api;
  const format=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(n);
  function preferences(){return {favorites:db.favorites||[],equipment:db.equipment||api.defaultEquipment()};}
  function commit(change){
    const previous=db,next=structuredClone(db);
    try{change(next);if(!validDB(next))throw Error('Revise os valores informados.');db=next;if(!save()){db=previous;return false;}return true;}
    catch(error){db=previous;toast(error.message);return false;}
  }
  const priorValid=root.validDB;
  root.validDB=data=>priorValid(data)&&api.validPreferences(data);
  root.epFavorite=id=>preferences().favorites.includes(id);
  root.epFavoriteOrder=list=>api.orderFavorites(list,preferences().favorites);
  root.epToggleFavorite=function(id){
    if(!catalog.some(e=>e.id===id))return;
    if(!commit(next=>{const list=next.favorites||[];next.favorites=list.includes(id)?list.filter(x=>x!==id):[...list,id];}))return;
    mdLibraryPage=0;if(page==='book')mdLibraryRefresh();
    if(document.getElementById('epFavoriteButton')){const b=document.getElementById('epFavoriteButton');b.textContent=epFavorite(id)?'★ Favorito':'☆ Favoritar';b.setAttribute('aria-pressed',String(epFavorite(id)));}
    toast(epFavorite(id)?'Exercício adicionado aos favoritos.':'Exercício removido dos favoritos.');
  };
  const priorMotion=root.showMotion;
  root.showMotion=function(id){priorMotion(id);if(!catalog.some(e=>e.id===id))return;document.getElementById('modalBody')?.insertAdjacentHTML('beforeend','<div class="modalfoot"><button id="epFavoriteButton" aria-pressed="'+epFavorite(id)+'" onclick="epToggleFavorite(\''+esc(id)+'\')">'+(epFavorite(id)?'★ Favorito':'☆ Favoritar')+'</button></div>');};
  root.epEquipment=function(){
    const equipment=preferences().equipment;
    openModal('Equipamentos e anilhas','<form id="epEquipmentForm"><p>Cadastre o peso da barra e o número de pares de cada anilha disponível. Valores em kg.</p><label>Peso da barra (kg)<input name="bar" type="number" min="0" max="100" step="0.25" required value="'+equipment.bar+'"></label><div class="fields">'+api.sizes.map(w=>'<label>'+format(w)+' kg · pares<input name="p'+w+'" type="number" min="0" max="20" step="1" required value="'+(equipment.plates.find(p=>p.weight===w)?.pairs||0)+'"></label>').join('')+'</div><div class="modalfoot"><button type="button" onclick="epPlateCalculator()">Calculadora</button><button class="primary">Salvar equipamentos</button></div></form>',true);
    document.getElementById('epEquipmentForm').onsubmit=e=>{
      e.preventDefault();const f=e.currentTarget.elements;
      const item={bar:Number(f.bar.value),plates:api.sizes.map(weight=>({weight,pairs:Number(f.namedItem('p'+weight).value)}))};
      if(!commit(next=>{next.equipment=item;}))return;closeModal();render();toast('Equipamentos salvos.');
    };
  };
  root.epPlateCalculator=function(value=''){
    const equipment=preferences().equipment;
    openModal('Montagem de anilhas','<p>Informe a carga total incluindo a barra. A montagem é simétrica e respeita o estoque salvo em <button type="button" onclick="epEquipment()">Equipamentos</button>.</p><label>Carga total desejada (kg)<input id="epPlateTarget" type="number" min="0" max="2000" step="0.25" value="'+esc(value)+'" oninput="epCalculatePlates()"></label><div id="epPlateResult" class="notice" role="status" aria-live="polite"></div><small>Barra: '+format(equipment.bar)+' kg. O resultado é uma sugestão de montagem; não altera a prescrição nem a carga registrada.</small>');epCalculatePlates();
  };
  root.epCalculatePlates=function(){
    const box=document.getElementById('epPlateResult'),input=document.getElementById('epPlateTarget');if(!box||!input)return;
    if(input.value===''){box.textContent='Informe uma carga para calcular.';return;}
    try{const r=api.plateLoad(Number(input.value),preferences().equipment);box.textContent=r.belowBar?'A carga desejada é menor que o peso da barra.':r.exact?'Por lado: '+(r.plates.map(format).join(' + ')||'somente a barra')+' kg. Total: '+format(r.actual)+' kg.':'Montagem possível abaixo da meta: '+format(r.actual)+' kg. Por lado: '+(r.plates.map(format).join(' + ')||'somente a barra')+' kg. Faltam '+format(r.missing)+' kg no total.';}catch(e){box.textContent=e.message;}
  };
  function download(bundle){
    const blob=new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='EvoluPersonal_Rotinas.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  root.epShareRoutines=function(){
    if(!db.workouts.length)return toast('Cadastre uma rotina antes de compartilhar.');
    openModal('Compartilhar rotinas','<form id="epShareForm"><p>Escolha as rotinas para exportar. O arquivo contém a prescrição e as orientações do treino. Revise as orientações antes de enviar.</p><p class="muted">Não inclui alunos, contatos, avaliações, sessões, favoritos ou equipamentos.</p>'+db.workouts.map(w=>'<label class="row"><input style="width:auto" type="checkbox" name="routine" value="'+esc(w.id)+'">'+esc(w.title)+' · '+esc(student(w.student)?.name||'')+'</label>').join('')+'<div class="modalfoot"><button type="button" onclick="closeModal()">Cancelar</button><button class="primary">Exportar arquivo</button></div></form>',true);
    document.getElementById('epShareForm').onsubmit=e=>{e.preventDefault();try{const ids=new FormData(e.currentTarget).getAll('routine');download(api.exportBundle(db,ids));closeModal();toast('Arquivo de rotinas exportado.');}catch(err){toast(err.message);}};
  };
  let pendingImport=null,importRevision=0;
  root.epImportRoutines=function(){
    pendingImport=null;importRevision++;
    if(!db.students.length)return toast('Cadastre o aluno que receberá as rotinas.');
    openModal('Importar rotinas','<p>Selecione um arquivo de rotinas EvoluPersonal (até 1 MB). As rotinas serão adicionadas como cópias para o aluno escolhido.</p><label>Arquivo JSON<input id="epRoutineFile" type="file" accept="application/json,.json"></label><div id="epRoutinePreview" class="space" role="status"></div>');
    document.getElementById('epRoutineFile').onchange=async e=>{
      pendingImport=null;const revision=++importRevision,file=e.target.files[0];if(!file)return;
      const preview=document.getElementById('epRoutinePreview');
      try{
        if(file.size>1_000_000)throw Error('O arquivo excede 1 MB.');
        const text=await file.text();if(!preview.isConnected||revision!==importRevision)return;
        const bundle=api.parseBundle(text,new Set(catalog.map(e=>e.id)));pendingImport=bundle;
        preview.innerHTML='<strong>'+bundle.routines.length+' rotina(s)</strong><ul>'+bundle.routines.map(w=>'<li>'+esc(w.title)+' · '+w.items.length+' exercício(s)</li>').join('')+'</ul><label>Aluno de destino<select id="epRoutineStudent">'+db.students.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join('')+'</select></label><button class="primary space" onclick="epConfirmRoutineImport()">Adicionar cópias ao aluno</button>';
      }catch(error){if(revision!==importRevision)return;pendingImport=null;if(preview.isConnected)preview.textContent=error.message;}
    };
  };
  root.epConfirmRoutineImport=function(){
    if(!pendingImport)return;const sid=document.getElementById('epRoutineStudent')?.value;
    if(!db.students.some(s=>s.id===sid))return toast('Selecione um aluno válido.');
    const bundle=pendingImport;
    if(!commit(next=>{const imported=api.importBundle(next,bundle,sid,uid);next.workouts=imported.workouts;}))return;
    pendingImport=null;closeModal();render();toast(bundle.routines.length+' rotina(s) adicionada(s) como cópias.');
  };
  function actions(){return '<section class="card section"><h2>Rotinas e equipamentos</h2><div class="row wrap"><button onclick="epShareRoutines()">Compartilhar rotinas</button><button onclick="epImportRoutines()">Importar rotinas</button><button onclick="epEquipment()">Equipamentos</button><button onclick="epPlateCalculator()">Montagem de anilhas</button></div></section>';}
  const priorTrains=root.trains;root.trains=()=>actions()+priorTrains();
  const priorSettings=root.settings;root.settings=()=>priorSettings()+actions();
  const priorRenderItems=root.renderItems;
  root.renderItems=function(){priorRenderItems();document.querySelectorAll('#editorItems > .exrow').forEach((box,n)=>{const item=editor?.items[n];if(item&&(!item.unit||item.unit==='kg total')&&(!item.executionMode||item.executionMode==='reps'))box.insertAdjacentHTML('beforeend','<button type="button" class="space" onclick="epPlateCalculator('+(item.load??'')+')">Montar anilhas para esta carga</button>');});};
  render();
})(typeof globalThis==='undefined'?this:globalThis,function(){
  const sizes=[25,20,15,10,5,2.5,2,1.5,1.25,1,0.5];
  const defaultEquipment=()=>({bar:20,plates:sizes.map(weight=>({weight,pairs:[2,1.5,1,0.5].includes(weight)?0:6}))});
  const bounded=(n,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max;
  function validEquipment(e){return !!e&&bounded(e.bar,100)&&Number.isInteger(e.bar*4)&&Array.isArray(e.plates)&&e.plates.length<=sizes.length&&new Set(e.plates.map(p=>p?.weight)).size===e.plates.length&&e.plates.every(p=>p&&sizes.includes(p.weight)&&Number.isInteger(p.pairs)&&bounded(p.pairs,20));}
  function validPreferences(d){return (d.favorites===undefined||Array.isArray(d.favorites)&&d.favorites.length<=500&&new Set(d.favorites).size===d.favorites.length&&d.favorites.every(id=>typeof id==='string'&&/^md([1-9][0-9]{0,2})$/.test(id)&&Number(id.slice(2))<=500))&&(d.equipment===undefined||validEquipment(d.equipment));}
  function orderFavorites(list,ids=[]){const favorites=new Set(ids);return [...list.filter(e=>favorites.has(e.id)),...list.filter(e=>!favorites.has(e.id))];}
  function plateLoad(target,equipment){
    if(!bounded(target,2000)||!validEquipment(equipment))throw Error('Informe carga de 0 a 2000 kg e equipamentos válidos.');
    if(target<equipment.bar)return {belowBar:true,plates:[],actual:equipment.bar,missing:0,exact:false};
    // Bounded subset sum in quarter-kilograms, one side only. Prefer fewer plates.
    const limit=Math.floor((target-equipment.bar)*2+1e-8),states=new Map([[0,[]]]);
    for(const p of [...equipment.plates].sort((a,b)=>b.weight-a.weight)){
      const before=[...states.entries()];
      for(const [sum,stack] of before)for(let count=1;count<=p.pairs;count++){
        const next=sum+Math.round(p.weight*4)*count;if(next>limit)break;
        const candidate=[...stack,...Array(count).fill(p.weight)];
        if(!states.has(next)||states.get(next).length>candidate.length)states.set(next,candidate);
      }
    }
    const best=Math.max(...states.keys()),actual=equipment.bar+best/2,missing=Math.round((target-actual)*1000)/1000;
    return {belowBar:false,plates:states.get(best),actual,missing,exact:missing===0};
  }
  const itemKeys=['exercise','sets','reps','load','rest','unit','executionMode','sideMode','supersetNext','alternatives','setPlan','progression'];
  const seriesKeys=['type','mode','load','reps','rest','percent','reference','rir','drops','dropPercent','miniSets','miniRest'];
  const progressionKeys=['scheme','criterion','min','max','increment','deloadAfter','deloadPercent'];
  const pick=(value,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(value,k)).map(k=>[k,structuredClone(value[k])]));
  function cleanItem(item){
    if(!item||typeof item!=='object'||Array.isArray(item))throw Error('Exercício inválido.');
    const out=pick(item,itemKeys);
    if(item.setPlan!==undefined){if(!Array.isArray(item.setPlan)||item.setPlan.length>30)throw Error('Séries inválidas.');out.setPlan=item.setPlan.map(s=>{if(!s||typeof s!=='object')throw Error('Série inválida.');return pick(s,seriesKeys);});}
    if(item.progression!==undefined){if(!item.progression||typeof item.progression!=='object')throw Error('Progressão inválida.');out.progression=pick(item.progression,progressionKeys);}
    return out;
  }
  function exportBundle(data,ids){
    if(!Array.isArray(ids)||!ids.length||ids.length>100)throw Error('Escolha de 1 a 100 rotinas.');
    const selected=new Set(ids),routines=data.workouts.filter(w=>selected.has(w.id));
    if(routines.length!==selected.size)throw Error('Rotina não encontrada.');
    return {format:'evolupersonal-routines',version:1,routines:routines.map(w=>({title:w.title,notes:w.notes||'',items:w.items.map(cleanItem)}))};
  }
  function parseBundle(text,known){
    if(typeof text!=='string'||text.length>1_000_000)throw Error('Arquivo inválido ou maior que 1 MB.');
    let data;try{data=JSON.parse(text);}catch{throw Error('O arquivo não contém JSON válido.');}
    if(data?.format!=='evolupersonal-routines'||data.version!==1||!Array.isArray(data.routines)||!data.routines.length||data.routines.length>100)throw Error('Selecione um arquivo de rotinas EvoluPersonal versão 1.');
    const routines=data.routines.map(w=>{
      if(!w||typeof w.title!=='string'||!w.title.trim()||w.title.length>100||typeof w.notes!=='string'||w.notes.length>1500||!Array.isArray(w.items)||!w.items.length||w.items.length>100)throw Error('Rotina inválida: confira nome, orientações e exercícios.');
      const items=w.items.map(cleanItem);
      for(const i of items){
        if(!known.has(i.exercise)||!Number.isInteger(i.sets)||i.sets<1||i.sets>20||typeof i.reps!=='string'||!i.reps.trim()||i.reps.length>40||!(i.load===null||bounded(i.load,2000))||!Number.isInteger(i.rest)||!bounded(i.rest,3600))throw Error('Exercício desconhecido ou prescrição inválida.');
        if(i.alternatives!==undefined&&(!Array.isArray(i.alternatives)||i.alternatives.length>5||i.alternatives.some(id=>!known.has(id))))throw Error('Substituto inválido.');
        validatePrescription(i);
      }
      return {title:w.title.trim(),notes:w.notes,items};
    });
    return {format:data.format,version:1,routines};
  }
  function validatePrescription(i){
    const units=['kg total','kg por halter','kg por lado','placas da máquina','peso corporal'],types=['aquecimento','feeder','trabalho','principal','backoff','drop','restpause'];
    const work=s=>['trabalho','principal','drop','restpause'].includes(s.type),load=n=>n===null||bounded(n,2000);
    if(i.unit!==undefined&&!units.includes(i.unit)||i.executionMode!==undefined&&!['reps','timed','cardio'].includes(i.executionMode)||i.sideMode!==undefined&&!['together','separate'].includes(i.sideMode)||i.supersetNext!==undefined&&typeof i.supersetNext!=='boolean')throw Error('Unidade ou modo de execução inválido.');
    if(i.alternatives&&(new Set(i.alternatives).size!==i.alternatives.length||i.alternatives.includes(i.exercise)))throw Error('Substitutos repetidos ou iguais ao exercício original.');
    if(i.setPlan!==undefined){
      if(!i.setPlan.length||i.setPlan.filter(work).length!==i.sets)throw Error('O plano de séries não corresponde ao número de séries de trabalho.');
      i.setPlan.forEach((s,n)=>{
        const valid=types.includes(s.type)&&['fixed','percent'].includes(s.mode)&&load(s.load)&&typeof s.reps==='string'&&s.reps.trim()&&s.reps.length<=40&&Number.isInteger(s.rest)&&bounded(s.rest,3600)&&(s.rir===null||Number.isInteger(s.rir)&&bounded(s.rir,10))&&typeof s.percent==='number'&&s.percent>0&&s.percent<=100&&(s.reference==='base'||Number.isInteger(s.reference)&&s.reference>=0&&s.reference<n&&work(i.setPlan[s.reference]))&&(s.type!=='backoff'||s.mode==='percent'&&Number.isInteger(s.reference));
        if(!valid)throw Error('Prescrição de série inválida.');
        for(const [key,min,max] of [['drops',1,5],['dropPercent',5,80],['miniSets',1,5],['miniRest',5,120]])if(s[key]!==undefined&&(!Number.isInteger(s[key])||s[key]<min||s[key]>max))throw Error('Parâmetros da técnica avançada inválidos.');
      });
    }
    if(i.progression!==undefined){const p=i.progression;if(!['off','all','principal'].includes(p.criterion)||p.scheme!==undefined&&!['linear','double'].includes(p.scheme)||!Number.isInteger(p.min)||!Number.isInteger(p.max)||p.min<1||p.max<p.min||p.max>100||!bounded(p.increment,100)||p.increment===0||p.deloadAfter!==undefined&&(!Number.isInteger(p.deloadAfter)||p.deloadAfter<2||p.deloadAfter>6)||p.deloadPercent!==undefined&&(!bounded(p.deloadPercent,30)||p.deloadPercent<5))throw Error('Progressão inválida.');}
    return true;
  }
  function importBundle(data,bundle,sid,uid){
    if(!data.students.some(s=>s.id===sid))throw Error('Aluno de destino inválido.');
    const clean=parseBundle(JSON.stringify(bundle),new Set(data.exercises.map(e=>e.id))),next=structuredClone(data),ids=new Set(next.workouts.map(w=>w.id));
    for(const w of clean.routines){const id=uid();if(typeof id!=='string'||!id||ids.has(id))throw Error('Não foi possível gerar um identificador novo.');ids.add(id);next.workouts.push({...w,id,student:sid});}
    return next;
  }
  return {sizes,defaultEquipment,validEquipment,validPreferences,orderFavorites,plateLoad,exportBundle,parseBundle,importBundle,validatePrescription};
});
