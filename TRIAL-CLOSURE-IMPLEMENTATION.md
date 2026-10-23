# Cierre de período de prueba · 23 de octubre de 2026

Implementado en GitHub Pages y Supabase de Cartel Studio.

- Entrada desde la ficha del candidato en prueba y desde la decisión final. Las otras decisiones y acciones rápidas se conservan.
- Preparación explícita de un documento imprimible de constancia de cierre, con nombre, plaza, inicio, duración, fecha y espacios de firma/recepción. Se conserva la versión generada en la base de datos.
- Dos enlaces aleatorios distintos, restringidos al documento o al formulario individual, con 30 días de vigencia y revocación desde RRHH. No se usan UUID de candidato como autorización.
- Mensaje completo editable antes de abrir WhatsApp, enlaces dentro de sus respectivas secciones, plantilla predeterminada independiente de cada edición. El historial conserva el texto revisado. Abrir WhatsApp no equivale a envío o entrega confirmados.
- Formulario con identidad, domicilio, contacto de emergencia y escolaridad. Reutiliza nombre, correo, teléfono, municipio, dirección y escolaridad ya disponibles. Los campos del expediente utilizan las claves canónicas existentes; el expediente previo a la contratación es una solicitud pendiente, no un segundo expediente laboral.
- Frente y reverso del carné en bucket privado `hr-identity-private`; no hay lectura anónima ni lectura para cuentas ajenas al propietario autorizado. El enlace permite únicamente subir las dos rutas asignadas mientras el formulario esté pendiente. No permite listar, descargar ni sobrescribir fotos. JPG/PNG, máximo 5 MB por cara.
- Recepción manual del cierre firmado, verificación de RRHH y preparación de capacitación (días, tutor e inicio). La contratación existente queda bloqueada en servidor hasta cumplir esos requisitos. Al contratar, los datos pasan a `hr_employee_personal_details`; no se duplican campos en `hr_candidates` ni se crea empleado antes de tiempo.
- Historial de preparación, mensaje revisado, formulario recibido, cierre firmado, verificación, preparación de capacitación y revocación.

## Validación realizada

- Sintaxis de JavaScript y scripts incrustados; revisión de diferencias.
- Prueba de navegador con datos simulados a 390 y 1280 píxeles: editor, ubicación de enlaces, edición individual, conservación de plantilla y apertura de WhatsApp.
- Regresión de acciones rápidas en nueve estados de candidatura.
- Prueba transaccional en Supabase con candidato sintético y reversión: separación de enlaces, rechazo de token inválido, aislamiento de rutas de subida, bloqueo de contratación anticipada, recepción, verificación, preparación, contratación y traspaso de expediente, revocación y rechazo de lecturas anónimas/no autorizadas.
- Comprobación HTTP de las cinco páginas/archivos publicados: 200 y contenido nuevo.
- Navegador contra el sitio publicado: formulario/documento rechazan enlaces inválidos.
- Confirmación final: cero candidatos sintéticos y cero cierres creados para personas reales; bucket privado.

## Límites y pendientes

- No se enviaron mensajes ni se utilizaron identidades/fotos de candidatos reales. No se probó entrega efectiva de WhatsApp ni un recorrido de carga HTTP de fotos reales en producción. La subida se verificó en permisos de base de datos y el resto del editor mediante simulación de navegador.
- La recepción del cierre firmado y la verificación siguen siendo acciones humanas. Se conserva una constancia imprimible nueva; no se sustituyó el acuerdo original del período de prueba.
- Se prepara la capacitación con duración, tutor e inicio; su ejecución, materiales y mensaje de bienvenida pertenecen a la etapa posterior.
- Los enlaces vencidos o revocados no disponen todavía de un botón de renovación. RRHH debe resolver esa situación administrativamente; el sistema no reabre formularios enviados ni permite sustituir fotos por enlace público.
- El acceso administrativo usa el permiso de propietario ya existente; no se concedieron nuevos permisos a otras cuentas de RRHH.
- Los asesores de Supabase señalan funciones SECURITY DEFINER públicas: las nuevas funciones de enlace son deliberadamente públicas con capacidad aleatoria limitada; las funciones administrativas comprueban el propietario. Se mantienen avisos previos ajenos al cambio (incluida protección de contraseñas filtradas desactivada). Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
