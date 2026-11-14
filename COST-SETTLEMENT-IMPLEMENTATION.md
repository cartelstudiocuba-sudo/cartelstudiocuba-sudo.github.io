# Fondo de insumos y distribución histórica del bar

Implementación del 14 de noviembre de 2026. Los nuevos cuadres incluyen productos de reventa y el desglose de ingredientes de servicios compuestos. La vista está dentro de Cuadre de nevera, accesible desde la Nevera audiovisual y por el Manager General según los permisos existentes.

## Comportamiento

- Fondo de insumos por producto: unidades asociadas, costo histórico total, costo recuperado en los cobros del cuadre y pendiente al corte.
- Cada servicio compuesto expone sus ingredientes, cantidades y unidades, costo histórico y recuperación. El total del servicio se cuenta una sola vez; los ingredientes lo explican y no se vuelven a sumar al fondo.
- Los porcentajes se aplican a la venta cobrada, usando la ficha/versiones guardadas en cada venta. Los gastos fijos se aplican por unidad equivalente cobrada. Se muestran vendedor, jefe de área y los demás conceptos configurados.
- El fondo conserva el mecanismo previo de recuperación proporcional del costo en ventas a crédito. Un abono posterior incluye la venta original y su receta original. Los cuadros congelan sus datos al enviarse.
- Las unidades asociadas y su costo total pueden pertenecer a ventas anteriores si se está cobrando una deuda. No equivalen a unidades vendidas nuevamente en este período. El importe a reservar corresponde únicamente al costo recuperado en este cuadre.
- Se truncan los centavos de cada concepto sobre la base acumulada por venta y se descuenta lo devengado en abonos anteriores. El excedente y los ajustes de centavos se identifican expresamente. Los ajustes de visualización de ingredientes/productos se muestran por separado para no alterar el fondo exacto.
- Si el costo y los conceptos superan el cobro, el Manager debe reconocer expresamente el faltante e indicar cómo se atenderá. Esto confirma el dinero realmente recibido; no crea efectivo ni cancela la deuda de los conceptos sin fondos.
- Los pagos y apartados son manuales, con constancia, responsable y fecha. Se conserva el límite individual por concepto y se añade un límite global: los demás pagos nunca pueden utilizar el fondo reservado para insumos, aunque su apartado aún no se haya registrado.
- Un cuadre nuevo sin ficha o composición histórica completa bloquea la aprobación. No se sustituyen esos datos por porcentajes actuales.
- Los cuadres anteriores conservan su esquema y distribución. El editor de reparto anterior queda disponible si existen reportes históricos. No se cambian precios, conversiones, existencias, recetas ni ventas anteriores.
- No se descuentan insumos de almacén automáticamente ni se realizan transferencias externas.

## Archivos y base de datos

- `assets/fridge-reconciliation.js`: fondo, ingredientes, distribución histórica, autorización de faltantes y compatibilidad de reportes anteriores.
- `assets/fridge-cost-settlement.css`: panel compacto oscuro/amarillo y tablas desplazables en móvil.
- `cuadre-nevera.html`: nuevos estilos y versión de script.
- `database/fridge_cost_settlement.sql`: migración `fridge_historical_cost_fund_settlement` aplicada. Reutiliza tablas existentes; agrega el resultado histórico `cost_settlement` en el snapshot JSON de cuadres nuevos. Respalda cuatro funciones previas, conserva los puntos de entrada y sus validaciones, y añade el cálculo privado y protecciones del servidor.
- `database/fridge_cost_settlement_rollback.sql`: restauración de las cuatro funciones respaldadas sin eliminar datos; impide revertir con cuadres nuevos pendientes. Acompañar de restauración del frontend anterior. Los cuadres confirmados conservan su distribución congelada y pagos.
- `tests/fridge-cost-settlement.cjs`, `tests/fridge-cost-settlement-ui.cjs` y `package.json`: regresiones automatizadas.

No se crean tablas ni permisos de usuario. Las funciones auxiliares y los respaldos no permiten ejecución directa de clientes; detalle y comando mantienen acceso autenticado y comprobación de rol. Coincidieron las huellas y los recuentos antes/después de once tablas operativas: productos, recetas, ventas, pagos, movimientos, operaciones, configuraciones, cuadres, asignaciones de cobros, desembolsos y eventos. Se conservaron los avisos de seguridad preexistentes sin añadir hallazgos.

## Verificación

`npm run test:fridge` completó todas las suites: operaciones, ventas, crédito, fotos, navegación, cuadres anteriores, reparto, USD/CUP, inventario/exportaciones, precios y autorizaciones, fichas centrales y productos compuestos. Las pruebas nuevas validan recuperación de reventa y cinco ingredientes del espresso, porcentajes sobre venta, importes fijos, dos cobros parciales sin duplicación, conservación de receta y ficha tras cambios, aprobación, reintentos, límite de pagos que protege el fondo, faltantes expresos, permisos y reversión. Después de añadir el bloqueo de reversión con reportes pendientes, se repitió la suite SQL: 24 comprobaciones; la suite de interfaz pasó 23 comprobaciones. JavaScript, CSS y diff sin errores.

La adaptación de interfaz se verificó mediante DOM/CSS y formularios sintéticos. Queda pendiente una revisión visual autenticada en escritorio y móvil; estas pruebas no equivalen a esa inspección.
