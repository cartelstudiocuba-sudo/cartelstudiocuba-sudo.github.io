# Fichas de costo estándar del bar

Implementación del 14 de noviembre de 2026 para Nevera audiovisual y Cuadre del Bar.

## Comportamiento

- Una ficha estándar única, inicialmente 55%: Vendedor 10%, Jefe de área 5%, Gestor Operativo 2%, Gestor Técnico 2%, Manager General 3%, Gastos fijos 10%, Recuperación 3%, Utilidad 20%.
- Porcentajes versionados, con suma estrictamente inferior a 100%. Solo `fridge_manager()` (Manager General o propietario administrativo existente) puede modificarlos, aprobar excepciones y editar composiciones.
- Mínimo calculado en PostgreSQL con NUMERIC: `ceil(costo * 10000 / (100 - total_porcentajes)) / 100`. La vista previa usa céntimos y BigInt para evitar redondeo binario hacia abajo.
- Orden del formulario: costo unitario, mínimo sugerido, precio de venta. «Usar precio sugerido» completa la venta; el mínimo es de solo lectura.
- Un precio nuevo inferior al mínimo requiere una aprobación del Manager. El servidor valida producto/nombre, costo, precio, versión de ficha, solicitante y autorización. Las aprobaciones son de un solo uso y quedan registradas con usuario, fecha y motivo. La aprobación directa del Manager requiere confirmación explícita y motivo.
- Solicitar aprobación no guarda ni aplica el precio. Tras aprobarlo en Fichas de costo, el operador verifica la aprobación y vuelve a guardar su formulario.
- Una entrada de mercancía suma unidades, guarda el último costo (incluso si baja) y conserva el precio de venta. Un precio vigente inferior al nuevo mínimo queda señalado para revisión. Se sustituye expresamente la antigua regla de conservar siempre el mayor costo.
- El precio de venta de un registro existente no se cambia al editar solo su costo o al cambiar la ficha estándar. El cambio de precio se confirma por separado. Las ventas históricas siguen usando sus importes originales.
- Se conservan sin cambios el importe original de compra CUP, la tasa de esa operación y la conversión existente a USD.
- Las composiciones admiten nombre, unidad, consumo por servicio y costo unitario de cada insumo. Calculan el costo agregado y el mínimo. No descuentan inventario de componentes ni del producto. Cada revisión conserva la composición en su auditoría.
- La ficha determina precios mínimos; no modifica el mecanismo existente de reparto, cobros, apartados ni aprobación de cuadres anteriores.

## Componentes

- `assets/fridge-pricing.js` y `.css`: cálculo, panel integrado, porcentajes, solicitudes, excepciones, desglose, composiciones e historiales.
- `assets/fridge.js`, `nevera-audiovisual.html`: formulario económico, carga de ficha, alertas de revisión e integración de permisos.
- `assets/fridge-reconciliation.js`, `cuadre-nevera.html`: acceso a Fichas de costo dentro del Cuadre existente. La navegación principal permanece intacta.
- `database/fridge_standard_costs.sql`: esquema y funciones compatibles con el libro anterior.
- `database/fridge_standard_costs_rollback.sql`: reversión de funciones sin borrar datos ni historiales.
- Pruebas nuevas `tests/fridge-pricing.cjs` y `tests/fridge-pricing-ui.cjs`; adaptaciones de pruebas UI existentes y `package.json`.

## Base de datos

Tablas privadas nuevas: `fridge_cost_configs`, `fridge_price_requests`, `fridge_pricing_events`, `fridge_cost_audit`, `fridge_recipes`, `fridge_pricing_backups`.

Todas tienen RLS y políticas restrictivas de denegación de acceso directo; sin permisos de escritura directos para anon/authenticated. Se reutilizan los permisos operativos y de Manager actuales. Las RPC públicas son SECURITY INVOKER y delegan en funciones privadas con búsqueda de esquema vacía y comprobación de autorización. Los ayudantes y funciones anteriores que permitirían eludir las comprobaciones no son ejecutables por los clientes.

Se extiende el comando atómico del bar bajo su bloqueo asesor existente. Hay validación de versiones de productos y configuraciones, así como identificadores persistentes de operación para reintentos sin duplicación. Las nuevas ventas guardan una copia de la ficha aplicada en sus partidas; los registros anteriores no se reescriben.

Migraciones publicadas en Supabase: `fridge_standard_cost_sheets_and_price_authorizations`, `fridge_cost_sheets_deny_direct_table_access`.

## Verificación

`npm run test:fridge`

- 30 escenarios nuevos de servidor: configuración inicial, límites de porcentajes, persistencia/versiones, fórmula, redondeo, creación, compras/stock, CUP, bloqueos, roles, autorizaciones vinculadas y de un solo uso, costos compuestos sin consumo, snapshots de ventas e historial, y reversión funcional.
- 44 comprobaciones nuevas de interfaz: mínimo, diferencia respecto al precio, aplicación de sugerencia, permisos, petición/aprobación, reintentos y estructura responsive.
- Regresión del libro: 26 escenarios básicos, 25 de conciliación, 47 de la evolución USD/costos, UI de ventas/cuentas/conteo/fotos, navegación, 4 pruebas de fotografías y exportaciones JPG/PDF/Excel/ZIP.
- Comprobación remota: ficha versión 1, 8 conceptos, 55%; ejemplo 0,58 -> 1,29 USD. RLS y permisos de las RPC/ayudantes comprobados.
- Comparación antes/después mediante conteos y huellas de filas: 6 productos, 12 operaciones y 5 movimientos idénticos; ventas, cobros y cuadres previos también idénticos. No se realizaron operaciones de prueba contra datos reales.
- Los avisos globales de seguridad del proyecto permanecen iguales a la línea de base. Las seis tablas nuevas no añaden avisos RLS o funciones expuestas.

## Límites de verificación y funciones pendientes

La revisión visual automatizada en navegador local quedó bloqueada por la política del navegador; no se afirma una verificación por píxeles de escritorio/móvil. Sí se verificaron las interacciones DOM y las reglas CSS adaptables. Hace falta revisar visualmente el resultado en el navegador habitual del usuario.

El descuento automático de componentes permanece desactivado por instrucción expresa. Los porcentajes iniciales y su reparto requieren las decisiones comerciales del Manager antes de su uso definitivo; son editables desde la interfaz.

## Reversión

Antes de revertir, comprobar operaciones en curso y conservar los registros nuevos. Restaurar el frontend del commit padre y ejecutar `database/fridge_standard_costs_rollback.sql`: restaura las tres definiciones respaldadas, desactiva las RPC de ficha para clientes y conserva productos, operaciones, autorizaciones y auditoría. La reversión funcional fue probada en PostgreSQL embebido; nunca se ejecutó sobre producción. Reaplicar una versión nueva de la funcionalidad requiere una migración de reactivación deliberada, no ejecutar de nuevo el script inicial de creación.

## Rediseño del panel operativo del Bar — opción 2

El panel «Precios y costos del Bar» sustituye la lista de acordeones por pestañas de Precios, Autorizaciones, Recetas e Historial. La cabecera conserva la versión y los porcentajes activos, con acceso a Finanzas para el Manager. En Precios y Recetas hay buscador, selección de producto y detalle lateral; en móvil la lista pasa a una franja horizontal y el contenido se apila. Se muestran por separado costo unitario, mínimo sugerido, precio vigente y precio propuesto. El desglose queda disponible bajo demanda.

Se conservan las funciones y permisos del servidor: precios inferiores requieren autorización, las solicitudes no cambian precios por sí solas y las recetas no descuentan insumos. Los operadores consultan recetas y sus solicitudes, sin obtener edición de recetas ni historiales administrativos. El historial distingue versiones y cambios de producto. La recuperación de envíos se muestra solo cuando existe una operación sin confirmar y conserva su identificador original. Cambiar de producto, pestaña o cerrar exige guardar o descartar cambios locales; los controles quedan bloqueados durante envíos.

Las miniaturas usan las fotos privadas ya disponibles en el contexto de la nevera; donde no hay metadatos/foto se muestran iconos vectoriales. No se amplían permisos de almacenamiento. No hay cambios de esquema, datos ni precios reales como parte del rediseño. Archivos: `assets/fridge-pricing.js`, `assets/fridge-pricing.css`, enlaces de Nevera/Cuadre/Finanzas y `tests/fridge-pricing-ui.cjs`.

Verificación: suite completa `npm run test:fridge` aprobada; suite ampliada de precios, 67 comprobaciones, aprobada nuevamente tras el bloqueo de controles durante envíos. Incluye búsquedas sin acentos, navegación, roles, recetas, aprobación, precios mínimos, recuperación idempotente y cambios sin guardar. Sintaxis JavaScript, CSS y diff correctos. Adaptación móvil verificada en estructura DOM/CSS; revisión visual autenticada pendiente. Para revertir, restaurar estos archivos del commit anterior; no se necesita reversión de base de datos.
