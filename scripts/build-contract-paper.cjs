// Nomenclador is the only authored source of contract rules and paper layout.
// --check rejects stale generated assets.
const fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
const master=fs.readFileSync(path.join(root,'plaza-ficha.html'),'utf8').replace(/\r\n/g,'\n');
const matches=[...master.matchAll(/^(?:async )?function (\w+)\(/gm)],functions=new Map();
for(let i=0;i<matches.length;i++)functions.set(matches[i][1],master.slice(matches[i].index,matches[i+1]?.index||master.length).trim());
const selected=new Map();
function include(name){if(selected.has(name))return;const body=functions.get(name);if(!body)throw Error('Missing master function '+name);selected.set(name,body);for(const call of body.matchAll(/\b(\w+)\s*\(/g))if(functions.has(call[1])&&!selected.has(call[1]))include(call[1]);}
for(const name of ['workData','selectedPolicyIds','appliedPolicies','appliedDiscipline','specificWorkItems','contractDataValue','contractCompanyText','contractInheritedContent','contractCandidateTemplateText','contractEffectiveRenderedText','normalizeEmploymentPolicyBlocks','buildContractPreviewPages'])include(name);
const defaults=master.slice(master.indexOf('const workDefaults=['),master.indexOf('\nfunction workData('));
const js='// GENERATED from plaza-ficha.html. Do not author clauses here.\nfunction createContractPaper(role,n,options={}){\nconst e=options.escape||hiringEsc,contractLogoUrls=options.logos||{};\nconst agencyPolicies=n.filter(x=>x.category===\'normas_politicas\'),agencyDiscipline=n.filter(x=>x.category===\'regimen_disciplinario\'),agencyContractData=n.filter(x=>x.category===\'datos_contractuales_empresa\'),agencyContractClauses=n.filter(x=>x.category===\'clausulas_contractuales\');\n'+defaults+'\n'+[...selected.values()].join('\n')+'\nreturn {build:buildContractPreviewPages,normalize:normalizeEmploymentPolicyBlocks,candidateText:contractCandidateTemplateText};\n}\n';
const styles=[...master.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(x=>x[1]).join('\n');
const css=[...styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>!m[1].includes('@')&&/\.(contract-paper|contract-page|contract-first-logo|contract-pages|contract-fill|contract-annex-page|contract-annex-table|contract-annex-label|contract-annex-box|contract-annex-id-space|contract-transport|transport-photo)/.test(m[1])&&!/mini|editor|preview|training|definition|recruitment|evaluation|:where/.test(m[1])).map(m=>m[0]).join('\n');
for(const [file,body] of [['assets/contract-paper.js',js],['assets/contract-paper.css',css+'\n']]){const target=path.join(root,file);if(process.argv.includes('--check')){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==body)throw Error('Stale '+file);}else fs.writeFileSync(target,body);}
console.log('Contract master parity: '+selected.size+' functions');
