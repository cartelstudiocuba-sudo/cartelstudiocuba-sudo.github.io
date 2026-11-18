import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { createRateHandler } from "./service.mjs";
const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(url,service,{auth:{persistSession:false}});
const auth=createClient(url,anon,{auth:{persistSession:false}});
const id="eltoque-informal";
Deno.serve(createRateHandler({
  authenticate:async (token:string)=>{const {data,error}=await auth.auth.getUser(token);return !error&&!!data.user;},
  read:async()=>{const {data,error}=await db.from("dashboard_exchange_rate_cache").select("*").eq("id",id).maybeSingle();if(error)throw error;return data;},
  claim:async()=>{const {data,error}=await db.rpc("eltoque_claim_refresh");if(error)throw error;return data===true;},
  getToken:async()=>{const env=Deno.env.get("ELTOQUE_API_TOKEN");if(env)return env;const {data,error}=await db.rpc("eltoque_server_token");if(error)throw error;return data;},
  save:async(row:Record<string,unknown>)=>{const {error}=await db.from("dashboard_exchange_rate_cache").upsert(row);if(error)throw error;},
  cooldown:async(until:string)=>{await db.from("dashboard_exchange_rate_cache").update({refresh_after:until}).eq("id",id);},
  fetch:globalThis.fetch,
}));
