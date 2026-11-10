/* Only the scoped, allowlisted read endpoint is used on this page. */
(()=>{'use strict';
const client=CartelLoad.createClient('https://jhumvctocphyiwhszeaz.supabase.co','sb_publishable_ZHV-5dlsjfamQpfUOsgumg_G-vN84Gn',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const byId=id=>document.getElementById(id),list=byId('products'),status=byId('status'),search=byId('search'),detail=byId('detail');
let offset=0,version=0,detailVersion=0,timer,ready=false,identity=null,previousFocus;
const quantity=value=>Number(value).toLocaleString('es',{maximumFractionDigits:8});
function node(tag,text,className){const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;}
function reset(){version++;detailVersion++;list.replaceChildren();byId('detail-body').replaceChildren();byId('updated').textContent='';if(detail.open)detail.close();byId('next').hidden=byId('previous').hidden=true;}
function lock(message){ready=false;reset();search.disabled=byId('refresh').disabled=true;list.setAttribute('aria-busy','false');status.textContent=message;}
function badge(p){return node('span',p.stock_status,'badge'+(p.stock_status==='Agotado'?' empty':p.stock_status==='Bajo mínimo'?' low':''));}
function amount(p){const n=node('p',quantity(p.stock)+' ','quantity');n.append(node('small',p.unit));return n;}
async function call(args){const r=await client.rpc('inventory_graphics_catalog',args);if(r.error)throw r.error;return r.data;}
async function load(){if(!ready)return;const request=++version;detailVersion++;if(detail.open)detail.close();byId('detail-body').replaceChildren();list.replaceChildren();byId('updated').textContent='';list.setAttribute('aria-busy','true');byId('next').hidden=byId('previous').hidden=true;status.textContent='Consultando existencias…';
 try{const data=await call({p_search:search.value.trim(),p_offset:offset,p_limit:50});if(request!==version||!ready)return;
 if(offset>0&&offset>=data.total){offset=Math.max(0,Math.floor((data.total-1)/50)*50);return load();}
 for(const p of data.rows){const card=node('article','','product');card.append(badge(p),node('h2',p.name),amount(p));const button=node('button','Ver ficha');button.type='button';button.onclick=()=>openDetail(p.id,button);card.append(button);list.append(card);}
 if(!data.rows.length)list.append(node('p',search.value.trim()?'No hay insumos que coincidan con tu búsqueda.':'Todavía no hay insumos registrados en Departamento Gráfica.','empty-state'));
 status.textContent=data.total?`${offset+1}–${Math.min(offset+data.rows.length,data.total)} de ${data.total} insumos`:'0 insumos';
 byId('previous').hidden=offset===0;byId('next').hidden=offset+data.rows.length>=data.total;
 byId('updated').textContent='Existencias consultadas a las '+new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})+'.';
 }catch(e){if(request!==version)return;if(e.code==='42501'){lock('Tu cuenta no tiene autorización para esta consulta.');return;}status.textContent='No se pudo consultar el almacén. Comprueba la conexión y pulsa «Actualizar existencias».';}
 finally{if(request===version)list.setAttribute('aria-busy','false');}}
async function openDetail(id,button){const request=++detailVersion;previousFocus=button;byId('detail-title').textContent='Ficha del insumo';byId('detail-body').replaceChildren(node('p','Consultando existencias…'));detail.showModal();
 try{const data=await call({p_product:id,p_search:'',p_offset:0,p_limit:1});if(request!==detailVersion||!ready||!detail.open)return;const p=data.rows[0];if(!p){byId('detail-body').replaceChildren(node('p','Este insumo ya no está disponible en la consulta de Gráfica.'));return;}
 byId('detail-title').textContent=p.name;const dl=document.createElement('dl');for(const [label,value] of [['Categoría',p.category],['Existencias',quantity(p.stock)+' '+p.unit],['Estado',p.stock_status],['Mínimo registrado',Number(p.minimum_stock)>0?quantity(p.minimum_stock)+' '+p.unit:'Sin umbral definido'],['Ubicación',p.location||'Sin ubicación registrada'],['Código',p.id]])dl.append(node('dt',label),node('dd',value));byId('detail-body').replaceChildren(badge(p),dl);
 }catch(e){if(request!==detailVersion)return;if(e.code==='42501')lock('Tu cuenta no tiene autorización para esta consulta.');else byId('detail-body').replaceChildren(node('p','No se pudo cargar la ficha. Cierra y vuelve a intentarlo.'));}}
byId('close-detail').onclick=()=>detail.close();detail.addEventListener('close',()=>{detailVersion++;byId('detail-body').replaceChildren();previousFocus?.focus();});
search.oninput=()=>{clearTimeout(timer);offset=0;reset();status.textContent='Buscando…';timer=setTimeout(load,250);};byId('refresh').onclick=()=>{clearTimeout(timer);offset=0;load();};
byId('previous').onclick=()=>{offset=Math.max(0,offset-50);load();};byId('next').onclick=()=>{offset+=50;load();};
client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(identity&&session?.user?.id!==identity))lock('La sesión cambió. Vuelve a iniciar sesión para consultar el almacén.');});
(async()=>{try{const session=await client.auth.getSession();if(!session.data?.session){lock('Inicia sesión para consultar el almacén.');location.replace('/rrhh-login.html?next='+encodeURIComponent('/consulta-insumos-grafica.html'));return;}const {data,error}=await client.auth.getUser();if(error||!data.user){lock('Inicia sesión para consultar el almacén.');location.replace('/rrhh-login.html?next='+encodeURIComponent('/consulta-insumos-grafica.html'));return;}identity=data.user.id;ready=true;search.disabled=byId('refresh').disabled=false;await load();}catch(e){lock('No se pudo comprobar la sesión. Recarga la página para intentarlo de nuevo.');}})();
})();
