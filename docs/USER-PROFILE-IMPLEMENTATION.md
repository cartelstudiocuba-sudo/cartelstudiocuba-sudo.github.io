# Ficha del usuario y medios asignados

La ficha de Usuarios conserva el directorio `system_list_users`, los editores de expediente, roles y vistas, las invitaciones y la aplicación explícita de plantillas. Las siete pestañas reorganizan esos accesos y muestran datos del expediente laboral vinculado; no crean cuentas ni contratos. La ficha y las subpantallas conservan el trabajador seleccionado en la URL.

## Archivos

- `usuarios-permisos.html`: carga la presentación nueva.
- `assets/user-profile.js` y `assets/user-profile.css`: encabezado, pestañas, paneles, accesibilidad, documentos privados y gestión de asignaciones.
- `assets/users-roles.js`: conecta la presentación con los seis accesos existentes y corrige las iniciales del avatar.
- `assets/role-templates.js`: evita la doble apertura y restaura la selección después de guardar permisos.
- `assets/loading-runtime.js`: regreso desde Plaza al usuario seleccionado; conserva el cierre de sesión previo.
- `trabajador-ficha.html`: apertura directa de la sección contractual existente y regreso a Usuarios.
- `sql/user-profile-assets.sql`: ampliación compatible del registro de asignaciones y APIs protegidas.
- `tests/user-profile-sql.cjs` y `tests/user-profile-browser.cjs`: pruebas aisladas y de navegador.

## Arquitectura y seguridad

`hr_employees.system_auth_user_id` vincula Auth; el identificador del expediente es `employee_id`. Plaza usa `role_id`, contratos usan `hr_hiring_cases.employee_id`, documentos y medios usan el mismo expediente. Se reutilizan los eventos de candidatos, permisos, roles y bajas en el historial. Los estados de acceso y laborales se muestran por separado.

Migración Supabase `user_profile_existing_employee_assets`: añade `asset_code`, `assigned_by` y `returned_by` a `hr_employee_assets`, con índice único por código normalizado mientras la asignación esté activa. No modifica filas previas, RLS, roles, permisos, vistas ni contratos. Las funciones públicas invocan funciones privadas con comprobación de propietario y `search_path` vacío. No conceden permisos a `anon`.

`system_user_profile` consulta sin crear bajas ni recibos. `system_employee_asset` serializa operaciones por trabajador y código, rechaza fechas inválidas, asignaciones duplicadas y medios ajenos, registra al operador y añade auditoría en el registro existente. Impide nuevas entregas durante una baja y cambios después de una baja definitiva.

Las devoluciones de una baja usan `studio_offboarding_private.manage(...,'receipt',...)` y su revisión vigente, sin sustituir sus reglas ni su aprobación final. La fuente del Paso 13 sigue siendo `hr_employee_assets`. La ficha consulta los recibos reales y se actualiza al regresar a la ventana, al volver de una subpantalla o mediante Actualizar. El formulario autorizado del trabajador permanece intacto.

Los documentos y retratos se descargan mediante Storage autenticado. No se crean enlaces públicos. El contrato se consulta con el renderer existente, sin cambiar documentos ni plantillas.

## Validación y límites

- 24 comprobaciones de PostgreSQL aislado con datos sintéticos: autorización, unicidad, fechas, pertenencia, entrega/devolución, auditoría, concurrencia de revisión y coherencia con bajas.
- 33 comprobaciones existentes del Paso 13 aprobadas.
- Navegador a 320, 390 y 1440 px: siete pestañas, seis accesos originales, guardado de expediente/roles/vistas, documentos autenticados, estados vacíos y con datos, asignación/devolución, incidencia, baja, usuario sin expediente, bloqueo de acceso y selección persistente. Todas las solicitudes Supabase de estas pruebas se interceptan; no escriben datos reales.
- Consulta real de las cinco fichas en Supabase verificada proyectando únicamente conteos y tipos. Accesos anónimos y no propietarios rechazados sin escrituras. Las huellas de trabajadores, roles, vistas, documentos y bajas coinciden antes y después de la migración; medios continúa con cero filas.
- Las advertencias de seguridad existentes no aumentaron después de la migración. Las tablas privadas sin políticas están cerradas por diseño; no se abrió RLS.
- El inventario disponible es de insumos por cantidades; no hay catálogo de equipos individualizados compatible. La asignación registra la entrega de un medio físico identificado por su código en el registro existente, sin duplicar un inventario. No puede comprobar físicamente su existencia. No se inventaron equipos, evaluaciones ni vigencias contractuales ausentes.
- Las operaciones de escritura se probaron únicamente en aislamiento o con respuestas sintéticas. No se ensayaron entregas ni devoluciones sobre trabajadores reales. Las capturas contienen exclusivamente datos sintéticos.

La referencia de implementación es la especificación detallada proporcionada por el usuario. No se obtuvo una imagen adicional de la ficha aprobada durante esta tarea.
