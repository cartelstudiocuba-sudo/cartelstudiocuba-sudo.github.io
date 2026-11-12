Paso 12: formulario directo de configuración

- El modal conserva X y Volver a la ficha. El retroceso 12→11 pertenece exclusivamente a la ficha.
- Cada apertura comienza con usuario sugerido por el servidor, correo vacío, perfil sin seleccionar y resumen oculto.
- No se muestra ni se ejecuta el flujo de revisión de cuenta existente.
- Guardar bloquea cuentas vinculadas y vuelve a consultar el estado antes de configurar para detectar cambios desde otra ventana. Las validaciones transaccionales del servidor y la protección de aprovisionamiento permanecen intactas.
- No se modificaron SQL, Auth ni datos de candidatos reales.

Verificación aislada satisfactoria:

- tests/onboarding-fresh-browser.cjs: 320/390/1440 px, validaciones, errores recuperables, permisos, cuenta nueva simulada, cuentas vinculadas/protegidas y vinculación concurrente. Cero escrituras reales.
- tests/step12-return-browser.cjs: rrhh.html real con servicios simulados; modal sin flecha; ficha conservada; 12→11→12 repetido; recarga, cancelación, fallo recuperable y datos intactos en 320/390/1440 px.
- tests/onboarding-fresh-sql.cjs: PostgreSQL aislado; normalización Dániel Hérrera y colisión daniel.herrera.2; protección de Auth, roles, vistas, permisos y correo; configuración y activación.
- tests/step12-return-sql.cjs: autorización, advertencia de cuenta activa, persistencia de ruta y conservación de contrato/cuenta/empleo.
- tests/onboarding-edge.cjs: servicios simulados, autorización, fallos parciales, protección contra duplicados y activación.
