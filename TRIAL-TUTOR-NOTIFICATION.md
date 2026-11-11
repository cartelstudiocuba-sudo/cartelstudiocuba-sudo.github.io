# Notificación al tutor del período de prueba

Se incorpora en «Enviar documentación» de la ficha, junto a la acción existente del candidato. La capacitación conserva su flujo independiente.

- Mensaje aprobado con nombre completo, plaza, departamento y condiciones reales de la prueba.
- Consulta de solo lectura de la prueba vigente. Datos faltantes requieren completarse; nunca se utiliza el WhatsApp del candidato como alternativa.
- Vista previa con destinatario explícito, validación telefónica, detección de ventana bloqueada y confirmación manual independiente. Apertura no equivale a envío ni entrega.
- Borrador y confirmación del tutor conservados durante la sesión por ID de prueba. Se preserva la ruta de la ficha al abrir WhatsApp.
- Sin cambios en contratos, candidatos, plazas, permisos, fuente o estructura del PDF «Contenido de la plaza». Se mantienen sincronizadas las dos entradas de RRHH.

Validación: tests/trial-tutor-notification.cjs y tests/trial-tutor-integration.cjs, 390 y 1440 px; regresión completa de tests/trial-candidate-return.cjs; scripts de paridad del contrato, renderizador y entradas de candidato. Pruebas con datos sintéticos, WhatsApp simulado y cero escrituras reales. No se realizó ningún envío a personas reales.
