# Recuperación de cuestionarios de entrevista

Auditoría del 8 de noviembre de 2026: Administrador tiene publicada la versión 2 (21 preguntas); Gestor Técnico, versión 1 (21); Asistente Personal/Ejecutivo, versión 1 (16). Gestor Operativo tiene borrador sin publicación y Gestor Comercial de Gráfica no tiene publicación. No se publicaron ni copiaron borradores. Las cuatro convocatorias existentes están enlazadas a ciclos que resuelven sus plazas correctamente.

Los errores de carga indican su causa y ofrecen Reintentar carga sin retirar el contenido existente. Las respuestas pendientes se conservan en memoria por candidato, pregunta y revisión de la versión. Un fallo de red no bloquea los guardados posteriores ni los de otro candidato. Reintentar guardado y la recuperación de conexión vuelven a intentar las respuestas pendientes. Rehacer el formulario o cambiar de candidato no borra la edición local.

La función de guardado acepta un reintento idéntico cuando la respuesta ya se guardó y se perdió su confirmación. Un valor concurrente distinto continúa protegido por la comprobación de versión/valor esperado; no se sobrescribe automáticamente. No se registran respuestas en almacenamiento persistente del navegador. Si se intenta cerrar o recargar con respuestas sin confirmar se muestra aviso: forzar el cierre puede perder las ediciones no guardadas. Las respuestas confirmadas se recuperan desde Supabase al recargar.

Las entrevistas con versión iniciada conservan su snapshot original. Las anteriores al sistema versionado mantienen sus preguntas y validaciones originales; no se convierten automáticamente. Las respuestas históricas presentes en entrevistas nuevas se muestran aparte y no se reasignan a preguntas nuevas. Las entrevistas cerradas no inician cuestionarios.

Pruebas aisladas: errores sin publicación, reintento, desconexión, pérdida de confirmación, edición concurrente, reconstrucción del formulario, cola independiente por candidato y respuesta tardía de otra ficha, en 320/390/768/1440 px. Prueba completa con PostgreSQL aislado de cinco cuestionarios en 390/1440 px, guardado/recarga, cierre, histórico y cambio rápido de candidato. Pruebas de navegación y decisiones sintéticas. Ninguna entrevista, respuesta o plaza real fue alterada durante las pruebas.

Migración: idempotent_published_interview_answer_retry; modifica solo la función de guardado, conserva SECURITY INVOKER, search_path vacío, RLS y rechazo de ejecución anónima.

