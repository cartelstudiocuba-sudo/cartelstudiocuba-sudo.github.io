# Auditoría previa — Ficha evolutiva

Base inspeccionada: main 7e956f644e4266d4461400bd174e131c2921a131. Auditoría completada antes de reestructurar. Inventario mecánico complementario: evolution-original-inventory.json (funciones, identificadores/campos, acciones y operaciones de los 13 archivos fuente). Se conserva el código original de la ficha de selección; la integración añade navegación y reutiliza los componentes laborales y administrativos.

| Original | Contenido y acciones conservadas | Ubicación de integración |
|---|---|---|
| rrhh.html, approvedCandidatePanel/openDetail | Fotografía, cabecera, contacto, plaza, estado, información de plaza, archivos, historial, PDF, seis iconos y acciones de ruta. | Cabecera y ruta permanecen; Selección contiene el cuerpo original. |
| Selección | Preselección, disponibilidad, coordinación/citación, asistencia, entrevista/cuestionarios y evaluación, decisión, cantera, no selección y motivo, perfilado, eliminación protegida, información personal, resumen, aplicación. | Selección, sin reordenar ni reconstruir sus componentes. |
| Prueba/adiestramiento/contratación | Propuesta, acuerdo, representante, fechas, compensación, firmas, evaluación, decisión, documentación, formulario/PDF, mensajes y seguimiento. | Acciones originales de Selección y ruta. Formularios externos conservados. |
| trabajador-ficha.html | Resumen personal, contratación y PDF, documentos, medios/transporte, otros accesos, roles/permisos y consulta histórica. | Expediente laboral y Acceso, usando el componente original de consulta detallada. Enlace antiguo resuelve a ficha única. |
| user-profile.js | Información personal/laboral, departamento/plaza, condiciones históricas, contrato, desempeño, documentos privados, medios: asignar/devolver/actualizar/incidencias; historial y baja. | Expediente laboral; Historial separado. Se reutiliza el renderizador y sus operaciones originales. |
| users-roles.js: seis editores | Datos personales: identidad, nombre preferido, nacimiento, nacionalidad; direcciones; contactos/emergencias; formación/especialidad/experiencia/habilidades/licencia; documentos/notas. Plaza: consulta y vínculo. Acceso: usuario, correo, estado, seguridad. Roles: asignación/retiro/invitación. Vistas: asignaciones individuales/inicio/snapshot. Actividad. | Editar expediente y consultar plaza en Expediente laboral. Acceso, Permisos, Vistas y Actividad en Acceso. |
| role-templates.js | Plantillas persistentes por rol, techo de permisos, versión, aplicación explícita confirmada a un trabajador; borradores visuales separados. | Usuarios y Accesos: Roles y permisos / Vistas y plantillas. Se conservan asignaciones y regla de no herencia automática de vistas. |
| usuarios-permisos.html / users-dashboard.js | Consulta autorizada, búsqueda, área/plaza/estado laboral/acceso, indicadores, altas y cuentas técnicas/propietario. | Directorio existente en modo Trabajadores; administración técnica de cuentas sin segunda ficha laboral. |
| alta-trabajador.html / direct-employee.js | Ocho etapas, borrador/revisión, identidad/foto, contactos/emergencia, formación, contrato histórico, documentación, medios originales y acceso opcional. | Flujo original; al completar abre la ficha laboral única, sin candidatura ficticia. |
| onboarding.js, paso 12 | Configuración, edición, cuenta, enlace activación, mensaje editable/WhatsApp, estados y recuperación; protección de cuentas existentes. | Ruta y Acceso. Configuración completada deja paso 13 pendiente; Gestionar acceso permanece. |
| offboarding.js / bajas.html | Inicio explícito, fechas/motivo/contrato, documentos, enlaces, mensaje, recepción, medios, incidencias y cierre. | Expediente laboral → Baja y ruta Paso 13. Nunca se ejecuta al abrir la ficha. |

## Relaciones comprobadas

hr_employees.candidate_id enlaza de forma opcional al candidato; system_auth_user_id enlaza opcionalmente a Auth. hr_hiring_cases enlaza candidatura, prueba y trabajador. Una candidatura sin expediente no debe crear uno al abrir las pestañas. Un alta directa tiene trabajador y datos históricos sin necesitar candidato ni prueba. Una cuenta técnica puede existir sin trabajador.

system_user_profile ya devuelve contrato, condiciones históricas, documentos, medios, desempeño, baja e historial agregado. Su implementación privada exige propietario. El historial combina registros originales de candidatura, roles, permisos y baja; no hay que migrarlos ni volver a insertarlos. La interfaz debe mostrar registros y fechas realmente disponibles, sin deducir eventos a partir del estado actual. Se verifican candidaturas, contratos y expedientes mediante huellas agregadas antes/después, sin usar datos reales en pruebas.

No se necesita inicialmente cambio de esquema, RLS ni permisos: navegación y composición de componentes existentes. Si se descubre un dato ausente en una consulta, se revisará su origen antes de introducir cambios.
