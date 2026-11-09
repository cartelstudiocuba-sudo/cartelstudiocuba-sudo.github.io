# Jornada RRHH — estado inicial

Base: main 8a83a5a2e3c04c9aa8ed96159f96ddc645d4bb50. Auditado antes de modificar código: ficha evolutiva, onboarding cliente/Edge/SQL, activación, recuperación de contraseña, permisos/vistas, baja y pruebas existentes. Lecturas de Supabase limitadas a definiciones, metadatos, agregados y huellas; no se ejecutan acciones de expedientes reales.

## Flujos y límites

- Paso 12 conserva configuración, cuenta creada y apertura de WhatsApp como subpasos distintos; activación personal y formalización laboral siguen siendo estados independientes.
- La Edge provisiona sin contraseña permanente ni correo, verifica identidad/duplicados y utiliza lease. Preview recupera un enlace cifrado vigente; renovar requiere una acción explícita. Solicitar correo usa el correo registrado y shouldCreateUser:false.
- Activación comprueba identidad/correo, establece contraseña y después consume el enlace en una operación independiente. El servidor exige contraseña existente, cuenta correcta, enlace vigente y trabajador sin baja. No se cambian esos controles.
- Roles y vistas mantienen las funciones existentes y su autorización. Las vistas no se heredan automáticamente de nuevas configuraciones.
- Ficha de cuatro pestañas y paneles conservados en refrescos de la misma persona; limpieza al cambiar de persona. Se reutilizan los componentes publicados.
- Baja actual: consulta, inicio explícito, notificación, declaración, medios, documento/firma y finalización confirmada. La finalización revoca acceso y sesiones; no se ejecutará sobre datos reales.
- El inicio de baja exige un contrato firmado de hr_hiring_cases. Las altas directas con contrato histórico/documento pero sin ese caso no están cubiertas por ese requisito actual. Ampliarlo afecta una operación de cierre y queda para decisión específica; no se fabricará un contrato ni se relajará el guard.

## Reproducciones prioritarias

1. Contraseña guardada seguida de fallo en la confirmación de activación: el cliente vuelve a pedir el mismo cambio de contraseña en el reintento. La respuesta puede ser same_password, impidiendo completar el segundo paso.
2. Un fallo de baja recarga el caso mediante load/render y puede descartar mensajes o texto de documento aún no guardados.
3. La pantalla de inicio de baja no distingue preparación en borrador de inicio del caso y no presenta pendientes previamente; se revisará una preparación local reversible que no ejecute start.

Estas observaciones se deben reproducir con servicios sintéticos antes de corregir. No se da por comprobada la entrega de correo ni una activación real por el hecho de que una simulación pase.

## Estado inicial de integridad y seguridad

Huellas registradas para empleados, candidatos, respuestas, entrevistas, contratación, onboarding, bajas, documentos, medios, vistas, roles y metadatos Auth no secretos. Se compararán al finalizar.

Avisos previos: RLS sin política 28 (informativo), ejecución de funciones por anon 14 / authenticated 34, protección de contraseñas filtradas 1. Rendimiento: claves foráneas sin índice 33, evaluaciones RLS 20, índices sin uso 5 y políticas permisivas múltiples 2. No se alterarán configuraciones o permisos administrativos para silenciarlos.
