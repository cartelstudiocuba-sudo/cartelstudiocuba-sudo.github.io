/* Presentation only: authoritative values remain unchanged in the workspace state. */
(()=>{'use strict';
let active=null;
const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function stop(){if(!active)return;const run=active;active=null;cancelAnimationFrame(run.frame);run.finish();}
function animate(root){
 stop();if(!root||reduced()||document.hidden||typeof requestAnimationFrame!=='function')return;
 const values=[...root.querySelectorAll('[data-summary-stock],[data-summary-metric],.fr-summary-stock-number,.fr-summary-balance')].map(el=>{
  const currency=el.hasAttribute('data-motion-value'),value=Number(currency?el.dataset.motionValue:el.textContent),text=[...el.childNodes].find(n=>n.nodeType===3);
  if(!text||!Number.isFinite(value))return null;
  return {el,text,value,currency,final:text.nodeValue,label:el.getAttribute('aria-label')};
 }).filter(Boolean);
 const ring=root.querySelector('.fr-summary-ring'),healthy=parseFloat(ring?.style.getPropertyValue('--healthy')||0),warning=parseFloat(ring?.style.getPropertyValue('--warning')||0),hasProducts=Number(root.querySelector('[data-summary-stock="total"]')?.textContent)>0;
 const bars=[...root.querySelectorAll('.fr-summary-stock-track i')].map(el=>({el,width:el.style.width,transform:el.style.transform}));
 const finish=()=>{for(const v of values){v.text.nodeValue=v.final;if(v.label===null)v.el.removeAttribute('aria-label');else v.el.setAttribute('aria-label',v.label);}if(ring)ring.style.removeProperty('background');for(const b of bars){b.el.style.transform=b.transform;b.el.style.width=b.width;}root.classList.remove('fr-summary-motion');};
 const paint=progress=>{
  for(const v of values){const amount=v.currency?Math.round(v.value*progress*100)/100:Math.round(v.value*progress);v.text.nodeValue=v.currency?'$'+amount.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' ':String(amount);}
  if(ring&&hasProducts)ring.style.background='conic-gradient(#ffda03 0 '+healthy*progress+'%,#e6a33a '+healthy*progress+'% '+warning*progress+'%,#ee8279 '+warning*progress+'% '+100*progress+'%,#ffffff15 '+100*progress+'% 100%)';
  for(const b of bars)b.el.style.transform='scaleX('+progress+')';
 };
 for(const v of values)v.el.setAttribute('aria-label',v.el.textContent.trim());
 root.classList.add('fr-summary-motion');paint(0);
 let start=null;const run={root,frame:0,finish};active=run;
 const tick=now=>{if(active!==run)return;if(!root.isConnected||reduced()||document.hidden){stop();return;}if(start===null)start=now;const t=Math.min(1,Math.max(0,(now-start)/850));paint(1-Math.pow(1-t,3));if(t===1){active=null;finish();}else run.frame=requestAnimationFrame(tick);};
 run.frame=requestAnimationFrame(tick);
}
// Animate newly rendered view blocks, including asynchronous lists, once per element.
const blocks='.fr-sale-banner,.fr-toolbar,.fr-actions,.fr-section-title,.fr-panel:not(#recon-detail),.fr-product,.fr-board-totals>div,.fr-board-filters,.fr-board-card,.fr-menu-editor,.fr-menu-preview,.fr-menu-panel,.recon-steps,.recon-prepare,#recon-toolbar,.recon-history-heading,.manager-floating-menu,.operator-report-card,.manager-inbox-card,.manager-report-banner,.manager-review-panel,.manager-review-bottom,.manager-allocation,.fr-receipt-hero,.fr-receipt-payment,.manager-review-actions';
const entered=new WeakSet(),running=new Map();
function cancelEntries(){for(const animation of running.values())animation.cancel();running.clear();}
function enter(root,{replay=false}={}){
 if(!root||reduced()||document.hidden)return;
 const candidates=[...(root.matches?.(blocks)?[root]:[]),...root.querySelectorAll(blocks)].filter(el=>!el.closest('.fr-summary,dialog,[hidden]'));
 // Animate containers as a unit, so child transforms never compound.
 const chosen=candidates.filter(el=>!el.parentElement?.closest(blocks));
 let order=0;for(const el of chosen){if((!replay&&entered.has(el))||typeof el.animate!=='function')continue;entered.add(el);running.get(el)?.cancel();
  const animation=el.animate([{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:560,delay:Math.min(order++*60,280),easing:'cubic-bezier(.22,.7,.25,1)',fill:'backwards'});running.set(el,animation);
  animation.finished.then(()=>{if(running.get(el)===animation)running.delete(el);},()=>{if(running.get(el)===animation)running.delete(el);});
 }
}
const workspace=document.getElementById('fridge-app');
if(workspace){const observer=new MutationObserver(records=>{
 // Typing and changing quantities should not replay the surrounding catalog.
 if(document.activeElement?.matches('input,select,textarea'))return;
 const added=records.flatMap(record=>[...record.addedNodes]).filter(node=>node.nodeType===1&&node.isConnected);
 const roots=added.filter(node=>!added.some(other=>other!==node&&other.contains(node)));
 for(const node of roots)enter(node);
});observer.observe(workspace,{childList:true,subtree:true});}
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===window.parent&&event.data?.type==='fridge-view-enter')enter(workspace,{replay:true});});
window.CartelSummaryMotion={animate,stop,enter};
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();cancelEntries();}});
window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',e=>{if(e.matches){stop();cancelEntries();}});
})();
