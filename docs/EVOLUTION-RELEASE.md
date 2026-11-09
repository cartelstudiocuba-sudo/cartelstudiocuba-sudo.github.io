# Ficha única evolutiva — 8 de noviembre de 2026

## Resultado

La ficha existente de rrhh.html es la entrada única para candidatura y trabajador. Se añaden Selección, Expediente laboral, Acceso e Historial debajo de la ruta de incorporación. La cabecera, los seis iconos y los componentes interiores de Selección mantienen su construcción original. La integración agrupa el cuerpo sin reordenarlo, y reutiliza los editores laborales y administrativos dentro de secciones protegidas del mismo origen.

La ruta canónica de un trabajador es `/rrhh.html?employee=<id>&person-tab=labor`. Si tiene candidatura se abre su ficha original; si procede de alta directa se muestra su expediente sin crear candidatura, entrevista o prueba. La ruta antigua trabajador-ficha redirige a esta entrada; su consulta detallada se reutiliza internamente para conservar campos y documentos originales. La administración técnica ya no presenta una segunda ficha laboral de siete pestañas.

## Inventario y ubicación

La auditoría obligatoria anterior a la integración está en [EVOLUTION-AUDIT.md](EVOLUTION-AUDIT.md), con el inventario complementario [evolution-original-inventory.json](evolution-original-inventory.json).

| Funcionalidad original | Ubicación |
|---|---|
| Cabecera, foto, contacto, plaza, estado, archivos, PDF e información de plaza | Cabecera original; Archivos conserva su visor; Historial abre la pestaña correspondiente. |
| Acciones rápidas, información personal, resumen, aplicación, entrevista/cuestionario, evaluación, prueba, adiestramiento y contratación | Selección, con los mismos componentes y operaciones. |
| Datos personales y laborales, emergencia, formación, direcciones, documentos/notas y consulta de plaza | Expediente laboral → Información y sus editores originales. |
| Contrato vigente, condiciones históricas, registros anteriores de plaza/vínculo y documentos contractuales | Expediente laboral → Contrato / Documentos / consulta detallada original. |
| Desempeño, medios, asignación/devolución/incidencias y baja | Subsecciones de Expediente laboral. Se conserva el registro de medios existente. |
| Usuario, correo, estado, creación, último acceso, activación y otros accesos registrados | Acceso; Gestionar acceso conserva el flujo original o abre los controles de la cuenta directa. |
| Roles/permisos, vistas asignadas y plantillas aplicadas | Acceso → Permisos / Vistas. Los permisos se heredan del rol; las vistas requieren asignación o aplicación explícita. |
| Eventos originales de candidatura, roles, permisos, medios y baja | Historial, con fechas y responsables disponibles. Los registros de plaza se consultan desde la misma respuesta protegida. |
| Candidatura, entrevista y períodos de prueba originales | Historial → Registros originales de selección; respuestas y evaluaciones completas permanecen en Selección. No se insertan eventos derivados del estado actual. |
| Directorio con búsqueda y filtros, alta de ocho etapas y borradores | Recursos Humanos → Trabajadores y Agregar nuevo usuario. |
| Cuentas técnicas, roles y plantillas persistentes | Usuarios y Accesos → Roles y permisos / Vistas y plantillas / Administración de cuentas. |

Contratados y Bajas desaparecen del menú lateral como entradas independientes; sus estados, datos y procesos permanecen. No se desarrolla Inventario General ni se cambia la etapa de medios del alta.

## Paso 12 y continuidad

La configuración guardada o un acceso anterior protegido deja Paso 13 — Efectuar baja como siguiente acción, sin ejecutar ninguna baja. Crear la cuenta, preparar activación y notificar siguen siendo acciones explícitas recuperables mediante Gestionar acceso. Se conservan los estados distintos de configuración, cuenta creada, notificación y activación. El estado Contratado no acredita por sí solo contrato firmado ni expediente formalizado: el flujo original sigue verificando ambas condiciones.

Los trabajadores sin cuenta y las altas directas no deben recorrer etapas de selección que no les corresponden. Los enlaces heredados de los editores de expediente y plaza regresan a la ficha en lugar de abrir Contratados. Los formularios y consultas conservan una ruta de regreso a la misma persona y pestaña. Las subinterfaces conservan su estado al cambiar de pestaña; los diálogos tienen un tamaño acotado para seguir siendo utilizables en móvil. La navegación por teclado de una sección integrada no atrapa el foco como si fuera una ventana modal independiente.

## Cambios imprescindibles de base de datos

1. `evolution_explicit_employee_access`, archivo `sql/evolution-employee-access.sql`: nueva operación de suspensión/reanudación del acceso a la plataforma. Exige propietario, confirmación en interfaz y estado esperado; protege al propietario y a trabajadores dados de baja. No activa cuentas pendientes ni desbloquea Auth. La reanudación exige una suspensión anterior y cuenta confirmada/no bloqueada. Registra auditoría y conserva estado laboral, roles y vistas. Los reintentos idénticos no duplican el registro.
2. `evolution_owner_profile_position_history`, archivo `sql/evolution-profile-history.sql`: añade registros existentes de plaza/contrato a la respuesta de system_user_profile mediante un helper privado autorizado. La tabla original tiene RLS sin políticas de lectura cliente; se evita abrir nuevas políticas. El perfil anterior se conserva y solo se añade position_history.

Ambas migraciones están aplicadas. Los wrappers públicos son SECURITY INVOKER; los helpers privados validan propietario, usan search_path vacío y están denegados a anon/PUBLIC. No se añaden tablas, cuentas ni expedientes; no se migran datos ni se cambian políticas RLS o permisos individuales.

## Pruebas

La evidencia reproducible se genera con `node tests/evolution-verification.cjs <grupo>`: matrix, actions, access, audit, regression, remaining, stage, public y deployed. Los resultados y registros locales se conservan en la carpeta evolution-evidence, fuera del sitio publicado.

- Matriz de 48 combinaciones: 12 estados en 320, 390, 768 y 1440 px. Incluye candidato nuevo, entrevista, prueba, adiestramiento, contratación, trabajador con acceso, sin cuenta, alta directa, baja, pendiente, suspendido y configuración pendiente.
- Acciones en 320/1440 px: edición/guardado personal, historial contractual, asignación/devolución de medios, descarga PDF sintética, confirmación/cancelación de suspensión y reanudación, vistas asignadas, permisos, plantillas persistentes, directorio laboral y técnico, regreso de consulta detallada, recuperación de error, recarga de pestaña y teclado.
- 14 comprobaciones SQL aisladas de suspensión/reanudación y 11 de historial protegido, incluyendo no propietario, anon, propietario protegido, activación pendiente, cuenta bloqueada, baja, conflicto, reintento idempotente, ausencia de lectura RLS y aislamiento entre expedientes.
- 25 comprobaciones de preservación, sintaxis y exclusión de inventario. Las funciones originales approvedCandidatePanel, openDetail y visores de archivos/historial se comparan con main anterior por hash; las páginas de consulta y baja conservan su fuente, salvo la incorporación del adaptador de navegación. El alta solo cambia su destino y la versión del recurso.
- Regresión de cuestionarios, SQL, entrevista y decisión unificada, retorno al candidato, alta, invitación, onboarding, vistas explícitas, contratación/WhatsApp y cierre de sesión.
- Baja: regresión SQL y 36 comprobaciones de navegador con RPC simuladas. El simulador antiguo requería onAuthStateChange, método ya utilizado por la protección de sesión.
- Retroceso visible: 16 casos sobre el RPC protegido actual, con cancelación, error, conflicto, recarga y conservación del otro candidato. El test antiguo esperaba cinco pasos internos retirados antes de esta entrega; permanece sin modificar y se sustituye en esta verificación por evolution-stage-back.cjs. La lógica de etapas del producto no se cambia para acomodar ese test.
- Servicio real: system_employee_access, system_user_profile y system_list_users rechazan solicitudes anónimas con parámetros sintéticos. No se usan expedientes reales como pruebas.
- Después del despliegue: se comparan 16 recursos públicos con los archivos probados, además de repetir las comprobaciones anónimas. Las pruebas de interfaz sobre publicación siguen usando datos y sesiones sintéticos.

## Integridad y límites

Las pruebas de escritura utilizan PGlite aislado o servicios interceptados. No se envían correos, WhatsApp ni recordatorios reales; no se modifican trabajadores, candidaturas, respuestas, contratos, cuentas, permisos o documentos reales. Las huellas de empleados —incluido Daniel Herrera—, candidatos, entrevistas y casos de contratación se comparan antes/después. No se publica contenido de esos expedientes en la evidencia.

La suspensión afecta el acceso de plataforma comprobado por sus permisos; no elimina la cuenta Auth ni modifica su contraseña. No se prueba una suspensión real ni la recepción de mensajes. No se certifican funcionalidades futuras como reincorporaciones que aún no tengan un flujo/registro existente: se muestran los registros disponibles y no se fabrican eventos.

Los avisos globales anteriores de Supabase sobre funciones ejecutables y protección de contraseñas filtradas se revisan por separado. No se debilitan controles ni se alteran ajustes globales para silenciarlos. Referencias: [funciones anónimas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [funciones autenticadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

El commit y el resultado concreto de Pages, la comparación pública y la repetición de interfaz se adjuntan al informe final de ejecución después de publicar. Este documento no confunde código preparado con una operación laboral realizada en producción.
