# Corrección de contratación y correo de acceso — 2026-11-11

El Paso 11 reabierto desde el 12 mostraba únicamente «Continuar a inserción en sistema». `candidateGuidedFlow` reemplazaba sus acciones por ese botón y `candidatePreviousStep` excluía al contratado con `hiring_reopened`. La gestión documental existente quedaba inaccesible desde la ruta.

Se recuperan la preparación de WhatsApp, la revisión del expediente, la consulta y descarga del contrato guardado y las confirmaciones según el estado documental. La contratación ya formalizada se consulta sin habilitar modificaciones. El renderizador contractual v2 y las plantillas emitidas permanecen intactos.

El retroceso de un contratado del 11 al 10 registra una revisión de navegación en el historial; no revierte su contratación, notificaciones, documentos ni cuenta. El 10 permite consultar sus datos de adiestramiento y regresar al 11. Se conserva la flecha del 12 en la ficha; no se añade una flecha al diálogo de acceso. La ficha permanece abierta durante 12 → 11 → 10 → 11 → 12.

En una configuración nueva sin cuenta, el correo se precarga desde el expediente laboral vigente, con el correo anterior como respaldo. En borradores y cuentas vinculadas se conserva la fuente de la cuenta. El campo es editable y obligatorio; si no hay correo permanece vacío. Se mantienen las validaciones del servidor, las restricciones únicas y las comprobaciones de identidad antes de crear una cuenta. Cambiar este campo no escribe en `hr_hiring_cases.data` ni en el formulario del candidato. Se conserva el usuario sugerido y la selección de un solo rol, sin selector de vistas individuales ni pantalla de cuenta existente.

## Verificación

- `tests/step12-return-sql.cjs`: autorización, reconocimiento de cuenta activa, navegación persistente 10/11/12, rechazo de saltos desde 10, historial, conservación de empleado/contrato/cuenta y bloqueo por baja.
- `tests/onboarding-fresh-sql.cjs`: acceso privado/RLS, cuentas existentes, duplicados, permisos, activación y formalización idempotente con documentos pendientes/completados.
- `tests/hiring-flow-sql.cjs`: permisos de propietario/anónimo, tokens, archivos privados, versiones, revocación y transferencia documental.
- `tests/step12-return-browser.cjs`: 320/390/1440 px, ficha abierta, recarga, cancelación, fallo/reintento, retrocesos y ausencia de flecha en el diálogo del 12.
- `tests/onboarding-fresh-browser.cjs`: 320/390/1440 px, correo presente/ausente, formato, duplicado rechazado, rol único, cuenta vinculada y concurrencia.
- `tests/hiring-review-browser.cjs`: 320/390/1440 px, expediente pendiente/recibido/validado/formalizado, confirmaciones, documento heredado, contrato original/PDF y escape de texto.
- `tests/hiring-flow-browser.cjs` y `tests/hiring-whatsapp-browser.cjs`: formulario público, contrato/PDF, mensaje editable, ventanas bloqueadas, reintento, reapertura y recuperación del avance.
- Comprobaciones de paridad del contrato y de los dos puntos de entrada `rrhh.html`/`rrhh-20261101.html`.

Las pruebas de escritura se ejecutan con PostgreSQL local y respuestas interceptadas del navegador. No envían mensajes ni crean cuentas reales. La comprobación del caso reportado en producción es de solo lectura, con comparación de huellas antes/después de publicar.

## Publicación

Aplicar `sql/hiring-route-restoration.sql` mediante la herramienta de migraciones de Supabase y publicar los dos HTML y `assets/hiring.js`/`assets/onboarding.js` en GitHub Pages. La migración solo actualiza funciones; no actualiza filas existentes. Las versiones de los assets en los HTML fuerzan la descarga de la corrección. Verificar los archivos públicos contra el commit publicado.
