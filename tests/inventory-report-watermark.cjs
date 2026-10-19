'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../inventario-insumos.html'),'utf8');
const first=source.indexOf('function inventoryReportWatermarkHTML('),last=source.indexOf('function normalizeInventoryMovementCurrency(',first);
function context(){
 const ctx={};vm.createContext(ctx);vm.runInContext(source.slice(first,last),ctx);return ctx;
}
test('Watermark uses the existing vector logo in pale grey instead of text',()=>{
 const ctx=context(),markup=ctx.inventoryReportWatermarkHTML(),css=ctx.inventoryReportWatermarkStyles();
 assert.match(markup,/<svg[^>]+viewBox="0 0 1040 810"/);assert.match(markup,/<path d=/);assert.match(markup,/fill="#ededed"/);assert.doesNotMatch(markup,/>EL CARTEL STUDIO</);assert.doesNotMatch(markup,/<text\b/);
 assert.match(css,/opacity:\.42/);assert.match(css,/rotate\(-33deg\)/);assert.match(css,/position:fixed/);
});
test('Weekly report embeds logo directly and preserves report content',()=>{
 const ctx=context();let result='';
 Object.assign(ctx,{popup:{document:{write:s=>result=s}},esc:String,heading:'Cuadre semanal',start:'2026-10-12',end:'2026-10-18',kind:'entry',summary:'<p>25 CUP</p>',body:'<p>Mouse</p>'});
 const a=source.indexOf('const printCSS='),b=source.indexOf('popup.document.close()',a);
 vm.runInContext(source.slice(a,b),ctx);
 assert.match(result,/<svg/);assert.match(result,/<p>25 CUP<\/p>/);assert.match(result,/<p>Mouse<\/p>/);assert.match(result,/<main class="page">/);assert.match(result,/opacity:\.42/);
});
test('General report also uses vector watermark and a foreground content wrapper',()=>{
 const ctx=context();Object.assign(ctx,{generated:'Fecha de prueba',rows:[],empty:[],low:[],shortage:[],total:0,rowsHtml:'',filterDetails:[],esc:String,money:String});
 const a=source.indexOf(" const html='<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><title>Inventario general");
 const b=source.indexOf(' w.document.open()',a);assert.ok(a>=0&&b>a);
 vm.runInContext(source.slice(a,b)+'\nthis.result=html;',ctx);
 assert.match(ctx.result,/<svg/);assert.match(ctx.result,/<main class="page">/);assert.match(ctx.result,/<\/main><\/body>/);assert.match(ctx.result,/opacity:\.42/);
});
