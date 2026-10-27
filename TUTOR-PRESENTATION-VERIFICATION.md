# Enviar documentación: presentación automática del tutor

Se elimina el campo manual y su explicación. WhatsApp candidato conserva su documento; WhatsApp tutor genera la presentación con el exportador existente, publica un archivo privado y prepara la plantilla aprobada en una vista editable. El formulario solo se usa para redactar WhatsApp. El puente recibe exclusivamente el identificador de la plaza, carga sus fuentes completas y no guarda cambios ni registra una exportación manual.

## Publicación y acceso

- Exportación automática PDF 16:9; modo de presentación cargada conserva PDF/PPT/PPTX/PPSX. PowerPoint se descarga sin enviarlo a visores de terceros.
- Publicación requiere sesión verificada y autorización de propietario en la base de datos. Se valida etapa de capacitación, plaza, versión, extensión, firma de archivo, existencia y tamaño máximo de 50 MB. Entrada multipart acotada incluso sin Content-Length.
- Bucket privado `hr-tutor-presentations`, sin políticas de acceso directo para clientes. El servidor transmite los bytes: nunca devuelve rutas internas, claves privilegiadas ni URLs de Storage.
- Capacidad aleatoria de 256 bits, guardada únicamente como SHA-256, caducidad de siete días, rotación por período y revocación mediante `hr_revoke_tutor`. Cada consulta/descarga valida token, vigencia de candidatura y decisión de capacitación; se vuelve a validar después de leer Storage. El enlace da acceso a quien lo posea, circunstancia visible en el visor. Una copia ya descargada no puede revocarse.
- Separación estricta de `content_links` y `tutor_links`: los tokens no son intercambiables. Publicar/revocar tutor no revoca el contenido de la plaza.
- Sin caché de respuestas privadas, sin referer, token en fragmento y retirado de la barra al cargar; visor con CSP y mensajes de error sin información interna. Reabrir el enlace original tras recargar el visor.
- Los archivos privados permanecen almacenados tras caducar. No se ha añadido una política automática de eliminación; el acceso queda cerrado por el servicio.

## Verificación realizada

- `tests/tutor-access.sql`: ejecutado contra Supabase con transacción revertida. Autorización, restricciones de ruta/versión, hash, aislamiento entre documentos, expiración, rotación, revocación y período reemplazado.
- `tests/tutor-service.cjs`: servicio real ejecutado con dependencias simuladas. Errores de autorización, origen, firma, subida, limpieza de archivo fallido, expiración y revocación durante lectura; bytes de consulta/descarga y ausencia de rutas en respuesta.
- `tests/tutor-whatsapp.cjs`: 390/1440 px, validación de campos y teléfono, plantilla editable, enlaces separados, fallo de publicación, estado al regresar y WhatsApp completamente simulado.
- `tests/tutor-export-browser.cjs`: exportador real e iframe del puente con plaza ficticia; PDF de 30 páginas y 2.626.478 bytes; publicación multipart y servicio simulados, visor y descarga efectivos a 390/1440 px. Portada y página interior renderizadas e inspeccionadas.
- `tests/training-content-browser.cjs`: regresión completa aprobada a 320/390/768/1440 px, texto extenso de 39 páginas, descarga PDF, errores, recuperación y acceso público aislado. Se actualiza el selector de la prueba para la vista editable ya existente.
- Asesor de seguridad Supabase: revisado antes/después. Nuevos avisos esperados: tabla privada RLS sin políticas (denegación deliberada) y tres RPC SECURITY DEFINER autenticadas que comprueban propietario. Resolver restringido exclusivamente a service_role, sin concesión anónima. Los avisos preexistentes generales quedan fuera de este cambio.
- Servicio Edge desplegado y rechazo real de token inválido verificado. `tests/tutor-release.cjs` compara los archivos publicados y verifica rechazos reales de consultas, descarga y publicación sin sesión.

## Límite de la evidencia

No hay sesión del propietario disponible en el navegador de esta tarea. La subida autenticada completa a Storage con descarga posterior no se ha ejecutado en producción: la ruta positiva de servicio se comprobó con dependencias simuladas, el PDF con el generador real y las reglas de autorización contra la base real. No se enviaron mensajes ni se modificaron candidaturas reales; los datos SQL de prueba se revirtieron.
