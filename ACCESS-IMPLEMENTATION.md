# Usuarios y Roles — 18 de octubre de 2026

Se parte del commit `b9484e1`, sin reconstruir páginas, expedientes ni inventario. Se revisaron los commits recientes de inventario y gestión de usuarios, el historial de migraciones, Auth, las definiciones de las funciones y las políticas efectivas.

## Modelo aplicado

- `system_employee_role_assignments` es la única fuente de asignación de roles, con historial y una asignación activa por empleado/rol. Varios roles acumulan permisos.
- `system_user_role_grants` estaba vacía. Se conserva como archivo, se retiran los permisos de acceso de clientes y deja de intervenir en la autorización. El RPC anterior delega al modelo por empleado.
- `system_role_module_permissions` configura lectura/escritura por rol y módulo. Insumos permite ambas opciones; RRHH y Usuarios y Roles se mantienen reservados al propietario, también por servidor.
- Una cuenta Auth solo puede vincularse a un expediente. El nombre de usuario y el correo de cuenta tienen índices únicos. Los cambios de matriz, roles y vínculos quedan auditados en un esquema privado.
- Las políticas existentes de Insumos y el RPC de movimientos consultan la nueva matriz mediante `inventory_has_access`. Las comprobaciones usan tablas del servidor, sin confiar en metadatos editables por usuarios ni esperar a refrescar el token para retirar permisos.
- Se habilitó RLS en las cuatro tablas de expedientes antes desprotegidas y se añadió una barrera restrictiva de propietario a todas las tablas `hr_*`. Las funciones públicas de candidaturas y convocatorias existentes se preservan.

## Cuentas previstas

| Expediente existente | Usuario | Rol | Insumos | Estado |
|---|---|---|---|---|
| Alejandro Garcés Noriega | alejandro.garces | Administrador | Lectura y escritura | Rol preparado, sin Auth; plaza Administrador vinculada |
| Melanie Medina Olivares | melanie.medina | Gestor Comercial de Gráfica | Solo lectura | Rol preparado, sin Auth; ficha de plaza pendiente |

No se modificó el estado laboral de ninguno de los expedientes. No se crearon identidades con correos inventados o compartidos. Auth contiene únicamente la cuenta propietaria.

## Interfaz y autenticación

Se mantiene el diseño de Usuarios y Roles y se añade la matriz editable. La pantalla muestra las cuentas pendientes y permite invitar con un correo individual real. La función `system-account` comprueba la sesión propietaria y toda la lista Auth antes de invitar o vincular una cuenta existente. No genera ni guarda contraseñas; cada trabajador las establece desde su enlace personal. El acceso admite usuario o correo. El servicio de login requiere autenticación por contraseña contra Supabase Auth; las demás acciones exigen sesión del propietario. El acceso del navegador usa exclusivamente una clave publicable.

La navegación consulta permisos del servidor y oculta módulos no autorizados. La ficha de acceso del trabajador refleja los roles canónicos y la matriz, conservando el resto del expediente. La navegación no sustituye RLS.

## Verificación realizada

- `tests/verify-access.sql`: transacción real con rol PostgreSQL `authenticated`; entrada y actualización de stock administrativas; lectura comercial; denegación de escritura comercial por RPC e inserción directa; ausencia de datos de RRHH; rechazo de autoasignación y cambios de matriz por comerciales; unión de roles, retirada inmediata, cuenta deshabilitada y matriz aplicada sin refrescar tokens. Todo se revierte al finalizar.
- `tests/verify-ui.cjs`: sintaxis de páginas y scripts, referencias de recursos, permisos de navegación obtenidos del servidor y errores de red.
- Pruebas HTTP de la función desplegada: invitación sin autorización 403, login inválido 401 y preflight CORS 204. No se enviaron correos de prueba.
- Tras las pruebas: tres expedientes originales, una cuenta Auth y cero productos de prueba.
- Asesor de seguridad: sin nuevas advertencias sobre las funciones de permisos; conserva avisos previos sobre funciones públicas de contratación, tablas deliberadamente cerradas y protección de contraseñas filtradas deshabilitada. No se cambió la configuración global de Auth.

## Pendiente y límites

Faltan los correos individuales reales de Alejandro y Melanie. No se ha probado el envío de una invitación real ni el ingreso con sus cuentas porque todavía no existen. La plaza Gestor Comercial de Gráfica no existe en `hr_roles`; se conserva el título del expediente de Melanie sin inventar una ficha laboral. La vista requiere completar ese vínculo antes de invitarla.

La prueba visual local con el navegador integrado no pudo conectarse al servidor local. Esto no sustituye la verificación posterior de publicación ni las pruebas reales de RLS detalladas arriba.
