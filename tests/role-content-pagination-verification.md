# Verificación de paginación pública de Contenido de la plaza

Fecha: 27 de octubre de 2026. Base revisada: 58f778fe3fcccdadc856028e1a45f364ccf31267, coincidente con origin/main al consultar GitHub.

## Corrección

- Medición de la separación al pie en coordenadas Carta; reserva de 30 px al dividir y mínimo de 28 px al verificar, para absorber redondeo fraccionario.
- Vista móvil mediante transform, sin zoom que recomponga las líneas. Composición y exportación fuera de pantalla a 816 × 1056 px (Carta).
- Evita desplazamiento interno de páginas durante la división, que podía ocultar encabezados y falsear la altura disponible. Texto sin autosizing en iOS.
- División conserva exactamente todos los caracteres, incluyendo espacios, saltos de línea y pares sustitutos Unicode.
- Reconstrucción transaccional: un fallo conserva la vista previa anterior. Si falla la primera paginación, presenta el texto íntegro en vista continua con aviso y opción de reintentar. La exportación siempre reconstruye y verifica páginas Carta; no exporta la recuperación continua.

## Pruebas realizadas

Ejecutadas en Windows con Microsoft Edge/Chromium headless y Playwright. No se dispuso de Safari/iOS real ni se afirma haberlo probado; los anchos móviles son emulación de viewport en Chromium.

- tests/training-content-browser.cjs: PASS a 320, 390, 768 y 1440 px, con párrafos extensos, campos agrupados y cadenas Unicode sin espacios. Cada escenario produjo 39 páginas, comprobando igualdad exacta del texto sin normalizar espacios.
- Escalas visuales .37, .48, .85, 1 y 1.25: integridad y separación al pie verificadas. La condición anterior reproduce un falso desbordamiento con escala .37.
- Comprobación del límite superior, desplazamiento interno cero y separación al pie.
- Descargas reales del navegador a 390 y 1440 px. El archivo de prueba extenso descargado tiene 12 páginas; pdfinfo confirma 612 × 792 puntos, Carta. Revisión visual con Poppler de páginas normales y continuación del bloque largo: encabezados, texto y pie dentro de márgenes.
- Fallo simulado al reconstruir: conserva exactamente la vista previa y permite reintentar. Fallo inicial simulado: recupera el texto completo en vista continua. Enlace ficticio inválido o vencido sigue retirando el documento.
- Regresión del formulario de documentación: PASS a 390 y 1440 px, fecha/tutor/teléfono inicialmente vacíos y obligatorios. WhatsApp se simula; esos datos no se pasan al generador PDF.
- tests/role-content-warnings.cjs: PASS sin mutaciones. git diff --check: PASS.

## Alcance y evidencia

Solo se modifican el diseño/paginación de Contenido de la plaza, su controlador público, las referencias de caché y las pruebas. Sin cambios en rrhh.html, candidatos, contratos, SQL/Supabase ni emisión/revocación de tokens. Todas las respuestas RPC de navegador se interceptan con datos ficticios; no se contacta Supabase ni se crean enlaces reales o se envían mensajes.

Evidencia local: tests/training-content-proof.pdf, tests/training-content-mobile.png, tests/role-content-desktop.png y tests/role-content-final-06.png. No se incorporan binarios generados al commit.

Verificación de publicación: tests/role-content-release.cjs comprueba el estado de GitHub Pages para el SHA actual y compara los cuatro recursos publicados con el checkout. tests/training-content-browser.cjs --published permite repetir el flujo usando los recursos públicos y manteniendo todas las RPC simuladas.
