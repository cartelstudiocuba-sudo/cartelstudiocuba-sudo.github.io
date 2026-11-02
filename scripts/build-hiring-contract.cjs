// Refresh the generated hiring renderer using the existing master-template rules.
const fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8').replace(/\r\n/g,'\n');
const master=read('plaza-ficha.html'),current=read('assets/hiring-contract.js');
const start=current.indexOf(' const d=result.data||{}');if(start<0)throw Error('Missing view section');
function fn(name){const a=master.indexOf('function '+name+'('),b=master.indexOf('\nfunction ',a+1);if(a<0||b<0)throw Error('Missing master resolver: '+name);return master.slice(a,b).trim();}
const names=['workData','selectedPolicyIds','appliedPolicies','appliedDiscipline','specificWorkItems','contractDataValue','contractCompanyText','contractInheritedContent','contractCandidateTemplateText','contractSpecificStructuredText','contractDisciplineStructuredText','contractBaseRenderedText','contractEffectiveRenderedText','contractPolicyByKey','normalizeEmploymentPolicyBlocks'];
const header=current.slice(0,current.indexOf('const workDefaults=['));
const defaults=master.slice(master.indexOf('const workDefaults=['),master.indexOf('\nfunction workData('));
fs.writeFileSync(path.join(root,'assets/hiring-contract.js'),header+defaults+'\n'+names.map(fn).join('\n')+'\n'+current.slice(start));
console.log('Hiring renderer refreshed from master resolvers');
