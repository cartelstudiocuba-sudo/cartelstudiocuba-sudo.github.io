# Cuestionario de entrevista por plaza

Implementación sobre `675ed9d`, con base remota `f5feb0c` verificada. La investigación inicial queda como referencia histórica; este informe describe la implementación final.

## Configuración e interfaz

En ficha de plaza → Definición de la plaza → **Cuestionario de entrevista**. Editor de secciones, preguntas, orientaciones, texto/opciones, obligatoriedad, altas, bajas y orden. Guardar borrador y aprobar/publicar son acciones separadas; una publicación requiere confirmar la aprobación. Se conservan los controles de concurrencia del editor original.

| Plaza | Preguntas | Estado inicial |
|---|---:|---|
| Asistente Personal / Ejecutivo | 16 | Publicadas por migración literal de `entrevistas.html` y sus opciones |
| Administrador | 10 | Borrador pendiente de revisión |
| Gestor Operativo | 10 | Borrador pendiente de revisión |
| Gestor Técnico | 8 | Borrador pendiente de revisión |
| Gestor Comercial de Gráfica | 0 | Borrador vacío: faltan funciones/requisitos/contenido operativo |

Las propuestas se documentan en `INTERVIEW-QUESTIONNAIRES-REVIEW.json`, con referencias a campos/bloques reales y huellas del contenido usado. No se emplearon `application_form` ni `evaluation_master` para construirlas. Asistente conserva literalmente texto, secciones, orientaciones y opciones, incluida su presentación original como texto u opciones. Se cotejó también la configuración persistida con la extracción original.

## Versionado y compatibilidad

- Borrador y publicación viven en claves separadas de `hr_roles.work_content`. Publicar no modifica los cuestionarios ya iniciados.
- Iniciar captura la versión publicada de la plaza resuelta por el ciclo de convocatoria. Para convocatorias antiguas sin ciclo solo se admite coincidencia exacta y única de título; plaza ausente/ambigua bloquea el inicio.
- Las respuestas nuevas usan identificadores estables `iq_*`, no posiciones `qN`. El guardado compara el valor anterior y fusiona una sola respuesta bajo bloqueo de fila. Un conflicto conserva lo escrito en pantalla y requiere recargar para revisar la versión vigente.
- La copia del cuestionario iniciada es inmutable. Las entrevistas nuevas requieren una versión publicada para cerrar. Las anteriores mantienen la validación histórica sin reasignación automática.
- Las listas inline de cinco preguntas dejaron de ser una ruta de escritura: ficha y Agenda abren la misma entrevista. Impresión y resumen PDF consumen el mismo modelo de preguntas/respuestas.
- Los registros antiguos no indican si se usó la lista inline de cinco o la de dieciséis. Las claves/respuestas `q0`–`q15` y `q0`–`q4` se conservan; para claves ambiguas se muestran ambos textos históricos posibles. No se atribuyen esas respuestas a preguntas nuevas ni se usan para completar sus requisitos.
- Se mantienen las diez calificaciones, la decisión, la protección del cierre original y la finalización atómica existentes.

## Migración y seguridad

Aplicada en `jhumvctocphyiwhszeaz`: **`20261025004133_versioned_role_interview_questionnaires`**. El archivo local reproduce la versión registrada por el servidor. La instalación local de la CLI falló; se empleó el conector oficial para registrar la migración y después se recuperó su identificador.

Cambios aditivos: copia de cuestionario y marca de formato en `hr_interviews`; funciones invoker de inicio, publicación y guardado; protección de copia y adaptación de validación. Se verificaron esquema, triggers, permisos y función instalada antes de sustituirla; la migración exige su huella esperada y que el contenido fuente de cada plaza siga coincidiendo. Límite de espera de bloqueo: cinco segundos. No se cambió RLS ni se otorgaron permisos a `anon` sobre las funciones nuevas.

Tras aplicar y probar: **170 candidatos y 29 entrevistas conservan exactamente sus datos originales** (descontando las nuevas columnas nulas de esquema). Las huellas de candidatos, entrevistas y políticas RLS coinciden antes/después. Las pruebas remotas insertaron exclusivamente registros sintéticos en una transacción revertida. El análisis de seguridad no señala ninguna función nueva; los avisos previos ajenos a esta modificación no se alteraron.

## Pruebas

- Editor en Edge a 390 y 1440 px: cinco plazas, orden, identificadores, opciones duplicadas, guardado/recarga, cambios concurrentes, cambio de plaza, doble guardado, errores y ausencia de desbordamiento horizontal.
- SQL aislado: cuatro plazas, borradores bloqueados, aprobación, copia idempotente, obligatorias/opcionales, opciones, conflictos, protección histórica, nuevas publicaciones sin alterar entrevistas iniciadas, cierre repetido y compatibilidad legacy.
- Interfaz real de Agenda conectada a Postgres aislado con cinco plazas sintéticas, a 390/1440 px: carga por plaza, bloqueo del borrador vacío, respuestas, recarga, conflicto entre sesiones, evaluación, cierre, lectura de cerradas, cambio rápido de candidato y contenido de impresión. El iframe de revisión de la candidatura se sustituyó por una superficie sintética; esa funcionalidad no se modificó.
- Seed completo aislado: cinco configuraciones, solo Asistente publicado, preservación del contenido previo y rechazo a sobrescribir una configuración existente.
- Supabase con RLS vigente: tres plazas/candidatos sintéticos, borrador/publicación, copia, obligatorias/opcionales, opciones, conflicto de respuestas, cierre y repetición. **ROLLBACK completo**.
- Fidelidad: 16 secciones, textos, orientaciones y opciones de Asistente cotejados con el commit original y con la configuración persistida.

No se activaron las propuestas pendientes de revisión del usuario.
