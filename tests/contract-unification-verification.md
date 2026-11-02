# Contrato laboral: fuente y presentación unificadas

Fecha: 2 de noviembre de 2026.

## Hallazgos

- La plantilla real está en `hr_roles.work_content.contract_templates.employment.documents`, documento `employment_contract`. El archivo adjunto de la plaza (`employment_contract_path`) es una descarga independiente; no es la plantilla que presenta el editor contractual.
- Las cláusulas se resuelven con los datos de plaza y `hr_nomenclators`: datos de empresa, cláusulas maestras, políticas y disciplina. Se inspeccionaron esas fuentes en producción sin cambiar sus registros.
- El paso 11 ya guardaba una instantánea de esas fuentes al emitir por primera vez. Renovar enlaces solo cambiaba el token y no actualizaba la plantilla.
- El candidato usaba encabezados HTML simplificados, omitía numeración y estructura de subcláusulas, convertía anexos en párrafos y creaba el PDF con Helvetica y una paginación independiente. No utilizaba logos ni marcas de agua del editor.

## Resultado y archivos

- `assets/contract-paper.js` y `.css`: reglas y estilos generados directamente desde `plaza-ficha.html`; ninguna cláusula nueva escrita para la vista pública. `scripts/build-contract-paper.cjs --check` verifica paridad.
- `assets/hiring-contract-paper.js` y `.css`: vinculación de datos, logos privados, escalado móvil, impresión y PDF de las mismas páginas Carta (816 × 1056 px; PDF 612 × 792 pt).
- `contrato-laboral.html`: carga local de las bibliotecas y del nuevo renderizador. Los estilos nuevos se cargan únicamente para la versión nueva.
- `assets/hiring-contract.js`: conserva la vista anterior para instantáneas firmadas anteriores; dirige la versión 2 a la presentación compartida.
- `plaza-ficha.html`: nuevos nombres únicos para logos y marcas de agua; conserva archivos anteriores al reemplazarlos o restablecerlos. Corrección del destino de fragmentos al dividir una subcláusula demasiado larga.
- `sql/hiring-contract-versioning.sql`: huella de fuente, fecha de emisión, versión de presentación, renovación y protección de contratos firmados. Acceso a logos limitado al token y a las rutas de su instantánea, en esquema privado.
- `assets/contract-renderer-v2.json`, `scripts/check-contract-renderer.cjs` y comprobación de GitHub: fijan los archivos de la presentación emitida. Un cambio posterior de presentación requiere otra versión conservando la anterior.

## Política de versiones

1. La primera emisión toma la plantilla y las fuentes vigentes de la plaza.
2. Renovar enlaces de un expediente todavía sin validar toma una nueva instantánea vigente e invalida el token anterior. Consultar o descargar no modifica la instantánea.
3. Una versión validada queda fijada. Puede reabrirse antes de firmar y renovarse después si necesita incorporar cambios de plantilla.
4. Al confirmar la recepción del contrato firmado se fijan también los datos consolidados del candidato. Los contratos firmados no admiten cambios de contenido o datos ni reapertura destructiva. Cualquier modificación posterior requiere otro expediente.
5. Las emisiones anteriores sin firma reciben el formato nuevo al consultarlas, conservando su plantilla emitida hasta su renovación. Las firmadas anteriores conservan el renderizador anterior.

## Pruebas realizadas

- Navegador real a 390 y 1440 px: página completa, datos simulados, caracteres HTML tratados como texto, nombres/CI/domicilio y anexo de datos; descarga PDF real e impresión.
- Plantilla real de Asistente Personal / Ejecutivo: 26 bloques. Vista, impresión y descarga en ambos tamaños. Los cuatro PDF contienen 14 páginas Carta, sin recortes detectados por las comprobaciones de contenido. Para esta prueba aislada se sustituyó el logo privado por el SVG local; se verificó por separado que el archivo original existe en el almacenamiento privado.
- Regresión completa de contratación: precarga/corrección, compresión de documentos, envío simulado, dos enlaces con el mismo token, vencimiento, texto editable de WhatsApp, reintento, confirmación independiente, paso 12 y retorno. Todas las solicitudes de esa prueba fueron interceptadas. No se envió ningún WhatsApp.
- PostgreSQL aislado: permisos de propietario/anónimo, RLS de archivos, tokens inválidos/caducados/revocados, rotación, revisiones obsoletas, validación, firma, traslado e idempotencia.
- Pruebas añadidas: cambio de plantilla pendiente, renovación y cambio de huella; denegación de logos ajenos y tokens inválidos; datos firmados fijos y rechazo de modificación/reapertura de un contrato firmado.
- Instalación en producción exclusivamente de funciones, permisos y disparador. La huella agregada de los expedientes existentes se comprobó idéntica antes y después. No se editaron candidatos reales.

## Límites de la comprobación

Las pruebas móviles usan el navegador con tamaño móvil, no un teléfono físico. No se abrió ni firmó un contrato real de candidato. El control visual del logo privado original no se realizó dentro de un contrato real; la verificación de acceso se hizo con datos simulados y comprobación de existencia del archivo original.

Los resultados locales y la copia de referencia de la plantilla están excluidos de Git: pueden contener datos contractuales de empresa y no se publican como fixtures.
