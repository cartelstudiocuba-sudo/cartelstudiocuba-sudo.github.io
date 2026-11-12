import { createHandler } from './bridge.mjs';
// Every request validates its Supabase user and write permission.
Deno.serve(createHandler(name=>Deno.env.get(name)));
