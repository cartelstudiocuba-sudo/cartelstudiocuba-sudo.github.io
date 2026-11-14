import { createHandler } from './handler.mjs';
// Deliberately public: only immutable approved menu images, never arbitrary storage paths.
Deno.serve(createHandler(name=>Deno.env.get(name)));
