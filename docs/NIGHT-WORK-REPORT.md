# Cartel Gestión — trabajo nocturno

## Producción y cambios pendientes

Producción actual: `6b01e4ca865c863472fe7c3a2e830e1dd58c18f1`. GitHub Pages y paridad de contratos finalizaron correctamente. Incluye el bloque `76a5f2ce633f19746151dabf829ed7309810f63b`: login oscuro accesible, recordatorios manuales de entrevistas de mañana según America/Havana y ocultación del acceso visual público indicado en Captación. Añade guardado del mensaje de activación antes de abrir WhatsApp, reintento sin ventana duplicada, carga compartida de ficha y tolerancia de recordatorios. Los tres archivos servidos coinciden exactamente con la versión probada (`evidence/safe-publication.json`). Ficha repetida contra producción a cuatro tamaños, login/recordatorios cinco casos y activación con el archivo descargado de producción a 390/1440 px, todos aprobados con servicios sintéticos. La ocultación tiene revisión de código; falta comprobación DOM específica en vivo.

Implementado y probado, sin desplegar: catálogo individual de medios, alta directa de ocho etapas y su integración con ficha/bajas. Rama `night/employee-assets-pending-migration`, commit `206f8f5e48d658ab40cd7e7c1755740538b1d41b`. La confirmación obligatoria de Supabase caducó dos veces. Un primer fallo de separador SQL se revirtió por completo, se corrigió y se volvió a probar como paquete concatenado. No se cambió de herramienta para eludir la confirmación.

Segundo commit de la rama pendiente: `6e6b17ae1f4616804eae59ce1b75a8078e286e00`. Conserva permisos de nuevas cuentas sin herencia automática de vistas y reducción de grants anon innecesarios; ambos con pruebas SQL aisladas aprobadas, sin aplicar en producción. La rama pendiente debe integrar después el commit seguro de main y resolver cualquier diferencia antes de desplegar.

El entorno local tuvo fallos al iniciar procesos, incluido System.Diagnostics.Process, y luego se recuperó. Se terminó la prueba de activación y la ausencia en agenda. Las pruebas que siguen fallando no se consideran aprobadas.

## Las 36 tareas

Auditada significa comprobado el alcance indicado; no certifica todos los casos posibles. Pendiente de migración significa preparada, sin publicar.

| Nº | Estado y alcance |
|---|---|
| 1 | Auditada: ficha de siete pestañas; versión anterior publicada conservada. |
| 2 | Parcial: navegación, ficha y diálogos con sesiones sintéticas; no todos los botones globales. |
| 3 | Publicada: coalescencia de carga; sin medición comparativa completa de latencia real. |
| 4 | Auditada: editores y funciones originales reutilizados; enlace a plaza aclarado como consulta en código pendiente. |
| 5 | Auditada; ampliación pendiente: documentos/contratos conservados y fuente histórica firmada preparada para baja. |
| 6 | Verificada: ficha y nuevos formularios a 320, 390, 768 y 1440 px; formularios nuevos sin publicar. |
| 7 | Pendiente de migración: catálogo individual separado del inventario por cantidades. |
| 8 | Pendiente de migración: categorías administrables con control de acceso. |
| 9 | Pendiente de migración: códigos/series únicos, búsqueda y filtros. |
| 10 | Pendiente de migración: disponibilidad, conservación, ubicación, responsable e historial separados. |
| 11 | Pendiente de migración: asignaciones reutilizan hr_employee_assets. |
| 12 | Pendiente de migración: constancias imprimibles sin firmas simuladas. |
| 13 | Pendiente de migración: devolución integrada con revisión y controles del Paso 13. |
| 14 | Parcial: ruta de seis etapas y navegación verificadas; sin ciclo con personas reales. |
| 15 | Parcial: cuestionarios SQL y ausencia en agenda aprobados. El simulador necesitó separar consultas de permiso/recordatorio de acciones. La prueba antigua de decisión unificada sigue buscando un botón de ausencia retirado de la ficha; queda pendiente de adaptar y terminar. |
| 16 | Parcial: regresiones previas de contrato; prueba adicional de retorno al candidato falló por tiempo de espera, pendiente de resolver. |
| 17 | Parcial: almacenamiento privado y flujos conservados; no se revisó visualmente cada PDF/foto real. |
| 18 | Auditada: apertura de WhatsApp separada del envío confirmado; no hubo mensajes reales. |
| 19 | Corrección preparada y probada en SQL: nuevas cuentas reciben permisos del rol sin vistas automáticas; preserva plantillas y accesos anteriores. Sin migración. |
| 20 | Verificada: Baja ya aparece después de Contratación; conservado. |
| 21 | Auditada: puertas de validación de baja probadas en aislamiento. |
| 22 | Mejora pendiente: editar mensaje invalida apertura/confirmación previas; confirmación repetida idempotente. |
| 23 | Auditada: formularios y controles de baja con datos sintéticos. |
| 24 | Integración pendiente: catálogo, conservación observada y receptor en devoluciones. |
| 25 | Auditada/ampliación pendiente: documentos y contrato histórico sin contratación ficticia. |
| 26 | Auditada: puertas de revocación y cierre conservadas; ninguna cuenta real revocada. |
| 27 | Auditada; endurecimiento pendiente: todas las tablas públicas con RLS. Grants anon innecesarios en tres tablas HR, corrección probada sin aplicar. Avisos anteriores de funciones definer y protección de contraseñas filtradas continúan abiertos. |
| 28 | Verificación real limitada: cuatro rutas de documentos privados rechazaron HEAD anónimo con HTTP 400; sin descargar cuerpos ni divulgar rutas. |
| 29 | Verificada con servicios sintéticos: SQL/Edge y navegador de activación aprobados; guardado del mensaje publicado y repetido con el archivo servido. No se enviaron correos ni se activaron cuentas reales. |
| 30 | Parcial: suites publicadas verificadas; no se afirma cero errores globales por las pruebas adicionales incompletas. |
| 31 | Parcial: carga compartida publicada; sin comparación completa de rendimiento real. |
| 32 | Realizada con pendientes: suites, evidencia e informe; fallos y bloqueos explícitos. |
| 33 | Publicada: ocultación exclusiva por selector del enlace de Captación; módulo y otros accesos conservados. Falta prueba DOM específica en vivo. |
| 34 | Publicada/verificada: mañana en La Habana, confirmación manual, duplicados e incidencias controlados. |
| 35 | Publicada/verificada: login oscuro y control accesible de contraseña; Auth conservado. |
| 36 | Pendiente de migración: ocho etapas, borradores privados, duplicados, términos históricos, documentos y medios; sin candidatos ficticios, invitaciones ni activaciones automáticas. |

## Pruebas aprobadas

- Regresión: 16 de 16 archivos; `evidence/regression-results.json`.
- Catálogo/alta: 36 comprobaciones SQL del paquete completo y navegador en cuatro tamaños.
- Bajas actualizadas: 35 comprobaciones SQL y 36 de navegador en 390/1440 px.
- Vistas explícitas: suite SQL aprobada, accesos anteriores preservados.
- Grants anon: 21 privilegios retirados en aislamiento, autenticados y filas conservados.
- Recordatorios: 16 comprobaciones SQL.
- Bloque prioritario: cinco casos locales y cinco con recursos publicados; `evidence/live-priority-results.json`.
- Ficha publicada: cuatro tamaños con servicios sintéticos y recursos en vivo.
- Navegación de entrevistas: dos tamaños; ruta de seis etapas: diez combinaciones de diseño, sin escrituras reales.
- Cuestionarios por plaza: suite SQL adicional aprobada. Ausencia en agenda: 320/390/1440 px, doble envío, recarga y evaluación conservada; cero escrituras reales.
- Activación: prueba completa a 390/1440 px, guardado/recuperación del mensaje, enlace secreto sustituido por marcador, bloqueo de ventanas, reintento sin duplicación, verificación de correo y contraseña, todo con servicios sintéticos. Repetida con archivo servido en producción.
- Logout anterior: 51 casos locales/en vivo, commit `aae3146cf3b166e5ec306e5bb62e66b502e049fd`.

No sumar estos números como casos únicos: hay suites solapadas y repeticiones local/en vivo. Decisión unificada y retorno al candidato NO se contabilizan como aprobados.

## Datos, migraciones y continuación

La única migración aplicada en esta tanda fue manual_interview_reminders_havana; su tabla seguía vacía tras verificar. La migración de dominio no dejó tablas/bucket parciales: studio_assets, employee_drafts y hr-employee-private ausentes. La comprobación posterior conservaba cinco trabajadores y cero asignaciones. No se crearon trabajadores, candidatos, equipos, documentos, bajas ni cuentas reales para probar; no se alteraron permisos personales ni se enviaron WhatsApps/correos.

Siguiente paso: terminar las dos pruebas antiguas pendientes e integrar main en la rama. Completar la confirmación obligatoria de migraciones, verificar backend/RLS/datos y solo entonces publicar lo dependiente. El orden de seis archivos SQL está en `../account-redesign/docs/NIGHT-DOMAIN-PENDING-MIGRATION.md`. Después, aplicar juntas explicit-new-account-views.sql y onboarding-permissions-only-functions.sql; la reducción de grants está en hr-anonymous-grant-hardening.sql. Ninguna de estas migraciones adicionales fue aplicada.

