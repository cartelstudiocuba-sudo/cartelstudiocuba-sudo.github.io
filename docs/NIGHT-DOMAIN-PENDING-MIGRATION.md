# Catálogo de medios y alta directa — pendiente de migración

Implementación preparada y probada sobre la base 76a5f2ce633f19746151dabf829ed7309810f63b. No desplegar este bloque hasta aplicar su migración y verificarla.

La primera aplicación falló por un separador SQL omitido al concatenar funciones y se revirtió completamente. Se corrigió y se probó el paquete concatenado como una sola migración en PostgreSQL aislado. Los dos intentos posteriores devolvieron `status: expired`: la confirmación obligatoria del servicio caducó después de dos minutos. No se cambió de herramienta ni se fragmentó la operación para eludir ese control.

Orden de migración (unir con `\n;\n`):

1. `sql/asset-catalog.sql`
2. `sql/direct-employees.sql`
3. `sql/direct-signed-contract.sql`
4. `sql/offboarding-existing-contract-source.sql`
5. `sql/catalog-offboarding-receipts.sql`
6. `sql/direct-employee-audit.sql`

Nombre: `individual_assets_and_direct_labor_records`.

El catálogo reutiliza `hr_employee_assets` para entregas. Separa equipos individuales de insumos por cantidades, valida códigos y series, distingue disponibilidad y conservación, ofrece categorías administrables y permite constancias sin firmas simuladas. Las devoluciones mantienen el Paso 13, su revisión y sus aprobaciones.

El alta directa usa `hr_employees`, `hr_employee_personal_details`, `hr_employee_documents` y el historial laboral existentes. Los borradores se guardan en una tabla privada, sin crear trabajadores al guardar parcialmente. El asistente tiene ocho etapas, documentos privados y comprobación de duplicados. La creación final es idempotente y transaccional; no fabrica candidaturas ni procesos previos, no envía invitaciones y no activa cuentas. El acceso preparado añade únicamente el rol elegido y deja las vistas sin asignación automática.

Los contratos históricos firmados se reconocen como fuente del Paso 13 sin crear casos de contratación ficticios. Se conservan los controles de fechas, notificación, declaración, inventario, firma y aprobación de RRHH. Editar una notificación de baja invalida su apertura y confirmación anteriores; repetir una confirmación no duplica el registro.

Pruebas aprobadas: 36 comprobaciones SQL del dominio; 35 del Paso 13 actualizado; formularios de alta y catálogo en navegador a 320, 390, 768 y 1440 px; ficha con selección de catálogo, devolución y constancia en esos cuatro tamaños. Todas usan datos sintéticos aislados o servicios interceptados. No se crearon trabajadores, equipos, documentos ni bajas reales.

La rama conserva código, pruebas y SQL para revisar y aplicar cuando la confirmación obligatoria pueda completarse. La publicación del login y los recordatorios es independiente y permanece en producción.
