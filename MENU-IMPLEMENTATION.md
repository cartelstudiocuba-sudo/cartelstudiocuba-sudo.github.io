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
