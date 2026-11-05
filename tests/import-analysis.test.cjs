const {test}=require('node:test');const assert=require('node:assert/strict');const api=require('../import-analysis.js');
const base=()=>({students:[{id:'s1'},{id:'s2'}],exercises:[{id:'md1',name:'Supino',group:'Peito'},{id:'md2',name:'Remada',group:'Costas'}],sessions:[],workouts:[{id:'existente'}]});
const text='Data;Exercício;Treino;Carga (kg);Repetições;Unidade\n2026-11-05;Supino;Treino A;20,5;10;kg total\n2026-11-05;Supino;Treino A;20;8;kg total';
test('CSV: BOM, CRLF, separador, vírgula decimal, aspas e quebra de linha',()=>{
 assert.equal(api.parseHistory('\uFEFF'+text.replaceAll('\n','\r\n')).rows[0].load,20.5);
 assert.deepEqual(api.csv('a,b\r\n"nome, com vírgula","duas\nlinhas e ""aspas"""'),[['a','b'],['nome, com vírgula','duas\nlinhas e "aspas"']]);
 for(const broken of ['a,b\n"ab,b','a,b\na"b,c','a,b\n"ab"x,c','a,b\nx'])assert.throws(()=>api.csv(broken));
});
test('não adivinha datas, rejeita datas inexistentes, metas e números incorretos',()=>{
 for(const date of ['05/11/2026','2026-02-30','2026-13-01'])assert.throws(()=>api.dateISO(date));
 for(const invalid of [text.replace('20,5','-2'),text.replace(';10;',';8–12;'),text.replace(';10;',';501;'),text.replace('2026-11-05','2026-02-30')])assert.throws(()=>api.parseHistory(invalid));
 assert.throws(()=>api.csv('a'.repeat(2000001)));
 assert.throws(()=>api.dateISO('2026-11-05T24:00:00'));
 assert.throws(()=>api.csv('a,b\n'+'x,y\n'.repeat(5001)));
 assert.throws(()=>api.parseHistory('Data;Aluno;Exercício;Repetições\n2026-11-05;s1;Supino;10\n2026-11-05;s2;Supino;10'));
});
test('cabeçalhos Strong e Hevy, duração e tipo aquecimento',()=>{
 const strong=api.parseHistory('Date,Exercise Name,Workout Name,Weight,Reps,Seconds\n2026-11-05,Supino,Treino,20,10,');assert.equal(strong.rows[0].mode,'reps');
 const hevy=api.parseHistory('start_time,exercise_title,title,weight_kg,reps,duration_seconds,distance_km,set_type\n2026-11-05,Remada,Treino,0,,120,1,normal');assert.equal(hevy.rows[0].mode,'cardio');
 assert.throws(()=>api.parseHistory('date,exercise,reps,repetitions\n2026-11-05,Supino,10,11'));
});
test('importação exige associação, preserva outros dados e evita reimportação no mesmo aluno',()=>{
 const data=base(),copy=structuredClone(data),parsed=api.parseHistory(text);let count=0;const uid=()=>`new${++count}`;
 assert.throws(()=>api.mergeHistory(data,parsed,{},'s1','kg total',uid));
 const result=api.mergeHistory(data,parsed,{Supino:'md1'},'s1','kg total',uid);assert.equal(result.added,1);assert.equal(result.data.sessions[0].records.length,2);assert.deepEqual(data,copy);assert.deepEqual(result.data.workouts,data.workouts);
 assert.equal(api.mergeHistory(result.data,parsed,{Supino:'md1'},'s1','kg total',uid).added,0);
 assert.equal(api.mergeHistory(result.data,parsed,{Supino:'md1'},'s2','kg total',uid).added,1);
 result.data.exercises[0].name='Supino renomeado';assert.equal(api.mergeHistory(result.data,parsed,{Supino:'md1'},'s1','kg total',uid).added,0);
 assert.throws(()=>api.mergeHistory(data,parsed,{Supino:'md1'},'invalido','kg total',uid));
});
test('preserva sessões distintas com identificadores de origem e rejeita unidades desconhecidas',()=>{
 const parsed=api.parseHistory('date,exercise,reps,session id\n2026-11-05,Supino,10,a\n2026-11-05,Supino,10,b');let n=0;
 assert.equal(api.mergeHistory(base(),parsed,{Supino:'md1'},'s1','kg total',()=>`n${++n}`).added,2);
 const pounds=api.parseHistory('date,exercise,reps,unit\n2026-11-05,Supino,10,lb');assert.throws(()=>api.mergeHistory(base(),pounds,{Supino:'md1'},'s1','kg total',()=> 'new'));
 const unweighted=api.parseHistory('date,exercise,reps\n2026-11-05,Supino,10');assert.equal(api.mergeHistory(base(),unweighted,{Supino:'md1'},'s1','kg total',()=> 'new').data.sessions[0].records[0].load,null);
});
test('análise exclui aquecimento, cardio, outras datas e alunos; drop e unilateral contam uma vez',()=>{
 const data=base();const record=(type,extra={})=>({exercise:'md1',type,done:true,...extra});
 data.sessions=[{student:'s1',date:'2026-11-05T12:00:00',records:[record('trabalho'),record('aquecimento'),record('feeder'),record('drop',{blocks:[{},{}]}),record('trabalho',{left:'10',right:'10'}),record('trabalho',{executionMode:'cardio'}),record('trabalho',{done:false}),record('trabalho',{exercise:'desconhecido'})]},{student:'s2',date:'2026-11-05',records:[record('trabalho')]},{student:'s1',date:'2026-10-01',records:[record('trabalho')]}];
 const r=api.groupAnalysis(data,'s1','2026-11-02','2026-11-08');assert.equal(r.working,3);assert.equal(r.preparatory,2);assert.equal(r.cardio,1);assert.equal(r.unknown,1);assert.equal(r.sessions,1);assert.equal(r.groups.Peito,3);
 assert.throws(()=>api.groupAnalysis(data,'s1','2026-11-08','2026-11-02'));
});
