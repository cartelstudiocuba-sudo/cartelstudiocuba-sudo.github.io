const {chromium,webkit}=require('playwright'),sharp=require('sharp'),fs=require('fs'),assert=require('assert');
const helper=fs.readFileSync('assets/candidate-photo.js','utf8');
(async()=>{
 const results=[];
 const fixtures=[];
 for(const [name,w,h,format,orientation] of [['landscape',2400,1600,'jpeg'],['portrait',1200,2400,'jpeg'],['small',120,80,'png'],['transparent',1000,500,'png'],['exif6',1600,1000,'jpeg',6],['exif8',1600,1000,'jpeg',8],['exif2',1600,1000,'jpeg',2]]){
  let image=sharp({create:{width:w,height:h,channels:4,background:{r:60,g:140,b:200,alpha:name==='transparent'?.3:1}}});
  if(orientation)image=image.withMetadata({orientation});
  fixtures.push({name,w,h,orientation,type:'image/'+format,bytes:[...await image[format]().toBuffer()]});
 }
 const noise=Buffer.alloc(2400*1600*3);let seed=17;for(let i=0;i<noise.length;i++){seed=(seed*1664525+1013904223)>>>0;noise[i]=seed>>>24;}
 fixtures.push({name:'detailed',type:'image/jpeg',base64:(await sharp(noise,{raw:{width:2400,height:1600,channels:3}}).jpeg({quality:94}).toBuffer()).toString('base64')});
 for(const engine of [chromium,webkit]){
  let browser;try{browser=await engine.launch({headless:true,...(engine===chromium?{channel:"msedge"}:{})})}catch(e){results.push({engine:engine.name(),unavailable:e.message.split('\n')[0]});continue}
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:850}});await page.addScriptTag({content:helper});
   for(const fixture of fixtures){
    const result=await page.evaluate(async f=>{const original=new File([(f.base64?Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0)):new Uint8Array(f.bytes))],f.name,{type:f.type});const p=await CandidatePhoto.prepare(original);const bitmap=await createImageBitmap(p.file);const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);return {name:f.name,size:p.file.size,original:original.size,width:bitmap.width,height:bitmap.height,type:p.file.type,alpha:ctx.getImageData(0,0,1,1).data[3]};},fixture);
    assert(result.size<=result.original);assert(Math.max(result.width,result.height)<=800);if(fixture.orientation===6||fixture.orientation===8)assert(result.height>result.width);if(fixture.name==='transparent')assert(result.alpha<255);results.push({engine:engine.name(),viewport:width,...result});
   }
   for(const [name,bytes,type]of [['fake',[1,2,3],'image/jpeg'],['svg',[60,115,118,103],'image/svg+xml'],['empty',[],'image/png']])assert(await page.evaluate(async({bytes,type})=>{try{await CandidatePhoto.prepare(new File([new Uint8Array(bytes)],'invalid',{type}));return false}catch{return true}},{bytes,type}));
   const fallback=await page.evaluate(async f=>{HTMLCanvasElement.prototype.toBlob=function(){throw Error('synthetic encoder failure')};const p=await CandidatePhoto.prepare(new File([new Uint8Array(f.bytes)],'photo.jpg',{type:f.type}));return p.file.size===f.bytes.length&&p.fallback},fixtures[0]);assert(fallback);
   await page.close();
  }await browser.close();
 }
 assert(results.some(r=>r.name));fs.writeFileSync('tests/candidate-photo-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
