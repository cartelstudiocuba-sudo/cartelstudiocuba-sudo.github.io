# RRHH, Entrevistas y Usuarios — 8 de noviembre de 2026

Base: main dbc7db60. El bloque urgente de recuperación de cuestionarios se publicó primero en b458b5b. Esta entrega reúne la revisión restante. Inventario General está excluido: no se añaden catálogo, equipos ni asignaciones nuevas como desarrollo; la etapa de medios del alta conserva su comportamiento publicado.

| Tarea | Resultado |
|---|---|
| 1. Cuestionarios | Carga no destructiva, causa real del error, reintento, respuestas pendientes en memoria por candidato/revisión, recuperación tras desconexión y guardado idempotente. Versiones históricas conservadas. |
| 2. Entrevistas | Pruebas de decisión unificada y retorno al candidato resueltas. Guardados personales y de foto ligados al candidato original; doble pulsación protegida. Una carga tardía no cambia la etapa que el entrevistador eligió después. Agenda/ausencias y recordatorios conservados. |
| 3. Alta directa | Ocho etapas, borradores, recuperación en otra pestaña, duplicados, plaza, documentos privados, contratos históricos y acceso opcional auditados. Sin candidatos ficticios ni activación automática. |
| 4. Permisos | Nuevas configuraciones reciben permisos del rol sin copiar vistas. Vistas individuales o aplicación explícita de plantilla. Snapshots, vistas, asignaciones, plantillas y cuentas existentes preservados. |
| 5. Usuarios | Buscador con normalización de acentos y filtros de área, plaza, estado laboral/acceso; indicadores compactos de datos pendientes y activación. Una respuesta autorizada del directorio; filtrar no hace consultas adicionales. |
| 6. Contratación 11/12 | Formulario, compresión, PDF, tokens, guardado, retorno y errores probados con servicios sintéticos. Abrir WhatsApp significa apertura/inicio, nunca entrega acreditada. Mensaje de activación editable y recuperable, sin abrir ventanas duplicadas al reintentar. |
| 7. Ficha | Siete pestañas y seis funciones originales conservadas; estados laborales legibles y reintento de documentos sin acumular errores. Condiciones históricas ausentes no se sustituyen por las actuales de la plaza. |
| 8. Auditoría | RLS/grants/funciones, documentos privados, invitación, activación y recuperación revisados; rechazo anónimo comprobado sin registros reales. Retiradas 21 capacidades anónimas innecesarias de tres tablas HR. Índices necesarios ya existentes. |

## Cuestionarios y contenidos pendientes

Administrador conserva publicada la versión 2 con 21 preguntas. Gestor Técnico tiene versión 1 con 21 y Asistente Personal/Ejecutivo versión 1 con 16. Gestor Operativo tiene un borrador no publicado; Gestor Comercial de Gráfica no tiene publicación. No hay aprobación verificable que autorice publicar estos borradores, por lo que se conservan. Las cuatro convocatorias existentes resuelven correctamente sus plazas a través de sus ciclos. No se iniciaron, cerraron ni modificaron entrevistas reales para verificarlo.

## Permisos y directorio

Las plantillas de vistas siguen disponibles, pero configurar una cuenta nueva no las aplica automáticamente. Las cuentas anteriores mantienen su modo y sus valores guardados; modificar una plantilla no cambia los accesos existentes. Aplicarla a un trabajador continúa siendo una acción explícita y confirmada.

El indicador de expediente incompleto refleja datos digitales pendientes (nombre, plaza, incorporación, identificación o contrato), sin modificar estado laboral ni decidir validez jurídica. La ausencia de área histórica se muestra sin inventarla a partir de la plaza actual. Una cuenta sin crear se distingue de otra pendiente de activación, deshabilitada o bloqueada.

## Migraciones aplicadas

1. idempotent_published_interview_answer_retry: reintento idéntico sin un segundo UPDATE; conserva conflictos de valores distintos.
2. new_accounts_explicit_view_assignments: nueva distinción interna entre acceso anterior por plantilla y vistas individuales, manteniendo los valores existentes.
3. owner_user_directory_status: metadatos de consulta para filtros/pendientes; mismo control de propietario.
4. hr_remove_unused_anonymous_table_privileges: revoca grants anon innecesarios en hr_employees, hr_employee_documents y hr_employee_assets; no cambia RLS ni permisos de trabajadores autenticados.

## Verificación y límites

29 suites distintas aprobadas en la consolidación local, incluyendo SQL aislado, navegadores y límites anónimos reales con identificadores sintéticos. Hay 49 comprobaciones SQL del alta, 12 del directorio, 11 de guardado con cambio de candidato, 13 de invitación simulada y 16 escenarios de envío del expediente (390/1440 px). No deben sumarse como casos únicos: varias suites se solapan. Entrevista/resiliencia, alta/ficha y dashboard se prueban en 320/390/768/1440 px cuando corresponde.

Se verifican contratos PDF sintéticos, fallos/pérdidas de confirmación y recuperación, publicación por plaza, snapshots históricos, revocación, activación y autorizaciones. Ninguna prueba envía mensajes/correos reales ni usa candidatos, trabajadores o documentos reales como datos de prueba. Las huellas de candidatos, entrevistas, empleados, plazas, cuentas, roles, vistas y plantillas coinciden con la base auditada (excluyendo la nueva columna de modo al comparar los snapshots).

Los cambios sin confirmar de cuestionarios permanecen en memoria de la pestaña y se avisa antes de salir. Forzar su cierre puede perder esas ediciones; no se guardan respuestas sensibles en almacenamiento persistente del navegador. Las respuestas confirmadas se recuperan del servidor.

Sin nuevos WARN de seguridad. Siguen avisos anteriores sobre ejecución de funciones y protección de contraseñas filtradas; la auditoría de rendimiento también registra políticas RLS e índices ajenos a estas nuevas consultas para revisión posterior. No se alteran configuraciones globales de Auth ni se eliminan políticas/índices por un aviso genérico. No se afirma una mejora porcentual de velocidad ni una certificación de seguridad de toda la plataforma.

La evidencia final de despliegue, coincidencia de recursos públicos y repetición contra los archivos publicados se conserva en el informe de esta ejecución.

Se impide mostrar la vista en memoria de una cuenta anterior al cambiar de identidad o restaurar una pestaña. La salida no cierra la nueva cuenta; las pruebas cubren eventos, restauración y respuestas tardías. El modal de cierre conserva su confirmación y el cierre local de Supabase.
