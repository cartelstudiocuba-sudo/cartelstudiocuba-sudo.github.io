const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function opening({loaded=true,reduced=false}={}){
 const root={dataset:{splashPending:'true',accessPending:'true'}},listeners={},timers=new Map();let next=0;
 const image={complete:loaded,naturalWidth:loaded?216:0,addEventListener:(event,fn)=>listeners[event]=fn};
 const context={document:{documentElement:root,querySelector:()=>image},window:{matchMedia:()=>({matches:reduced})},setTimeout:(fn,ms)=>{timers.set(++next,{fn,ms});return next},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(fs.readFileSync('assets/platform-opening.js','utf8'),context);
 return {root,listeners,timers,finish:context.window.CartelOpening.finish};
}
test('A quick session waits for the complete 1.6 second opening',()=>{const a=opening();delete a.root.dataset.accessPending;assert.equal(a.root.dataset.splashPending,'true');const timer=[...a.timers.values()][0];assert.equal(timer.ms,1600);timer.fn();assert(!('splashPending' in a.root.dataset));});
test('Completing the animation never reveals unauthorised content',()=>{const a=opening();[...a.timers.values()][0].fn();assert.equal(a.root.dataset.accessPending,'true');const html=fs.readFileSync('dashboard.html','utf8');assert(html.includes('html:not([data-access-pending]):not([data-splash-pending]) #dashboardBoot{display:none}'));});
test('Timing starts when the vector loads; image failure and reduced motion do not block entry',()=>{const a=opening({loaded:false});assert.equal([...a.timers.values()][0].ms,3000);a.listeners.load();assert.equal([...a.timers.values()][0].ms,1600);a.listeners.error();assert(!('splashPending' in a.root.dataset));assert(!('splashPending' in opening({reduced:true}).root.dataset));});
test('Android manifest uses lettering assets and retains installed app identity',()=>{const m=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));assert.equal(m.start_url,'/dashboard.html');assert.equal(m.scope,'/');assert.equal(m.background_color,'#0b1016');assert(m.icons.every(i=>i.src.startsWith('/assets/cartel-launch-')&&i.purpose==='any'));});
