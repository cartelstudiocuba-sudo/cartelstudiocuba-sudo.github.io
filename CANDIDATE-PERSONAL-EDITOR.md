# Editar candidato

Se añade en acciones rápidas de la ficha, con modal oscuro y amarillo #FFDA03. Guardar y cancelar conservan la ficha abierta. Ambas entradas de RRHH permanecen sincronizadas.

Se usa el nombre completo del esquema real, sin dividirlo en columnas nuevas. Se editan teléfono móvil, correo y municipio de la candidatura, foto privada y únicamente los registros personales existentes de sexo, dirección, escolaridad, identidad, teléfono fijo y contacto del expediente. Los datos de candidatura y expediente se identifican expresamente cuando tienen fuentes distintas. No se inventan fecha de nacimiento, provincia ni contactos de emergencia.

El RPC `hr_edit_candidate_personal` usa SECURITY INVOKER, RLS y la identidad de propietario ya existente. No amplía permisos. Rechaza campos fuera de su lista, valida en servidor, bloquea filas y compara los valores originales de los campos modificados. El guardado de datos es transaccional; los campos sin cambios y los datos del proceso quedan fuera del parche. Las fotos usan el preparador existente y el almacenamiento privado, con rutas nuevas sin sobrescribir archivos. Una subida cuyo guardado falle se conserva para reintentar durante la apertura del editor.

## Verificación

- `tests/candidate-personal-editor.cjs`: 390, 768 y 1440 px. Precarga, campos disponibles, cancelación/Escape, guardado sin cambios, conflicto/reintento, parche mínimo, actualización de ficha sin dashboard, rechazo de permisos, fotografía inválida y fotografía válida. Navegador con fuentes simuladas y sin escrituras externas.
- `tests/candidate-personal-editor.sql`: integración contra PostgreSQL real bajo rol authenticated, dentro de transacción revertida. Guardado autorizado, conservación de otros datos, conflicto, rechazo de estado/campo inexistente/correo inválido, ausencia de guardado parcial y rechazo de usuario ajeno/anon. No quedan modificaciones de candidatos.
- Regresión `tests/trial-tutor-notification.cjs` y `tests/trial-tutor-integration.cjs`: 390 y 1440 px; documentación, retorno a ficha, PDF, WhatsApp simulado y notificación independiente conservados.
- Los siete casos de `tests/hr-dashboard-model.cjs`, `scripts/check-contract-renderer.cjs` y `scripts/check-candidate-entry.cjs` pasan. Paridad de 43 funciones contractuales comprobada normalizando CRLF del checkout de Windows, sin modificar los contratos.
- Sintaxis de JavaScript, scripts inline y `git diff --check` correctos. Revisión visual de capturas de escritorio y móvil.
- Supabase Advisors: sin avisos que nombren la nueva función; no se cambian las políticas existentes.

El test antiguo `candidate-quick-actions.cjs` tiene una dependencia ausente en su simulación (`hiringCandidateLabel`) anterior a este cambio. No se modifica su lógica de negocio para acomodar ese test; las acciones y los flujos existentes se verifican mediante la integración del navegador.

