# Auditoría de Nevera audiovisual

Fecha: 17 de noviembre de 2026. Base revisada: `47f4a3f`.

## Resultado

37 grupos de pruebas automáticas aprobados y 12 comprobaciones de sintaxis. Se revisaron ventas, cuentas, pagos, existencias, composición de productos, costos, carta digital, cuadres, autorización, recibido flexible en USD/CUP, PDF, navegación móvil/tablet y animaciones.

Las comprobaciones de producción fueron de lectura. No se crearon ventas, pagos, movimientos, cuadres ni aprobaciones de prueba en la base real.

## Correcciones realizadas

| Hallazgo | Corrección | Verificación |
| --- | --- | --- |
| Una consulta que terminaba después de cerrar sesión podía volver a dibujar información del módulo o del cuadre. | Se comprueba la identidad vigente antes de aplicar respuestas; se invalidan las consultas de detalle y se cierra el PDF al salir. | `fridge-lifecycle.cjs`, `fridge-reconciliation-lifecycle.cjs`. |
| La ficha de costos podía terminar de abrirse después de cerrar sesión; el cierre normal podía depender de cambios pendientes. | Reinicio de sesión forzado, invalidación de consultas y comprobación posterior a la consulta de identidad. Las notificaciones asíncronas comprueban que el campo todavía exista. | `fridge-pricing-lifecycle.cjs`, pruebas de precios existentes. |
| La actualización automática podía sacar al usuario de Actividad o de un recibo, o interrumpir la escritura. | Se pausa mientras se consulta ese detalle o se edita un campo. | `fridge-lifecycle.cjs`. |
| Actualizar Cuentas borraba la búsqueda. | Se conserva el texto del buscador y el filtro actual. | `fridge-lifecycle.cjs`. |
| Al regresar mediante la caché de navegación podían reutilizarse direcciones de fotos ya revocadas. | Se conservan durante una navegación guardada en BFCache y se liberan al abandonar definitivamente la página. | `fridge-lifecycle.cjs`. |
| La prueba móvil esperaba el nombre antiguo «Cerrar pedido» y podía quedarse abierta tras fallar. | Se actualizó a «Tramitar nuevo pedido» y se garantiza la salida del proceso de prueba al fallar. | `fridge-mobile.cjs`. |
| El comando general de pruebas omitía las verificaciones recientes de animación, recibido flexible y navegación de tablet. | `npm run test:fridge` descubre y ejecuta toda la batería específica, con límite de tiempo por prueba. | `scripts/test-fridge-audit.cjs`. |

## Comprobaciones sobre la base real

- 21 tablas de Nevera con RLS habilitado y sin acceso directo de lectura para `anon` ni `authenticated`; el acceso se canaliza mediante las funciones autorizadas.
- Ninguna función de Nevera, pública o privada, ejecutable por `anon`.
- Buckets de fotos y cartas privados; límites de tamaño configurados.
- Sin existencias ni precios negativos.
- Sin diferencias entre existencias actuales y la suma de movimientos.
- Sin diferencias entre el total de las ventas y sus productos.
- Sin cuentas con cobros superiores al total de sus ventas.
- Sin diferencias entre el importe de pago y su equivalente USD registrado.
- Sin asignaciones de cobros superiores al pago.
- Sin confirmaciones incompletas ni diferencias entre recibido y esperado en los cuadres confirmados con recibido flexible.
- Los registros recientes de las RPC de Nevera muestran respuestas correctas; se observó una respuesta 401 del aviso de cuadres, compatible con una sesión vencida. No se observaron respuestas 5xx en las rutas RPC consultadas.

## Carta digital y documentos

- La carta pública aprobada respondió correctamente.
- Las 15 fotografías de productos y el JPG aprobado respondieron con HTTP 200 y tipo `image/jpeg`.
- Los recursos locales referenciados por las tres páginas de entrada existen.
- Se generó y comprobó un PDF sintético de 12 páginas con 65 productos de nombres extensos, inventario, distribución, deudas, observaciones y recibido confirmado. Se verificaron texto completo, monedas originales, recibido efectivo y numeración de páginas.
- Las exportaciones de inventario a Excel, JPG, PDF y ZIP superaron sus pruebas locales.

## Límites de la auditoría

Las pruebas de interacción se realizaron con DOM simulado y datos sintéticos; las reglas de base de datos se probaron en PostgreSQL local mediante PGlite. Se comprobaron los permisos y la consistencia de producción mediante consultas de lectura.

No fue posible iniciar Chromium en este entorno. Por tanto, no se certifica una revisión visual con navegador real ni la apertura de la hoja nativa de compartir de iOS/Android. Tampoco se enviaron archivos a WhatsApp ni se efectuaron operaciones financieras reales de prueba.

## Mejoras propuestas

1. **Historial con búsqueda y rango de fechas.** Facilitaría revisar cuadres y movimientos cuando el historial crezca.
2. **Resumen por día o mes.** Ventas, cobros, costos recuperados, comisiones y utilidad, con exportación del periodo seleccionado.
3. **Vencimientos y lotes, si lo necesitan.** Útil para priorizar productos perecederos y registrar bajas por vencimiento.

El asesor de rendimiento también señala dos claves foráneas sin índice de apoyo: `fridge_payments.sale_id` y `fridge_menu_settings.active_version`. Es una optimización posible si crece el volumen; no se modificó el esquema durante esta auditoría. Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys . Los índices señalados como poco usados no se eliminaron.

## Repetir la verificación

Ejecutar `npm run test:fridge`. El comando revisa la sintaxis y ejecuta los grupos específicos del módulo, incluidos los nuevos casos de sesión, actualización automática y PDF. Estas pruebas no se conectan a producción.
