import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";

const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {auth:{persistSession:false}});
const allowedEndpoint = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com|[a-z0-9-]+\.notify\.live\.net)\//;
Deno.serve(async request => {
  if (request.method !== "POST") return new Response("Method not allowed", {status:405});
  const token = request.headers.get("x-cartel-dispatch");
  if (!token) return new Response("Unauthorized", {status:401});
  const keys = webpush.generateVAPIDKeys();
  const {data:config,error:configError} = await client.rpc("management_push_config",{p_token:token,p_public:keys.publicKey,p_private:keys.privateKey});
  if (configError || !config?.privateKey) return new Response("Unauthorized",{status:401});
  webpush.setVapidDetails("mailto:contacto@elcartelstudio.com",config.publicKey,config.privateKey);
  const {data:jobs,error} = await client.rpc("management_push_claim");
  if (error) return new Response("Queue unavailable",{status:503});
  await Promise.all((jobs||[]).map(async (job:{id:string;endpoint:string;p256dh:string;auth:string;title:string;body:string})=>{
    let result="retry";
    if (!allowedEndpoint.test(job.endpoint)) result="expired";
    else try {
      await webpush.sendNotification({endpoint:job.endpoint,keys:{p256dh:job.p256dh,auth:job.auth}},JSON.stringify({id:job.id,title:job.title,body:job.body}),{TTL:86400,timeout:10000});
      result="sent";
    } catch (error) {
      const status=(error as {statusCode?:number}).statusCode;
      if(status===404||status===410)result="expired";
    }
    await client.rpc("management_push_finish",{p_id:job.id,p_endpoint:job.endpoint,p_result:result});
  }));
  return Response.json({processed:jobs?.length||0});
});
