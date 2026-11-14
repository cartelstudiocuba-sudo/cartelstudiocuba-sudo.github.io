# Finanzas — Fichas de costo

Fecha: 14 de noviembre de 2026.

## Resultado

El Manager General y el propietario tienen acceso a Finanzas → Fichas de costo. La navegación personal del Manager incorpora únicamente esta entrada de Finanzas; no concede acceso a otros apartados financieros ni modifica permisos operativos.

La ficha del Bar se importa desde la configuración existente, conserva sus ocho conceptos iniciales, el total del 55 % y sus versiones previas. La configuración se edita exclusivamente desde Finanzas. El panel anterior del Bar enlaza a esta página y conserva precios, autorizaciones y composiciones.

Cada ficha tiene borrador, conceptos de porcentaje sobre venta o importe fijo en USD por unidad, simulador e historial de versiones. Guardar borrador no afecta la operación. Activar requiere motivo y confirmación expresa, verificados en servidor. Las versiones y operaciones conservan responsable, fecha y contenido; los reintentos usan un identificador persistente para evitar duplicados. La revisión del borrador evita sobrescribir cambios concurrentes.

Precio mínimo = redondeo hacia arriba a dos decimales de `(costo unitario + gastos fijos por unidad) / (1 − porcentajes / 100)`. Con costo 0,58 y 55 %, resulta 1,29 USD; con 0,10 USD de gasto fijo adicional, resulta 1,52 USD.

La activación del Bar se integra con el motor existente de mínimos y excepciones. Conserva precios de venta vigentes, existencias, conversiones CUP y registros históricos. Un precio vigente inferior al mínimo recalculado queda señalado para revisión. Otras fichas pueden crearse y versionarse, pero su conexión operativa con futuros módulos debe implementarse por separado. Los gastos fijos representan importes por unidad, no gastos mensuales sin prorratear. No se activan consumos automáticos de componentes.

## Archivos

- `fichas-costo.html`, `assets/finance-cost-sheets.js`, `assets/finance-cost-sheets.css`: página, edición, simulador, historial y confirmación.
- `dashboard.html`: capacidad explícita y navegación personal de Finanzas; compatibilidad con el menú móvil existente.
- `assets/fridge-pricing.js`, `assets/fridge-pricing.css`: gastos fijos y enlace a administración central; se conservan autorizaciones y recetas.
- `nevera-audiovisual.html`, `cuadre-nevera.html`: actualización de versión de recursos de precios.
- `database/finance_cost_sheets.sql`: migración aplicada como `central_finance_cost_sheets_drafts_fixed_expenses`.
- `database/finance_cost_sheets_rollback.sql`: restauración controlada de funciones anteriores, preservando tablas e historiales. Requiere primero una versión activa sin gastos fijos por unidad para evitar perder su cobertura al restaurar el motor anterior. También se debe restaurar el frontend del commit anterior.
- `tests/finance-cost-sheets.cjs`, `tests/finance-cost-sheets-ui.cjs`, `tests/fridge-navigation.cjs`, `tests/fridge-pricing-ui.cjs`, `package.json`: pruebas y comandos.

## Base de datos

Cuatro tablas privadas nuevas: `finance_cost_sheets`, `finance_cost_versions`, `finance_cost_events`, `finance_cost_backups`. Todas tienen RLS y política restrictiva sin acceso directo de clientes. Se añade `fixed_total`, con valor inicial cero, a `fridge_cost_configs`. Se conservan las definiciones originales de las funciones para reversión. RPC públicos `finance_cost_state` y `finance_cost_command` son SECURITY INVOKER; las funciones privadas verifican el rol en servidor. Se amplía `system_my_navigation` con una capacidad explícita de fichas de costo y se bloquea la antigua escritura de configuración desde el panel del Bar.

Verificación posterior a migración: una ficha del Bar, una versión importada, una configuración operativa, 55 % y 0 USD de gastos fijos. Sin nuevas activaciones de prueba en producción. Las huellas de productos (6), movimientos (5), operaciones (12), ventas, pagos y cuadres coincidieron antes y después. La revisión de seguridad no introdujo nuevos avisos frente al estado previo.

## Validación

`npm run test:fridge`: todas las suites pasaron: operaciones, ventas, crédito, pagos, cuadres, distribución histórica, conversión CUP, inventario y exportaciones, fotos, navegación y fichas estándar. Incluye las nuevas suites centrales. Tras añadir la protección de reversión se repitieron las suites centrales: 24 escenarios SQL y 38 comprobaciones de interfaz aprobados. La suite de precios mantuvo sus 44 comprobaciones aprobadas.

Cobertura central: importación, aislamiento de borrador, persistencia, activación expresa, redondeo, gastos fijos, bloqueo de precio inferior, historial, permisos de Manager/operativo/anónimo, creación de ficha independiente, conflictos de revisión, reintentos y cierre de sesión. Las comprobaciones de escritorio y móvil cubren estructura DOM y reglas adaptables; no equivalen a una inspección visual de píxeles en un navegador autenticado.

## Alcance pendiente

Conexiones operativas de nuevas fichas con otros módulos y descuento automático de insumos compuestos requieren definición posterior. Se conserva la lógica actual de distribución del cuadre; editar la ficha de costo modifica el cálculo del mínimo, no introduce repartos de efectivo adicionales. No se modifican otras secciones.
