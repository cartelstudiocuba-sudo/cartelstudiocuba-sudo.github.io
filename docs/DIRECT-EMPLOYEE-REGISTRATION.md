# Tarea 36 — Alta directa de trabajadores

Reutiliza el desarrollo de night/employee-assets-pending-migration e integra main 6b01e4c. La integración completa se conserva en el commit 22148b0; la publicación selecciona únicamente la Tarea 36 y sus dependencias.

## Uso

Usuarios → Agregar nuevo usuario. Ocho etapas: datos personales; dirección/contactos; formación; condiciones laborales históricas; contrato/documentos; entregas existentes; acceso opcional; revisión/creación. Guardar borrador permite continuar después mediante un enlace privado persistente. Adjuntar documentos también guarda el borrador. La revisión enumera pendientes y conserva las condiciones introducidas; no toma el salario/horario actuales como condiciones históricas.

Crear expediente no crea Auth ni habilita acceso. Crear expediente y preparar acceso guarda usuario/rol y mantiene el acceso deshabilitado, sin vistas automáticas ni invitación. La invitación posterior sigue siendo una acción explícita en la ficha mediante system-account. Una cuenta Auth coincidente requiere confirmación expresa de vinculación; no se activa. Las cuentas protegidas y ya vinculadas se rechazan.

La etapa de medios usa el registro existente hr_employee_assets y sus controles de código/asignación/fecha. No publica el catálogo nuevo ni cambia los flujos de inventario. Es posible registrar el trabajador sin entregas y completarlas después.

## Persistencia y seguridad

Migraciones aplicadas en Supabase: direct_existing_employee_registration, direct_employee_audit_scope y direct_employee_historical_validation. Tabla privada employee_drafts con RLS, sin grants directos; RPC hr_direct_employee autorizado exclusivamente al propietario. Bucket hr-employee-private privado, límite 15 MiB y tipos PDF/JPEG/PNG/WebP. Inserciones de archivos permitidas solo en la carpeta de un borrador no finalizado y al propietario; sin sobrescritura automática.

La finalización reutiliza hr_employees, hr_employee_personal_details, hr_employee_documents, system_employee_position_history, hr_employee_assets y los roles existentes. No crea candidatos ni casos de contratación. Serializa duplicados por identificación/correo/usuario y bloquea el borrador; creación repetida devuelve el mismo expediente. Documentos deben pertenecer a la carpeta del borrador; estado firmado exige documento real adjunto y fecha. Auditoría de borradores, creación y cambios; el disparador solo registra expedientes de alta directa.

El acceso directo al formulario no concede permisos. Las comprobaciones RLS/RPC se aplican en servidor. El wrapper de ficha conserva las siete pestañas y añade condiciones históricas, contrato y fotografía privada. Los documentos se descargan mediante almacenamiento autenticado.

## Verificación previa a publicar

- 49 comprobaciones SQL aisladas, sin cargar el catálogo: borradores parciales/recuperación/revisión, datos históricos, documentos, duplicados normalizados, acceso opcional, Auth existente, idempotencia, entrega duplicada y rollback de la creación, permisos y RLS.
- Navegador a 320/390/768/1440 px: ocho etapas, recuperación, documento privado, medios, comprobación de duplicados, creación con/sin preparación de acceso, autorización y retorno a ficha. Todas las peticiones de mutación interceptadas.
- Ficha a cuatro tamaños: siete pestañas, condiciones históricas, documento privado y funciones existentes conservadas, botón en Usuarios y rechazo no autorizado.
- 13 comprobaciones del envío posterior de invitación con system-account simulado: sin candidato, errores de preparación/Auth, rechazo de terceros, invitación explícita y reutilización sin duplicados. Cero correos reales.
- Base real: transacción de alta sintética con rol, condiciones históricas, creación idempotente y rechazo de duplicado; ROLLBACK completo. Prueba real de rechazo a identidad sintética no autorizada. Revisados los disparadores actuales de RRHH antes de ejecutar.
- Huellas de trabajadores y cuentas idénticas antes/después; cero borradores, archivos y trabajadores sintéticos persistidos. No se modificaron personas ni cuentas reales.

Advisors: sin nuevos WARN. El INFO adicional de RLS sin políticas corresponde a la tabla privada de borradores, deliberadamente sin grants directos y operada por RPC autorizado. Los avisos previos de la plataforma no forman parte de esta publicación.

La prueba del envío posterior usa servicios simulados: no se envían correos ni se activan cuentas reales para verificar. La publicación exige GitHub Pages correcto, coincidencia de archivos públicos y repetición de las pruebas de navegador con recursos publicados.


