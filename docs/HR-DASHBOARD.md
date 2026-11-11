# Dashboard de Recursos Humanos

Rediseño aprobado: grafito/negro, amarillo #FFDA03, cuatro vistas. Sustituye únicamente recursos-humanos.html, la vista que ya abre dashboard.html dentro de su navegación lateral. No cambia rutas, procesos, tablas, permisos, roles ni registros.

## Fuentes y cálculos

Todas las consultas usan la sesión Supabase del usuario y las políticas RLS existentes. Antes de leer se comprueba system_has_permission(rrhh, read). Las nueve tablas tienen RLS habilitado, verificado en producción. No se usan claves privilegiadas ni datos de maqueta. No se persisten datos personales en cachés nuevas. Las lecturas se paginan por id en lotes de 500; un fallo descarta la fuente completa. Fechas de actividad con calendario America/Havana; existencias actuales se etiquetan expresamente.

| Elemento | Fuente / definición |
| --- | --- |
| Candidatos registrados | hr_candidates, registros visibles actuales |
| Plazas en convocatoria | role_id distintos de hr_recruitment_cycles activos, abiertos y no vencidos a fecha actual; no número de personas ni de ciclos |
| Personal activo | hr_employees.status = active, incluye altas directas y contrataciones de candidatos |
| Entrevistas realizadas | hr_interviews.completed_at dentro del período; una cita programada no cuenta como realizada |
| Capacitación en curso | candidato trial con período vigente no supersedido; eventos ordenados por created_at e id: decisión continue y training_notification_confirmed, respetando reversión; misma lógica de rrhh.html |
| Contratos y renovaciones | system_user_profile para trabajadores activos, máximo 4 solicitudes concurrentes; fecha contractual explícita en contract.data o employment; firmado y fecha <= hoy + 30 días, incluye vencidos |
| Embudo | estado actual de candidaturas recibidas en el período; no conversión histórica |
| Incorporaciones mensuales | hr_employees.hired_at en período, seis últimos meses; incluye trabajadores ahora inactivos si su fecha corresponde |
| Departamentos | hr_employees.role_id y hr_roles.department_id; candidatos por ciclo o vacante/ciclo; Sin departamento conserva no asociados |
| Tiempo de contratación | media de días entre submitted_at e hired_at, solo fechas válidas y no negativas, contrataciones del período; muestra tamaño de muestra |
| Tasa de avance actual | candidatos del período actualmente en preselección, entrevista, prueba, capacitación o contratación / candidaturas del período |
| Atención | candidaturas nuevas, decisión tras entrevista, documentación/evaluación de prueba y revisión contractual sin firma |
| Agenda | entrevistas futuras sin completar y sin cancelación/ausencia, próximos inicios de prueba; abre ficha original |

## Límites explícitos

No existe dotación autorizada por plaza: no se calcula total de plazas cubiertas/vacantes ni ocupación porcentual. Se muestran plazas distintas con personal activo y plazas en convocatoria como conjuntos independientes. No hay evaluaciones completas por cohorte ni plantilla media histórica: aprobación y rotación muestran Sin datos. No se usa la expiración de enlaces temporales como vencimiento contractual. Sin fecha contractual, el KPI de renovaciones muestra Sin datos si no existe ninguna fecha conocida; con cobertura parcial se lista el número de contratos con fecha y los que no la tienen. No se presenta como un total completo de obligaciones contractuales.

Períodos: mes actual, tres meses naturales incluyendo actual, año actual o todo el historial. No afectan las existencias actuales ni las alertas futuras; sí entrevistas realizadas, cohorte del embudo, avance, tiempo de contratación e incorporaciones. Bajas actuales se etiquetan sin filtro de fecha, el acceso al procedimiento conserva las fechas efectivas originales.

## Verificación

- node --test tests/hr-dashboard-model.cjs
- node tests/hr-dashboard-browser.cjs (Playwright instalado; Edge en Windows, Chromium en otros sistemas)
- node tests/verify-ui.cjs

Casos: unidades distintas, capacitación revertida/supersedida, fechas y zona horaria, denominador vacío, fuente caída, asociación de departamento, convocatorias vencidas/futuras, vencimiento desconocido; navegador 390/768/1440, cuatro pestañas, filtros, enlaces, escape de texto, estados empty/error, cierre de sesión y acceso denegado/sin sesión. Los datos de los tests son exclusivamente fixtures locales y nunca se escriben en Supabase. La validación de navegador con fixtures no equivale a una sesión autenticada real en producción.
