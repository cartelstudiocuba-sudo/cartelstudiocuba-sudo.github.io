/* Mobile navigation mirrors the authenticated desktop links; it grants no access. */
(()=>{'use strict';
function allowed(link,nav){if(!link||!link.getAttribute('href')||link.getAttribute('href')==='#'||link.hasAttribute('data-soon'))return false;for(let node=link;node&&node!==nav;node=node.parentElement)if(node.hidden||node.style?.display==='none')return false;return true;}
function label(text){return /aprobar/i.test(text)?'Aprobar':/consulta|buscador/i.test(text)?'Buscador':/pedidos/i.test(text)?'Pedidos':text.trim();}
function partition(links){return links.length<=3?{direct:links,more:[]}:{direct:links.slice(0,2),more:links.slice(2)};}
if(typeof module!=='undefined'&&module.exports)module.exports={allowed,label,partition};
if(typeof document==='undefined')return;
const nav=document.querySelector('.app aside .nav');if(!nav)return;
const paths={home:'<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>',box:'<path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v10l9 5 9-5V8M12 13v10"/>',check:'<path d="M5 3h14v19H5zM9 2v4h6V2m-7 12 3 3 6-7"/>',search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',truck:'<path d="M1 4h14v13H1zM15 9h4l4 5v3h-8"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/>',account:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',grid:'<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/>'};
const svg=type=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[type]+'</svg>';
const icon=text=>/aprobar/i.test(text)?'check':/consulta|buscador/i.test(text)?'search':/pedido/i.test(text)?'truck':/insumo|inventario/i.test(text)?'box':'grid';
const bar=document.createElement('nav');bar.id='worker-mobile-nav';bar.setAttribute('aria-label','Menú de tu cuenta');
const sheet=document.createElement('dialog');sheet.id='worker-mobile-sheet';sheet.setAttribute('aria-labelledby','worker-mobile-sheet-title');sheet.innerHTML='<header><h2 id="worker-mobile-sheet-title"></h2><button type="button" aria-label="Cerrar menú">×</button></header><div id="worker-mobile-sheet-content"></div>';
let mounted=false,accountAnchor=null,accountNode=null,scheduled=false;
sheet.querySelector('header button').onclick=()=>sheet.close();
sheet.addEventListener('close',()=>{if(accountAnchor&&accountNode){accountAnchor.replaceWith(accountNode);accountAnchor=accountNode=null;}bar.querySelectorAll('[aria-expanded]').forEach(b=>b.setAttribute('aria-expanded','false'));});
function openSheet(title,button){if(sheet.open)sheet.close();document.getElementById('worker-mobile-sheet-title').textContent=title;document.getElementById('worker-mobile-sheet-content').replaceChildren();sheet.showModal();button.setAttribute('aria-expanded','true');sheet.querySelector('header button').focus();}
function button(text,type,action,active=false,full=text){const b=document.createElement('button');b.type='button';b.innerHTML=svg(type)+'<span></span>';b.querySelector('span').textContent=text;b.setAttribute('aria-label',full);if(active)b.setAttribute('aria-current','page');b.onclick=action;return b;}
function go(link){if(sheet.open)sheet.close();link.click();}
function render(){scheduled=false;if(!window.cartelPersonalNavigationReady)return;if(!mounted){document.body.append(bar,sheet);document.documentElement.classList.add('worker-mobile-ready');mounted=true;}
 const personal=[...nav.querySelectorAll('a.personal-view-link')].filter(a=>allowed(a,nav));const links=personal.length?personal:[...nav.querySelectorAll('a')].filter(a=>!a.hasAttribute('data-home')&&allowed(a,nav));const unique=[...new Map(links.map(a=>[a.getAttribute('href'),a])).values()];const {direct,more}=partition(unique);const home=nav.querySelector('[data-home]');const active=a=>a.classList.contains('active');bar.replaceChildren();if(home)bar.append(button('Inicio','home',()=>go(home),active(home)));
 direct.forEach(a=>{const full=a.textContent.trim();bar.append(button(label(full),icon(full),()=>go(a),active(a),full));});
 if(more.length){const b=button('Más','grid',()=>{openSheet('Tus accesos',b);const content=document.getElementById('worker-mobile-sheet-content');more.forEach(a=>{const full=a.textContent.trim();content.append(button(full,icon(full),()=>go(a),active(a)));});},more.some(active));b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-expanded','false');bar.append(b);}
 const account=button('Cuenta','account',()=>{openSheet('Mi cuenta',account);const node=document.getElementById('cartel-account');const content=document.getElementById('worker-mobile-sheet-content');if(node){accountNode=node;accountAnchor=document.createComment('account-position');node.parentNode.insertBefore(accountAnchor,node);content.append(node);}else{const p=document.createElement('p');p.textContent='La información de tu cuenta se está cargando.';content.append(p);}});account.setAttribute('aria-haspopup','dialog');account.setAttribute('aria-expanded','false');bar.append(account);
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(render);}
new MutationObserver(schedule).observe(nav,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','style']});
window.addEventListener('cartel-navigation-ready',schedule);window.addEventListener('resize',()=>{if(innerWidth>900&&sheet.open)sheet.close();});if(window.cartelPersonalNavigationReady)schedule();
})();
