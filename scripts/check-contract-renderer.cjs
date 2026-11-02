// Issued renderer versions are immutable. A new layout needs a new version,
// retaining the old assets and routing signed snapshots to their original version.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),root=path.join(__dirname,'..');
const lock=JSON.parse(fs.readFileSync(path.join(root,'assets/contract-renderer-v2.json'),'utf8'));
for(const [file,hash] of Object.entries(lock.files)){const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')).digest('hex');if(actual!==hash)throw Error('Issued renderer v2 changed: '+file+'. Create a new version and retain v2.');}
console.log('PASS immutable contract renderer v2');
