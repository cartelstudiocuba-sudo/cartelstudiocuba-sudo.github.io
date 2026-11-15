# Carta menú del Bar

Implementación del 14 de noviembre de 2026 en Nevera audiovisual, botón «Carta menú» antes de «Cuadre».

## Funcionamiento

El editor muestra los productos activos con sus precios de venta en USD, búsqueda y filtro de categoría, inclusión individual/todos/ninguno, orden y acabado mate o brillo. Los cambios se ven en el diseño amarillo con ilustraciones sutiles, pincelada negra y tipografías condensada/caligrafiada. Borrador y aprobación son operaciones diferentes; guardar un borrador no publica ni altera productos.

La carta física es Letter vertical: 21,59 cm de ancho × 27,94 cm de alto, 8,5 × 11 pulgadas. Preview y exportación utilizan el mismo renderizador Canvas. El JPG tiene 2550 × 3300 píxeles, metadatos JFIF de 300 ppp, márgenes seguros y esquinas dibujadas para corte redondeado. El tamaño de texto se ajusta dentro de límites legibles y se bloquea la aprobación si la selección desborda una hoja.

La aprobación exige confirmación explícita y valida en servidor la revisión del borrador, productos activos y huella del catálogo de nombres/categorías/precios. Si cambian los precios durante el envío, no se publica: se requiere actualizar y revisar de nuevo. Cada versión conserva el listado y los precios aprobados, autor, fecha, archivo y SHA-256. Los cambios futuros no reescriben archivos o snapshots anteriores. Los reintentos de comandos conservan el identificador y no duplican versiones.

El JPG aprobado se descarga, se abre para imprimir al 100 % o se comparte mediante un enlace de WhatsApp que el usuario envía al destinatario que elija. El mensaje incluye versión y enlace permanente de descarga, medida, Bristol o similar de 180–220 g/m², una cara, full color, acabado mate/brillo, corte redondeado y tamaño real sin ajustar a página. La acción no envía mensajes automáticamente.

El QR real puede descargarse en PNG y aparece en el JPG. Apunta siempre a `https://gestion.elcartelstudio.com/carta-menu.html`. La carta digital muestra la última versión aprobada; los enlaces de impresión y descarga de cada versión permanecen fijos. Las herramientas de exportación se habilitan cuando el editor coincide con la versión aprobada. Las versiones anteriores tienen su descarga explícita en el historial.

## Datos y seguridad

Migraciones `fridge_menu_approved_letter` y `fridge_menu_public_delivery` aplicadas. Tablas privadas nuevas: `fridge_menu_settings`, `fridge_menu_versions` y `fridge_menu_events`, con RLS y sin permisos directos de tabla a clientes. Las funciones de edición verifican la autoridad actual del Bar (operador autorizado, Manager o propietario) y usan revisión, bloqueo transaccional e idempotencia. No se conceden roles ni vistas a otros usuarios.

Bucket privado `fridge-menu`, solo JPEG de hasta 4 MiB. La subida requiere autorización del Bar y ruta del usuario; no hay permiso de cliente para sobrescribir o borrar imágenes aprobadas. Un intento que no llegue a aprobar puede dejar un archivo privado sin publicar; se conserva ante envíos inciertos.

Función de entrega `fridge-menu-image`, versión 2: endpoint público deliberado para imágenes y JSON de cartas aprobadas, no para editar. La función consulta mediante credencial de servidor únicamente la versión aprobada indicada o la activa; no acepta rutas de almacenamiento. Antes de servir un JPG verifica su hash, tamaño máximo y dimensiones. El JSON público contiene la carta aprobada, sin costos, existencias, cuentas, autores ni borradores. El visitante no obtiene acceso al esquema privado ni a RPC de edición. Las credenciales de servidor nunca aparecen en código del navegador.

Antes/después de la migración coincidieron las huellas de ocho tablas existentes del Bar. No se modificaron productos, ventas, costos, compras, movimientos, pagos, configuraciones ni cuadres. Los avisos de seguridad conservaron sus recuentos previos. No se aprobó ninguna carta de datos reales durante la implementación: la vista pública permanece sin carta hasta la primera aprobación del usuario.

## Archivos

- `assets/fridge-menu.js`, `assets/fridge-menu.css`: editor, borrador, aprobación, historial, exportación, enlaces y recuperación.
- `assets/fridge-menu-render.js`: dibujo, ajuste de texto, QR, JPG y mensaje de impresión.
- `carta-menu.html`, `assets/fridge-menu-public.js`: página de clientes e impresión a tamaño real.
- `assets/fridge.js`, `nevera-audiovisual.html`: integración y navegación de seis botones.
- `assets/fonts/*`, `assets/vendor/qrcode-generator-1.4.4.js` y su licencia: tipografías locales y QR sin servicios externos. Barlow Condensed: SIL OFL; Yellowtail: Apache 2.0; QR Code Generator de Kazuhiko Arase: MIT.
- `database/fridge_menu.sql`, `database/fridge_menu_public_delivery.sql`, `database/fridge_menu_rollback.sql`: esquema, entrega pública y reversión de accesos sin borrar datos.
- `supabase/functions/fridge-menu-image/*`: entrega de versiones aprobadas.
- `tests/fridge-menu-sql.cjs`, `tests/fridge-menu-render.cjs`, `tests/fridge-menu-ui.cjs`, ajustes en pruebas de la nevera y compuestos, `package.json`, `package-lock.json`.

## Verificación

Suite completa `npm run test:fridge` y suite específica `npm run test:fridge:menu`. Se comprueban borrador, orden, aprobación, precios vigentes y cambios concurrentes, recuperación sin duplicados, RLS de imágenes, acceso de Manager, bloqueo de usuarios ajenos, proyección pública sin datos internos, historial y reversión. Las pruebas de render generan el JPG, verifican dimensiones y 300 ppp, decodifican el QR desde el JPEG comprimido y prueban el límite de contenido de una sola hoja. Las pruebas de interfaz cubren búsqueda sin acentos, selección, revisión, aprobación, impresión, mensajes de WhatsApp, pérdida de conexión, cambio de precios y página pública sin sesión.

El JPG se inspeccionó visualmente. En producción se comprobó la lectura autorizada del editor y que el endpoint público devuelve `null` sin versión aprobada, 404 para una imagen aún no publicada y 400 para una versión inválida. La interfaz adaptable se comprobó por estructura DOM/CSS y flujo sintético; queda pendiente inspección visual autenticada en escritorio/móvil y la primera impresión física. No se subió ni aprobó una carta ficticia en producción.

Reversión: restaurar frontend del commit anterior y ejecutar `fridge_menu_rollback.sql` para retirar los nuevos accesos, sin eliminar borradores, versiones, imágenes ni auditoría. Los archivos privados sin publicar se pueden revisar posteriormente desde administración de almacenamiento.

## Actualización visual · Urbano creativo

Diseño elegido por el usuario: fondo amarillo ilustrado, lettering «Menú» sobre pincelada negra, ilustraciones de bar en el perímetro, nombres en mayúsculas y precios alineados. El fondo estático `assets/menu/urban-background-v2.jpg` contiene solo arte y encabezado; todos los productos, precios, QR y pie se dibujan desde los datos actuales. Se carga desde el mismo dominio y se bloquea la exportación si no se puede cargar. El arte se preparó con generación de imágenes a partir de la propuesta aprobada; no contiene productos ni precios de ejemplo.

El QR real conserva sus módulos cuadrados y margen blanco; lo rodea una tarjeta blanca con esquinas redondeadas. La hoja/exportación sigue siendo 2550 × 3300 px con 300 ppp; el arte de fondo original es de 1103 × 1426 px y se escala, mientras textos y QR se dibujan directamente a resolución final. La imagen exportada se inspeccionó visualmente y el QR se decodificó desde el JPG comprimido.

Migración `fridge_menu_urban_design`: añade `design` a los snapshots de futuras aprobaciones, conserva `original-v1` para clientes anteriores y registra `urban-v2` en el nuevo editor. No reescribe versiones. El editor requiere aprobar el nuevo diseño antes de descargarlo o compartirlo, aunque sus productos coincidan con una versión antigua. Se mantiene la descarga de versiones anteriores desde el historial. También normaliza el punto literal de la extensión JPG en la validación de ruta y en la política de subida (`[.]`), sin ampliar permisos ni rutas.

No se modifican datos del catálogo, ventas, existencias ni cuadres; no se publica una carta real automáticamente. Reversión visual: restaurar los archivos frontend previos; el nuevo metadato de diseño es compatible y se puede conservar. La función anterior está en `fridge_menu.sql` si se requiere restaurarla conservando los permisos actuales.

## Corrección del diseño elegido · Amarillo elegante

El usuario aclaró con imagen que la selección era «Amarillo elegante». Se utiliza `assets/menu/elegant-background-v3.jpg`: trama fina y tenue, lettering y pincelada de esa referencia. Los nombres conservan su escritura original, los precios se alinean a la derecha y las líneas separan cambios de categoría dentro del orden seleccionado. «PRECIOS EN USD» queda encima del QR; tarjeta blanca redondeada y texto sin cursiva. No se incorporan los productos ni los precios ficticios de la propuesta.

Migración `fridge_menu_elegant_design`: permite la etiqueta `elegant-v3` para futuras aprobaciones y sigue aceptando `original-v1` y `urban-v2`, conservando versiones históricas. No altera registros actuales ni permisos. Se requiere aprobación explícita del nuevo diseño antes de publicarlo. Reversión: restaurar el frontend anterior; las versiones e imágenes aprobadas permanecen intactas. Se verifican JPG Letter, 300 ppp, QR decodificable y separadores por categoría, además del flujo de edición/aprobación y permisos.

## Corrección de ajuste del catálogo completo

El cálculo anterior bloqueaba el catálogo de 15 productos por un interlineado rígido y un ancho fijo de nombre. El ajuste ahora reserva el ancho medido del precio, aprovecha el ancho restante para nombres completos y busca el mayor tamaño legible con espaciado normal o compacto. Los separadores se contabilizan en la misma geometría que usa el dibujo; todos los renglones quedan dentro del área segura, con un mínimo de 56 px (13,44 pt a 300 ppp). El desbordamiento real sigue bloqueando la aprobación y muestra un aviso dentro de la vista previa en vez de una carta truncada.

Regresión verificada con los 15 nombres completos del catálogo, orden inverso, cambio de categoría en cada fila y un nombre largo en dos líneas con precio de cuatro cifras. Las pruebas comprueban límites verticales, separación nombre/precio, conservación de todos los textos y conteo de productos dibujados; el caso excesivo de 100 productos sigue bloqueado. No cambia la base de datos, los productos, precios ni aprobaciones.

## Nota de pago en CUP y tarjetas de impresión/digital

El pie de la carta incorpora «Puedes pagar los productos en CUP según la tasa de cambio del día.», debajo de «PRECIOS EN USD» y encima del QR. La selección, importes en USD y conversión de compras mantienen su lógica. La nota aparece en la vista previa y en futuros JPG aprobados; no reescribe cartas anteriores. La página digital presenta también la nota del snapshot aprobado como texto accesible.

El editor agrupa dimensiones, material, acabado, aprobación, JPG, impresión, WhatsApp de imprenta e historial dentro de una tarjeta independiente «Gestionar impresión». Otra tarjeta debajo, «Carta digital», agrupa QR, enlace de revisión, descarga PNG y WhatsApp para clientes. Ambas comparten bordes, fondo y tratamiento de tarjeta de la vista previa y se apilan en móvil.

Migración `fridge_menu_cup_note`: reconoce `elegant-cup-v4` y fija el texto en el snapshot del servidor para futuras aprobaciones; mantiene los diseños anteriores y sus versiones inmutables. No añade permisos ni actualiza registros reales. El nuevo diseño requiere aprobación explícita para descarga/publicación. La reversión consiste en restaurar frontend anterior; los nuevos metadatos son compatibles y pueden conservarse, o restaurar la función previa de `fridge_menu_elegant_design.sql`.

Pruebas: render de nota y JPG/QR, ajuste del catálogo de 15 productos, agrupación de controles, flujo de aprobación y enlaces, nota accesible pública, persistencia del texto e historial de versiones sin alteración.

## QR compacto, miniaturas y orden móvil

Se retira del diseño impreso «PRECIOS EN USD» y sus líneas laterales, así como el texto y espacio lateral «Carta digital» del recuadro QR. Se conserva la nota de pago en CUP. Nota y QR siguen al último producto mediante posiciones calculadas; el QR real queda centrado en una tarjeta blanca cuadrada de 400 px con esquinas redondeadas y módulos/márgenes completos, alineados a píxeles enteros. El diseño se identifica como `elegant-compact-v5`, conservando los JPG históricos.

La vista previa va inmediatamente después del selector en el DOM y en móvil/tablet (hasta 1050 px); en escritorio sigue a la derecha mediante áreas de la cuadrícula. Después aparecen las tarjetas de impresión y carta digital. El selector utiliza tarjetas con miniatura, nombre completo, categoría, precio, casilla y orden, resaltado de incluidos y contador de selección.

Las miniaturas reutilizan las fotografías privadas del inventario: el módulo recibe un cargador que descarga desde `fridge-images` con la sesión actual y aprovecha la caché de la nevera. Las solicitudes se reutilizan al buscar/reordenar; fallos o fotos ausentes muestran un icono. Se ignoran respuestas al cerrar sesión y se revocan las URL locales de imágenes. No se añaden fotos ni rutas de almacenamiento al snapshot público de la carta, ni se cambia el catálogo o su huella.

Migración `fridge_menu_compact_design`: acepta el nuevo identificador y conserva la nota en nuevas aprobaciones; mantiene los anteriores. No reescribe datos ni amplía permisos. Reversión: restaurar frontend anterior y, si se requiere, la función de `fridge_menu_cup_note.sql`; las versiones se conservan.

Verificación: QR decodificado desde JPG, pie sin etiquetas retiradas, posiciones dentro de la hoja para listas cortas/largas y el catálogo de 15 productos, orden móvil por DOM/CSS, carga y ausencia de miniaturas, caché, selección y flujos de aprobación. Inspección visual del JPG y suite completa de Nevera.

## Gestionar impresión · Tarjetas de acción

Propuesta 2 seleccionada por el usuario. La tarjeta incorpora resumen de formato, cuatro especificaciones con iconos, selección Mate/Brillo mediante radios visuales y estado borrador/aprobado. «Revisar y aprobar» abre un diálogo con el listado completo de productos y precios, acabado y nota de CUP. Se exige marcar la confirmación para habilitar «Aprobar y publicar». Cancelar vuelve a edición sin guardar ni publicar.

Las tres tarjetas de salida (Descargar JPG, Imprimir y WhatsApp a imprenta) muestran iconos y candados mientras el diseño no está aprobado; mantienen los enlaces y protecciones existentes. Las instrucciones de impresión y el historial quedan en desplegables. El diálogo muestra errores a través del aviso de la vista al cerrarse y conserva la recuperación de envíos inciertos; no permite avanzar con datos locales cambiados o contenido que desborde la hoja.

Se conserva el diseño impreso, los snapshots y el flujo de servidor: no se modifica la base de datos ni se publica una carta real durante el cambio. Se comprueban selector de acabado, revisión, cancelación, confirmación, bloqueo por tamaño, recuperación sin duplicados y cambios de precios durante publicación. La reversión consiste en restaurar estos archivos frontend.

## Definiciones editables de impresión

Cada tarjeta de definición se despliega para editar. Formatos verticales: Carta, A4, A5 y Oficio. Material: Bristol, couché, bond u otro nombre (hasta 80 caracteres); gramaje: rango 180–220 o valores predefinidos de 80 a 300 g/m²; caras: una o dos repitiendo la misma carta; color: full color/blanco y negro; esquinas redondeadas/rectas. Mate/Brillo conserva su selector visual. Los cambios actualizan resumen y preview, invalidan una revisión abierta y requieren guardar/aprobar antes de generar una nueva versión pública.

`print_options` en los ajustes privados conserva el borrador. La migración `fridge_menu_editable_print` normaliza y valida las opciones en servidor, captura las especificaciones y dimensiones a 300 ppp en cada aprobación `elegant-print-v6` y conserva el comportamiento Letter de clientes/versiones anteriores. No modifica productos, costos, existencias, ventas ni cuadres. Se añade una función interna de validación sin acceso de clientes y se mantiene la autorización actual de los comandos.

El JPG se genera con las dimensiones físicas elegidas; texto y QR mantienen proporciones, el QR conserva su resolución de 350 px y el límite de legibilidad ajusta la capacidad del formato. A5 puede requerir menos productos. El modo blanco y negro se aplica a la imagen exportada y las esquinas se dibujan según la selección. La función de entrega sigue validando ruta, hash y tamaño; ahora compara las dimensiones del JPG con las del snapshot aprobado entre los cuatro formatos admitidos.

La vista de impresión pública usa el tamaño aprobado; al elegir dos caras prepara dos páginas con el mismo diseño (el usuario configura dúplex en su impresora). El JPG es un único diseño reutilizado en ambas caras; no se incluye un editor de reverso independiente. El mensaje a imprenta refleja material, gramaje, caras, color, acabado, esquinas y medidas del snapshot.

Pruebas: persistencia y validación de opciones, tamaños y color de exportación, QR legible en cada formato, rechazo de dimensiones discrepantes, impresión dúplex esperada, conservación de versiones y compatibilidad de clientes anteriores. Las opciones son editables en escritorio y móvil a través de controles nativos desplegables. No se rediseña aún «Carta digital»: se entregó una propuesta visual separada pendiente de aprobación.

Reversión: restaurar frontend y función Edge anteriores; conservar la columna nueva y versiones. Si se necesita retirar la funcionalidad del servidor, restaurar las funciones de `fridge_menu_compact_design.sql` y la referencia de imagen anterior sin borrar ajustes, archivos ni registros.
