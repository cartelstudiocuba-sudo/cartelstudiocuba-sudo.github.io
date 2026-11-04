const fs=require('fs'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
assert.equal(read('rrhh-20261101.html'),read('rrhh.html'),'Keep the legacy entry point synchronized with rrhh.html');
assert(!read('dashboard.html').includes('/rrhh-20261101.html'),'Dashboard must use the canonical candidate page');
console.log('PASS: candidate entry points match and dashboard uses canonical page');
