const {test}=require('node:test'),assert=require('node:assert/strict');const insights=require('../insights.js'),history=require('../import-analysis.js');
const fixture=()=>({workouts:[],sessions:[{id:'one',student:'s1',date:'2026-11-05T12:00:00Z',title:'Teste',records:[{exercise:'md1',name:'Supino',set:1,done:true,type:'trabalho',load:20,reps:'10',unit:'kg total'},{exercise:'md1',name:'Supino',set:2,done:true,type:'trabalho',load:30,reps:'10',unit:'kg por halter'},{exercise:'md1',name:'Supino',set:3,done:true,type:'trabalho',load:null,reps:'10',unit:'kg total'}]}]});
test('volume e recordes não misturam unidades; carga desconhecida não apaga a série',()=>{
 const data=fixture(),now=Date.parse('2026-11-05T12:00:00Z'),total=insights.aggregate(data,'s1',now),dumbbell=insights.aggregate(data,'s1',now,'kg por halter');
 assert.equal(total.totalVolume,200);assert.equal(dumbbell.totalVolume,300);assert.equal(total.loggedSets,3);assert.equal(total.exercises[0].bestLoad,20);assert.equal(dumbbell.exercises[0].bestLoad,30);assert.equal(total.rows[2].load,null);assert.equal(total.rows[2].volume,null);
 assert.equal(total.weeks.at(-1).volume,200);assert.equal(dumbbell.weeks.at(-1).volume,300);
 const csv=insights.exportCSV(total);assert(csv.includes('Carga informada'));const imported=history.parseHistory(csv);assert.equal(imported.rows[1].unit,'kg por halter');assert.equal(imported.rows[2].load,null);
});
