# Limpieza de fondo: rechazo inmediato por cola falsa

Corrección del 14 de noviembre de 2026. Los registros de la nevera mostraban consultas de disponibilidad con respuesta en 385–1074 ms y sin envío posterior de imagen. La cola compartida reportaba 19 trabajos terminados y uno pendiente. La función sumaba todos los estados y, al alcanzar 20 registros históricos, devolvía `available:false` aunque solo hubiera una foto pendiente.

## Cambios

- `supabase/functions/inventory-photo-clean/bridge.mjs`: la capacidad cuenta únicamente `queued` y `processing`; los completados y fallidos no ocupan cola. Conserva el límite de 20 trabajos simultáneos y la comprobación de suscripción activa. Respuestas de disponibilidad distinguen cola llena y conexión inactiva.
- `assets/catalog-photo.js`: conserva el motivo específico del servicio y la foto original optimizada cuando falla. No guarda como válida durante 20 segundos una respuesta negativa: un reintento vuelve a consultar la disponibilidad.
- `nevera-audiovisual.html`: versión de recurso actualizada.
- Pruebas: regresión con 19 completadas y una pendiente; historial de 1000 completadas/100 fallidas; límite real de 20 pendientes; desconexión; reintento inmediato tras indisponibilidad; permisos, aislamiento, idempotencia y retorno de imagen.

Siete pruebas del puente y catálogo aprobadas, más la suite de interfaz de la nevera. Sintaxis y diff correctos. La función `inventory-photo-clean` quedó activa en versión 4 y su código desplegado coincide con el repositorio. Conserva la autenticación de usuario y las comprobaciones de permiso propias de la función (la verificación JWT del gateway sigue desactivada como antes). No se modificaron inventario, fotos guardadas, suscripciones ni datos de productos. No se eliminan registros históricos para liberar capacidad.

El resultado corregido se comprobó con el estado real de la cola y con pruebas reproducibles del protocolo. No se cargó una fotografía ficticia en producción ni se verificó una nueva limpieza completa desde la sesión del usuario en este ajuste. La siguiente foto del usuario permitirá confirmar ese recorrido de extremo a extremo. Los registros sí muestran una descarga de resultado completada antes del bloqueo.

Reversión: restaurar los archivos del commit anterior y desplegar las dependencias anteriores de `inventory-photo-clean`. La corrección de disponibilidad en el servidor puede conservarse independientemente de la presentación del aviso.
