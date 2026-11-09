const fs=require('fs'),cp=require('child_process'),assert=require('assert/strict');
const unchanged=['rrhh.html','rrhh-20261101.html','trabajador-ficha.html','usuarios-permisos.html','alta-trabajador.html','assets/evolution-profile.js','assets/onboarding.js','assets/direct-employee.js'];
for(const file of unchanged)assert.equal(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),cp.execFileSync('git',['show','HEAD:'+file],{encoding:'utf8',maxBuffer:10e6}).replace(/\r\n/g,'\n'),file);
assert.equal(cp.execFileSync('git',['diff','HEAD','--','supabase'],{encoding:'utf8'}),'');
const preparation=fs.readFileSync('assets/offboarding-preparation.js','utf8');
assert(!/localStorage|sessionStorage|\.rpc\(/.test(preparation));
for(const file of ['assets/account-activation.js','assets/offboarding.js','assets/offboarding-preparation.js'])new(require('vm').Script)(fs.readFileSync(file,'utf8'));
console.log('Preserved selection, profile, direct employee, onboarding, database/Edge; preparation has no new persistence or write endpoint.');
