# Fondo de Insumos — CUP — 18 octubre 2026

Base auditada: 2a832e8. Proyecto jhumvctocphyiwhszeaz. Un Mouse, stock 1,
último costo 25 CUP, una compra histórica y una foto privada. Caja, reintegros y
cierres vacíos. No existe catálogo de proyectos en el esquema público.

El usuario confirmó que el saldo inicial es el dinero disponible DESPUÉS de las
compras históricas. No se registra ninguna cifra inicial automáticamente ni se
vuelve a descontar el Mouse. Las nuevas compras requieren caja iniciada y saldo.

## Implementación

- Operaciones nuevas de inventario, caja, consultas y reportes de esta etapa CUP.
  Históricos y columnas CUP/USD conservados, sin conversión ni eliminación.
- Compras con descuento del fondo en la misma transacción del stock. Salidas al
  último costo fijado por el servidor; los reintegros no modifican stock/costos.
- Libro de caja sin escritura directa desde clientes; apertura única, compras,
  reintegros parciales/totales, aportes/ajustes y anulaciones compensatorias.
  Totales monetarios redondeados por movimiento a centavos CUP; importes manuales
  con máximo dos decimales. UUID, usuario y payload exacto para reintentos.
- Fecha, actor, referencia, medio, motivo y personas que entregan/reciben.
  Las cuentas pendientes se calculan desde consumos y reintegros netos, sin usar
  el antiguo campo status como indicador de cobro.
- Un bloqueo transaccional común serializa compras/caja/cierres. Caja exige fechas
  no decrecientes y no futuras. Los consumos pueden llevar fecha desde el inicio
  del fondo; ningún registro puede modificar saldos de cierres aprobados.
- Semanas de siete días, sin solapamiento. Vista previa de compras, consumos por
  proyecto/Gastos fijos, caja y pendientes acumulados al fin. Borradores y eventos
  inmutables con snapshot; aprobación exige los mismos datos de la vista previa.
  El propietario puede reabrir con motivo; todas las versiones se conservan.
- PDF mediante vista de impresión A4 y «Guardar como PDF» del navegador.
- Alejandro: escritura/borradores. Melanie: lectura. Aprobación/reapertura y
  ajustes/anulaciones: autorización existente del propietario en servidor.
  No se cambia el modelo global del propietario ni los roles de otros módulos.
- RLS activo en todas las tablas de inventario. Funciones públicas nuevas invoker;
  mutaciones limitadas en esquema privado, autenticación y permiso en cada llamada.

## Verificación y límites

`tests/inventory-fund.sql`: ejecutado contra Supabase con identidades reales y
rol authenticated; rollback completo. Apertura única sin duplicar compra histórica,
compra idempotente, último costo/histórico, reintegros parciales/totales sin stock,
rechazo de sobrepago/sobregiro/USD, UUID alterado, escritura directa y anónima,
Alejandro/Melanie/propietario, aprobación, bloqueo de fechas, reapertura,
anulación y rechazo de aprobación desactualizada.

`tests/inventory-photo.cjs`: pasa la regresión de fotos/reintentos y sintaxis.
Navegador autenticado de producción: caja sin iniciar, Mouse conservado, consulta
semanal con compra histórica identificada sin descuento nuevo, controles CUP.
No se registraron movimientos de prueba ni saldo inicial en el navegador.
No se afirma prueba de concurrencia desde múltiples clientes ni PDF descargado.
El script histórico inventory-last-purchase.sql requiere ahora apertura de caja
antes de sus compras de prueba; inventory-fund.sql cubre el flujo nuevo.

El asesor de seguridad no señala funciones/tablas nuevas de inventario; continúan
avisos previos de RRHH, tablas privadas sin políticas y protección de contraseñas:
https://supabase.com/docs/guides/database/database-linter

Los proyectos siguen como referencias escritas, sin catálogo inventado. Corregir
un cierre no elimina compras/consumos; los movimientos originales permanecen.
Las correcciones de caja se registran por compensación, nunca editando el original.
