begin;
set local role authenticated;
do $$
declare actor uuid;result jsonb;paper uuid;outside uuid;outside_photo text;general uuid;general_photo text;row jsonb;
begin
 perform set_config('request.jwt.claim.sub','6418ad20-d0e8-49c0-8d9a-e1da3daf71b6',true);
 select id into paper from public.inventory_products where name='Papel Kraft formato carta 75g' and deleted_at is null;
 select id,photo_path into outside,outside_photo from public.inventory_products where department='Audiovisual' and deleted_at is null limit 1;
 select id,photo_path into general,general_photo from public.inventory_products where department='Generales' and deleted_at is null limit 1;
 foreach actor in array array['6418ad20-d0e8-49c0-8d9a-e1da3daf71b6'::uuid,'a0ee4b57-1f73-480b-bc68-0aa034d19bda'::uuid,'ff6bcd72-963c-4ea4-9a33-1722fe44c384'::uuid] loop
  perform set_config('request.jwt.claim.sub',actor::text,true);result:=public.inventory_graphics_catalog();
  assert exists(select 1 from jsonb_array_elements(result->'rows') x where x->>'id'=paper::text),'Paper absent';
  assert not exists(select 1 from jsonb_array_elements(result->'rows') x where x->>'department'<>'Gráfica'),'Other area exposed';
  assert (public.inventory_graphics_catalog('',0,1,outside)->>'total')::int=0,'Audiovisual direct ID bypass';
  assert (public.inventory_graphics_catalog('',0,1,general)->>'total')::int=0,'General direct ID bypass';
  if actor='ff6bcd72-963c-4ea4-9a33-1722fe44c384' then
   for row in select value from jsonb_array_elements(result->'rows') loop
    if nullif(row->>'photo_path','') is not null then assert studio_access_private.inventory_graphics_photo_allowed(row->>'photo_path'),'Graphics photo blocked';end if;
   end loop;
   if outside_photo is not null then assert not studio_access_private.inventory_graphics_photo_allowed(outside_photo),'Audiovisual photo exposed';end if;
   if general_photo is not null then assert not studio_access_private.inventory_graphics_photo_allowed(general_photo),'General photo exposed';end if;
  end if;
 end loop;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.inventory_graphics_catalog();raise exception 'Anonymous allowed' using errcode='23514';exception when insufficient_privilege then null;end;
end $$;
rollback;
select 'Verified only Gráfica: paper visible; Generales/Audiovisual products and photos excluded; anonymous denied' as verification;
