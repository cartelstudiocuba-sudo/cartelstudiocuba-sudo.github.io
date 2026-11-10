# Catálogo visual — Consulta de Insumos Gráfica

Fecha: 10 de noviembre de 2026, Bolivia.

URL: https://gestion.elcartelstudio.com/consulta-insumos-grafica.html

## Implementación

Primera propuesta aprobada: catálogo oscuro, amarillo #FFDA03, tarjetas y lista, código real (UUID existente), nombre y características del nombre, cantidades y unidades reales, disponibilidad, umbral configurado y ficha de solo lectura. Búsqueda por palabras combinadas, sin distinguir acentos ni mayúsculas. Familias derivadas únicamente de la primera palabra del nombre cuando se repite en dos o más productos; el selector lo indica expresamente. No se crean categorías ni datos.

Los filtros se aplican a todos los resultados del endpoint autorizado, obtenidos en lotes de 100; la presentación pagina de 24 en 24. Esto evita filtrar solamente la primera página. Si el inventario crece mucho, convendrá trasladar estos filtros a la API. La actualización manual obtiene datos nuevos sin recargar la página. La fecha de consulta se distingue de la fecha de modificación del producto en su ficha.

La API conserva exactamente su filtro `category='Departamento Gráfica'`, identidad de Melanie, rol individual, vista y validación de lectura. Solo se añade `photo_path` a su lista de campos seguros. Las fotografías privadas existentes se consultan con enlaces firmados de 60 segundos y una nueva política SELECT limitada a archivos vinculados a un producto autorizado de Gráfica. No hay permisos nuevos de escritura, acceso a otras fotos ni cambio de las políticas anteriores. Un enlace de foto ya emitido puede seguir siendo válido hasta su vencimiento de 60 segundos.

No se cambian tablas, productos, usuarios, roles, asignaciones, otras vistas, dashboard Inicio, navegación ni permisos administrativos. Sin costos, proveedores, operaciones ni enlace «Volver al inicio». Las fotos ausentes se indican, sin sustituirlas por imágenes inventadas.

## Pruebas completadas

- Edge, 360, 390, 768 y 1440 px: tarjetas/lista, geometría sin desbordamiento, paginación de 125 productos de prueba atravesando dos lotes API, búsqueda de palabras y código, familias combinadas con disponibilidad, agotados y mínimos reales, ocultación del filtro cuando no hay umbrales, miniatura existente y foto fallida, ficha/foco/tecla Escape, contenido escapado, actualización de cantidad, catálogo vacío, búsqueda vacía, error de conexión, rechazo de acceso y cierre de sesión con respuesta tardía. Sin errores JavaScript. Capturas revisadas visualmente en escritorio y móvil.
- Panel real con respuestas controladas de permisos: propietario, Melanie, Alejandro, RR. HH. y sin acceso, en 360, 768 y 1440 px. Verificación de módulos visibles, destino personal, regreso a Inicio y alineación izquierda del catálogo dentro del iframe junto al sidebar. El destino administrativo de inventario se sustituye en esa prueba por una pantalla neutra; sus operaciones se verifican en SQL.
- SDK y runtime reales: ausencia de sesión redirige al login preservando el destino de Gráfica.
- PostgreSQL con rol authenticated y claims existentes de Melanie: solo tres productos de Gráfica visibles en fixtures con otras categorías; búsqueda, detalle, paginación, rechazo por UUID ajeno, exclusión de costos y datos económicos, bloqueo de consultas directas y operaciones de escritura, imposibilidad de autoasignar rol o vista y revocación efectiva. Alejandro conserva lectura/escritura, otras categorías y inventory_admin; entradas y salidas se reflejan en existencias para Melanie. Usuario ajeno y anon rechazados.
- Fotografías en PostgreSQL: una foto vinculada a Gráfica visible; foto audiovisual y no vinculada invisibles; revocar acceso elimina la lectura. Los fixtures son metadatos dentro de una transacción revertida, sin subir archivos.
- Todos los fixtures SQL se revierten. Comprobación posterior: cero productos y cero metadatos de fotos de prueba. Huella de empleados, roles, asignaciones, vistas, permisos y snapshots idéntica antes/después: b530a448496019b19969d00192557309.
- Asesor de seguridad antes/después: mismas observaciones previas, ninguna nueva asociada al cambio. Se conservan fuera de alcance las observaciones existentes de otras funciones y Auth.

## Límites y pendientes

El inventario real está vacío al verificar. No se crearon productos, fotos ni umbrales para llenar la pantalla. No se usaron contraseñas ni sesiones reales de Melanie/Alejandro: UI con escenarios controlados y permisos reales verificados con claims en transacciones revertidas. Queda la comprobación humana desde sus sesiones reales y con productos/fotos reales cuando existan.

## Reproducción

`node tests/inventory-graphics-browser.cjs`, `node tests/inventory-graphics-shell.cjs`, `node tests/inventory-graphics-session.cjs` (Playwright + Edge). SQL: `tests/inventory-graphics-security.sql` y `tests/inventory-graphics-photos.sql`, ambos con rollback.

La migración aplicada está en `sql/inventory-graphics-catalog-visual.sql`.
