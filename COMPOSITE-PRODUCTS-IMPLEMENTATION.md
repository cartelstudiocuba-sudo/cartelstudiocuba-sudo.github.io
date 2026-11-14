# Productos compuestos del Bar

Implementación del formulario aprobado de Agregar producto, 14 de noviembre de 2026.

## Funciones

Producto nuevo y edición permiten elegir Producto de reventa o Producto compuesto. La composición contiene nombre del insumo, cantidad por unidad/servicio, unidad, costo en USD por esa unidad y subtotal. Se pueden agregar o quitar hasta 100 insumos. No se precargan importes de ejemplo ni se crean productos reales de prueba. Se incorpora la categoría Café.

Para compuestos, el costo es de solo lectura y se calcula sumando cantidad por costo unitario. Se admiten seis decimales para consumos y costos unitarios; el total se redondea hacia arriba a dos decimales, con aritmética decimal exacta en cliente y servidor. El costo alimenta el mínimo y la autorización de precios existentes. Al cambiar a reventa se recupera el costo manual; la conversión CUP existente se conserva para reventa. Los componentes se declaran en USD por la unidad seleccionada. La receta no usa una tasa CUP global para insumos con compras distintas.

Producto, cantidad inicial, composición, costo y auditoría se guardan en una transacción. Los reintentos conservan un único identificador; el servidor verifica producto y revisión de receta, y rechaza costos que no coincidan con los insumos. Se pueden editar las recetas después. Las entradas de unidades de un compuesto conservan el costo de su composición; las modificaciones de costo se hacen al editar la receta. Cambiar costos no cambia por sí solo el precio de venta vigente. Si queda bajo el nuevo mínimo se señala para revisión.

Las ventas nuevas conservan su composición, revisión y costo como fotografía histórica. Las ventas anteriores no se reescriben. Solo se descuenta stock del producto final: no se descuentan automáticamente ingredientes ni insumos de almacén. Las cantidades iniciales siguen representando unidades del producto final.

## Archivos

- `assets/fridge-composition.js` y `assets/fridge-composition.css`: selector de tipo, tabla adaptable, cálculo y validaciones.
- `assets/fridge.js`: integración con alta, edición, entradas, CUP, fotos y operación persistente.
- `nevera-audiovisual.html`: recursos nuevos y actualización de versión.
- `database/fridge_composite_products.sql`: migración `fridge_atomic_composite_product_recipes` aplicada.
- `database/fridge_composite_products_rollback.sql`: restauración de funciones, conservando datos y metadatos. Debe acompañarse de la restauración del frontend del commit anterior.
- `tests/fridge-composite.cjs`, `tests/fridge-composite-ui.cjs`, `tests/fridge-ui.cjs` y `package.json`: pruebas y comandos.

## Base de datos y seguridad

Se añade `product_type` a `studio_access_private.fridge_products` y Café a sus categorías admitidas. Se reutilizan `fridge_recipes`, `fridge_operations`, `fridge_cost_audit` y las autorizaciones actuales. La nueva función privada `fridge_composition_validate` valida y normaliza cantidades y costos. El comando anterior se conserva como `fridge_command_before_composite`, sin ejecución directa de clientes; el nuevo comando aplica permisos, idempotencia y transacción. Se conserva la herramienta previa de recetas del Manager y se impide que repetir una operación antigua vuelva a cambiar el tipo de un producto.

No se crean funciones públicas adicionales, permisos de usuario ni accesos directos a tablas. Se respaldan las funciones originales. Tras la migración coincidieron las huellas de los seis productos (excluyendo la nueva columna), recetas, ventas, movimientos, pagos, operaciones, cuadres y configuraciones; los seis productos existentes quedaron como reventa. Sin nuevos avisos de seguridad respecto al estado previo.

## Pruebas

`npm run test:fridge` completó todas las suites, incluidas operaciones, ventas, crédito, cobros, fotos, cuadres, distribución, CUP, inventario/exportaciones, precios/autorizaciones y fichas centrales. Las nuevas pruebas incluyen 26 escenarios SQL y 20 de interfaz: composición del espresso con cinco insumos, precisión y redondeo, creación/edición atómicas, costos manipulados, precios inferiores al mínimo, concurrencia/revisión, reintentos, existencias, aislamiento de permisos, conservación de ventas y compatibilidad con el editor anterior. Tras añadir la protección de navegación durante envíos se repitieron las suites de interfaz de nevera y compuestos, ambas aprobadas. JavaScript y diff sin errores.

La adaptación a escritorio y móvil se comprobó en estructura DOM/CSS y formularios sintéticos; no equivale a una inspección visual en navegador autenticado. La conexión con insumos de almacén y su consumo automático quedan para una aprobación posterior.
