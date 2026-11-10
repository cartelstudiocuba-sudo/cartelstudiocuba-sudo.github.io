# Consulta de Insumos — Gráfica

Release based on commit 6182052. Personal view code: `inventory_graphics_read`; route: `/consulta-insumos-grafica.html`.

The existing `melanie.medina` account and individual role `insumos_melanie_medina` keep their identity. Its individual inventory permission and snapshot become read-only. All previous view assignments are disabled; the new consultation is its only enabled/default view. Employment status and position, Auth, historical assignments, and other users are unchanged.

The administrator records color, size, format and material in the existing product name. Search uses that name or the existing UUID shown as Código. No independent product fields, visibility switches or characteristic filters are added. Only the exact category `Departamento Gráfica` qualifies. Historical free-text categories, Audiovisual and Otros are excluded; nothing is recategorized.

The client calls only `inventory_graphics_catalog`. Its public function is an authenticated-only invoker wrapper around a private, narrowly scoped definer function. The private function checks the authenticated identity, verified/enabled account, non-terminated employment status, active individual role and enabled view on every call. It returns an explicit list of physical stock fields and never costs, suppliers, movements or currency. Direct inventory table access is denied by existing RLS because `inventory_has_access` excludes Melanie's identity, for both read and write. The same check also denies existing write/report RPCs and inventory Storage access. The identity restriction stays effective with an already issued JWT. The employment status `inactive` is permitted by both the deployed `system-account` login handler and permission implementation; it is not changed.

The displayed quantities come from the central product stock. Zero is Agotado; positive stock is Bajo mínimo only when a recorded minimum greater than zero exists and stock is at or below it. Zero minimum means no threshold. Details recheck scope and current stock. Search, pagination, empty/error states and session changes clear outdated results. Product names render as text.

## Validation

- Real PostgreSQL transaction: six product fixtures cover Gráfica, Audiovisual, Otros and historical Producción; checks cover exact scope, guessed IDs, field allowlist, characteristic/code search, pagination, stock statuses, direct table RLS, direct mutations, entry/output/edit/minimum/photo/fund/closure/report RPCs, role/view escalation, disabled-account revocation, unrelated identity and anonymous access. Alejandro keeps inventory_admin and can edit, enter and issue stock. Melanie sees the resulting stock of 8 while receiving no movement or economic rows. All fixtures and permission changes roll back.
- Preservation comparison covers all employee rows and Auth identities, all role assignments, and other users' view assignments, permission matrices and snapshots.
- Browser checks at 360, 390 and 1440 pixels: layout, no horizontal overflow, characteristic/code search, pagination, read-only detail, native dialog focus/Escape, name injection, network failure, sign-out and stale response handling. Dashboard navigation loads the sole personal view by default. Browser tests use isolated transport fixtures, not Melanie's password/session.
- The absent-session integration test loads the actual shared runtime and SDK. The consultation checks `getSession` before `getUser`, since the runtime converts an absent-user error into an exception; absent sessions redirect to login rather than being treated as a connection failure.
- 67 existing inventory regression tests pass. Administrator inventory HTML remains byte-for-byte unchanged from 6182052.

The previous `tests/inventory-last-purchase.sql` assumes Melanie can read all inventory/history/photos, so that historical test is superseded for her access by `tests/inventory-graphics-security.sql`. The prior unrelated `inventory-photo.cjs` parsing failure remains outside this release. A real password sign-in as Melanie on her own device remains untested; no password, email, employment status or position is reset to run tests.

## Deployment

Publish the reviewed frontend files and wait for Pages to serve them, then apply `sql/inventory-graphics-read.sql` atomically. Recheck the scoped query, unique/default view, denied admin access, other users and zero remaining fixtures. The SQL file is the reviewed migration source; no local Supabase CLI was available. Security advisors have pre-existing notices for definer APIs and password protection; the new exposed RPC is invoker-only and anonymous execution is revoked.
