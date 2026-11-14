-- Keep the established unit cost when a later receipt or edit declares a lower cost.
-- The original purchase amount/rate remain in the operation payload and movement details.
do $migration$
declare definition text;old_expression text;
begin
 definition:=pg_get_functiondef('studio_access_private.fridge_command_core(uuid,text,jsonb)'::regprocedure);
 old_expression:='cost=excluded.cost';
 if position(old_expression in definition)=0 then raise exception 'No se encontró la asignación de costo del producto';end if;
 execute replace(definition,old_expression,'cost=greatest(fridge_products.cost,excluded.cost)');
 definition:=pg_get_functiondef('studio_access_private.fridge_command_ledger(uuid,text,jsonb)'::regprocedure);
 old_expression:='cost=round((rows->>''unit_cost'')::numeric,2)';
 if position(old_expression in definition)=0 then raise exception 'No se encontró la asignación de costo de la entrada';end if;
 execute replace(definition,old_expression,'cost=greatest(cost,round((rows->>''unit_cost'')::numeric,2))');
end $migration$;
