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
