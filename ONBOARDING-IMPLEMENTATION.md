# Paso 12 · Inserción en sistema

Implementación del 3 de noviembre de 2026, sobre main e2a53bf3f12887b713a04203983608739516cf44.

## Comportamiento

- La apertura de WhatsApp del paso 11 conserva su lógica anterior de ventana bloqueada, mensaje editable, apertura única y recuperación del guardado. El servidor crea un único expediente laboral y marca al candidato como Contratados. Esto no valida sus documentos ni declara recibido un contrato firmado.
- La ficha muestra indicadores independientes de expediente, contrato firmado y formalización documental. La formalización conserva las validaciones previas y reutiliza el expediente existente. No reemplaza el correo de una cuenta ya configurada por un dato de otro formulario.
- El paso 12 tiene tres subpasos persistentes: Configurar acceso; Crear cuenta y preparar notificación; Notificar por WhatsApp. Gestionar acceso aparece como acción permanente posterior a crear la cuenta, sin ser un cuarto subpaso.
- El usuario sugerido se comprueba por servidor y cuenta con índice único. Se precarga el correo individual. El selector utiliza exclusivamente roles activos reales de Usuarios y Accesos.
- El mensaje editable conserva íntegramente la redacción aprobada, incluyendo «nuestra Plataforma Automatizada» y «Bienvenido a nuestra plataforma automatizada». Un fixture compara todo el texto, interpretando las entidades HTML como caracteres legibles. Los asteriscos simples aplican el formato de WhatsApp.
- Abrir WhatsApp registra apertura; no confirma entrega ni envío. El mensaje puede guardarse y retomarse. Los enlaces de activación se sustituyen por un marcador al guardar el texto.

## Plantillas y conservación de accesos

Las cinco plantillas iniciales toman únicamente los límites de lectura/escritura ya autorizados a cada rol. Solo Inventario Insumos tiene autorización delegable; RRHH y Usuarios y Accesos continúan reservados al propietario. La vista operativa real es inventory_admin. La vista audiovisual existente está reservada para desarrollo futuro y no se concede mediante plantillas sin autorización de módulo.

Las plantillas se guardan en un esquema privado de Supabase. Cada nueva configuración recibe una copia de versión, permisos y vistas. Editar una plantilla no cambia esa copia ni las asignaciones antiguas. Las cuentas anteriores conservan su resolución original de permisos y vistas; no se rellenan ni migran asignaciones de trabajadores.

La matriz de roles sigue siendo el límite superior de autorización en servidor. Una copia de plantilla nunca permite superar ese límite. Retirar el rol, desactivarlo, suspender la cuenta o dar de baja al empleado retira el acceso efectivo. Una cuenta con copia de plantilla solo usa el rol de esa copia: asignar otro rol no amplía silenciosamente sus permisos. El propietario puede aplicar explícitamente otra plantilla de un rol ya asignado a ese trabajador; la interfaz requiere confirmación y registra auditoría.

Los borradores del editor visual siguen siendo diseños locales y se identifican como tales. Las plantillas permanentes de acceso se editan desde Roles.

## Provisión y activación

La nueva función hr-onboarding complementa system-account sin cambiar el login ni las invitaciones antiguas. Las operaciones administrativas comprueban la identidad propietaria mediante Auth. La provisión usa una reserva temporal persistente, comprobación paginada de Auth, unicidad de correo/usuario/vínculo y recuperación tras fallos parciales. Nunca crea una contraseña permanente ni envía un correo durante la provisión.

El enlace personal contiene una capacidad aleatoria de 256 bits en el fragmento de URL. Tiene 24 horas de vigencia y se consume al completar la activación. El servidor conserva su hash y una copia cifrada con AES-GCM para recuperar el mismo enlace en reintentos; el cifrado está asociado al candidato. Renovar invalida la capacidad anterior. Los tokens y los mensajes no se escriben en auditoría.

Abrir el enlace de WhatsApp no confirma el correo. El trabajador solicita un enlace de verificación al correo registrado; se limita a una solicitud por minuto. Se reutiliza reset-password.html, el destino de invitación ya utilizado, y los usuarios pendientes se dirigen a activar-cuenta.html. Si el correo se abre en otro navegador, deben abrir también allí el enlace original de WhatsApp. La capacidad se conserva solo en sessionStorage mientras se completa el proceso y se elimina al terminar.

Antes de activar, el servidor comprueba la misma identidad Auth, correo confirmado, contraseña establecida, ausencia de bloqueo o baja y capacidad vigente no consumida. Los permisos permanecen deshabilitados hasta entonces. Cambiar o rotar la clave de servicio puede requerir renovar las activaciones pendientes cifradas con la clave anterior.

## Verificación

Todas las pruebas funcionales usaron datos simulados, con solicitudes externas interceptadas en las pruebas de navegador. No se enviaron WhatsApp ni correos ni se modificaron candidatos o cuentas reales.

- tests/onboarding-sql.cjs: PostgreSQL aislado, permisos por rol y RLS, igualdad de accesos antiguos antes/después, límites de plantilla, aislamiento de versiones, aplicación administrativa explícita, transición 11→12 con documentos pendientes, expediente único, formalización idempotente, reservas, correo no verificado, cuenta bloqueada, vencimiento, contraseña requerida y activación de un uso.
- tests/onboarding-edge.cjs: autorización, CORS, fallos de Auth, fallo parcial de vinculación y recuperación sin duplicar cuentas, ausencia de contraseña/correo al provisionar, cifrado y recuperación del enlace, renovación, rechazo de vínculo a otro empleado y texto íntegro aprobado.
- tests/onboarding-browser.cjs: 390 y 1440 px, tres subpasos, configuración y errores, persistencia al reabrir/recargar, enlace permanente de gestión, plantilla real, edición segura del mensaje, ventanas bloqueadas, recuperación sin abrir otra ventana, verificación de correo, errores de contraseña, activación, guía y edición/aplicación explícita de plantillas.
- tests/hiring-whatsapp-browser.cjs: regresión de la apertura automática y recuperación del paso 11, doble clic, recarga, interrupción del guardado y enlaces revocados. Su simulación anterior conserva candidatos trial para cubrir compatibilidad; la transición laboral hired se comprueba en onboarding-sql.cjs.
- tests/verify-ui.cjs y tests/recruitment-regressions.cjs: sintaxis, recursos enlazados, navegación por permisos, errores de lectura y numeración.

Las dependencias de prueba están fijadas en package-lock.json. Para repetir: npm ci y npm run test:onboarding. En Windows se utiliza Edge; en otros sistemas se requiere instalar Chromium de Playwright. BROWSER_EXECUTABLE permite indicar otro ejecutable compatible. Las pruebas antiguas admiten PLAYWRIGHT_MODULE para localizar una instalación existente.

Las migraciones de Supabase son persistent_role_templates_and_candidate_onboarding y isolate_onboarding_privileged_rpc. Su SQL, en orden, está en sql/system-onboarding.sql, sql/hiring-onboarding-transition.sql, sql/onboarding-management-views.sql y sql/onboarding-private-rpc.sql. Las nuevas funciones privilegiadas quedan en el esquema privado y la API pública usa envoltorios SECURITY INVOKER con permisos explícitos.

Tras aplicar el esquema, las huellas de todos los registros de candidatos, empleados, asignaciones de roles, vistas existentes y matriz de permisos coincidieron exactamente con las anteriores. El total de cuentas Auth no cambió. Se crearon cinco plantillas; quedaron cero incorporaciones y cero copias de empleado creadas por el despliegue.

## Límites de comprobación

No se probó una entrega real de correo ni una activación de un trabajador real, para respetar la instrucción de no enviar mensajes ni modificar personas reales. La entrega depende del SMTP y los límites de correo configurados en Supabase; los errores de entrega permiten reintentar sin duplicar identidades.

La guía pública se comprobó contra las instrucciones de [Chrome para Android](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid) y [Safari para iPhone](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios). No se afirmó una instalación en dispositivos físicos. El manifiesto abre el dashboard para respetar la navegación de cada rol.
