# Contenido de la plaza: correcciones del 27/10/2026

Base inspeccionada: 3bbf30e7277d8a9fed69c8681dd2d9a1e87a6684 (main).

Cambios limitados al documento informativo role_content y su descarga pública:
- Paginación medida en Carta: si un bloque no cabe se divide conservando su HTML y texto, prefiriendo saltos de párrafo/línea y palabras. Cada fragmento se vuelve a medir. La comparación exacta del texto antes/después y los límites de página se verifican en cada generación.
- Tipografía de cuerpo Arial 11 px / 1.55 y títulos coherentes, con ajuste de palabras extensas. La vista móvil escala el lienzo Carta; el PDF se genera en un contenedor independiente de 816 × 1056 px.
- Descarga por Blob con enlace download y liberación diferida del recurso. No se abre una vista PDF adicional. Edge puede abrir su propio panel edge://downloads-hub/.
- Avisos internos no bloqueantes sobre campos vacíos, protocolos incompletos, textos orientativos y ponderaciones 0%. No se incluyen en las páginas ni en la vista pública; no modifican los datos.

Verificación local PASS:
- training-content-browser.cjs: Edge aislado, anchos 390 y 1440; formulario y texto WhatsApp; bloques de párrafos extensos y campos agrupados, igualdad exacta del texto y ajuste de todas las páginas; PDF con cabecera %PDF- descargado en móvil emulado y escritorio; sin nuevas vistas PDF; sin desbordamiento horizontal móvil; invalidación y token inválido simulados; sin errores JavaScript.
- role-content-warnings.cjs: vacíos, textos orientativos, protocolos y pesos 0%; datos inmutables.
- closure-document-regression.cjs: contratos, cláusulas, firmas y análisis sintáctico intactos.
- Revisión visual de captura móvil.
- git diff --check.

La prueba heredada recruitment-regressions.cjs falla al extraer fetchInterviewAnswers del HTML. Se reprodujo el mismo fallo usando exclusivamente los tres HTML de HEAD (3bbf30e), antes del cambio. entrevistas.html, rrhh.html y aplicar.html están intactos. No es un fallo introducido por estas correcciones.

Las pruebas interceptan el RPC con una ficha ficticia. No crean ni revocan enlaces, no usan candidatos reales y no envían WhatsApp. No se modifican contratos, SQL, tokens, permisos, formulario ni mensajes.

Límite: móvil emulado en Edge; no se afirma verificación física en Safari/iOS o Android.
