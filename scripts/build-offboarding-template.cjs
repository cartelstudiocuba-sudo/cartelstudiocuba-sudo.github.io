// Retain the issued v2 renderer byte for byte. Expose its existing text resolver
// in a separate closure-only asset, generated from the same frozen source.
const fs=require('fs'),path=require('path');const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/contract-paper.js'),'utf8').replace(/\r\n/g,'\n');
const result=source.replace('function createContractPaper(', 'function createOffboardingPaper(').replace('candidateText:contractCandidateTemplateText};','candidateText:contractCandidateTemplateText,text:contractEffectiveRenderedText};');
const target=path.join(root,'assets/offboarding-template.js');
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==result)throw Error('Stale offboarding template resolver');}else fs.writeFileSync(target,result);
console.log('Closure template resolver matches frozen contractual sources.');
