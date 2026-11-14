-- New receipts replace the reference cost with the last purchase price.
-- Sales, payment allocations and previously submitted reports keep their snapshots.
do $migration$
declare definition text;old_expression text:='cost=round(((stock-(rows->>''quantity'')::integer)*cost+(rows->>''quantity'')::integer*(rows->>''unit_cost'')::numeric)/stock,2)';new_expression text:='cost=round((rows->>''unit_cost'')::numeric,2)';
begin
 definition:=pg_get_functiondef('studio_access_private.fridge_command_ledger(uuid,text,jsonb)'::regprocedure);
 if position(old_expression in definition)=0 then raise exception 'No se encontró el cálculo de costo esperado';end if;
 definition:=replace(definition,old_expression,new_expression);execute definition;
end $migration$;
