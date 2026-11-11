# Paso 12: configuración nueva y cuenta existente

Publicado el 11 de noviembre de 2026.

La configuración nueva/reiniciada usa `suggested_username`, calculado en el servidor a partir del nombre de la candidatura, normalizado y con sufijo numérico para colisiones. No usa `username`, `email`, `pending_email` ni `role_id` persistidos. Correo y perfil comienzan vacíos y el resumen está oculto hasta seleccionar un perfil. La edición explícita de un borrador anterior a crear Auth conserva sus datos.

Cuando hay cuenta o acceso protegido, se muestra una pantalla de revisión sin formulario de alta ni botón Guardar bloqueado. Revisar o modificar acceso abre la pestaña Acceso de la misma ficha. En un regreso 13→12 se puede elegir Continuar con la cuenta actual: únicamente confirma el subpaso y registra historial. No sustituye usuario, correo, roles, permisos, vistas ni Auth. La antigua acción `review_configure` rechaza solicitudes de pantallas anteriores. Los subpasos dicen Revisar acceso existente y Preparar notificación, sin ofrecer crear otra cuenta.

La propuesta elimina la etiqueta inicial «CANDIDATO DE PRUEBA —» antes de normalizar el nombre. La candidatura original no se modifica. Los botones tienen tamaños equilibrados en escritorio y se apilan en móvil.

El servidor valida usuario/correo, duplicados también en Auth, perfil activo y revisión de permisos antes de guardar una configuración nueva. Se conservan las restricciones únicas, las comprobaciones de propietario, el bloqueo por baja y los controles de concurrencia de la revisión. El formulario conserva lo escrito tras errores y permite reintentar la consulta de permisos.

## Verificación

- `tests/onboarding-fresh-browser.cjs`: 36 casos en 320/390/1440 px. Campos vacíos, propuesta editable, obligatorios, correo inválido, duplicados, reintento sin perder datos, permisos, creación simulada, cuenta existente y protección contra envío programático.
- `tests/onboarding-fresh-sheet.cjs`: `rrhh.html` real con servicios simulados en 390/1440 px. Retroceso 13→12, retorno a ficha, gestión separada, pestañas de acceso/historial, candidatura vecina intacta. La pantalla interna de gestión se sustituye por un documento neutro; esta prueba verifica navegación, no sus operaciones.
- `tests/onboarding-fresh-sql.cjs`: PostgreSQL aislado con las funciones reales. Normalización y colisiones, campos/duplicados/revisión inválidos, creación y activación, permisos, protección de cuenta existente, revisión obsoleta, historial y recorrido completo de revisión. Compara trabajador, Auth, roles y permisos antes/después del retroceso.
- Regresiones `tests/onboarding-sql.cjs` y `tests/onboarding-edge.cjs`: aprobadas. Creación, recuperación de fallo parcial sin duplicar Auth, activación, autorización y permisos existentes.
- Producción: función actualizada sin operaciones sobre registros. Huellas antes/después idénticas para 177 candidaturas, 6 trabajadores, 6 cuentas Auth, 5 asignaciones de perfil, 4 vistas y 1 progreso de inserción. Lectura autenticada confirmó propuesta y detección de cuenta existente. Sin creación de cuentas ni envío de mensajes reales.
- Revisión de seguridad: se mantienen los permisos de ejecución existentes; `anon` no puede ejecutar `system_onboarding`. Los avisos generales previos del proyecto no son modificaciones de esta entrega.

## Despliegue

Aplicar `sql/onboarding-fresh-configuration.sql` para una instalación completa. Para actualizar la primera entrega, `sql/onboarding-clean-username-proposal.sql` modifica únicamente el cálculo de propuesta, conservando el resto de la función desplegada. Publicar los archivos estáticos. Se actualiza la versión de `assets/onboarding.js` y de sus estilos en ambas páginas de RRHH para renovar la carga. No se modifican otros pasos ni datos de candidatos.
