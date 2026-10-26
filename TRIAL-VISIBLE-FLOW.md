# Ficha de candidato: cierre de prueba

El retroceso visible recorre Cierre del período de prueba → Contrato de período de prueba → Confirmar disponibilidad. Los estados de recepción, aceptación e inicio quedan internos. Se conserva el resto de la navegación de entrevista y el contrato.

Finalizar sin avanzar exige elegir Cantera, No seleccionado (con el selector de motivo existente) o Perfilar para otra plaza activa. Perfilar archiva la candidatura original y crea otra con identificador nuevo, estado Nuevo y datos de identidad/contacto; no copia evaluaciones, respuestas de la plaza ni la prueba. Ambas candidaturas conservan referencias en su historial.

La RPC existente `hr_manage_trial_closure` guarda acta, decisión, candidatura nueva e historial en una sola transacción. Mantiene su firma, control de propietario, SECURITY DEFINER y permisos anteriores. La instalación solo reemplaza código: no cambia políticas RLS, ACL ni registros de candidatos. El bloqueo de filas, un bloqueo por contacto/plaza y la comprobación de candidaturas abiertas evitan duplicación; repetir una decisión ya confirmada no vuelve a crear registros. Un destino diferente después del cierre se rechaza.

Después de confirmar, la ficha muestra el estado guardado y ofrece consultar el mensaje preparado. El enlace Abrir WhatsApp requiere un clic, no registra entrega y puede recuperarse tras recargar. Una respuesta perdida se reconcilia consultando la candidatura. El sistema no confirma envío ni entrega de WhatsApp.

## Verificación

- `tests/trial-visible-flow.cjs`: PostgreSQL local en PGlite con estructura y función de preparación consultadas en el backend, sin datos reales. Prueba los tres destinos, idempotencia, historial, duplicados, origen/destino separados, autorización, etapa obsoleta y un fallo posterior a la creación que revierte toda la transacción.
- La misma prueba conecta el navegador a esa base local a 390 y 1440 px: cancelación, motivo, retroceso, estado real, historial, reapertura del cierre, WhatsApp simulado, recarga, pérdida de respuesta y error de lectura. Bloquea solicitudes externas; ninguna escritura en producción.
- `tests/candidate-quick-actions.cjs`: acciones en nueve estados, motivo y desvío de las acciones durante prueba al cierre transaccional.
- `tests/trial-agreement-views.cjs`, `tests/trial-agreement-browser.cjs` y `tests/trial-candidate-return.cjs`: aislamiento del documento público, autorización, contrato completo sin cambios, impresión/PDF, móvil/escritorio, pestañas independientes y regreso a la ficha.
- Sintaxis de scripts y revisión de diferencias.

PGlite y Playwright se reutilizan del entorno de pruebas local. La suite nueva no contacta Supabase. No se probó entrega real en WhatsApp ni se cerraron candidaturas reales para validar.

## Publicación y reversión

Instalar `supabase/trial-visible-flow.sql` antes del HTML. Es compatible con los usos anteriores de la RPC. Revertir primero el HTML y después restaurar la definición previa de la RPC, conservada en `tests/fixtures/trial-manage-before.sql`; no eliminar registros de cierres ya realizados. No hace falta modificar RLS ni permisos.

Las pruebas antiguas `candidate-stage-back.cjs` describen los pasos internos descartados y quedan superadas por `trial-visible-flow.cjs` para este flujo.
