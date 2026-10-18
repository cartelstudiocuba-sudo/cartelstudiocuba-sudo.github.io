const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const name of ['dashboard.html','rrhh-inicio.html','rrhh-login.html','reset-password.html','usuarios-permisos.html','trabajador-ficha.html']){
 const s=fs.readFileSync(name,'utf8');
 for(const [,source] of s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(source.trim())new vm.Script(source,{filename:name});
 for(const [,src] of s.matchAll(/<script src="(\/assets\/[^"?]+)/g))assert(fs.existsSync('.'+src),name+' missing '+src);
}
for(const name of ['users-roles','module-access','login'])new vm.Script(fs.readFileSync('assets/'+name+'.js','utf8'),{filename:name});
const source=fs.readFileSync('assets/module-access.js','utf8')+';globalThis.access=CartelAccess;';
const context={document:{documentElement:{dataset:{}},querySelectorAll:()=>[],querySelector:()=>null}};vm.createContext(context);vm.runInContext(source,context);
(async()=>{
 const access=await context.access.load({rpc:async(name,p)=>({data:p.module==='inventario_insumos',error:null})});
 assert.equal(access.inventario_insumos,true);assert.equal(access.rrhh,false);assert.equal(access.usuarios_roles,false);
 await assert.rejects(context.access.load({rpc:async()=>({error:Error('network')})}));
 const users=fs.readFileSync('assets/users-roles.js','utf8');
 assert(users.includes("sb.rpc('system_set_role_permission'"));assert(users.includes("sb.rpc('system_set_employee_role'"));
 assert(!users.includes('system_user_role_grants'));assert(!fs.readFileSync('assets/login.js','utf8').includes("email!=='cartelstudiocuba@gmail.com'"));
 console.log('PASS: HTML/JavaScript syntax, linked assets, server-driven navigation permissions, network failures, canonical role and matrix RPC wiring.');
})().catch(e=>{console.error(e);process.exitCode=1;});
