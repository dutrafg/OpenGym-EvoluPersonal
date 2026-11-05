/* EvoluPersonal — indicadores locais de treino, implementação independente.
   Nenhuma imagem, animação ou trecho de código do openGym é utilizado aqui.
   API pura: analisa somente as sessões já persistidas no EvoluPersonal (v2). */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.EvoluInsights=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function number(x){return typeof x==='number'&&Number.isFinite(x)?x:null}
  function actualReps(value){
    if(typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=500)return value;
    if(typeof value==='string'&&/^\s*\d{1,3}\s*$/.test(value)){const n=Number(value.trim());return n<=500?n:null}
    return null; // Não transformar metas como "8-12" em execuções efetivas.
  }
  function estimated1RM(weight,reps){
    const load=number(weight),n=actualReps(reps);
    if(load===null||load<=0||n===null||n<1||n>12)return null;
    return Math.round(load*(1+n/30)*10)/10;
  }
  function normalizeSession(s){
    const stamp=Date.parse(s?.date);
    if(!s||!Number.isFinite(stamp)||!Array.isArray(s.records))return null;
    return {id:String(s.id||''),student:String(s.student||''),title:String(s.title||'Treino'),workout:s.workout,date:s.date,timestamp:stamp,records:s.records};
  }
  function completedRows(db,studentId){
    const sessions=(Array.isArray(db?.sessions)?db.sessions:[]).map(normalizeSession).filter(Boolean)
      .filter(s=>studentId==='all'||!studentId||s.student===studentId)
      .sort((a,b)=>a.timestamp-b.timestamp||a.id.localeCompare(b.id));
    const rows=[];
    for(const session of sessions)for(const record of session.records){
      if(!record||record.done!==true)continue;
      const item = db.workouts?.find(w => w.id === session.workout)?.items?.[record.item];
      const mode = record.executionMode || item?.executionMode || 'reps';
      const strength = mode === 'reps';
      if (['aquecimento', 'feeder'].includes(record.type)) continue;
      const sideReps = Number(record.left) > 0 && Number(record.right) > 0 ? Number(record.left) + Number(record.right) : null;
      const reps = strength ? sideReps ?? actualReps(record.reps) : null, load=strength?number(record.load):(number(record.load)??0);
      if(load===null||load<0||load>2000)continue;
      const blockVolume = strength ? (record.blocks || []).reduce((total, b) => total + (number(b?.load) || 0) * (actualReps(b?.reps) || 0), 0) : 0;
      const volume = reps === null ? 0 : Math.round((load * reps + blockVolume) * 100) / 100;
      rows.push({
        session:session.id,student:session.student,title:session.title,date:session.date,
        timestamp:session.timestamp,exercise:String(record.exercise||''),
        name:String(record.name||'Exercício'),set:record.set,load,reps,
        volume,estimated1RM:strength && !['drop','restpause'].includes(record.type) && sideReps === null ? estimated1RM(load,reps) : null,
        executionMode:mode,durationSeconds:number(record.durationSeconds),distanceKm:number(record.distanceKm),
        blocks:record.blocks || [],
        unit:String(record.unit||'kg total'),type:String(record.type||'trabalho')
      });
    }
    return {sessions,rows};
  }
  function mondayUTC(timestamp){
    const d=new Date(timestamp),day=d.getUTCDay();
    return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-(day+6)%7)).toISOString().slice(0,10);
  }
  function aggregate(db,studentId='all',now=Date.now()){
    const {sessions,rows}=completedRows(db,studentId);
    const exerciseMap=new Map(),history=new Map();
    let totalVolume=0,personalRecords=0,loggedSets=0;
    for(const row of rows){
      totalVolume+=row.volume;
      loggedSets++;
      const key=row.exercise||row.name;
      let item=exerciseMap.get(key);
      if(!item){item={id:key,name:row.name,sets:0,volume:0,bestLoad:0,best1RM:null,personalRecords:0,lastDate:null};exerciseMap.set(key,item)}
      item.sets++;item.volume+=row.volume;item.bestLoad=Math.max(item.bestLoad,row.load);
      item.lastDate=row.date;
      if(row.estimated1RM!==null){
        const prev=history.get(key);
        if(prev===undefined||row.estimated1RM>prev){
          history.set(key,row.estimated1RM);
          item.personalRecords++;personalRecords++;
        }
        item.best1RM=Math.max(item.best1RM||0,row.estimated1RM);
      }
    }
    const anchor=Number.isFinite(Number(now))?Number(now):Date.now();
    const currentMonday=Date.parse(mondayUTC(anchor)+'T00:00:00Z');
    const weeks=Array.from({length:8},(_,i)=>{
      const d=new Date(currentMonday-(7-i)*7*86400000);
      return {start:d.toISOString().slice(0,10),sessions:0,volume:0,sets:0};
    });
    const byWeek=new Map(weeks.map(w=>[w.start,w]));
    for(const s of sessions){const bucket=byWeek.get(mondayUTC(s.timestamp));if(bucket)bucket.sessions++}
    for(const row of rows){const bucket=byWeek.get(mondayUTC(row.timestamp));if(bucket){bucket.volume+=row.volume;bucket.sets++}}
    for(const w of weeks)w.volume=Math.round(w.volume*100)/100;
    const exercises=[...exerciseMap.values()].map(e=>({...e,volume:Math.round(e.volume*100)/100}))
      .sort((a,b)=>b.volume-a.volume||a.name.localeCompare(b.name,'pt-BR'));
    return {
      studentId,sessions:sessions.length,loggedSets,
      totalVolume:Math.round(totalVolume*100)/100,personalRecords,
      exercises,weeks,rows,
      latestSessions:sessions.slice().reverse().slice(0,8)
    };
  }
  function csvSafe(value){
    let v=String(value===null||value===undefined?'':value).replace(/\r\n?/g,'\n');
    // Impede execução de fórmulas no Excel/Calc com dados fornecidos por usuários.
    if(/^[\s\u0000-\u001f]*[=+\-@\t]/.test(v))v="'"+v;
    return '"'+v.replace(/"/g,'""')+'"';
  }
  function exportCSV(data){
    const headers=['Data','Aluno','Treino','Exercício','Série','Carga (kg)','Repetições','Volume (kg)','1RM estimada (kg)','Modo','Duração (s)','Distância (km)','Blocos adicionais'];
    const rows=(data.rows||[]).map(r=>[
      r.date,r.student,r.title,r.name,r.set,r.load,r.reps===null?'':r.reps,r.volume,r.estimated1RM===null?'':r.estimated1RM,r.executionMode,r.durationSeconds,r.distanceKm,JSON.stringify(r.blocks)
    ]);
    return '\uFEFF'+[headers,...rows].map(row=>row.map(csvSafe).join(';')).join('\r\n');
  }
  return Object.freeze({actualReps,estimated1RM,completedRows,aggregate,exportCSV,mondayUTC});
});
