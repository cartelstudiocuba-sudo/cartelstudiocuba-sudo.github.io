# Cuestionarios de entrevista: investigación y preparación

Fecha: 24 de octubre de 2026. Proyecto: `jhumvctocphyiwhszeaz`.
Base del repositorio verificada contra GitHub: `f5feb0c6df632b0ada56b7feb1add114958d8d48`.

## Resultado y límite de publicación

No se encontró un cuestionario de entrevista persistido para ninguna de las cinco plazas. Se prepara un editor de **borradores** en Definición de la plaza → Contenido específico de la plaza → Cuestionario de entrevista. No se publica esta preparación como una corrección completa y no se activa una nueva validación. No se inventan preguntas ni se copian las de Asistente Ejecutivo a otras plazas.

## Evidencia de lectura autenticada

- `hr_roles`: Asistente Personal / Ejecutivo, Gestor Técnico, Administrador, Gestor Operativo y Gestor Comercial de Gráfica.
- Se recorrió `work_content` recursivamente, incluyendo objetos y arrays. Ninguna ruta contiene claves de preguntas/cuestionario/entrevista en español o inglés. Tampoco aparecen textos que identifiquen un cuestionario de entrevista en los valores de sus hojas.
- Asistente, Administrador y Gestor Operativo contienen `standard`, `custom`, `protocol_blocks`, `training_master`, `evaluation_master` y otros bloques. `evaluation_master.criteria` define evaluación de desempeño, con criterios, pesos y escalas; no define preguntas de selección.
- Gestor Técnico solo contiene `contract_templates`; Gestor Comercial de Gráfica no contiene bloques de `work_content`.
- `hr_roles.application_form` sí contiene preguntas específicas para cuatro plazas; pertenecen a la candidatura, con campos de datos personales, disponibilidad, formación y experiencia. La quinta tiene un array vacío. No se debe convertir este formulario en entrevista sin una decisión explícita de producto.
- Se inspeccionó el esquema de `hr_roles`, `hr_vacancies` y `hr_role_documents`: no existe una columna separada de cuestionario de entrevista. `hr_vacancies` tampoco contiene `role_id`; una resolución futura de la plaza debe detectar ambigüedad, sin elegir por defecto.
- `hr_role_documents` tiene un único documento registrado: contrato de trabajo de Gestor Técnico, con origen Contratación. No hay documento registrado de cuestionario.
- «Contenido de la plaza» se genera en `plaza-ficha.html` a partir de los bloques configurados (`documentationInfoSections` / `definitionDocumentSections`); no constituye otro almacén de preguntas.

## Causa raíz en código y SQL instalado

- `entrevistas.html`: array `Q` con 16 preguntas fijas, varias específicas del trabajo de asistente de Dirección.
- `assets/interview-question-options.js`: opciones fijas vinculadas al número de pregunta. Cambiar únicamente el texto conservaría opciones incorrectas.
- `rrhh.html`: `candidatePdfInterviewQuestions()` duplica las 16 preguntas para resumen/exportación. Existe además `inlineInterviewQuestions` con cinco preguntas diferentes. `showCandidateInterviewInline()` guarda por posición `q0`…`q4`, aunque las posiciones finales no equivalen a las del cuestionario de 16. No se puede atribuir automáticamente una respuesta histórica a una pregunta nueva.
- Función instalada `hr_validate_interview_closure()`: recorre `0..15`, exige `qN_choice` o `qN`, rechaza las opciones de no respuesta y exige diez calificaciones y decisión válida. Esta regla se ejecuta al cerrar y también al actualizar entrevistas ya cerradas con evaluación.
- Función instalada `hr_finalize_interview(uuid,jsonb,text,text)`: bloquea candidato y entrevista, actualiza evaluación/decisión/cierre y datos de decisión del candidato. No resuelve plaza ni configuración de preguntas; depende del trigger anterior.

## Preparación del editor

Archivos: `assets/role-interview-draft.js`, `assets/role-interview-draft.css`, integración en `plaza-ficha.html`.

El editor comienza vacío por plaza y guarda exclusivamente `work_content.interview_questionnaire_draft`:

```json
{
  "version": 1,
  "revision": 1,
  "status": "draft",
  "questions": []
}
```

Cada pregunta escrita por el usuario tiene `id` estable con prefijo `iq_`, sección, texto, orientación, tipo (`text` / `select`), obligatoriedad y opciones. Reordenar conserva el identificador. Guardar no activa el borrador. No hay dependencia de posiciones `qN`.

Antes de guardar se relee la plaza y se comprueba que el borrador no cambió. Se fusionan los demás bloques actuales y se usa comparación de `updated_at` y `work_content` para evitar sobrescribir cambios concurrentes. Los errores conservan lo escrito en el editor. No se ejecutaron escrituras contra Supabase durante esta investigación.

## Condiciones para continuar la activación

1. Configurar y revisar las preguntas reales de cada plaza mediante el editor, sin derivarlas automáticamente de funciones, criterios de desempeño o formularios de candidatura.
2. Publicar versiones de cuestionario separadas del borrador. Registrar por entrevista una instantánea de la versión, texto, opciones e identificadores antes de admitir respuestas nuevas. Cambios posteriores de la plaza no deben reinterpretar entrevistas iniciadas.
3. Conservar todas las claves antiguas y mostrar las respuestas previas como registro histórico sin atribución automática cuando falta evidencia del cuestionario usado. Nunca migrar respuestas `qN` por posición ni reutilizar su contenido para satisfacer requisitos de preguntas nuevas.
4. Implementar un único cargador por plaza para Agenda, ficha, ruta inline y exportación. Una plaza ausente, ambigua o sin configuración debe mostrar su estado sin fallback a otra plaza. Las cargas y guardados deben quedar vinculados al candidato capturado para descartar respuestas tardías al cambiar rápidamente de candidato.
5. Adaptar validación del navegador y del trigger de cierre al mismo cuestionario/versionado. Mantener controles de autorización, decisión y evaluación existentes y protección del cierre original. No modificar RLS.
6. Verificar el flujo integrado con registros sintéticos aislados: varias plazas, cambios rápidos de candidato, recarga, móvil/escritorio, campos opcionales/obligatorios, conservación de respuestas y cierre atómico. No usar candidatos reales para estas pruebas.

La ausencia de preguntas configuradas impide verificar hoy un cierre dinámico real. Las pruebas del editor no equivalen a esas pruebas de aceptación. La preparación permanece local hasta completar y verificar el conjunto solicitado.

## Verificación de la preparación

`node tests/role-interview-draft.cjs`: aprobado en Edge aislado, anchuras de 390 y 1440 px. Casos: borrador vacío, validación de texto y opciones duplicadas, identificadores al reordenar, persistencia tras recarga, cinco plazas independientes, conservación de otros bloques, claves JSON recibidas en distinto orden, conflicto entre editores, cambio entre lectura y escritura, cambio rápido de plaza durante la carga, doble guardado y fallo de acceso. Se comprobó ausencia de desbordamiento horizontal y se inspeccionó captura móvil.

El entorno de pruebas intercepta las solicitudes y usa exclusivamente registros sintéticos; no prueba el guardado del editor contra la base de producción. No se han probado carga dinámica de candidatos ni cierre dinámico: todavía no están implementados/activados por faltar la configuración aprobada y el versionado descrito arriba.

Lectura final de Supabase: 5 plazas, 0 borradores y 0 configuraciones activas con las claves propuestas. No se cambiaron candidatos, respuestas, evaluaciones, decisiones, funciones SQL ni RLS.
