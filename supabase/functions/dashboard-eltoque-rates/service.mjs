export const SOURCE = 'https://tasas.eltoque.com/v1/trmi';
export const CACHE_MS = 15 * 60 * 1000;
const MAX_AGE = 24 * 60 * 60 * 1000;
const codes = ['USD','EUR','MLC','CAD','MXN','ZELLE','CLA'];
export function validRates(raw) {
  const rates = {};
  for (const code of codes) {
    const n = raw?.[code];
    if (typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 1000000) rates[code] = n;
  }
  return rates.USD ? rates : null;
}
export function validSourceDate(date, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
  const day = Date.parse(date + 'T00:00:00Z');
  return Number.isFinite(day) && new Date(day).toISOString().slice(0,10) === date && now - day < 36*3600000 && day - now < 12*3600000;
}
export function createRateHandler(deps) {
  let pending = null;
  const clock = deps.now || Date.now;
  const headers = {'Content-Type':'application/json','Access-Control-Allow-Origin':'https://gestion.elcartelstudio.com','Vary':'Origin','Cache-Control':'no-store'};
  const reply = (body, status=200) => new Response(JSON.stringify(body), {status, headers});
  const cachedBody = (row, stale, extra={}) => ({rates:row?.rates || null, fetched_at:row?.fetched_at || null, source_url:row?.source_url || SOURCE, source_date:row?.source_date || null, source_time:row?.source_time || null, stale, ...extra});
  async function retrieve(cached) {
    try {
      if (!await deps.claim()) return cachedBody(cached, true, {error_code:'refresh_pending',error:'La fuente se está actualizando. Reintenta en unos segundos.'});
      const token = await deps.getToken();
      if (!token) throw Object.assign(Error(), {rateCode:'source_configuration'});
      const response = await deps.fetch(SOURCE, {headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
      if (!response.ok) throw Object.assign(Error(), {rateCode:response.status===429?'source_limit':'source_http',sourceStatus:response.status,retry:Math.min(3600,Math.max(60,Number(response.headers.get('retry-after'))||60))});
      const data = await response.json();
      const rates = validRates(data.tasas);
      if (!rates || !validSourceDate(data.date,clock())) throw Object.assign(Error(), {rateCode:'source_format'});
      const source_time = [data.hour,data.minutes,data.seconds].every((n,i)=>Number.isInteger(n)&&n>=0&&n<([24,60,60][i])) ? [data.hour,data.minutes,data.seconds].map(n=>String(n).padStart(2,'0')).join(':') : null;
      const row = {id:'eltoque-informal',rates,source_url:SOURCE,fetched_at:new Date(clock()).toISOString(),source_date:data.date,source_time,refresh_after:new Date(clock()+60000).toISOString()};
      let saved = false;
      try { await deps.save(row); saved=true; } catch { /* Verified rates remain usable if persistence fails. */ }
      return cachedBody(row,false,{cache_saved:saved});
    } catch (e) {
      const code = e.rateCode || (['AbortError','TimeoutError'].includes(e.name)?'source_timeout':'source_network');
      try { await deps.cooldown(new Date(clock()+(e.retry||60)*1000).toISOString()); } catch { /* Lease expires by itself. */ }
      // Never log upstream headers, response bodies, or credentials.
      return cachedBody(cached,true,{error:'No se pudo verificar la tasa actual de elTOQUE. Puedes declarar una tasa manual.',error_code:code,source_status:e.sourceStatus||null,cache_available:!!cached});
    }
  }
  return async req => {
    if (req.method==='OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,OPTIONS'}});
    if (req.method!=='GET') return reply({error:'Método no permitido'},405);
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
    if (!bearer || !await deps.authenticate(bearer).catch(()=>false)) return reply({error:'Acceso requerido',error_code:'session_required'},401);
    let row; try { row = await deps.read(); } catch { return reply({error:'No se pudo consultar la referencia.',error_code:'cache_unavailable',stale:true},503); }
    const cached = row && [SOURCE,'https://eltoque.com/'].includes(row.source_url) && validRates(row.rates) ? {...row,rates:validRates(row.rates)} : null;
    const age = cached ? clock()-Date.parse(cached.fetched_at) : Infinity;
    const force = new URL(req.url).searchParams.get('refresh')==='1';
    if (cached?.source_url===SOURCE && validSourceDate(cached.source_date,clock()) && age>=0 && age<(force?60000:CACHE_MS)) return reply(cachedBody(cached,false));
    const fallback = cached && age>=0 && age<MAX_AGE ? cached : null;
    if (!pending) pending=retrieve(fallback).finally(()=>{pending=null;});
    return reply(await pending);
  };
}
