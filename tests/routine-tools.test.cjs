const {test}=require('node:test');
const assert=require('node:assert/strict');
const tools=require('../routine-tools.js');
const item={exercise:'md1',sets:3,reps:'8–12',load:50,rest:60,unit:'kg total',setPlan:[{type:'trabalho',mode:'fixed',load:50,reps:'8–12',rest:60,percent:100,reference:'base',rir:2}],progression:{criterion:'all',scheme:'double',min:8,max:12,increment:2.5}};
const data=()=>({students:[{id:'s1',name:'Nome privado',email:'privado@example.com'}],exercises:[{id:'md1'}],workouts:[{id:'w1',student:'s1',title:'Treino A',notes:'Orientações',items:[structuredClone(item)]}],sessions:[{id:'privado'}],favorites:['md1'],equipment:tools.defaultEquipment()});
test('favoritos mantêm a ordem dos grupos e não alteram o catálogo',()=>{
 const list=[{id:'md1'},{id:'md2'},{id:'md3'}];assert.deepEqual(tools.orderFavorites(list,['md3','md1']),[list[0],list[2],list[1]]);assert.equal(list[0].id,'md1');
 assert(tools.validPreferences({}));assert(!tools.validPreferences({favorites:['md1','md1']}));assert(!tools.validPreferences({favorites:['md501']}));
});
test('anilhas: carga exata, limite de pares, aproximação, estoque vazio e barra',()=>{
 assert.deepEqual(tools.plateLoad(100,{bar:20,plates:[{weight:20,pairs:2}]}).plates,[20,20]);
 const r=tools.plateLoad(105,{bar:20,plates:[{weight:20,pairs:2}]});assert.equal(r.actual,100);assert.equal(r.missing,5);
 assert(tools.plateLoad(10,tools.defaultEquipment()).belowBar);
 assert.equal(tools.plateLoad(20,{bar:20,plates:[]}).actual,20);
 assert.equal(tools.plateLoad(30,{bar:20,plates:[]}).missing,10);
 assert.throws(()=>tools.plateLoad(NaN,tools.defaultEquipment()));assert.throws(()=>tools.plateLoad(2001,tools.defaultEquipment()));
 assert(!tools.validEquipment({bar:20,plates:[{weight:5,pairs:21}]}));
});
test('busca encontra combinações que a escolha gulosa perde',()=>{
 const r=tools.plateLoad(12,{bar:0,plates:[{weight:5,pairs:1},{weight:2,pairs:3}]});assert.equal(r.actual,12);assert.deepEqual(r.plates,[2,2,2]);
});
test('mil estoques limitados comparados com busca exaustiva',()=>{
 let seed=3;const rand=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n;};
 for(let n=0;n<1000;n++){
  const plates=[{weight:2.5,pairs:rand(4)},{weight:1.25,pairs:rand(4)},{weight:.5,pairs:rand(4)}],target=rand(80)/4;
  let best=0;
  for(let a=0;a<=plates[0].pairs;a++)for(let b=0;b<=plates[1].pairs;b++)for(let c=0;c<=plates[2].pairs;c++){const total=2*(a*2.5+b*1.25+c*.5);if(total<=target)best=Math.max(best,total);}
  assert.equal(tools.plateLoad(target,{bar:0,plates}).actual,best);
 }
});
test('compartilhar inclui só prescrição e exclui dados privados e campos estranhos',()=>{
 const d=data();d.workouts[0].items[0].studentEmail='segredo';d.workouts[0].items[0].setPlan[0].private='segredo';
 const bundle=tools.exportBundle(d,['w1']),text=JSON.stringify(bundle);
 for(const field of ['Nome privado','privado@example.com','studentEmail','sessions','favorites','equipment','segredo'])assert(!text.includes(field));
 assert.deepEqual(bundle.routines[0].items[0],item);assert.throws(()=>tools.exportBundle(d,[]));assert.throws(()=>tools.exportBundle(d,['inexistente']));
});
test('importação faz cópias sem alterar alunos, sessões, agenda ou rotinas existentes',()=>{
 const d=data(),snapshot=structuredClone(d),bundle=tools.exportBundle(d,['w1']);let n=0;
 const result=tools.importBundle(d,bundle,'s1',()=>`copy${++n}`);
 assert.deepEqual(d,snapshot);assert.equal(result.workouts.length,2);assert.equal(result.workouts[1].id,'copy1');assert.equal(result.workouts[1].student,'s1');
 assert.deepEqual(result.students,d.students);assert.deepEqual(result.sessions,d.sessions);assert.deepEqual(result.equipment,d.equipment);
 assert.throws(()=>tools.importBundle(d,bundle,'ausente',()=> 'copy'));
 assert.throws(()=>tools.importBundle(d,bundle,'s1',()=> 'w1'));
});
test('leitura rejeita arquivo corrompido, backup completo, versão errada e valores inválidos',()=>{
 const known=new Set(['md1']),bundle=tools.exportBundle(data(),['w1']);
 assert.throws(()=>tools.parseBundle('{',known));assert.throws(()=>tools.parseBundle(JSON.stringify(data()),known));
 for(const alter of [b=>b.version=2,b=>b.routines[0].items[0].exercise='md999',b=>b.routines[0].items[0].load=-1,b=>b.routines[0].items[0].sets=Infinity,b=>b.routines[0].items[0].rest=3601]){
  const b=structuredClone(bundle);alter(b);assert.throws(()=>tools.parseBundle(JSON.stringify(b),known));
 }
 assert.throws(()=>tools.parseBundle(' '.repeat(1000001),known));
});
