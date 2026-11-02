# Incorporación aprobada · El Cartel Studio

Implementación del paso 11 y separación del avance de la ruta y la contratación formal.

## Operación

1. En **11 · Preparar contratación**, **Notificar al candidato** prepara dos enlaces individuales protegidos y muestra exactamente el mensaje aprobado, sin emojis ni exclamaciones.
2. Abrir WhatsApp no cambia el estado. RRHH debe confirmar expresamente que envió el mensaje. La confirmación puede retomarse en la misma pestaña después de recargar.
3. La confirmación avanza a **12 · Inserción en sistema**, con **Contratación en trámite**. Los accesos, usuarios, roles y permisos siguen reservados para otra etapa.
4. **Revisar contratación en trámite** permite consultar datos y documentos, validar el expediente, registrar el contrato firmado recibido y validado, y formalizar la contratación. La validación se vincula a la revisión vigente.
5. Solo la formalización crea/actualiza el trabajador y cambia al candidato a **Contratado**. La ficha y los contadores reciben la actualización. El contrato y los documentos quedan disponibles en la ficha del trabajador.
6. **13 · Efectuar baja / Cierre de contrato** se muestra reservado, sin operación de baja habilitada.

## Expediente y contrato

- Cuatro secciones: identificación; contacto y emergencia; documentos y escolaridad; revisión y veracidad.
- Se precargan los datos de la candidatura, respuestas personales de captación y entrevista, y el expediente del cierre de prueba. No se incluyen respuestas médicas, estado civil o hijos.
- Las fotos anteriores del CI se reutilizan como documentos privados. Se pueden reemplazar individualmente. Las fotos nuevas se comprimen a JPEG con un máximo de 1800 px en su lado mayor y calidad 0,88, con vista previa para comprobar legibilidad.
- Móvil, contacto de emergencia y datos de identificación son obligatorios. Fijo, correo y dirección alternativa son opcionales. Se puede adjuntar título o certificación pertinente (PDF o imagen).
- Los enlaces duran siete días. Renovarlos invalida el enlace anterior. Se pueden revocar; también se revocan al retroceder y al formalizar.
- El contrato utiliza una captura de la plantilla maestra de la plaza y sus fuentes aplicables al preparar el caso. No crea una segunda plantilla editable ni modifica cláusulas. Las reglas de resolución se extraen de `plaza-ficha.html` con `scripts/build-hiring-contract.cjs`.
- **Imprimir** abre la impresión del navegador. **Descargar** genera un PDF real, usando una copia local fijada de jsPDF 2.5.2 con su licencia y procedencia.
- Las correcciones se permiten hasta la validación. Cualquier reemplazo de archivo cambia la revisión y exige volver a enviar el expediente. Después de validarlo, los documentos no pueden cambiar. Reabrir correcciones invalida las confirmaciones anteriores de revisión y firma.

## Datos y seguridad

`sql/hiring-flow.sql` crea `hr_hiring_cases`, funciones con permisos mínimos, políticas de almacenamiento privado y controles del lado del servidor. No modifica filas de candidaturas existentes al instalarse.

Los tokens aleatorios de 256 bits solo se guardan como SHA-256 en el servidor y se transmiten en el fragmento del enlace. Las páginas públicas no guardan sesiones de RRHH. Los documentos no son públicos.

Las funciones privilegiadas residen en un esquema privado; las entradas públicas son invocadoras. Las operaciones de RRHH verifican al propietario. El RPC anterior `hr_confirm_trial_hire` pasa por la misma validación y transferencia de expediente. Un control adicional impide cambiar directamente a `hired` sin los requisitos del nuevo flujo. No se reevalúa a trabajadores históricos ya contratados.

El retroceso conserva datos, documentos e historial. La formalización es transaccional e idempotente: un reintento no duplica documentos o trabajadores.

## Verificación

- `tests/hiring-flow-sql.cjs`: PostgreSQL aislado con PGlite, esquema de pruebas y la definición previa real del RPC de contratación. Comprueba permisos, caducidad, rotación y revocación, alcance de archivos, precarga, herencia de fotos, correcciones, revisión, firma, retroceso y transferencia sin duplicados.
- `tests/hiring-flow-browser.cjs`: carga completa de la aplicación y pantallas a 390 y 1440 px; precarga, corrección, compresión, confirmación y reintento; paso 12, retroceso, plantilla y descarga PDF real. Intercepta todas las solicitudes y sustituye `window.open`: no envía mensajes ni modifica datos de producción.
- `tests/recruitment-regressions.cjs`: sintaxis, paginación, errores de lectura, plazas, actualización del dashboard y numeración. Se actualizaron dos elementos desfasados de su simulación; las pantallas de entrevista y captación no cambian por ello.

Ejecutar con Node y los módulos `@electric-sql/pglite` y `playwright`. Puede indicarse su ubicación mediante `PGLITE_MODULE` y `PLAYWRIGHT_MODULE`. El navegador de prueba usa Microsoft Edge instalado en Windows. Las capturas y PDF se escriben en el directorio temporal `cartel-hiring-tests` o en `HIRING_OUTPUT_DIR`.

```text
node tests/hiring-flow-sql.cjs
node tests/hiring-flow-browser.cjs
node tests/recruitment-regressions.cjs
git diff --check
```

Las pruebas de aceptación operan con personas y documentos sintéticos. La verificación pública posterior usa enlaces inválidos y consultas de permisos; no ejecuta notificaciones ni formalizaciones reales.
