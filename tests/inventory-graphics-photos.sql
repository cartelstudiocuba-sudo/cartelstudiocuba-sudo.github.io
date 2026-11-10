-- Metadata-only fixtures, never persisted; no files are uploaded.
begin;
insert into public.inventory_products(id,name,category,unit,currency,stock,unit_cost,photo_path) values
('00000000-0000-4000-8000-000000000011','Foto gráfica','Departamento Gráfica','Unidad','CUP',3,99,'00000000-0000-4000-8000-000000000011/00000000-0000-4000-8000-000000000021.jpg'),
('00000000-0000-4000-8000-000000000012','Foto audiovisual','Departamento Audiovisual','Unidad','CUP',3,99,'00000000-0000-4000-8000-000000000012/00000000-0000-4000-8000-000000000022.jpg');
insert into storage.objects(bucket_id,name) values ('inventory-images','00000000-0000-4000-8000-000000000011/00000000-0000-4000-8000-000000000021.jpg'),('inventory-images','00000000-0000-4000-8000-000000000012/00000000-0000-4000-8000-000000000022.jpg'),('inventory-images','00000000-0000-4000-8000-000000000013/00000000-0000-4000-8000-000000000023.jpg');
select set_config('request.jwt.claims','{"sub":"ff6bcd72-963c-4ea4-9a33-1722fe44c384","role":"authenticated"}',true);
set local role authenticated;
do $t$
begin
 if public.inventory_graphics_catalog('',0,1,'00000000-0000-4000-8000-000000000011')->'rows'->0->>'photo_path'<>'00000000-0000-4000-8000-000000000011/00000000-0000-4000-8000-000000000021.jpg' then raise exception 'Missing linked photo';end if;
 if not studio_access_private.inventory_graphics_photo_allowed('00000000-0000-4000-8000-000000000011/00000000-0000-4000-8000-000000000021.jpg') then raise exception 'Linked photo denied';end if;
 if studio_access_private.inventory_graphics_photo_allowed('00000000-0000-4000-8000-000000000012/00000000-0000-4000-8000-000000000022.jpg') or studio_access_private.inventory_graphics_photo_allowed('00000000-0000-4000-8000-000000000013/00000000-0000-4000-8000-000000000023.jpg') then raise exception 'Photo scope leak';end if;
 if (select count(*) from storage.objects where bucket_id='inventory-images')<>1 then raise exception 'Storage RLS scope failed';end if;
end $t$;
reset role;
update public.hr_employees set system_access_enabled=false where system_username='melanie.medina';
set local role authenticated;
do $t$ begin if studio_access_private.inventory_graphics_photo_allowed('00000000-0000-4000-8000-000000000011/00000000-0000-4000-8000-000000000021.jpg') or exists(select 1 from storage.objects where bucket_id='inventory-images') then raise exception 'Revoked access still sees photo';end if;end $t$;
reset role;
rollback;

