'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const base = 'https://center.test';
const pageUrl = base + '/usuarios-permisos.html?section=views';
const owner = {name: 'Propietario', owner: true, roles: []};
const melanie = {name: 'Melanie', username: 'melanie', roles: ['Consulta gráfica']};
const alejandro = {name: 'Alejandro', username: 'alejandro', roles: ['Gestión de insumos']};

async function openPage(browser, width, profile) {
 const page = await browser.newPage({viewport: {width, height: 900}});
 const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.addInitScript(({profile, owner, melanie, alejandro}) => {
  window.calls = [];
  const role = {id: 'design-role', title: 'Rol de prueba', is_active: true};
  const readQuery = {select: () => readQuery, order: () => readQuery, limit: () => readQuery,
   then: resolve => resolve({data: []})};
  const client = {
   auth: {getUser: async () => ({data: {user: profile === 'anonymous' ? null : {id: profile}}}),
    getSession: async () => ({data: {session: {user: {id: profile}}}})},
   from: table => table === 'system_access_roles'
    ? {select: () => ({order: async () => ({data: [role]})})} : readQuery,
   rpc: async name => {
    window.calls.push(name);
    if (name === 'inventory_has_access') return {data: profile === 'owner'};
    if (name !== 'system_view_center_access') throw Error('Unexpected RPC ' + name);
    if (profile !== 'owner') return {error: {code: '42501'}};
    return {data: {
     assigned: {inventory_admin: 1, inventory_graphics_read: 1},
     effective: {owner: [owner], session: [owner, melanie, alejandro],
      inventory_admin: [owner, alejandro], inventory_graphics_read: [melanie]}
    }};
   }
  };
  window.CartelLoad = {createClient: () => client, run: (_, task) => task(), clearNotice() {}, limits: {}};
 }, {profile, owner, melanie, alejandro});
 let registryRequests = 0;
 let graphicsRequests = 0;
 await page.route('**/*', request => {
  const url = new URL(request.request().url());
  if (url.origin !== base) return request.abort();
  if (/loading-runtime|supabase-.*min/.test(url.pathname)) return request.fulfill({contentType: 'text/javascript', body: ''});
  if (url.pathname === '/dashboard.html') registryRequests++;
  if (url.pathname === '/consulta-insumos-grafica.html') graphicsRequests++;
  const file = path.join(root, url.pathname.slice(1));
  if (!fs.existsSync(file)) return request.fulfill({status: 404, body: ''});
  return request.fulfill({path: file});
 });
 await page.goto(pageUrl);
 return {page, errors, registryRequests: () => registryRequests, graphicsRequests: () => graphicsRequests};
}

async function verifyOwner(browser, width) {
 const {page, errors, graphicsRequests} = await openPage(browser, width, 'owner');
 try {
  await page.getByRole('heading', {name: 'Centro de Vistas y Plantillas'}).waitFor();
  const groups = page.locator('#vc-groups');
  assert.match(await groups.textContent(), /Recursos Humanos/);
  const inventory = groups.locator('details').filter({has: page.locator('summary', {hasText: /^Inventario/})});
  assert.match(await inventory.locator('summary').textContent(), /Inventario2/);
  assert.equal(await inventory.getAttribute('open'), null);
  await inventory.locator('summary').click();
  await page.getByRole('button', {name: /Administrador de Inventario/}).click();
  assert.equal(await page.getByRole('link', {name: 'Abrir vista ↗'}).getAttribute('href'), '/inventario-insumos.html');
  const frame = page.locator('.vc-preview-frame');
  await page.waitForFunction(() => document.querySelector('.vc-preview [role="status"]').hidden);
  const loaded = await frame.elementHandle();
  const embedded = await loaded.contentFrame();
  assert.equal(new URL(embedded.url()).pathname, '/inventario-insumos.html');
  assert.equal(await frame.getAttribute('sandbox'), 'allow-same-origin allow-scripts');
  assert.equal(await frame.evaluate(element => element.inert), true);
  for (const [name, dimensions] of [['Tablet', [768, 1024]], ['Móvil', [390, 844]], ['Escritorio', [1280, 800]]]) {
   const control = page.getByRole('button', {name, exact: true});
   await control.click();
   assert.equal(await control.getAttribute('aria-pressed'), 'true');
   assert.deepEqual(await embedded.evaluate(() => [innerWidth, innerHeight]), dimensions);
   assert.equal(await frame.evaluate((element, original) => element === original, loaded), true);
   assert.equal(await frame.evaluate(element => element.getBoundingClientRect().width <=
    element.closest('.vc-preview-stage').clientWidth + 1), true);
  }
  assert.equal(await page.locator('.vc-preview').evaluate(element => element.nextElementSibling.className), 'vc-actions');
  await page.getByRole('searchbox', {name: 'Buscar vista'}).fill('vistas y plantillas');
  await groups.getByRole('button', {name: /Vistas y plantillas/}).click();
  assert.equal(await frame.getAttribute('src'), '/usuarios-permisos.html?section=views');
  await page.getByRole('searchbox', {name: 'Buscar vista'}).fill('administrador de inventario');
  await groups.getByRole('button', {name: /Administrador de Inventario/}).click();
  await page.getByRole('button', {name: 'Consultar accesos'}).click();
  assert.match(await page.locator('#vc-audience').textContent(), /Alejandro.*Gestión de insumos/);
  assert.doesNotMatch(await page.locator('#vc-audience').textContent(), /Melanie/);
  await page.getByRole('button', {name: 'Vistas del sistema'}).click();
  await page.getByRole('searchbox', {name: 'Buscar vista'}).fill('grafica');
  await page.getByRole('button', {name: /Consulta de Insumos — Gráfica/}).click();
  assert.equal(await page.locator('#vc-detail code').textContent(), '/consulta-insumos-grafica.html');
  assert.equal(await page.getByRole('link', {name: 'Abrir vista ↗'}).count(), 0);
  assert.equal(await frame.count(), 0);
  assert.equal(graphicsRequests(), 0);
  await page.getByText('La sesión actual no tiene acceso a esta vista.').waitFor();
  await page.getByRole('button', {name: 'Consultar accesos'}).click();
  assert.match(await page.locator('#vc-audience').textContent(), /Melanie.*Consulta gráfica/);
  assert.doesNotMatch(await page.locator('#vc-audience').textContent(), /Alejandro/);

  await page.getByRole('button', {name: 'Diseño y borradores'}).click();
  await page.locator('#view-title').fill('Borrador <img src=x>');
  await page.locator('#view-device').selectOption('mobile');
  assert.equal(await page.locator('#view-preview.mobile img').count(), 0);
  await page.getByRole('button', {name: 'Guardar borrador'}).click();
  await page.getByRole('button', {name: 'Vistas del sistema'}).click();
  await page.getByRole('searchbox', {name: 'Buscar vista'}).fill('');
  await page.locator('#vc-filter').selectOption('published');
  assert.equal(await groups.getByText('Borrador <img src=x>').count(), 0);
  await page.locator('#vc-filter').selectOption('unassigned');
  assert.equal(await groups.getByRole('button').count(), 1);
  assert.match(await groups.textContent(), /Jefe de Área/);
  await groups.getByRole('button', {name: /Jefe de Área/}).click();
  assert.equal(await frame.count(), 0);
  await page.locator('#vc-filter').selectOption('draft');
  await groups.getByRole('button', {name: /Borrador <img src=x>/}).click();
  assert.equal(await frame.count(), 0);
  await page.getByRole('button', {name: 'Abrir borrador'}).click();
  assert.equal(await page.locator('#view-title').inputValue(), 'Borrador <img src=x>');
  await page.getByRole('button', {name: 'Restablecer'}).click();
  await page.getByRole('button', {name: 'Vistas del sistema'}).click();
  assert.match(await groups.textContent(), /No hay vistas/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(await page.evaluate(() => window.calls), ['system_view_center_access']);
  assert.deepEqual(errors, []);
  console.log('PASS catalog, real iframe, three device modes, permissions, filters, drafts and layout at ' + width + 'px');
 } finally {
  await page.close();
 }
}

(async () => {
 const browser = await chromium.launch({channel: 'msedge', headless: true});
 try {
  for (const width of [360, 768, 1440]) await verifyOwner(browser, width);
  for (const profile of ['anonymous', 'melanie', 'alejandro']) {
   const {page, errors, registryRequests} = await openPage(browser, 390, profile);
   await page.getByText(profile === 'anonymous' ? 'Inicia sesión para consultar Usuarios y Roles.' :
    'Solo el propietario puede abrir el Centro de Vistas y Plantillas.').waitFor();
   assert.equal(await page.locator('#app').isVisible(), false);
   assert.equal(registryRequests(), 0);
   assert.deepEqual(errors, []);
   await page.close();
  }
  console.log('PASS anonymous and delegated users cannot load center records');
 } finally {
  await browser.close();
 }
})().catch(error => {console.error(error); process.exitCode = 1;});
