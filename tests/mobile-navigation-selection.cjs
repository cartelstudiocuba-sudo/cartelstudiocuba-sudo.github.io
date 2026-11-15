const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('Only one mobile tab is highlighted during menus, screen changes and badge rerenders',()=>{
 const button=(name,current=false)=>({attrs:{'aria-label':name,...(current?{'aria-current':'page'}:{})},getAttribute(k){return this.attrs[k]??null},hasAttribute(k){return k in this.attrs},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]}});
 let buttons=[button('Inicio',true),button('Inventario'),button('Cuenta')];
 const context={bar:{querySelectorAll:()=>buttons},sheet:{open:false},openedLabel:null};
 const source=fs.readFileSync('assets/mobile-navigation.js','utf8');vm.runInNewContext(source.slice(source.indexOf('function syncBarSelection()'),source.indexOf('function openSheet(')),context);
 const selected=()=>buttons.filter(b=>b.hasAttribute('data-selected')).map(b=>b.getAttribute('aria-label'));
 context.syncBarSelection();assert.deepEqual(selected(),['Inicio']);
 context.sheet.open=true;context.openedLabel='Inventario';context.syncBarSelection();assert.deepEqual(selected(),['Inventario']);
 buttons=[button('Inicio',true),button('Inventario'),button('Cuenta')];context.syncBarSelection();assert.deepEqual(selected(),['Inventario']);
 context.sheet.open=false;context.openedLabel=null;buttons[1].setAttribute('aria-expanded','false');context.syncBarSelection();assert.deepEqual(selected(),['Inicio']);
 buttons[0].removeAttribute('aria-current');buttons[1].setAttribute('aria-current','page');context.syncBarSelection();assert.deepEqual(selected(),['Inventario']);
 context.sheet.open=true;context.openedLabel='Cuenta';context.syncBarSelection();assert.deepEqual(selected(),['Cuenta']);
});

test('Only embedded Nevera uses the mobile dock reservation and leaves cleanly',()=>{
 const root=new Set(),classes=new Set(['embedded']);let href='/nevera-audiovisual.html?embedded=1';
 const context={URL,location:{origin:'https://gestion.elcartelstudio.com',href:'https://gestion.elcartelstudio.com/dashboard.html'},workspace:{classList:{contains:k=>classes.has(k)}},moduleFrame:{getAttribute:()=>href},document:{documentElement:{classList:{toggle:(name,active)=>active?root.add(name):root.delete(name)}}}};
 const code=fs.readFileSync('assets/mobile-navigation.js','utf8');vm.runInNewContext(code.slice(code.indexOf('function syncFridgeDock()'),code.indexOf('if(workspace&&moduleFrame)')),context);
 const active=()=>root.has('fridge-workspace-active');context.syncFridgeDock();assert(active());classes.delete('embedded');context.syncFridgeDock();assert(!active(),'home restores normal scrolling');classes.add('embedded');href='/inventario-insumos.html';context.syncFridgeDock();assert(!active(),'other modules are unchanged');href='/nevera-audiovisual.html';classes.add('selection-mode');context.syncFridgeDock();assert(!active(),'selection views are unchanged');classes.delete('selection-mode');href='https://other.example/nevera-audiovisual.html';context.syncFridgeDock();assert(!active(),'external frames never trigger the dock');href='/nevera-audiovisual.html';context.syncFridgeDock();assert(active());
 const css=fs.readFileSync('assets/mobile-navigation.css','utf8');assert(css.includes('html.worker-mobile-ready.fridge-workspace-active body{height:100%;min-height:0;overflow:hidden;padding-bottom:0!important}'));assert(css.includes('height:calc(100dvh - var(--worker-nav-space))!important;min-height:0'));
 for(const viewport of [640,900,1366])for(const safe of [0,24]){const frameBottom=viewport-(82+safe),innerDockBottom=frameBottom-6,globalDockTop=viewport-(74+8+safe);assert.equal(globalDockTop-innerDockBottom,6);}
});
