# Reejecución de incorporación: contrato propuesto

12 de noviembre de 2026. Diseño pendiente de implementación; no es una migración ni una función publicada.

Regresar significa iniciar otro intento del procedimiento, mientras consultar el historial es una acción separada. No debe interpretarse una confirmación antigua como confirmación del nuevo intento.

## Unidad de ejecución

Cada ejecución necesita un identificador inmutable, candidato, etapa, número de intento, ejecución de origen, estado, revisión, actor y fechas. Los resultados, confirmaciones y eventos deben referenciar ese identificador. Una candidatura conserva una sola ejecución activa por etapa; el servidor comprueba la ejecución y revisión esperadas bajo bloqueo. Un identificador de solicitud permite devolver el mismo resultado si se pierde una respuesta.

Abrir un formulario, cerrar el procedimiento o recargar no crea ejecuciones. La acción explícita «Volver a ejecutar [etapa]» muestra el alcance y crea un intento pendiente una sola vez. Repetir la misma solicitud no crea otro. La recarga recupera el intento pendiente; no lo completa ni vuelve a emitir enlaces.

El intento anterior se conserva con sus documentos, mensajes, versiones y auditoría. Los intentos posteriores se marcan como dependientes de una ejecución anterior; no se borran. Su reutilización exige una decisión explícita y auditable, y nunca debe completar automáticamente el intento nuevo. La navegación para consultar un documento no inicia ni confirma ningún procedimiento.

## Datos y efectos por etapa

| Etapas | Nueva ejecución | Conservación obligatoria |
| --- | --- | --- |
| 1 Revisión inicial | Nueva decisión pendiente | Candidatura original y decisiones previas |
| 2 Disponibilidad de entrevista | Nueva confirmación pendiente | Contacto y confirmaciones anteriores |
| 3 Coordinación | Nueva cita pendiente; recordatorios ligados al intento | Citas y asistencia previas; cancelación explícita de recordatorios |
| 4 Entrevista y evaluación | Respuestas y evaluación de otro intento | Instantánea del cuestionario usado; entrevista anterior inmutable |
| 5 Propuesta de prueba | Nueva propuesta con términos revisados | Condiciones y decisiones anteriores |
| 6–8 Acuerdo y prueba | Otro intento; emisión documental como operación separada | Acuerdos firmados, originales, archivos y tokens anteriores |
| 9 Cierre | Nueva evaluación/cierre ligada a la nueva prueba | Acta anterior, firma, expediente y decisión previos |
| 10 Adiestramiento | Nueva configuración y notificación pendiente | Contenido y presentación usados en cada intento, tutor y notificaciones previas |
| 11 Contratación | Nuevo expediente borrador y nueva notificación pendiente | Expediente y contrato anteriores; firma, instantánea y referencias de documentos |
| 12 Inserción | Nueva ejecución de configuración y verificación | Identidad Auth única; permisos vigentes hasta una modificación explícita autorizada |

Se pueden precargar datos personales para revisión, identificándolos como datos de referencia; ninguna precarga equivale a procedimiento completado. Los indicadores de disponibilidad, recepción, validación, firma, envío y configuración deben pertenecer al intento, no deducirse de campos antiguos de la candidatura.

## Operaciones separadas

- El historial muestra originales y versiones sin crear ni renovar capacidades.
- Un nuevo borrador no reemite un contrato ni rota tokens antiguos. La emisión de documentos nuevos necesita una acción explícita; un contrato firmado requiere un nuevo expediente vinculado al anterior.
- Los archivos usan rutas por expediente/ejecución y versión; no se reutiliza `<trial>/front` para reemplazar un original histórico.
- La notificación pertenece a ejecución + destinatario + versión de mensaje. Abrir WhatsApp y confirmar su envío son eventos diferentes. Una confirmación anterior no se hereda. No se debe declarar entrega real por abrir una aplicación.
- La cuenta Auth se vincula por empleado, con comprobación de identidad y límites de roles; otro intento de Paso 12 no crea otra cuenta ni suspende la existente.
- La revocación de enlaces, reemisión de contratos, cancelación de una cita vigente o cambio de accesos no son efectos implícitos de retroceder. Requieren una operación separada que indique exactamente qué cambia.

## Despliegue compatible requerido

Primero añadir estructura y RPC de ejecución sin tocar filas históricas. Desplegar lectores compatibles con registros antiguos y nuevos; después escritores que incluyan ejecución/revisión/idempotencia. La activación debe ser por candidatura y empezar en un entorno aislado. Los registros antiguos se presentan como ejecución histórica, sin convertirlos en aprobaciones nuevas.

No basta con cambiar el texto de los botones ni limpiar campos existentes. Actualmente `hiring_route` registra navegación; `hr_hiring_cases` se identifica por `trial_id`; la entrevista y los documentos usan referencias que todavía no aíslan una ejecución nueva. Por eso no se ha activado esta semántica en producción.

## Criterios de aceptación

Un candidato sintético debe completar desde 1 hasta 12 usando la aplicación y la misma base aislada; después regresar y repetir cada etapa. Se exige comprobar recarga, cancelación, dos pestañas, clic duplicado, respuesta perdida y reintento. No puede reutilizarse una confirmación de otro intento ni mutarse un documento histórico. Las cuentas, enlaces y contratos previos deben permanecer idénticos antes/después de crear un borrador. Deben probarse por separado casos nuevos, notificados, validados, firmados, formalizados y con cuenta activa, en 320/390/1440 px y con roles propietario, autorizado, no autorizado y anónimo con token.
