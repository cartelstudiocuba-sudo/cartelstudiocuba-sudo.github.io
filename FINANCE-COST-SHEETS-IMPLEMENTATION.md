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

## Dashboard minimalista aprobado — 14 de noviembre

Se actualiza únicamente la presentación de entrada: resumen global de fichas creadas, activas y borradores pendientes, tarjetas flotantes con módulo/estado/conceptos/versión, búsqueda por nombre o módulo sin distinguir tildes, filtros de estado y tarjeta para crear una ficha. Las cifras globales no dependen del filtro; una ficha activa con cambios pendientes cuenta también entre los borradores. La recuperación de envíos se muestra únicamente cuando existe una operación pendiente.

Archivos de esta revisión: `fichas-costo.html`, `assets/finance-cost-sheets.css`, `assets/finance-cost-sheets.js`, `tests/finance-cost-sheets-ui.cjs` y este informe. Sin migraciones ni cambios de datos. Se conserva el editor actual; el diseño del pop-up de administración queda para la siguiente etapa acordada.

Validación: 24 escenarios SQL y 58 comprobaciones de interfaz aprobados, incluidos totales globales, filtros, búsqueda, estados vacíos, creación, activación y recuperación sin duplicados. Estructura adaptable a móvil y escritorio verificada en DOM/CSS; revisión visual con sesión real pendiente.

## Clasificación por área

Se reutiliza `public.hr_departments` como registro de áreas. Las fichas incorporan `area_id` con referencia y eliminación SET NULL para conservarlas si se retira un área. El Bar se clasifica por el nombre existente Audiovisuales sin crear departamentos. Las nuevas fichas requieren área válida; los clientes previos que guardan borradores sin ese campo conservan la asignación actual. Las nuevas versiones guardan el identificador y nombre del área como fotografía histórica. Las versiones anteriores no se reescriben.

El dashboard incorpora botones Todas y las áreas reales con cantidades, combinables con búsqueda y estado. Los contadores superiores continúan siendo globales. Cada tarjeta muestra el área; al crear desde un filtro de área se propone esa selección. El editor permite cambiarla, con control de borrador y activación existente. Si una ficha queda sin área, se conserva accesible bajo Sin área. Sin cambios de permisos, precios ni existencias.

Migración: `database/finance_cost_sheet_areas.sql` (`finance_cost_sheet_area_classification`); reversión de funciones en `database/finance_cost_sheet_areas_rollback.sql`, conservando metadatos e historial. Validación: 34 escenarios SQL y 71 comprobaciones de interfaz aprobados. Incluyen área obligatoria, persistencia, asignación inicial del Bar, filtros combinados, cambio de área, renombrado/eliminación del departamento sin alterar historial, permisos, compatibilidad y reversión. Tras aplicar la migración, coincidieron las huellas de productos, ventas, movimientos, pagos, operaciones, cuadres y configuraciones de costo; no hubo nuevos avisos de seguridad.

## Botonera visual de áreas

El resumen general se sustituye por botones de área que ocupan el mismo ancho completo del contenido, con iconos SVG, cantidad global de fichas por área y selección amarilla. Se conservan búsqueda, filtros de estado y administración. En móvil se distribuyen en dos columnas. Sin cambios de base de datos ni permisos. Pasaron las 71 comprobaciones de interfaz existentes, actualizadas para verificar cantidades por área y ausencia del resumen anterior.

## Diseño aprobado: Relieve suave

Se aplica la segunda propuesta visual conservando la distribución: banner, filtros por área a todo el ancho, búsqueda y estado, tarjeta de ficha y creación. Se incorpora `assets/finance-cost-dashboard-relief.css`, con superficies grafito elevadas, iluminación y sombras discretas, iconos SVG, insignia de área y botones amarillos con volumen. La tarjeta agrupa icono, nombre, módulo y estado en su encabezado y muestra conceptos, versión y porcentaje en una franja de metadatos. Adaptación a móvil con dos columnas de áreas y tarjetas apiladas. Se actualizan recursos en `fichas-costo.html` y el marcado de presentación de `assets/finance-cost-sheets.js`. Sin cambios en la base de datos, cálculos ni permisos. Pasaron las 71 comprobaciones funcionales de interfaz existentes; la propuesta aprobada se usó como referencia visual, sin afirmar una verificación de píxeles en navegador autenticado.

## Abrir ficha desde la tarjeta

Toda la superficie de la tarjeta permite abrir el editor con clic o toque, con indicador de puntero y realce de borde al pasar el cursor. El botón Administrar ficha conserva su acceso nativo por teclado y no se duplica la apertura por propagación del clic. Los controles permanecen bloqueados durante envíos. Pasaron 74 comprobaciones de interfaz, incluidas aperturas desde título, fondo de tarjeta y botón. Se preparan propuestas del futuro pop-up; esta revisión conserva el editor existente y no modifica su funcionalidad ni sus datos.

## Iconos vectoriales predefinidos

Se incorpora un selector de 13 iconos al crear fichas y en Datos de la ficha: los 12 vectores ya usados en Plazas y el icono de ficha existente. Se reutilizan los trazados en `assets/finance-cost-icons.js`, con nombres en español, selección amarilla y vista previa en la cabecera. El dashboard muestra el icono guardado. La selección se guarda como identificador de catálogo, nunca como SVG o HTML proporcionado por el usuario.

Migración `finance_cost_sheet_predefined_vector_icons`, archivo `database/finance_cost_sheet_icons.sql`: columna `icon_code` en fichas y versiones, valor inicial `sheet`, catálogo permitido verificado en servidor y conservación del identificador al guardar desde clientes anteriores. Se mantiene el control de Manager, las revisiones de borrador y la activación expresa. Las versiones nuevas guardan el identificador histórico. Reversión de la función previa en `database/finance_cost_sheet_icons_rollback.sql`, conservando datos.

Validación: 44 escenarios SQL y 83 comprobaciones de interfaz aprobados, incluyendo elección, vista previa, descarte, guardado, creación, compatibilidad, códigos inválidos, permisos e historial. La migración preservó las huellas de productos, ventas, movimientos, pagos, operaciones, cuadres y configuraciones de precios. Sin nuevos avisos de seguridad. Esta revisión añade el selector al editor actual; el diseño del pop-up seleccionado continúa siendo una etapa aparte.

## Pop-up de administración aprobado

Se implementa la segunda propuesta de administración: ventana modal nativa centrada con conceptos y gastos a la izquierda y vista previa del borrador a la derecha. Datos e iconos permanecen en el desplegable de la ficha; las pestañas incluyen simulador con desglose y versiones. La vista previa conserva el costo de ejemplo, gastos, mínimo redondeado y prueba de precio. El encabezado y las acciones permanecen visibles mientras el cuerpo se desplaza. En pantallas pequeñas, editor y resumen se apilan.

Se elimina el botón Administrar ficha de las tarjetas. Toda la tarjeta es un control accesible con clic, toque, Enter o Espacio y anuncia que abre un diálogo. El dashboard conserva sus filtros y búsqueda al cerrar; se devuelve el foco a la tarjeta. Escape y el botón cerrar respetan las protecciones de cambios sin guardar y operaciones en curso. Los errores y la recuperación de envíos se muestran también dentro del pop-up. La activación conserva su confirmación expresa separada. Al cerrar sesión se cierran ambos diálogos.

Archivos de esta revisión: `fichas-costo.html`, `assets/finance-cost-sheets.js`, nuevo `assets/finance-cost-editor.css`, `tests/finance-cost-sheets-ui.cjs` y este informe. No se modifica la base de datos ni se escribe información de prueba en producción. Validación: 109 comprobaciones de interfaz central y 44 de precios y autorizaciones aprobadas; análisis sintáctico del JavaScript y de la hoja de estilos correcto. Las comprobaciones de adaptación se limitan a estructura DOM y CSS; no equivalen a una inspección visual de píxeles en una sesión autenticada.

## Catálogo ampliado a 30 iconos

Se añaden 17 vectores al catálogo, incluyendo Bar, Nevera, Café, Bebidas, Vinos, Cerveza, Alimentos y Picaderas, además de Ventas, Tienda, Comprobantes, Costos, Finanzas, Estadísticas, Impresión, Producción y Música. Se mantienen los 13 iconos previos y sus identificadores. Bar aparece junto a Ficha para encontrarlo rápidamente. El selector anuncia 30 opciones en creación y edición.

`database/finance_cost_icons_30.sql`, migración `finance_cost_sheet_expand_vector_catalog_30`, amplía las restricciones de identificadores en fichas y versiones y las dos validaciones del comando existente, preservando el resto de su definición y permisos. La reversión documentada en `database/finance_cost_icons_30_rollback.sql` impide retirar el catálogo si ya existen selecciones nuevas en uso. No se reescriben selecciones ni registros históricos.

Pruebas aprobadas: 77 escenarios SQL y 173 comprobaciones de interfaz. Incluyen aceptación y guardado de los 30 identificadores, icono de Bar, cambio a Nevera, persistencia en versiones, vectores SVG válidos y bloqueo de códigos ajenos al catálogo. Las huellas de fichas, versiones, productos, ventas, movimientos, pagos, operaciones, cuadres y configuraciones coincidieron antes y después de la migración; sin nuevos avisos de seguridad.
