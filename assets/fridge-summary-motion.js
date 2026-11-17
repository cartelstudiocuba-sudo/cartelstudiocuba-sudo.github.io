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
window.CartelSummaryMotion={animate,stop};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',e=>{if(e.matches)stop();});
})();
