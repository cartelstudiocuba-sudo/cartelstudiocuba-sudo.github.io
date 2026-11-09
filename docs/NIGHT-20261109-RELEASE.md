# Jornada RRHH — correcciones verificadas

## Estado inicial y problemas

Base 8a83a5a2e3c04c9aa8ed96159f96ddc645d4bb50. La auditoría está en NIGHT-20261109-AUDIT.md. Se reprodujeron dos fallos con servicios sintéticos en 320, 390, 768 y 1440 px: repetir el cambio de contraseña después de un fallo de activación; perder texto de baja al recargar el caso tras un error.

## Cambios

- Activación: una contraseña cuyo guardado fue reconocido se elimina del formulario y solo se reintenta la confirmación del acceso. Se verifica nuevamente la identidad y la vigencia; cambiar de identidad bloquea el reintento. Un enlace nuevo reinicia el formulario. Los errores o respuestas inciertas nunca se presentan como cuenta activada.
- Baja: preparación reversible, consulta de pendientes y conservación de texto en memoria de la pestaña. Los errores conservan el borrador; otra versión documental no recibe texto antiguo automáticamente. Las confirmaciones de revisión nunca se restauran. Preparar o consultar no inicia una baja.
- Se deshabilita iniciar cuando la lectura indica que falta el contrato requerido; se muestran pendientes antes del cierre. El servidor mantiene toda autorización y comprobación definitiva.
- Se conserva el diseño y los componentes de selección, ficha de cuatro pestañas, alta directa y Paso 12. No se modifica Inventario General.

## Verificación previa

Pruebas de incorporación/Edge/SQL, roles/vistas, ficha, navegación, alta directa, contratación, cuestionarios, baja y cierre de sesión. Bases PostgreSQL de prueba aisladas y servicios de navegador sintéticos; sin escribir en producción ni enviar correo o WhatsApp. Nuevas reproducciones en cuatro anchuras, comprobación de desbordamiento y captura móvil. Verificación de conservación del código original y ausencia de nuevos endpoints de escritura o almacenamiento persistente en la preparación.

Las huellas agregadas antes/después coinciden en los doce grupos: empleados, candidatos, respuestas, entrevistas, contratación, onboarding, bajas, documentos, medios, vistas, roles y metadatos Auth no secretos. La Edge desplegada coincide con el código del repositorio. No hay migraciones, cambios RLS, credenciales, permisos administrativos, bajas reales ni revocaciones.

## Límites y decisiones pendientes

1. No se ha demostrado entrega real SMTP ni una activación con una identidad real. Hace falta un destinatario de prueba autorizado para comprobar el recorrido de correo completo. Las pruebas controladas no sustituyen esa comprobación.
2. Si el servidor consume el enlace pero se pierde su respuesta, el cliente muestra resultado incierto y permite comprobar el acceso. Resolverlo concluyentemente requiere un estado autenticado de activación o idempotencia del servidor, con revisión específica de seguridad. Tampoco se persiste el reconocimiento de contraseña al recargar.
3. La baja exige actualmente contrato firmado en hr_hiring_cases. Reconocer contratos históricos de altas directas requiere acordar la fuente válida y revisar el procedimiento; no se relaja el control ni se crean casos ficticios.
4. Los borradores de preparación solo viven en memoria de la pestaña; cerrar o recargar puede perderlos. Un borrador durable protegido requiere diseño de permisos y almacenamiento.
5. Avisos previos de seguridad y rendimiento permanecen documentados en la auditoría. No se cambian políticas ni ajustes para silenciarlos. Referencias: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable y https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable ; protección de contraseñas: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Publicación y reversibilidad

Solo archivos estáticos, pruebas y documentación. Publicación por el flujo habitual de GitHub Pages, después de las verificaciones. La confirmación del despliegue y su commit se entrega en el informe de sesión; este documento no da por publicado un despliegue pendiente. Revertir el commit restaura los archivos previos; no hay datos ni migraciones que revertir.

Siguiente jornada: autorizar identidad/destinatario de prueba para correo, decidir contratos históricos válidos para baja y evaluar resolución segura de respuestas de activación perdidas. No ejecutar cierres reales como prueba.
