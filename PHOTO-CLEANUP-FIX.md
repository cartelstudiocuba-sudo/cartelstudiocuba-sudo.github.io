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

## Segunda barrera y reintentos idempotentes

Un envío real posterior devolvió 502 y el siguiente 429. La inspección del servidor del conector identificó una segunda restricción: `/api/pilot/upload` admitía hasta 20 fotos históricas, aunque la consulta de disponibilidad ya contara únicamente pendientes. Además, el puente consumía la espera de 15 segundos incluso si el servidor remoto rechazaba la foto.

- Conector privado de fotos: el límite del envío cuenta solo `queued` y `processing`, sin eliminar originales ni resultados. La consulta de trabajos admite un identificador exacto para recuperar una foto aunque ya no esté entre los 20 registros más recientes. Fuente sincronizada: `04acab12bd126f2374b2590578a5cd78a3d5f4f7`, desplegada en el mismo sitio y con los mismos accesos.
- Puente `inventory-photo-clean`, versión 5: registra la espera después de un envío aceptado, devuelve `Retry-After` y segundos restantes, conserva rechazos concretos y busca el trabajo por su identificador privado. Mantiene autorización y aislamiento entre usuarios.
- Cliente: reutiliza el identificador y el JPEG preparado para la misma foto tras una carga incierta o una espera agotada. Si recibe el límite temporal, muestra la cuenta atrás y reintenta una vez; conserva el original si no obtiene resultado. Un fallo terminal permite solicitar otro procesamiento.
- Pruebas: tres suites del conector aprobadas, nueve pruebas del puente/catálogo aprobadas y suite de interfaz de nevera aprobada. Incluyen historial mayor a 20, límite real de pendientes, reanudación, duplicados, espera automática y rechazos que no consumen cuota.
- Verificación de producción: una imagen técnica creada para la prueba fue aceptada con los 20 registros históricos presentes; su reenvío conservó el mismo trabajo y una sola entrega de evento aceptada. No se cambió ningún producto, foto de producto, stock ni dato comercial. El trabajo de prueba se conserva como tal en el servicio de imágenes.

Para revertir el conector, desplegar su versión anterior desde su repositorio de Sites. El puente y el cliente se revierten desde el commit anterior de este repositorio. No hay migración de base de datos.
