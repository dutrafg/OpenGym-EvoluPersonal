const {spawnSync}=require('node:child_process'),path=require('node:path');
for(const name of ['dom-flow.cjs','student-flow.cjs']){
 const run=spawnSync(process.execPath,[path.join(__dirname,name)],{stdio:'inherit',env:process.env});
 if(run.status!==0)process.exit(run.status||1);
}
