import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(url,service,{auth:{persistSession:false}});
const source="https://eltoque.com/";
const codes=["USD","EUR","MLC","CAD","MXN","ZELLE","CLA"];
function parse(html:string){
 const plain=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;|&#xA0;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ");
 const section=plain.indexOf("Mercado Informal de Divisas en Cuba");
 if(section<0)throw Error("Tabla de tasas no localizada");
 const excerpt=plain.slice(section,section+3500);
 const rates:Record<string,number>={};
 for(const code of codes){
  const re=new RegExp("1\\s*"+code+"\\b[^0-9]{0,100}([0-9]{1,5}(?:[.,][0-9]{2})?)\\s*CUP","i");
  const m=excerpt.match(re);
  if(m){const n=Number(m[1].replace(",","."));if(Number.isFinite(n)&&n>0&&n<100000)rates[code]=n}
 }
 if(!rates.USD||Object.keys(rates).length<3)throw Error("Tasas insuficientes para validar");
 return rates;
}
Deno.serve(async(req)=>{
 const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"https://gestion.elcartelstudio.com","Vary":"Origin","Cache-Control":"no-store"};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{...headers,"Access-Control-Allow-Headers":"authorization,apikey,content-type","Access-Control-Allow-Methods":"GET,OPTIONS"}});
 if(req.method!=="GET")return reply({error:"Método no permitido"},405);
 const bearer=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!bearer)return reply({error:"Acceso requerido",error_code:"session_required"},401);
 const auth=createClient(url,anon,{auth:{persistSession:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(bearer);
 if(authError||!user)return reply({error:"Sesión inválida",error_code:"session_required"},401);
 const {data:stored,error:cacheError}=await db.from("dashboard_exchange_rate_cache").select("*").eq("id","eltoque-informal").maybeSingle();
 // Never attribute another provider's cached values to elTOQUE.
 const cached=stored&&stored.source_url===source?stored:null;
 const age=cached?Date.now()-Date.parse(cached.fetched_at):Infinity;
 const force=new URL(req.url).searchParams.get("refresh")==="1";
 if(cached&&age>=0&&age<(force?60000:86400000))return reply({rates:cached.rates,fetched_at:cached.fetched_at,source_url:cached.source_url,stale:false});
 try{
  const response=await fetch(source,{headers:{"Accept":"text/html"},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Object.assign(new Error("Fuente HTTP "+response.status),{rateCode:response.status===403?"source_forbidden":"source_http",sourceStatus:response.status});
  let rates;try{rates=parse(await response.text());}catch{throw Object.assign(new Error("Tabla de tasas no validada"),{rateCode:"source_format"});}
  const fetched_at=new Date().toISOString();
  const {error}=await db.from("dashboard_exchange_rate_cache").upsert({id:"eltoque-informal",rates,source_url:source,fetched_at});
  if(error)console.warn("elTOQUE cache save failed:",error.code);
  return reply({rates,fetched_at,source_url:source,stale:false,cache_saved:!error});
 }catch(e){
  const failure=e as {rateCode?:string;sourceStatus?:number;name?:string;message?:string};
  const error_code=failure.rateCode||(["AbortError","TimeoutError"].includes(failure.name||"")?"source_timeout":"source_network");
  console.warn("elTOQUE rate retrieval:",error_code,failure.sourceStatus||"");
  const messages:Record<string,string>={source_forbidden:"elTOQUE rechazó la consulta automática del servidor (HTTP 403).",source_http:"La fuente respondió con un error y no pudo verificarse una tasa vigente.",source_format:"La tabla publicada por la fuente no pudo validarse.",source_timeout:"La fuente tardó demasiado en responder.",source_network:"No se pudo conectar con la fuente de la tasa."};
  return reply({rates:cached?.rates||null,fetched_at:cached?.fetched_at||null,source_url:source,stale:true,error:messages[error_code],error_code,source_status:failure.sourceStatus||null,cache_available:!!cached});
 }
});
