const {JSDOM}=require('jsdom'),fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('dashboard.html','utf8');
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(m[2].trim()&&!/type=["']application\/json/i.test(m[1]))new vm.Script(m[2]);
(async()=>{for(const width of [390,800,1024,1280]){
 const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://gestion.elcartelstudio.com/dashboard.html'}),w=dom.window,d=w.document;Object.defineProperty(w,'innerWidth',{value:width});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.sb={};const reads=[];
 w.CartelExchangeRates={read:async(client,options)=>{reads.push(options);return {rates:{USD:930,MLC:840,EUR:1000,USDT_TRC20:1130,USDT_ERC20:1140,NEW_COIN:150},fetched_at:'2026-11-18T15:00:00Z',stale:false}}};
 const script=[...d.scripts].find(s=>s.textContent.includes('function openRates()'));assert(script);w.eval(script.textContent);w.dispatchEvent(new w.Event('load'));await new Promise(r=>setTimeout(r,0));
 assert.equal(w.getComputedStyle(d.querySelector('#exchange-mobile-trigger')).display,'block');assert.equal(d.querySelector('#exchange-mobile-trigger').closest('.dashboard')!==null,true);assert.equal(w.getComputedStyle(d.querySelector('aside .foot')).display,'none');
 assert.equal(d.querySelector('.home-brand-motto').textContent,'Siempre positivo');assert.equal(d.querySelectorAll('#exchange-rates-list > div').length,6);assert.match(d.querySelector('#exchange-rates-list').textContent,/USDT_TRC20/);assert.match(d.querySelector('#exchange-rates-list').textContent,/NEW_COIN/);assert.match(d.querySelector('#exchange-collection-note').textContent,/10 CUP/);
 d.querySelector('#exchange-mobile-trigger').click();await new Promise(r=>setTimeout(r,0));assert(d.querySelector('#exchange-dialog').open);assert(reads.some(r=>r.force===true));d.querySelector('#exchange-close').click();assert(!d.querySelector('#exchange-dialog').open);
 w.dispatchEvent(new w.Event('resize'));assert.equal(d.querySelector('#exchange-mobile-trigger').closest('.dashboard')!==null,true);dom.window.close();
 }console.log('PASS: home rate card remains in the dashboard at portrait/landscape widths; all API rates, +10 CUP notice, slogan and popup refresh');})().catch(e=>{console.error(e);process.exit(1)});
