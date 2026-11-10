/* The dashboard remains the source of registered routes and navigation labels. */
const CartelViewsCenter = (() => {
 const byId = id => document.getElementById(id);
 const normalize = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
 const sort = (a, b) => a.localeCompare(b, 'es');
 const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
 };

 function route(value) {
  if (!value?.startsWith('/') || value.startsWith('//')) return null;
  const url = new URL(value, location.origin);
  if (url.origin !== location.origin || !url.pathname.endsWith('.html')) return null;
  url.searchParams.delete('embedded');
  url.searchParams.delete('v');
  return url.pathname + url.search;
 }

 function registeredViews(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const dashboard = template.content;
  const nav = dashboard.querySelector('.nav');
  const registry = id => JSON.parse(dashboard.querySelector('#' + id).textContent);
  const groupLabel = button => [...button.childNodes].filter(child =>
   !child.matches?.('.ico,.chev')).map(child => child.textContent).join('').trim();
  const personal = Object.entries(registry('personal-view-registry'));
  const personalRoutes = new Set(personal.map(([, view]) => route(view.url)).filter(Boolean));
  const views = [];
  const add = (title, group, path, scope, code = null) => {
   const url = route(path);
   if (!title || (!url && !code)) return;
   views.push({id: url || code, title, group, url, scope, code, state: url ? 'published' : 'pending'});
  };
  const home = nav.querySelector('[data-home]');
  add(groupLabel(home), 'General', home.getAttribute('href'), 'session');

  for (const button of nav.querySelectorAll('[data-menu]')) {
   const group = groupLabel(button);
   const menu = dashboard.getElementById(button.dataset.menu);
   if (button.dataset.viewRoute) add(group, group, button.dataset.viewRoute, 'owner');
   if (menu.querySelector('[data-selection]')) {
    for (const {label, url} of Object.values(registry('selection-view-registry'))) {
     add(label, group, url, 'owner');
    }
   }
   for (const link of menu.querySelectorAll('a[data-module][href]')) {
    const href = route(link.getAttribute('href'));
    // The registered personal view supplies the canonical label and policy for this route.
    if (personalRoutes.has(href)) continue;
    add(groupLabel(link), group, href, 'owner');
   }
  }
  for (const [code, view] of personal) {
   add(view.catalogTitle || view.title, view.group, view.url, code, code);
  }
  return views;
 }

 async function mount(client, roles) {
  // Request private authorization first. The catalog is built only for an authorized session.
  const {data, error} = await client.rpc('system_view_center_access');
  if (error || !data?.effective || !data?.assigned) throw error || Error('Respuesta de acceso incompleta');
  const response = await fetch('/dashboard.html', {cache: 'no-cache'});
  if (!response.ok) throw Error('Registro de navegación no disponible');
  const views = registeredViews(await response.text());
  if (!views.length) throw Error('Registro de navegación vacío');

  const search = byId('vc-search');
  const filter = byId('vc-filter');
  const groups = byId('vc-groups');
  const detail = byId('vc-detail');
  const accessSelect = byId('vc-access-select');
  const audience = byId('vc-audience');
  const statuses = {published: 'Publicada', pending: 'Pendiente de configuración', draft: 'Borrador local'};
  const users = view => data.effective[view.scope] || [];
  const assignments = view => view.code ? data.assigned[view.code] || 0 : users(view).length;
  const drafts = () => roles.filter(role => role.is_active).flatMap(role => {
   try {
    const draft = JSON.parse(localStorage.getItem('cartel-views-draft-v1-' + role.id));
    return draft && typeof draft === 'object' ? [{
     id: 'draft:' + role.id, title: draft.title || role.title, roleId: role.id,
     role: role.title, group: 'Borradores de diseño', state: 'draft'
    }] : [];
   } catch {
    return [];
   }
  });
  const tabs = [...document.querySelectorAll('[data-vc-tab]')];
  function showTab(name) {
   for (const button of tabs) {
    const active = button.dataset.vcTab === name;
    button.setAttribute('aria-pressed', String(active));
    byId('vc-' + button.dataset.vcTab).hidden = !active;
   }
   if (name === 'catalog') renderList();
   if (name === 'access') renderAccess();
  }

  let selected = null;
  const expanded = new Map();
  function renderList() {
   const query = normalize(search.value);
   const shown = [...views, ...drafts()].filter(view =>
    (filter.value === 'all' || filter.value === view.state ||
     (filter.value === 'unassigned' && view.state !== 'draft' && assignments(view) === 0)) &&
    normalize([view.title, view.group, view.url, view.role].filter(Boolean).join(' ')).includes(query));
   if (!shown.some(view => view.id === selected?.id)) selected = null;
   groups.replaceChildren();
   const grouped = new Map();
   for (const view of shown) {
    if (!grouped.has(view.group)) grouped.set(view.group, []);
    grouped.get(view.group).push(view);
   }
   for (const [group, entries] of grouped) {
    const panel = node('details', '', 'vc-group');
    panel.open = Boolean(query || filter.value !== 'all' || expanded.get(group));
    panel.addEventListener('toggle', () => {
     if (!search.value.trim() && filter.value === 'all') expanded.set(group, panel.open);
    });
    const summary = node('summary');
    summary.append(node('span', group), node('span', String(entries.length), 'vc-count'));
    panel.append(summary);
    for (const view of entries) {
     const button = node('button', '', 'vc-row');
     button.type = 'button';
     button.setAttribute('aria-pressed', String(selected?.id === view.id));
     button.append(node('strong', view.title), node('small', statuses[view.state]));
     button.onclick = () => {
      selected = view;
      groups.querySelectorAll('.vc-row[aria-pressed="true"]').forEach(row => row.setAttribute('aria-pressed', 'false'));
      button.setAttribute('aria-pressed', 'true');
      renderDetail();
      detail.focus();
     };
     panel.append(button);
    }
    groups.append(panel);
   }
   byId('vc-count').textContent = shown.length === 1 ? '1 resultado' : shown.length + ' resultados';
   if (!shown.length) groups.append(node('p', 'No hay vistas que coincidan con la búsqueda.', 'vc-muted'));
   renderDetail();
  }

  function renderDetail() {
   detail.replaceChildren();
   if (!selected) {
    detail.append(node('p', 'Selecciona una vista para consultar sus detalles.', 'vc-muted'));
    return;
   }
   const view = selected;
   detail.append(node('p', view.group, 'vc-muted'), node('h2', view.title), node('p', statuses[view.state], 'vc-status'));
   const actions = node('div', '', 'vc-actions');
   if (view.state === 'draft') {
    detail.append(node('p', view.role));
    const edit = node('button', 'Abrir borrador');
    edit.onclick = () => {
     byId('view-role').value = view.roleId;
     byId('view-role').dispatchEvent(new Event('change'));
     showTab('design');
     byId('view-role').focus();
    };
    actions.append(edit);
   } else {
    if (view.url) detail.append(node('code', view.url));
    if (view.url && users(view).some(user => user.owner)) {
     const open = node('a', 'Abrir vista ↗');
     open.href = view.url;
     open.target = '_blank';
     open.rel = 'noopener';
     actions.append(open);
    } else if (view.url) {
     detail.append(node('p', 'La vista requiere una sesión con acceso a esta ruta.', 'vc-muted'));
    }
    const access = node('button', 'Consultar accesos');
    access.onclick = () => {
     accessSelect.value = view.id;
     showTab('access');
     accessSelect.focus();
    };
    actions.append(access);
   }
   detail.append(actions);
  }

  function renderAccess() {
   const view = views.find(item => item.id === accessSelect.value);
   const allowed = users(view);
   const roleNames = [...new Set(allowed.flatMap(user => user.roles))].sort(sort);
   audience.replaceChildren();
   if (view.code) {
    const count = assignments(view);
    audience.append(node('p', count === 1 ? '1 asignación registrada' : count + ' asignaciones registradas', 'vc-muted'));
   }
   audience.append(node('h3', 'Usuarios con acceso efectivo'));
   if (view.scope === 'session') audience.append(node('p', 'Acceso por sesión. Se muestran las cuentas vinculadas al directorio.', 'vc-muted'));
   if (view.state === 'pending') audience.append(node('p', 'Esta vista todavía no tiene una ruta habilitada.', 'vc-muted'));
   const list = node('ul', '', 'vc-people');
   for (const user of allowed) {
    const item = node('li');
    item.append(node('strong', user.name), node('span',
     [user.username, user.owner ? 'Propietario' : user.roles.join(', ')].filter(Boolean).join(' · '), 'vc-muted'));
    list.append(item);
   }
   audience.append(allowed.length ? list : node('p', 'Ningún usuario con acceso efectivo.'));
   audience.append(node('h3', 'Roles que aportan acceso'),
    node('p', roleNames.join(', ') || (view.scope === 'session' || view.scope === 'owner' ? 'Acceso independiente del rol.' : 'Ninguno.')));
  }

  for (const view of views) accessSelect.add(new Option(view.group + ' · ' + view.title, view.id));
  expanded.set(views[0].group, true);
  tabs.forEach(button => button.onclick = () => showTab(button.dataset.vcTab));
  search.oninput = renderList;
  filter.onchange = renderList;
  accessSelect.onchange = renderAccess;
  renderList();
 }
 return {mount};
})();
