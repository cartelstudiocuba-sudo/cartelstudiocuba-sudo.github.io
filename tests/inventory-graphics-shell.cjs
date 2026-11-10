const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const profiles=[{id:'owner',owner:true,rrhh:true,inv:true,users:true,views:[]},{id:'melanie',inv:true,views:[{code:'inventory_graphics_read',is_default:true}]},{id:'alejandro',inv:true,views:[{code:'inventory_admin',is_default:true}]},{id:'rrhh',rrhh:true,views:[]},{id:'no-access',views:[]}];
async function run(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const width of (process.argv.includes('--preview')?[360,1440]:[360,768,1440]))for(const profile of profiles.filter(p=>!process.argv.includes('--preview')||['owner','melanie'].includes(p.id))){
  const snapshots=[];
  for(const baseline of [false]){
   const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(p=>{
    const product={id:'00000000-0000-4000-8000-000000000001',name:'Vinilo amarillo 60 cm',category:'Departamento Gráfica',unit:'Metro',stock:7,minimum_stock:2,location:'A',stock_status:'Disponible'};
    const client={auth:{getSession:async()=>({data:{session:{user:{id:p.id}}}}),getUser:async()=>({data:{user:{id:p.id,email:p.id+'@test.invalid'}}}),onAuthStateChange(){}},rpc:async(n,a)=>{
     if(n==='system_has_permission')return {data:!!({rrhh:p.rrhh,inventario_insumos:p.inv,usuarios_roles:p.users}[a.module])};
     if(n==='system_my_navigation')return {data:{is_owner:!!p.owner,views:p.views}};
     if(n==='inventory_graphics_catalog')return {data:{total:1,rows:[product]}};
     throw Error('Unexpected RPC '+n);
    },from:()=>({select:()=>({eq:async()=>({count:12})})})};
    const rpc=client.rpc;client.rpc=(...args)=>Object.assign(rpc(...args),{abortSignal(){return this;}});
    window.CartelLoad={createClient:()=>client,read:async(n,f)=>f(),deadline:async f=>f(),run:async(n,f)=>f(),notice:()=>{}};
   },profile);
   await page.route('**/*',async route=>{
    const u=new URL(route.request().url());if(u.origin!=='https://visual.test')return route.abort();
    if(u.pathname==='/inventario-insumos.html')return route.fulfill({contentType:'text/html',body:'<p>Existing inventory destination; operations verified separately in SQL.</p>'});
    if(/loading-runtime|supabase-.*min/.test(u.pathname))return route.fulfill({contentType:'text/javascript',body:''});
    let file=path.join(root,u.pathname==='/dashboard.html'&&baseline?'baseline-dashboard.html':u.pathname.slice(1));
    if(!fs.existsSync(file))return route.fulfill({contentType:'text/html',body:'<p>Existing module destination</p>'});
    return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html',body:fs.readFileSync(file)});
   });
   await page.goto('https://visual.test/dashboard.html');
   await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-access-pending'));
   if(profile.views.length)await page.locator('.personal-view-link').waitFor({state:'attached'});
   await page.locator('[data-home]').click();
   assert(await page.locator('.dashboard').isVisible());
   const snapshot=await page.evaluate(()=>{
    const visible=e=>!!(e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
    return {nav:[...document.querySelectorAll('.nav a,.nav button')].filter(visible).map(e=>({text:e.textContent.trim(),href:e.getAttribute('href')})),modules:[...document.querySelectorAll('.module')].filter(visible).map(e=>e.textContent.trim()),stats:[...document.querySelectorAll('.stat')].filter(visible).map(e=>e.textContent.trim())};
   });snapshots.push(snapshot);
   if(!baseline){
    assert.equal(await page.locator('.dashboard').evaluate(e=>getComputedStyle(e).color),'rgb(244, 246, 250)');
    assert.equal(await page.locator('.module.inv').evaluate(e=>getComputedStyle(e).display==='none'),!profile.inv);
    assert.equal(await page.locator('.module.rh').evaluate(e=>getComputedStyle(e).display==='none'),!profile.rrhh);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Home has no horizontal overflow');
    await page.screenshot({path:root+'/evidence/home-'+profile.id+'-'+width+'.png',fullPage:true});
    if(profile.views.length){
     const link=page.locator('.personal-view-link');await page.locator('.personal-nav-group>.nav-parent').click();await link.click();
     const dest=profile.id==='melanie'?'/consulta-insumos-grafica.html':'/inventario-insumos.html';
     assert(new URL(await page.locator('#frame').getAttribute('src'),'https://visual.test').pathname===dest);
     if(profile.id==='melanie'){
      const frame=page.frameLocator('#frame');await frame.locator('.product').waitFor();
      assert.equal(await frame.getByText('Volver al inicio',{exact:true}).count(),0);
      const geometry=await frame.locator('main').evaluate(e=>({left:e.getBoundingClientRect().left,padding:parseFloat(getComputedStyle(e).paddingLeft),width:e.getBoundingClientRect().width,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}));
      assert.equal(geometry.left,0);assert(geometry.padding>=16&&geometry.padding<=38);assert.equal(geometry.width,geometry.viewport);assert.equal(geometry.overflow,false);
      const positions=await Promise.all(['header','.toolbar','#status','.products'].map(s=>frame.locator(s).evaluate(e=>Math.round(e.getBoundingClientRect().left))));assert(positions.every(n=>n===positions[0]));
      await frame.locator('.product button').click();assert(await frame.locator('#detail').isVisible());await frame.locator('#close-detail').click();
      await page.screenshot({path:root+'/evidence/graphics-embedded-'+width+'.png',fullPage:true});
     }
     await page.locator('[data-home]').click();assert(await page.locator('.dashboard').isVisible());assert.equal(await page.locator('#frame').getAttribute('src'),'');
    }
   }
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS '+profile.id+' '+width+'px: authorized views preserved, dark home, responsive layout and navigation');
 }
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});

