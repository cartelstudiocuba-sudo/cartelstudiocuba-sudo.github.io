/* Static illustrations. The document is sandboxed and has no external resources. */
const CartelViewsDemo = (() => {
 const layouts = {
  '/dashboard.html': ['Inicio', 'Recursos Humanos|Inventario|Usuarios y Accesos'],
  '/recursos-humanos.html': ['Resumen de Recursos Humanos', 'Convocatorias abiertas|Candidatos en proceso|Colaboradores activos'],
  '/rrhh.html': ['Candidatos', 'Buscar candidato|Todas las plazas', 'Candidato|Plaza|Estado', 'Candidato de ejemplo|Diseño de muestra|En revisión'],
  '/rrhh.html?view=convocatorias': ['Convocatorias activas', 'Sobre las convocatorias|Diseño de muestra|Producción de muestra'],
  '/entrevistas.html?view=agenda': ['Agenda de entrevistas', 'Semana anterior|Hoy|Semana siguiente', 'Hora|Candidato|Plaza', '10:00|Candidato de ejemplo|Diseño de muestra'],
  '/periodo-prueba.html': ['Período de prueba', 'Buscar candidato|Estado', 'Candidato|Plaza|Seguimiento', 'Candidato de ejemplo|Diseño de muestra|En curso'],
  '/periodo-prueba.html?decision=1': ['Decisión final', 'Buscar candidato|Estado', 'Candidato|Evaluación|Decisión', 'Candidato de ejemplo|Evaluación de muestra|Pendiente'],
  '/usuarios-permisos.html?section=workers': ['Directorio de trabajadores', 'Buscar trabajador|Estado', 'Trabajador|Plaza|Estado', 'Trabajador de ejemplo|Diseño de muestra|Activo'],
  '/plazas.html': ['Plazas', 'Buscar plaza|Área|Estado', 'Plaza|Área|Estado', 'Diseño de muestra|Gráfica|Activa'],
  '/nomencladores.html': ['Nomencladores', 'Áreas|Departamentos|Cargos', 'Código|Nombre|Estado', 'DEMO-01|Área de ejemplo|Activo'],
  '/usuarios-permisos.html?section=roles': ['Catálogo de roles', 'Roles de Inventario|Rol de consulta de ejemplo|Rol de gestión de ejemplo'],
  '/usuarios-permisos.html?section=views': ['Centro de Vistas y Plantillas', 'Vistas del sistema|Consultar accesos|Diseño y borradores', 'Grupo|Vista|Estado', 'Inventario|Vista de ejemplo|Publicada'],
  '/usuarios-permisos.html?section=users': ['Cuentas del sistema', 'Buscar usuario, cuenta o plaza', 'Cuenta|Plaza|Estado', 'Cuenta de ejemplo|Diseño de muestra|Activa'],
  '/inventario-insumos.html': ['Listado de insumos', 'Buscar insumo|Stock por categoría|Alertas de stock', 'Código|Insumo|Existencias', 'DEMO-01|Papel de muestra|24 hojas'],
  audiovisual_lead: ['Jefe de Área', 'Resumen del área|Equipo de muestra|Actividades de ejemplo']
 };
 const escape = value => value.replace(/[&<>]/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[char]));
 const pieces = (value, tag) => value.split('|').map(label => '<' + tag + '>' + escape(label) + '</' + tag + '>').join('');
 const graphics = `
 <div class="search"><div><strong>Encuentra tu insumo</strong><div class="field">Nombre, código, color, talla o formato…</div></div><span class="accent">Actualizar datos ↻</span></div>
 <p class="hint">Busca una o varias características incluidas en el nombre registrado.</p>
 <div class="toolbar"><span class="active">Todos</span><span>Disponibles</span><span>Bajo mínimo</span><span>Agotados</span><span>Familia · Todas</span><span>Limpiar filtros</span></div>
 <div class="results"><strong>3 insumos de demostración</strong><div class="toolbar"><span class="active">▦ Tarjetas</span><span>☷ Lista</span></div></div>
 <div class="cards graphics-cards">${[
  ['Papel de muestra', 'P', 'Disponible', '24', 'hojas', 'Formato A4 · Blanco', 'available'],
  ['Vinilo de muestra', 'V', 'Bajo mínimo', '2', 'rollos', 'Acabado mate · Gris', 'low'],
  ['Lámina de muestra', 'L', 'Agotado', '0', 'unidades', 'Formato A3 · Transparente', 'empty']
 ].map(([name, letter, state, quantity, unit, description, style], index) => `
  <article><div class="visual">${letter}<small>Imagen de demostración</small></div><div class="product">
   <span class="stock ${style}">${state}</span><h2>${name}</h2><small>DEMO-0${index + 1}</small><p class="hint">${description}</p>
   <div class="results"><div><small>EXISTENCIAS</small><div class="quantity">${quantity} <small>${unit}</small></div></div><span class="accent">Ver ficha</span></div>
  </div></article>`).join('')}</div>`;

 function documentFor(view) {
  const isGraphics = view.code === 'inventory_graphics_read';
  const [heading, toolbar, columns, row] = layouts[view.url || view.code] ||
   [view.title, 'Buscar|Filtros', 'Elemento|Estado', 'Registro de ejemplo|Pendiente'];
  const body = isGraphics ? graphics : `
   <h2>${escape(heading)}</h2>
   <div class="toolbar">${pieces(toolbar, 'span')}</div>
   ${columns ? '<table><thead><tr>' + pieces(columns, 'th') + '</tr></thead><tbody><tr>' +
    pieces(row, 'td') + '</tr></tbody></table>' : '<div class="cards panels">' + pieces(toolbar, 'article') + '</div>'}`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
   <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
   <meta name="viewport" content="width=device-width,initial-scale=1">
   <style>
   *{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top right,#ffda0310,transparent 45%),#101216;color:#f6f7fa;font:16px/1.45 system-ui,sans-serif}
   main{padding:24px clamp(16px,2.5vw,38px)}header{padding-bottom:20px;border-bottom:1px solid #343639;position:relative}
   h1{font-size:clamp(25px,3.2vw,38px);line-height:1.2;margin:8px 0}h2{font-size:19px}small,.hint,.subtitle{color:#b6b8bc}.hint{font-size:13px}
   .demo{display:inline-block;color:#ffda03;font-size:11px;font-weight:800;letter-spacing:.1em}.mark{position:absolute;right:12px;top:4px;color:#ffda03;font-size:56px;font-weight:900}
   .search,.toolbar,.results{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.search{align-items:end;margin-top:22px}.search>div{flex:1}
   .toolbar{margin:14px 0}.toolbar span,.field,.accent{border:1px solid #494b45;border-radius:10px;padding:9px 12px;background:#1d2024;font-size:13px}
   .field{margin-top:7px;color:#b6b8bc}.toolbar .active{border-color:#ffda0370;color:#ffda03}.accent{background:#ffda03;color:#161811;font-weight:750}
   .results{justify-content:space-between;border-top:1px solid #343639;padding-top:10px;margin-top:12px}.results .toolbar{margin:0}
   .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,245px),1fr));gap:16px;margin-top:16px}
   article,table{background:linear-gradient(145deg,#22252a,#171a1e);border:1px solid #36393b;border-radius:16px;overflow:hidden}
   .panels article,.product{padding:16px}.visual{height:118px;display:grid;place-content:center;text-align:center;background:#242620;color:#ffda036e;font-size:42px;font-weight:900}
   .visual small{font-size:11px;font-weight:400}.stock{border-radius:99px;padding:4px 9px;font-size:11px;background:#244036;color:#baf3d1}.low{background:#473d20;color:#ffe597}.empty{background:#472a31;color:#ffc4ce}
   .quantity{font-weight:800;color:#ffda03;font-size:25px}.quantity small{font-size:12px}table{width:100%;text-align:left;border-spacing:0}td,th{padding:12px;border-bottom:1px solid #36393b;overflow-wrap:anywhere}th{color:#ffda03}
   .graphics-cards{grid-template-columns:repeat(3,minmax(0,1fr))}
   @media(max-width:900px){.graphics-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
   @media(max-width:600px){.graphics-cards{grid-template-columns:1fr}.mark{display:none}.search{display:block}.search .accent{display:block;text-align:center;margin-top:10px}td,th{padding:8px;font-size:13px}}
   </style></head><body><main><header><span class="demo">EL CARTEL STUDIO · DATOS DE DEMOSTRACIÓN</span>
   <h1>${escape(view.title)}</h1><span class="subtitle">${isGraphics ? 'Departamento Gráfica · Solo lectura' : escape(view.group)}</span>
   ${isGraphics ? '<span class="mark" aria-hidden="true">G /</span>' : ''}</header>${body}</main></body></html>`;
 }

 return {documentFor};
})();
