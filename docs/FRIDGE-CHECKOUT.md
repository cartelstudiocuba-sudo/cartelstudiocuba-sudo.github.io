# Destination and CUP collection in Bar checkout — 2026-11-15

## Behavior

The approved compact dark application popup starts with Project, Staff and Courtesy as three icon tiles (General is no longer offered). Project is the default and requires its name. Staff chooses an active worker or declares a manual name. Payment modes, currency and collection method use directly selectable segmented buttons with pressed states and keyboard focus. Full payment locks the calculated amount; partial payment allows editing; credit shows the amount owed. Observation is collapsed until requested; courtesy opens its required reason. Styles are scoped to this dialog and adapt to narrow screens.

CUP is a collection currency, while all ledger amounts and debts remain USD. The existing authenticated elTOQUE reference endpoint is reused. Missing/stale reference permits manual entry; a late reference never replaces an entered rate. The server validates the original amount, positive rate and rounded USD equivalent, and stores both. The reference/manual source is declared client metadata, not an independently attested rate. Purchase conversion is unchanged. General account repayments retain their existing form; the server also accepts validated collection metadata for future repayment UI integration.

Courtesies are now **payable cost-only sales**, requiring a beneficiary and reason. Their total is purchase cost × units, including the frozen cost of a composite recipe, with no profit, percentage or fixed charges. The server checks the submitted cost against the locked current product, preserves catalog sale prices, validates available integer quantities and creates/reuses a `Cortesía · name` account. Full/partial payment or credit works in USD/CUP. All collected money, including later repayments, recovers the supplies fund; no commissions accrue. A total cost of zero is rejected with a clear message rather than inventing a payable zero-value sale. Ingredient inventory consumption remains disabled. Existing free courtesy losses are retained as their original historical category.

## Database and compatibility

`database/fridge_sale_context.sql` adds `fridge_sales.sale_context`, `fridge_payments.collection`, and `fridge_customers.manual_staff`. The staff constraint now supports deliberate manual staff accounts; a partial unique index prevents duplicates. No new public tables/grants or expanded roles. New command/report wrappers reuse the original transactions, stock checks, price checks, costs, allocation and idempotency mechanisms. Wrapped implementations are revoked from direct authenticated access; original definitions are saved in the existing backup table.

Reconciliation snapshots include original currency receipts, totals per currency/method and separately recorded courtesies. Existing approved snapshots and historical calculations are never rewritten. Legacy clients without new metadata continue to work.

`database/fridge_sale_context_rollback.sql` routes legacy writes to the prior implementation and rejects cached new forms rather than silently dropping their currency/context. It deliberately retains additive columns, identities and the read/report extension so new records remain traceable. Revert the frontend alongside write rollback; do not delete records.

`database/fridge_cost_courtesy.sql` backs up and replaces the checkout function, narrowly changes the locked ledger's unit price basis for validated courtesy sales and exempts server-frozen cost-only items from percentage distribution. No new tables, columns, grants or roles. The established stock, receipt allocation and idempotency transactions are reused. Each new courtesy item explicitly stores its cost-only basis and empty percentages; later sheet edits cannot introduce charges.

`database/fridge_cost_courtesy_rollback.sql` restores the previous checkout and ledger while retaining the cost-only settlement exemption, all records, accounts and saved reports. The restored checkout rejects new courtesy-sale requests. Revert frontend assets together with write rollback; do not delete records.

## Verification

Full `npm run test:fridge` passes, including 53 destination/cost-only courtesy SQL checks, regular sale price integrity, mixed USD/CUP, full/partial/credit, composite ingredients, subsequent repayments, atomic failure, stale cost, fractional quantity, zero total, duplicate replay, report immutability, rollback and access restrictions. UI checks cover direct icon/segment selection, project default, required identity fields, locked totals, cost-only courtesy, observation disclosure, automatic/manual CUP, reference failure and late-reference protection. DOM/CSS verification does not claim a physical-device browser review or a real cash collection.

Production migration `fridge_cost_only_courtesy_checkout` applied. Before/after counts and hashes match for all 15 actual products and 30 operations; sales, payments and reports remain unchanged. Three previous function definitions are backed up. Direct authenticated access to the core remains denied; security advisors contain no fridge/checkout finding. No test transactions were created in production.
