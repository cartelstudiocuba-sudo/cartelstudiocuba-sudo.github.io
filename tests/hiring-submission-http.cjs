const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.argv[2]||path.join(__dirname,'..'),base=process.env.HIRING_BASE||root;
const output=process.env.HIRING_OUTPUT_DIR||path.join(require('os').tmpdir(),'hiring-submission-tests');fs.mkdirSync(output,{recursive:true});
const fields={full_name:'Persona simulada',identity_number:'99010112345',birth_date:'1999-01-01',nationality:'Cubana',province:'La Habana',municipality:'Plaza de la Revolución',address:'Calle simulada',mobile:'5355555555',email:'prueba@example.com',emergency_name:'Contacto simulado',emergency_relation:'Hermana',emergency_phone:'5355555556',education_level:'Universitario'};
(async()=>{let release,submits=0;const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');let body='';for await(const chunk of req)body+=chunk;
 if(u.pathname==='/rest/v1/rpc/hr_read_hiring'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({trial_id:'synthetic',data:fields,revision:0,front:true,back:true,portrait:true,locked:false,submitted:false,role_title:'Plaza simulada'}));}
 if(u.pathname==='/rest/v1/rpc/hr_submit_hiring'){const values=JSON.parse(body);assert.equal(values.p_revision,0);submits++;await new Promise(r=>release=r);res.setHeader('Content-Type','application/json');return res.end('1');}
 let file=path.join(root,u.pathname),fallback=path.join(base,u.pathname);file=fs.existsSync(file)?file:fallback;if(!fs.existsSync(file)){res.statusCode=404;return res.end();}let content=fs.readFileSync(file);if(u.pathname.endsWith('.html'))content=content.toString().replace('https://jhumvctocphyiwhszeaz.supabase.co','http://127.0.0.1:'+server.address().port);res.setHeader('Content-Type',u.pathname.endsWith('.js')?'text/javascript':'text/html');res.end(content);
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:820}});await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).hostname,'127.0.0.1');return route.continue();});
 // No Playwright network interception of POST bodies: retain real upload events.
 await page.unroute('**/*');page.on('request',r=>assert.equal(new URL(r.url()).hostname,'127.0.0.1'));
 await page.goto('http://127.0.0.1:'+server.address().port+'/expediente-contratacion.html#token='+'a'.repeat(64));
 for(let i=0;i<3;i++)await page.getByRole('button',{name:'Siguiente',exact:true}).click();await page.locator('[name=truth_confirmed]').check();await page.getByRole('button',{name:'Guardar y enviar expediente'}).click();
 await page.getByText('Datos del expediente · 100 % · esperando confirmación del servidor…',{exact:true}).waitFor();assert(await page.locator('#hiringSendFinish').isDisabled());assert(await page.locator('#hiring').evaluate(e=>e.inert));
 await page.screenshot({path:path.join(output,'progress-'+width+'.png')});release();
 await page.getByRole('heading',{name:'Expediente enviado correctamente',exact:true}).waitFor();await page.screenshot({path:path.join(output,'success-'+width+'.png')});
 await page.locator('#hiringSendFinish').click();await page.getByRole('heading',{name:'Proceso completado. Ya puedes cerrar esta ventana'}).waitFor();await page.screenshot({path:path.join(output,'completed-'+width+'.png')});
 // Contract mode does not depend on the public-submission helper or completion flag.
 assert(await page.evaluate(async()=>{delete window.hiringSubmission;window.renderHiringContract=(_root,result)=>{window.contractResult=result;};history.replaceState({cartelHiringComplete:true},'','#token='+'a'.repeat(64));await initHiringPublic(true);return Boolean(window.contractResult);}));
 await page.close();console.log('PASS real UI 100% pending, inherited documents, final screen and contract mode',width);
}assert.equal(submits,2);}finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1)});

