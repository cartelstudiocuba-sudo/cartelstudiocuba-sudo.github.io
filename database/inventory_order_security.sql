revoke execute on function studio_access_private.inventory_order_reserved(uuid),studio_access_private.inventory_order_role(text) from authenticated;
do $$declare def text;begin
 select pg_get_functiondef('studio_access_private.inventory_order_action(uuid,text)'::regprocedure) into def;
 def=replace(def,'if auth.uid() is null then','if auth.uid() is null or not ((c->>''create'')::boolean or (c->>''approve'')::boolean or (c->>''fulfil'')::boolean) then');
 execute def;
end $$;
