# Validación final de la ficha única — 8 de noviembre de 2026

Base auditada: f0f2d7c57e1bf8c5c098a484be69ac458fa5888c. Se conserva la estructura aprobada, el menú y los componentes originales; no se reconstruye la ficha.

## Errores reproducidos y corregidos

1. **Paso 13 anticipado.** La interfaz consideraba terminado el Paso 12 con solo configured_at, aunque faltaran crear la cuenta o registrar la apertura de WhatsApp. Ahora exige los tres subpasos guardados, o reconoce un acceso anterior protegido. La activación personal es un estado independiente y no se fuerza. Un proceso parcial muestra Continuar inserción; tras el último guardado, la ruta y los indicadores se actualizan en la misma ficha. Abrir WhatsApp acredita apertura/inicio, nunca entrega del mensaje. No se ejecuta ninguna baja automáticamente.
2. **Editor recargado durante una actualización de la misma candidatura.** openDetail sustituía el cuerpo que contenía las subinterfaces y podía perder campos aún no guardados. Los paneles secundarios permanecen montados durante ese refresco, se conserva la pestaña y posición, y se eliminan al cambiar de persona. La construcción original de Selección permanece intacta.

La reproducción previa mostró ambos problemas en 320/390/768/1440 px. Las nuevas pruebas verifican tanto la conservación del formulario como el aislamiento al seleccionar otra persona.

## Alcance verificado

- Cabecera, seis iconos, acciones rápidas, información personal, resumen, aplicación, entrevista/cuestionarios, evaluación, prueba, adiestramiento, contratación, archivos y PDF. Se comparan las funciones originales de construcción con la base por hash.
- Cuatro pestañas: Selección, Expediente laboral, Acceso e Historial. Contratos/registros históricos, desempeño, documentos privados, medios y baja conservan sus editores y controles.
- Acceso: usuario, correo, cuenta, fechas, roles/permisos, vistas asignadas, activación, suspensión y Gestionar acceso después del Paso 12. Los permisos siguen ligados al rol y las vistas mantienen sus asignaciones explícitas.
- Historial: registros existentes con sus fechas y responsables disponibles, sin insertar ni duplicar eventos.
- Directorio, altas directas y sin cuenta, regresos de formularios, pestaña persistente, recarga y cambio de persona.
- Menú aprobado: RH con Captación y selección / Trabajadores / Plazas / Nomencladores; Usuarios y Accesos con Roles y permisos / Vistas y plantillas / Administración de cuentas. No se cambian estados ni se eliminan funciones al retirar los accesos independientes a Contratados/Bajas.

## Pruebas y límites

- 28 casos nuevos en cuatro tamaños: etapas parciales/completas, recarga, Gestionar acceso, conservación del editor, cambio de persona y finalización simulada del Paso 12 en la misma ficha.
- 48 combinaciones de estado y tamaño de pantalla, más edición, descargas sintéticas, medios, permisos, vistas, plantillas, errores, suspensión y regresos en móvil/escritorio.
- Regresiones de entrevista/cuestionario, decisión y retorno, alta/borrador/duplicados, invitación, onboarding, vistas explícitas, contratación/WhatsApp, baja, retroceso y cierre de sesión.
- SQL aislado de autorizaciones, suspensión e historial; comprobaciones de preservación y ausencia de cambios en inventario.
- La revisión del expediente solicitado usa lecturas administrativas y una representación aislada de esos registros con el código real. Todos los envíos y escrituras están bloqueados. La evidencia con datos personales se conserva fuera del repositorio público. No se inicia sesión Auth como ese trabajador ni se generan resúmenes de IA con sus datos.
- Los estados vacíos se contrastan con los registros realmente disponibles; no se inventan fotografías, entrevistas, contratos, documentos o medios para completar la interfaz.
- Tras publicar se comparan los recursos públicos y se repiten las pruebas sintéticas relevantes contra los archivos publicados. Los resultados concretos, el commit y Pages se añaden al informe privado de ejecución.

## Integridad

No hay cambios de esquema, migraciones, RLS, permisos o cuentas. No se modifican candidatos/trabajadores reales ni se envían WhatsApp, correos o recordatorios reales. No se interviene en Inventario General. Las huellas de candidatos, empleados, respuestas, entrevistas, contratación, historial, documentos y medios se comparan antes/después.

El avance de la ruta no acredita por sí solo contrato firmado ni formalización laboral. Las condiciones de activación o formalización pendientes en registros existentes requieren sus acciones habituales; esta auditoría no los adelanta artificialmente.

Archivos funcionales: assets/evolution-profile.js, assets/onboarding.js y las versiones de esos recursos en rrhh.html / rrhh-20261101.html. Los demás cambios son documentación, simuladores y pruebas.
