# Essential Nevera summary — 2026-11-15

Implements the approved open-layout proposal. Three metrics reuse the existing server-provided `sales_today`, `collected_today` and `owed`, with a note distinguishing collections from same-day sales. No financial calculation, currency conversion or permissions change.

The replenishment list contains only active products whose expected stock is at or below the configured minimum. Zero stock is clearly labeled. Rows open the existing product form; account rows open the existing account detail. Counts cover all qualifying records; previews show the first four, with links to full stock/accounts views. Empty lists have accurate messages. All names are escaped.

The summary uses open typography, thin rules and two desktop columns that stack at 600px. The existing dock remains the only route for sale, accounts, inventory, menu and reconciliation. Only the summary receives the restrained selected-nav indicator; other sections retain their header and styling. Refresh, return to Inicio and activity remain accessible.

Files: `assets/fridge.js`, `assets/fridge.css`, `nevera-audiovisual.html`, `tests/fridge-ui.cjs`, this note. No database/backend changes or real data mutations. Asset URLs were bumped for deployment.

Verification: complete `npm run test:fridge` passed. Summary UI checks cover the three server figures, exclusion of adequate/inactive stock, no-stock state, product/account navigation, activity and normal section-header restoration. Existing sales, payment, retry, pricing, settlement, print and public menu checks also passed. Responsive review is DOM/CSS based; a physical-device browser review is not claimed.

Rollback: revert this frontend commit. Existing records, ledger and printed menus remain unchanged.
