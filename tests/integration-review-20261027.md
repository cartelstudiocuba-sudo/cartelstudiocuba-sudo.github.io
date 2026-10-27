Revisión de integración — 27 de octubre de 2026

Se revisaron en GitHub los commits 9ab1647 y cc98229 y los trabajos del despliegue 40452377646: build, deploy y report-build-status finalizaron con success. La rama remota seguía en cc98229 al comenzar esta revisión.

Enviar documentación usa el generador buildDocumentationInformativePages('role_content', ...), sin adjuntos obligatorios ni contrato. Se conserva el mensaje de WhatsApp. El código instalado en Supabase emite tokens aleatorios de 256 bits, guarda solo su hash y limita su vigencia a siete días. Revalidación en descarga, rotación, revocación y aislamiento anónimo siguen presentes.

Validación nueva:

- training-content-access.sql: PASS contra Supabase real, transacción revertida. Autorización, lectura anónima limitada, contenido vigente, hash, rotación, caducidad, revocación y período sustituido.
- training-content-browser.cjs: PASS a 390 y 1440 px, formulario y WhatsApp, errores y concurrencia, vista pública sin sesión, PDF descargado y rechazo de token inválido/revocado. Datos de navegador simulados.
- closure-document-regression.cjs: PASS tras corregir expectativas desactualizadas.
- closure-public-render.cjs: PASS a 390 y 1280 px, cláusulas, firmas, fechas, ausencia del campo de resumen, sin errores JavaScript.
- git diff --check: PASS.

El fallo previo no era una regresión de la integración. La prueba aún exigía eliminar la cláusula octava y conservar un botón Cerrar. Los cambios 19890c0, 2d561dc y a9c7bd3 restauraron expresamente las cláusulas, retiraron Cerrar y dejaron fuera únicamente el campo final de resumen. Se actualizan las pruebas a ese comportamiento y se sirve el helper real en la simulación de navegador. Se comprueba también que limpiar una plantilla no modifica la instantánea original.

No se modifican páginas, plantillas, funciones ni datos de producción. Este cambio contiene pruebas e informe. No se enviaron mensajes. La descarga de 5 113 950 bytes en producción corresponde a la evidencia histórica de cc98229; esta revisión repite la descarga con datos simulados y la seguridad contra Supabase real.
