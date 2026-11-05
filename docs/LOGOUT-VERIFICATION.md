# Cierre de sesión — 5 de noviembre de 2026

Botón persistente de cierre de sesión en las páginas internas, independiente de los permisos y del perfil oculto en móvil. Estilo oscuro y amarillo #FFDA03, objetivo de 44 px, foco visible y activación por teclado. Confirmación nativa, coherente con las confirmaciones existentes; advierte sobre cambios sin guardar.

Se usa auth.signOut({scope:'local'}) del SDK fijado en el repositorio. El SDK elimina únicamente su estado de autenticación; no se borran preferencias, borradores ni datos de negocio. La navegación reemplaza el documento por el login. Se comprueba sesión antes de revelar las páginas internas y al restaurar historial/visibilidad. SIGNED_OUT redirige también otras pestañas. Las salidas anteriores de módulos se encauzan al mismo control. Bajas y CV usan ahora el cliente común; CV usa el SDK local ya fijado por el resto de la plataforma.

Si falla la revocación remota pero el SDK elimina la sesión local, el login informa de esa limitación. Si permanece sesión o falla su comprobación, se ofrece reintentar. No se afirma revocación de un JWT de acceso todavía vigente: su caducidad y RLS existentes siguen aplicando.

## Validación reproducible

PLAYWRIGHT_MODULE=<ruta a playwright> node tests/logout-browser.cjs

Pruebas con SDK real incluido y respuestas de red simuladas, sin conexiones a Supabase real. Los nombres propietario y cartelstudiocubasecundaria son etiquetas de perfiles sintéticos, no accesos a esas cuentas reales. Pantallas de 390 y 1440 px: cancelar, confirmar, teclado, modo de solo lectura, salida anterior, error 500 remoto, conservación de preferencias/borradores, acceso directo sin sesión, navegación atrás y evento de restauración de historial. Dashboard real en ambos tamaños y cierre en dos pestañas. Acceso sin sesión comprobado en las 16 rutas protegidas incluidas. Activación pública sin control de cierre ni bloqueo nuevo. El evento simulado de restauración no equivale a garantizar que el navegador use su caché de historial en esa ejecución.

Comprobaciones de contrato: paridad de 43 funciones, renderer inmutable y entradas de candidatos. En Windows se normalizaron solo las lecturas CRLF para comprobar paridad; no se modificaron documentos de contrato.

No se modifican usuarios, roles, credenciales, expedientes ni datos reales. La prueba de cierre remoto usa interceptación HTTP; no constituye un acceso real a las cuentas del usuario. La publicación se verifica por separado comparando archivos servidos en el dominio oficial con estos archivos y comprobando el estado del despliegue.
