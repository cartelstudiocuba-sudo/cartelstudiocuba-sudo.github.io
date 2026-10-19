'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../inventario-insumos.html'),'utf8');
const begin=html.indexOf('async function downloadDeliveryReceipt('),end=html.indexOf("\nbyId('week-ending')",begin),source=html.slice(begin,end);
function fixture(overrides={}){
 let pdf;
 class PDF{
  constructor(){pdf=this;this.page=1;this.texts=[];this.saved=null}
  setFillColor(){} rect(){} setTextColor(){} setFont(){} setFontSize(){} setDrawColor(){} line(){}
  splitTextToSize(value,width){const max=Math.floor(width/2);return String(value).match(new RegExp('.{1,'+max+'}','g'))||['']}
  text(value,x,y){const lines=Array.isArray(value)?value:[value];lines.forEach((t,i)=>this.texts.push({page:this.page,text:t,x,y:y+i*5}))}
  addPage(){this.page++}
  save(name){this.saved=name}
 }
 const ctx={window:{jspdf:{jsPDF:PDF}}};vm.createContext(ctx);vm.runInContext(source,ctx);
 const data={id:'00000000-0000-4000-8000-000000000001',date:'2026-10-18',name:'INSUMO DE PRUEBA',quantity:2,unit:'Unidad',unitCost:25,currency:'CUP',stock:5,area:'Gerencia',person:'PRUEBA',kind:'project',project:'PROYECTO DE PRUEBA',notes:'Sin entrega real',...overrides};
 return {run:async()=>{await ctx.downloadDeliveryReceipt(data);return pdf}};
}
test('Normal receipt totals and signatures fit one page',async()=>{
 const pdf=await fixture().run();assert.equal(pdf.page,1);assert.ok(pdf.texts.some(t=>t.text==='50,00 CUP'));assert.ok(pdf.texts.some(t=>t.text.includes('Recibido por')));assert.match(pdf.saved,/2026-10-18_00000000.pdf$/);
});
test('Very long fields and observations remain within printable page bounds',async()=>{
 const pdf=await fixture({name:'NOMBRE '.repeat(350),project:'PROYECTO '.repeat(300),notes:'OBSERVACION '.repeat(1500)+'FIN_OBSERVACIONES'}).run();
 assert.ok(pdf.page>1);assert.ok(pdf.texts.every(t=>t.y>=10&&t.y<=285));assert.ok(pdf.texts.some(t=>t.text.includes('FIN_OBSERVACIONES')));assert.ok(pdf.texts.some(t=>t.text.includes('Recibido por')));
});
test('Historical reprint omits unavailable stock estimates',async()=>{
 const pdf=await fixture({stock:null}).run();assert.ok(!pdf.texts.some(t=>/Existencia anterior|Existencia estimada/.test(t.text)));
});
test('Administrative and breakage consumption are labelled accurately',async()=>{
 for(const reason of ['', 'breakage']){const pdf=await fixture({kind:'administrative',reason,project:''}).run();assert.ok(pdf.texts.some(t=>t.text===(reason?'Rotura o merma (gasto administrativo)':'Gasto administrativo')))}
});
