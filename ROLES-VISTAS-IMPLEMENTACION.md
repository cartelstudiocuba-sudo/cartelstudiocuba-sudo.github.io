# Roles, herencia y vistas individuales

## Alcance actual

- Paso 12: seleccionar exclusivamente uno de los 13 roles aprobados. Se heredan los permisos y las vistas predeterminadas al configurar una cuenta nueva.
- El código histórico `gestor_comercial_grafica` conserva su identidad y pasa a mostrarse como Gestor Operativo (Dpto. Gráfica).
- Los dos perfiles individuales anteriores se conservan activos con sus asignaciones, permisos y rutas. No se ofrecen en el catálogo de roles ni para cuentas nuevas.
- Ficha → Acceso muestra el rol, las vistas heredadas sin controles para retirarlas, las asignaciones anteriores y las vistas adicionales individuales.
- Las vistas publicadas adicionales son Inventario (lectura o lectura y operaciones) y Consulta de insumos de Gráfica (solo lectura, sin datos económicos). La vista audiovisual pendiente de desarrollo no se ofrece como permiso operativo.
- Cada cambio individual es atómico, verifica la versión leída y registra antes/después y responsable en el historial. No hay fechas de vencimiento.
- Los roles nuevos empiezan sin permisos operativos inventados. La plantilla se configura con los límites autorizados existentes.

## PENDIENTE DESTACADO — discutir después con el usuario

Diseñar la organización completa de vistas por rol, con pestañas por rol y sin vistas flotantes, incluidas las consultas de Melanie y el inventario de Daniela. Definir el mecanismo de préstamo de vistas de otro rol a una persona. Esta reorganización NO forma parte de esta entrega. No se han movido ni eliminado esas vistas ni sus permisos.

## Seguridad y compatibilidad

La migración es aditiva. Conserva Auth, expedientes, asignaciones de rol, vistas existentes y snapshots. Las concesiones adicionales viven en un esquema privado con RLS y sin acceso directo para clientes. Solo el propietario puede gestionarlas mediante una función autorizada; la API pública nueva usa SECURITY INVOKER. El acceso efectivo exige cuenta confirmada, habilitada, no bloqueada y trabajador sin baja. Gráfica usa su consulta limitada y nunca obtiene las tablas económicas por una concesión de lectura de Gráfica.

El ensayo transaccional de la migración verifica las huellas de todos los expedientes, asignaciones, vistas, snapshots y concesiones anteriores, además del acceso efectivo de las cuatro cuentas laborales vinculadas. El ensayo termina con ROLLBACK.

## Verificación

- `node tests/roles-individual-sql.cjs`: PostgreSQL aislado; permisos, herencia, historial, concurrencia, cuenta inactiva/bloqueada/sin confirmar, denegación a anónimo/no propietario y consulta de Gráfica sin costes.
- `node tests/roles-individual-browser.cjs`: 390 y 1440 píxeles; selector de 13 roles, sin selector de vistas en paso 12, ficha integrada, permisos adicionales, herencia no eliminable, errores y ausencia de desbordamiento.
- Comprobaciones de publicación y de conservación del acceso real posteriores al despliegue.

## Reversión

Revertir el commit de interfaz y ejecutar `sql/roles-inherited-individual-rollback-functions.sql` en una transacción. Esto restaura las funciones exactas anteriores. Conservar la tabla privada de concesiones como historial; las funciones anteriores no la consultan. No borrar cuentas ni asignaciones creadas después de publicar. Los roles nuevos ya utilizados deben conservarse; solo se pueden desactivar los que no tengan trabajadores activos asignados. Restaurar los títulos previos de los tres roles renombrados si se revierte también el catálogo. La columna de clasificación puede conservarse sin impacto en el código anterior.

Las cuentas nuevas con snapshots heredados siguen siendo compatibles con las funciones anteriores. Las concesiones individuales nuevas dejan de otorgar acceso al restaurar las funciones anteriores y permanecen registradas para una recuperación posterior.
