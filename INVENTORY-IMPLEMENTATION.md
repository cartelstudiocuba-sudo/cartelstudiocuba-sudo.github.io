# Insumos — 18 de octubre de 2026

## Auditoría y datos conservados

Base publicada auditada: 58d36c0. Supabase: jhumvctocphyiwhszeaz.
Había un producto real (Mouse), una entrada de 1 Unidad a 25 CUP y una foto privada.
No se reconstruyeron productos, no se borraron datos y no se cambiaron las políticas RLS.
La función de entrada usaba promedio ponderado: se sustituyó por último costo de compra.
El producto existente ya tenía una única compra: no necesitaba recalcularse.

## Comportamiento

- Catálogo real con foto descargada mediante sesión y URL Blob, categoría, unidad, stock, mínimo, estado y costo.
- Búsqueda, categorías y filtros de estado/moneda; exportación CSV; proveedores extraídos de compras.
- Ficha con historial paginado, responsable, fecha de documento y registro, destino y costo histórico.
- Entradas nuevas y existentes; compresión JPEG existente conservada (1600 px, .84, límite 2 MiB).
- Cada compra registrada fija el último costo; una compra con fecha de documento anterior también pasa a ser la última registrada. Las salidas no cambian ese costo.
- Salidas bajo bloqueo FOR UPDATE, validación de stock e imputación económica en una transacción.
- Moneda, nombre, unidad y responsable se fijan en los movimientos nuevos. Los antiguos se conservan sin reescribir; la ficha usa la información del producto como alternativa para campos históricos que no existían.
- UUID y carga exacta para reintentos; rechazo de reutilización con otros datos o usuario. Recuperación de operaciones enviadas tras recargar mediante sessionStorage por usuario. La recuperación dura la sesión de esa pestaña; no promete sobrevivir al borrado del almacenamiento ni a cerrar la pestaña.
- Los mínimos existentes se actualizan con un método limitado a ese campo y autorizado en servidor. No concede edición de stock/costo ni altera las políticas de tablas.
- Alejandro mantiene lectura/escritura y Melanie solo lectura, verificado con sus identidades reales y el rol PostgreSQL authenticated.

## Pruebas

`tests/inventory-last-purchase.sql` ejecutado en Supabase y revertido íntegramente:
compras a 10, 20 y 30 CUP; salida a 20 congelada en historial y movimiento económico;
salidas por proyecto y administración; stock insuficiente; moneda incorrecta;
reintento idéntico; reintento modificado rechazado; mínimo; escritura directa
denegada; permisos de Alejandro/Melanie; lectura autorizada de metadatos de fotos.

`tests/inventory-photo.cjs` pasa: sintaxis, foto antes de RPC, errores conservan
formulario, mismo UUID, no vuelve a subir una foto confirmada y omitir foto permite guardar.

Navegador autenticado contra producción: catálogo real, foto Blob decodificada,
ficha e historial; guardar el mínimo existente conservando 0; búsqueda combinada
con moneda y categoría; formulario nuevo; preparación local de PNG a foto optimizada;
salida de 2 con stock 1 bloqueada por validación. No se guardaron compras/salidas
ficticias desde el navegador. Los movimientos exitosos se probaron por separado en
Supabase con rollback; no se afirma una prueba completa de subida y movimiento desde navegador.

## Límites

- Los proyectos se identifican por referencia obligatoria; no existe catálogo de proyectos conectado en este esquema.
- Reintegros de caja, aprobación de cierre y PDF continúan pendientes, indicados en pantalla. Los informes de salidas disponibles separan CUP y USD y no presentan un saldo cobrado ficticio.
- No se ejercitó concurrencia desde dos navegadores; la serialización se implementa con bloqueo de fila y UUID dentro de la transacción.
- Los asesores de Supabase no señalaron funciones nuevas de inventario expuestas como SECURITY DEFINER. Persisten avisos ajenos a este cambio sobre funciones de RRHH, protección de contraseñas filtradas y tablas protegidas sin políticas (incluidas caja/cierres aún pendientes).
  Referencia: https://supabase.com/docs/guides/database/database-linter
