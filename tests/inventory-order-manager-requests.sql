begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a0ee4b57-1f73-480b-bc68-0aa034d19bda","role":"authenticated"}',true);
do $$declare c jsonb;begin
 c:=public.inventory_order_capabilities();
 if not (c->>'create')::boolean or not (c->>'approve')::boolean or (c->>'fulfil')::boolean then raise exception 'Manager capabilities incorrect: %',c;end if;
 perform public.inventory_request_catalog();
end $$;
select public.inventory_order_capabilities() as verified;
rollback;
