# Paso 13 — Efectuar baja

Implementación del diseño aprobado del cierre laboral. Base revisada: `ff40636063a19bbd85db15146ccc5efae0f67bce`.

## Arquitectura y controles

- Dashboard: acceso Bajas. Ficha de trabajador y Paso 12: acceso al cierre. Ruta: Baja después de Contratación; la etapa se refleja desde los expedientes de cierre sin reescribir la candidatura original.
- Selector manual: incluye prueba, adiestramiento, contratación, inserción y baja; las etapas protegidas abren su flujo, no escriben un estado arbitrario. Un trigger impide terminar o reactivar empleados desde una actualización directa.
- El permiso efectivo `system_has_permission('rrhh','write')` controla cada operación interna. En la arquitectura actual RRHH está reservado al propietario; no se añadieron roles ni se concedieron permisos a usuarios existentes.
- Esquema privado con RLS, sin acceso directo de anon/authenticated. API pública SECURITY INVOKER y operaciones privilegiadas en esquema privado con autorización explícita. No hay claves privilegiadas en clientes.
- Inicio serializado por empleado, expediente único, revisión optimista y bloqueo de filas. Reintentos de inicio, entrega externa y finalización no duplican expedientes ni efectos.
- Enlace de 256 bits, hash en base de datos, vencimiento de 30 días, revocable al renovar y al finalizar. Renovar elimina el mensaje y la confirmación anterior; guardar exige los dos enlaces vigentes. No se guardan tokens en eventos.
- El trabajador solo envía declaración, asuntos pendientes y veracidad. Datos administrativos y medios son de solo lectura. No se lee, solicita ni actualiza su carné desde este procedimiento.
- Medios desde `hr_employee_assets`: solo asignaciones existentes, control individual y progreso exclusivamente por medios. Responsable, fecha, observación y resolución persistentes; la incidencia queda en el historial. La empresa puede documentar reposición u otra resolución, sin fingir devolución física.
- Archivo firmado privado, sin sobrescritura, ruta por expediente/versión. Documento revisado por RRHH, versiones en auditoría y contrato original preservado. El texto se obtiene de la plantilla `employment_close`; el módulo contractual emitido v2 permanece intacto.
- Finalización: fecha efectiva, envío confirmado, declaración validada, fuente de medios verificada, medios resueltos y firma archivada. Confirmación textual explícita. Deshabilita acceso, marca `terminated`, elimina sesiones Auth (sus dependencias en cascada), termina asignaciones digitales y deshabilita vistas. Los JWT existentes quedan sin autorización por los controles efectivos de estado/acceso de la plataforma.

## Limitaciones seguras y prerrequisitos

1. `hr_employee_assets` existe pero estaba vacío al auditar. No se infieren medios a partir de la plaza ni se fabrican asignaciones. Se exige verificación interna documentada de esa fuente, incluso con cero registros. La función no reconstruye un inventario no registrado.
2. No existe un campo estructurado y verificable para los días de entrega del contrato. Se registran manualmente y se exige fundamentación contractual; no se interpreta automáticamente el texto legal ni se inventa un plazo.
3. No se inicia una baja sin expediente de empleado, contrato firmado vinculado en `hr_hiring_cases` y plantilla de cierre en Contratación. La ausencia devuelve un bloqueo concreto.
4. La confirmación de envío es una declaración del operador. No hay confirmación automática de entrega/lectura desde WhatsApp.

## Pruebas ejecutadas

- PGlite aislado: 31 comprobaciones de autorización, permisos de tablas, duplicados, concurrencia por revisión, privacidad, medios, incidencias, documentación, firma, confirmación, sesiones, archivo, preservación del contrato y registro ajeno intacto. Solo datos sintéticos.
- Edge headless: 36 comprobaciones a 390 y 1440 px, formularios, lectura exclusiva de medios, envío externo, mensaje editable, borrador desde plantilla, emisión, progreso, ausencia de carné y otras responsabilidades, sin desbordamientos ni errores JavaScript. RPC simuladas; no envía mensajes ni modifica producción.
- Regresión contractual: paginación móvil/escritorio, escaping, impresión y PDF; generador maestro, contrato emitido v2 y entradas de candidatos sincronizadas.
- Producción: RPC interna anónima devuelve 401; enlace externo inválido devuelve 400. RLS activa en las tres tablas nuevas, cero acceso directo a tablas, bucket privado de 15 MB y cero bajas creadas durante el despliegue.
- Huellas antes/después iguales para candidatos, empleados, casos de contratación, medios, asignaciones de roles y Auth users. Incluyen todos los registros existentes; no se seleccionó ni modificó individualmente a Daniel Herrera.
- Asesor de seguridad: sin nuevos WARN. Tres avisos INFO esperados por tablas privadas con RLS sin políticas y sin grants directos; solo se accede a través de funciones autorizadas.

No se ejecutó una baja sobre usuarios o candidatos reales. El ensayo transaccional de producción no llegó a ejecutarse porque expiró la confirmación de la herramienta; los escenarios completos se verificaron de forma aislada. La publicación del esquema se realizó mediante la herramienta específica de migraciones y se verificó después.

Resultados detallados: `tests/offboarding-sql-results.json`, `tests/offboarding-browser-results.json`. Evidencia local: `test-results/offboarding/` (no publicada). El control de despliegue compara los doce archivos publicados con los originales locales y comprueba los rechazos de la API.
