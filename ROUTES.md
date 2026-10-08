# Rutas de Gestión

- `/` (sin consulta) → `/dashboard.html`: Dashboard global.
- `/dashboard.html`: Inicio de Gestión y navegación a todos los módulos.
- `/rrhh-inicio.html`: entrada de Recursos Humanos, con su resumen cargado en la navegación existente.
- `/recursos-humanos.html`: contenido del resumen de RRHH usado por el marco del módulo.
- `/rrhh-login.html?next=...`: conserva el destino solicitado después del acceso; sin `next` entra a RRHH.
- `/trabaja-con-nosotros.html` y `/aplicar.html?plaza=...`: convocatorias y formularios públicos.

Las consultas de la raíz conservan el formulario público anterior por compatibilidad. La selección interna abre explícitamente `/trabaja-con-nosotros.html`, sin depender de este comportamiento heredado.

Los dos documentos de entrada comparten el diseño y la navegación originales. RRHH oculta el resumen global y carga su propio resumen tras comprobar la sesión. Su enlace Inicio vuelve a `/dashboard.html`. No se cambian consultas, credenciales, permisos ni datos.
