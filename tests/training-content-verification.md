Verificación: 27 de octubre de 2026

El botón del comienzo de capacitación emite una capacidad de lectura de siete días. No consulta archivos adjuntos ni envía contratos. El texto aprobado de WhatsApp conserva sus palabras; se corrigen el primer nombre y los saltos de línea literales. Las opciones personalizadas se comparan correctamente al comprobar cambios concurrentes.

La vista pública usa `buildDocumentationInformativePages('role_content', ...)`, el mismo generador de la ficha. El PDF usa ese generador en un contenedor de tamaño Carta, independiente del ajuste visual móvil. La API devuelve datos vigentes mediante una lista explícita de campos; excluye contratos, respuestas automáticas, datos del candidato y rutas privadas. No se cambian permisos de las tablas administrativas.

Seguridad: token criptográfico de 256 bits en el fragmento del enlace, hash SHA-256 en una tabla privada con RLS, caducidad del servidor y revocación por el propietario. Preparar otro enlace revoca los anteriores del mismo período. Un período sustituido o una candidatura que sale de capacitación pierde el acceso. `hr_revoke_training_content(trial_id)` permite revocar explícitamente. La descarga vuelve a validar el token y obtiene el contenido vigente.

Pruebas ejecutadas:

- `training-content-access.sql`: PASS en Supabase real, con ROLLBACK. Incluye emisión exclusiva del propietario, denegación a otros usuarios y anónimos, acceso anónimo con token válido, hash, campos permitidos, actualización del contenido, tokens incorrectos, rotación, caducidad, revocación y período sustituido.
- `training-content-browser.cjs`: PASS con Edge aislado, 390 y 1440 px. Formulario, siete días, salario heredado, tutor vacío, WhatsApp decodificado, ausencia de adjuntos y contrato, errores, opciones personalizadas y cambios concurrentes. Vista pública completa, PDF real de ocho páginas con datos simulados, ausencia de lecturas administrativas y de sesión persistida, enlace inválido y revocación. Revisión visual de captura móvil.
- `training-content-live.cjs`: PASS con frontend local y Supabase real, candidato sintético temporal. Sesión anónima, solo RPC de lectura por token, PDF descargado de 5 113 950 bytes, token inválido rechazado y ningún error JavaScript.
- `git diff --check`: PASS.

Incidencia previa comprobada: `closure-document-regression.cjs` falla en la línea 16 al encontrar «Ninguna» en la vista del acta. Se reprodujo idénticamente con los archivos originales del commit `c5af790`; los archivos del acta no se modifican en este cambio.

Los avisos de Supabase sobre funciones SECURITY DEFINER se revisaron: la lectura anónima de esta API es intencional y exige el token; emisión y revocación comprueban el propietario. La tabla privada no concede acceso directo. Referencia del analizador: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

Producción: `training-content-live.cjs --published` terminó en PASS sobre https://gestion.elcartelstudio.com con Supabase real. Descargó un PDF de 5 113 950 bytes sin login, rechazó el token incorrecto y no registró errores JavaScript. Todas las solicitudes a Supabase correspondieron exclusivamente al RPC de lectura por token. El candidato, período, acta y enlaces sintéticos fueron eliminados después; se comprobó que no quedan registros de esa prueba.

Commit de implementación: `9ab1647e7eb99b1a4256160724a98761a5f5186f`.
GitHub Pages: despliegue `40452377646`, conclusión `success`.
https://github.com/cartelstudiocuba-sudo/cartelstudiocuba-sudo.github.io/actions/runs/40452377646

Migración aplicada en `jhumvctocphyiwhszeaz`: `secure_live_training_content_links`.
Las pruebas no enviaron mensajes a candidatos reales. Los PDF, capturas y tokens de prueba no se incorporan al historial Git.
