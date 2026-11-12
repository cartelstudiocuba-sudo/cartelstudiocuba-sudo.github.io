# Revisión integral de incorporación — 12 de noviembre de 2026

Base revisada: `691218beb9d5da80aa72430550cba2eed8f1f89d`. Esta revisión identifica una regresión documental corregible de forma compatible y una diferencia todavía pendiente entre navegación y reejecución. No certifica que todas las etapas ya cumplan la nueva semántica de retroceso.

## Regresión reproducida y corregida

`assets/loading-runtime.js` clasificaba `plaza-ficha.html` como página privada sin considerar sus dos vistas públicas `documento=contenido` y `documento=presentacion`. El lector iniciaba la consulta de su token, pero el control de sesión podía sustituirlo por la pantalla de acceso. Afecta a candidatos nuevos y a candidatos que regresan; no depende de datos anteriores.

Se excluyen exclusivamente esos dos modos de la exigencia de sesión del editor. El editor sin modo público, modos desconocidos, RRHH y permisos siguen protegidos. Los RPC de lectura conservan su comprobación del token, vencimiento y revocación. Se actualiza la versión del recurso en `plaza-ficha.html`; no cambia ninguna tabla, política, token, cuenta o documento.

Evidencia: la prueba de documentación pública falló antes del cambio mostrando el acceso, sin errores JavaScript y con la lectura del token ya iniciada. Con el cambio pasa la página completa, el PDF real, la igualdad con el generador compartido, enlace revocado e inválido y la ausencia de consultas administrativas. La prueba nueva de clasificación cubre 21 combinaciones de rutas/modos/ancho. Las pruebas de cambio de identidad y el diálogo actual de cierre de sesión siguen pasando (51 casos de este último).

## Contratos de datos y cobertura

| Etapa | Contrato actual y pruebas nuevas ejecutadas | Evaluación del retroceso |
| --- | --- | --- |
| 1 Revisión inicial | Candidatura, decisión, respuestas originales; regresiones de captación y validación de código | Cambiar estado no crea una nueva decisión versionada |
| 2 Disponibilidad de entrevista | `interview_availability_confirmed_at` separado del estado | Se limpia la marca al retroceder; la confirmación anterior no tiene una entidad de ejecución propia |
| 3 Coordinación | Cita ligada a candidato; navegación y aislamiento A/B | Falta una política global de cita/recordatorio por nuevo intento |
| 4 Entrevista/asistencia/evaluación | Cuestionario, borrador, revisión esperada, recuperación sin red y respuesta perdida; cierre de entrevista | Reabrir la candidatura no crea otra entrevista independiente |
| 5 Disponibilidad para prueba | Propuesta y condiciones; RPC con prueba esperada | Existe otro intento para pruebas cerradas; no para todo retroceso |
| 6 Contrato de prueba | Token y documento asociados a la prueba | El retroceso visible cambia etapa conservando marcas antiguas; no debe confundirse con reemisión |
| 7 Documentación de prueba | Archivos y datos de identidad asociados a prueba | Reutilizar rutas sin una nueva entidad puede mezclar versiones |
| 8 Seguimiento de prueba | Estados internos de recepción/inicio | La ficha actual agrupa estos estados; no son todos pasos visibles independientes |
| 9 Cierre de prueba | SQL y navegador con la misma PGlite: tres destinos, respuesta perdida, reintento, cancelación, recarga y conservación del acta anterior | Otro intento de prueba cerrada conserva el original y rechaza pestañas obsoletas; cobertura localizada, no global |
| 10 Adiestramiento | Condiciones, tutor, contenido público y PDF; validación, errores y cambios concurrentes | El retorno desde contratación formaliza navegación; puede continuar sin otra ejecución real del proceso |
| 11 Contratación | Expediente, revisión, instantánea de contrato, archivos, notificación y firma independientes | El caso existente abre revisión; no inicia otro expediente ni otra notificación |
| 12 Inserción | Configuración, cuenta Auth, activación, roles heredados, permisos individuales, concurrencia e idempotencia | La revisión conserva la identidad existente; crear otra cuenta no es una reejecución válida |

Las pruebas de interfaz principales de retorno, contratación, revisión documental, nueva configuración, roles y documentación cubren 320/390/1440 px. Se ampliaron entrevista, retroceso visible, contrato/PDF y cierre a esos tres anchos. La prueba de documentación estresa además 768 px y textos Unicode largos, conservando el texto completo.

## Hallazgos de persistencia y causa raíz

1. El estado laboral, la posición visible de la ruta y las confirmaciones históricas se usan como fuentes de avance diferentes. `hiring_route` conserva contratación/cuenta y escribe eventos de navegación. Abrir 11→10 y continuar no crea un nuevo resultado de adiestramiento ni exige repetir su notificación.
2. `hr_hiring_cases` está identificado por la prueba. Una revisión del expediente no equivale a un nuevo intento de contratación. El servidor solo guarda hashes de los tokens: los enlaces originales no pueden reconstruirse desde ese registro. Renovarlos rota capacidades; no es una lectura.
3. El retorno visible de prueba modifica la etapa y conserva marcas documentales. Enviar otra propuesta sobre una prueba pendiente actualiza sus condiciones; solo una prueba cerrada activa actualmente la creación de otro intento mediante `hr_request_trial`.
4. La rama heredada `hr_manage_hiring(...,'back')` para casos todavía en `trial` anula los enlaces y limpia la notificación. No es una operación neutra de navegación y no debe reutilizarse como implementación de la nueva semántica. No se ejecutó sobre producción.
5. La confirmación de notificación actual puede pasar a contratado antes de validar/firma documental; esto es un contrato de datos implementado deliberadamente, no prueba de formalización. Se añadió una prueba SQL con `hiring-onboarding-transition.sql`, porque la antigua prueba de contratación por sí sola cargaba el contrato anterior donde `notify` todavía conservaba `trial`.

La solución global requiere ejecuciones explícitas por etapa y referencias por versión; limpiar campos o volver a emitir enlaces sobre la fila actual no basta. El [diseño de reejecución](onboarding-reexecution-design.md) fija el alcance y las condiciones de activación. Está pendiente de implementar y probar; esta publicación no lo activa.

## Protecciones verificadas

- Abrir WhatsApp en contratación no guarda la notificación; requiere confirmación explícita. Se prueban bloqueo del popup, doble clic, fallo de guardado, reintento, interrupción, recarga y enlaces revocados.
- SQL aislado: acceso propietario/anónimo, revisiones obsoletas, tokens inválidos/caducados/revocados, RLS de almacenamiento, firma inmutable, finalización e idempotencia. Se ejecutó también la variante de versionado contractual.
- La transición SQL vigente crea un empleado al notificar, conserva documentos pendientes y no duplica empleado ni auditoría al reintentar. El retroceso contratado por la vía heredada se rechaza sin anular enlaces.
- 12→11→10→11→12→11→12 conserva candidato, contratación y cuenta; cubre cancelación, fallo, recarga y aviso de cuenta activa. Esta prueba demuestra navegación conservadora, no reejecución.
- Se comprobó paridad de 43 funciones con el nomenclador y el manifiesto del renderizador contractual inmutable. Se corrigió un falso fallo del verificador en Windows normalizando únicamente CRLF al comparar; los recursos de renderizado no se regeneraron.
- El PDF sintético exportado a 320 px tiene cuatro páginas Carta (612×792 pt); sus cuatro páginas se renderizaron y revisaron visualmente. No se alteraron plantillas ni cláusulas.

## Reproducibilidad y límites

`node scripts/test-onboarding-integral.cjs --list` enumera la matriz; `--only=nombre,nombre` permite ejecutar sus grupos. Requiere dependencias del proyecto y Edge instalado para las pruebas históricas actuales. Acepta `PLAYWRIGHT_MODULE` y `PGLITE_MODULE` para entornos con dependencias compartidas. Los resultados y logs se guardan en `test-results/onboarding-integral/`. No se pasa `--live` a ninguna suite ni se usan credenciales de producción.

Se repararon fixtures antiguas: JSON incrustado no es JavaScript ejecutable; consultas/RPC de lectura añadidas por la ficha evolutiva necesitaban dobles compatibles; el cierre ya no envía el formulario histórico de identidad; los textos de botones de capacitación habían cambiado. La antigua prueba `logout-browser.cjs` todavía supone confirmaciones nativas y falla con el diálogo actual; para la conducta vigente se ejecutó `logout-modal.cjs`.

Las suites cubren componentes y transiciones, y la de prueba une UI y base SQL aislada. **No hay todavía una única prueba desde candidatura nueva hasta Paso 12 que mantenga el mismo candidato y la misma base real para todas las etapas.** Los fixtures de algunas suites simulan los RPC. No se presenta su suma como una certificación integral de reejecución.

Se consultó el caso de referencia real y las funciones de producción en transacciones de solo lectura. No se invocaron acciones de negocio, notificaciones, renovaciones, creación de cuentas, firmas ni cambios de etapa. Las instantáneas personales y los hashes de control permanecen fuera del repositorio. No se descargó ni certificó un PDF privado real contra su contrato firmado.

La revisión automática de Supabase incluye advertencias de funciones públicas/security definer y tablas sin políticas directas. No se interpretan automáticamente como acceso indebido: los lectores por token son públicos por diseño y las funciones de administración comprueban autorización. No se cambiaron concesiones ni políticas. La protección de contraseñas filtradas aparece deshabilitada; su configuración queda fuera de esta corrección.

Navegador utilizado: Edge Chromium automatizado. No se efectuó una nueva prueba manual de Firefox; el bloqueo histórico de soporte de política de URL de Windows no se considera resuelto. Tampoco se probaron WhatsApp real, entrega de mensajes, firma física, creación real de cuentas ni toda la variación móvil en Safari/iOS.
