/* Only our authenticated server sees the elTOQUE credential. No financial operation is saved here. */
(()=>{'use strict';
 const endpoint='https://jhumvctocphyiwhszeaz.supabase.co/functions/v1/dashboard-eltoque-rates';
 const inputs=new WeakMap();let cached=null,inflight=null,actor=null;
 function valid(data){const n=Number(data?.rates?.USD),stamp=Date.parse(data?.fetched_at),age=Date.now()-stamp;return !data?.stale&&Number.isFinite(n)&&n>0&&n<=1000000&&Number.isFinite(age)&&age>=-300000&&age<86400000;}
 async function read(client,{force=false}={}){
  const {data,error}=await client.auth.getSession(),session=data?.session;if(error||!session?.access_token)throw Error('Inicia sesión para consultar la tasa.');
  const id=session.user?.id||session.access_token;if(actor!==id){actor=id;cached=null;inflight=null;}
  if(!force&&cached&&valid(cached)&&Date.now()-cached.loaded<60000)return cached;
  if(inflight)return inflight;
  const request=(async()=>{const response=await fetch(endpoint+(force?'?refresh=1':''),{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('No se pudo consultar elTOQUE. Puedes declarar una tasa manual.');const result=await response.json();if(!valid(result))throw Error(result.error||'No se pudo verificar la tasa actual. Puedes declararla manualmente.');const reference={...result,value:Number(result.rates.USD),loaded:Date.now()};if(actor===id)cached=reference;return reference;})();
  inflight=request;try{return await request;}finally{if(inflight===request)inflight=null;}
 }
 function track(input){if(!inputs.has(input)){const state={manual:false,run:0};inputs.set(input,state);input.addEventListener('input',()=>{state.manual=true;state.run++;input.dataset.rateSource='manual';});}return inputs.get(input);}
 async function fill(input,client){
  if(!input||input.value!=='')return null;const state=track(input);if(state.manual)return null;const run=++state.run;
  const reference=await read(client);
  if(!input.isConnected||state.manual||state.run!==run||input.value!=='')return null;
  input.value=String(reference.value);input.dataset.rateSource='reference';input.dataset.rateFetchedAt=reference.fetched_at;return reference;
 }
 function label(reference){return 'elTOQUE · '+(reference.source_date||new Date(reference.fetched_at).toLocaleDateString('es-ES'))+' · editable';}
 window.CartelExchangeRates=Object.freeze({read,fill,valid,label,isManual:input=>!!inputs.get(input)?.manual});
})();
