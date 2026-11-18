# API oficial de elTOQUE · 18 de noviembre de 2026

Se sustituye la extracción de HTML por `GET https://tasas.eltoque.com/v1/trmi`, con autorización Bearer exclusivamente en el servidor. Documentación: https://tasas.eltoque.com/docs/.

## Cobertura revisada

| Vista | Comportamiento |
| --- | --- |
| Dashboard principal, tarjeta lateral/móvil y diálogo | Referencia oficial; actualización al regresar a la pestaña, abrir el diálogo y cada 15 minutos con la página visible. |
| Inventario de insumos, compra en CUP | Tasa sugerida al abrir la conversión; ajustar sigue disponible; aplicar exige confirmación. |
| Inventario general, estimado total en CUP | Referencia oficial, fecha de consulta y reintento; no altera la valoración guardada en USD. |
| Nevera, entrada y reposición | Precarga de la tasa de compra, editable. |
| Nevera, venta y cobro de cuenta | Precarga del cambio; conserva la tasa manual y registra el origen de la tasa utilizada. |
| Cuadre, vista de revisión y distribución | Referencia actual sugerida; equivalencias en USD/CUP; edición manual conservada durante la revisión. |
| Cuadre confirmado | Utiliza la tasa confirmada en el recibido; para registros antiguos utiliza el último cobro histórico en CUP. Nunca sustituye esa tasa por la actual. |

La búsqueda de consumidores de tasas en HTML/JS no encontró otros campos de configuración. Las menciones en RRHH son indicadores estadísticos, y la carta pública solamente muestra una nota sobre pago en CUP.

## Operaciones y protección

- La credencial está en Vault con el nombre `eltoque_api_token`; no forma parte del repositorio ni llega al navegador. El getter RPC y el bloqueo de actualización tienen permiso de ejecución únicamente para `service_role`.
- Caché compartida de 15 minutos. Una solicitud explícita de actualización respeta un mínimo de 60 segundos. Bloqueo de 30 segundos entre instancias y agrupación de solicitudes concurrentes dentro de la función.
- HTTP 429 respeta `Retry-After` con límites, y las fallas aplican una pausa. Las respuestas de error no incluyen cuerpos del proveedor, encabezados ni credenciales.
- Se valida USD positivo, acotado, numérico, fecha de origen reciente y fecha de consulta. No se inventan monedas que la API no devuelve.
- Una falla no cambia datos financieros: se informa que no se pudo verificar la referencia y se mantiene la posibilidad de introducir una tasa manual. Los datos anteriores se marcan como tales y no se aplican como referencia vigente.
- La respuesta tardía no reemplaza una tasa escrita o borrada por el usuario ni rellena un formulario que ya se cerró.
- Los cobros existentes, las compras guardadas, los snapshots y las tasas de confirmaciones anteriores no se reescriben.

## Validación

- Consulta real a la API oficial: HTTP 200 con la credencial aprobada y JSON `date/hour/minutes/seconds/tasas` válido.
- Servicio desplegado activo. Solicitud sin sesión a la función: HTTP 401.
- Denegación real de los RPC privados con clave pública: `42501`.
- `npm run test:exchange-rates`: 16 pruebas más permisos/lease en PostgreSQL aislado.
- `npm run test:fridge`: 37 suites, 12 verificaciones de sintaxis.
- Sintaxis de scripts incrustados en los cuatro HTML modificados y `git diff --check`.
- Asesores de seguridad: mismos avisos preexistentes antes y después; ningún aviso nuevo para los RPC de elTOQUE.

No se realizaron ventas, cobros o aprobaciones de negocio para probar la integración. No se dispuso de una sesión interactiva autenticada para ejecutar el recorrido completo desde un navegador real. Las interacciones se comprobaron con DOM y servicios simulados; la consulta del proveedor y las restricciones de acceso sí se verificaron en vivo.

## Mantenimiento

La rotación de la credencial se hace en Vault, conservando su nombre. También se admite el secreto de entorno `ELTOQUE_API_TOKEN`, que tiene prioridad. Nunca pegar la credencial en código, migraciones, documentación, URLs o logs.
