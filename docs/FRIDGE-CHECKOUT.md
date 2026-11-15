# Destination and CUP collection in Bar checkout — 2026-11-15

## Behavior

The sale confirmation asks for General sale, Project, Staff or Courtesy. Projects require a name. Staff selects an existing active worker or declares a manual name. Existing full/credit/partial payment modes remain. The redundant “cash sale without account” option is removed; a general-sale account is requested only for unpaid balances. Project/staff accounts resolve atomically within the sale command, including fully paid transactions. Case-insensitive manual staff identities and project names reuse their accounts. Employee identity is resolved on the server, never trusted from posted display names.

CUP is a collection currency, while all ledger amounts and debts remain USD. The existing authenticated elTOQUE reference endpoint is reused. Missing/stale reference permits manual entry; a late reference never replaces an entered rate. The server validates the original amount, positive rate and rounded USD equivalent, and stores both. The reference/manual source is declared client metadata, not an independently attested rate. Purchase conversion is unchanged. General account repayments retain their existing form; the server also accepts validated collection metadata for future repayment UI integration.

Courtesies use the existing `loss` / `courtesy` mechanism, require a beneficiary and reason, reduce the selected products only, and create no sales, payment, debt or commissions. Their purchase cost and component descriptions are frozen for traceability; component inventory remains untouched. They are listed separately in the next reconciliation and not repeated after submission. Cost shown for a courtesy is an informational expense; it does not create a funded reserve from nonexistent receipts.

## Database and compatibility

`database/fridge_sale_context.sql` adds `fridge_sales.sale_context`, `fridge_payments.collection`, and `fridge_customers.manual_staff`. The staff constraint now supports deliberate manual staff accounts; a partial unique index prevents duplicates. No new public tables/grants or expanded roles. New command/report wrappers reuse the original transactions, stock checks, price checks, costs, allocation and idempotency mechanisms. Wrapped implementations are revoked from direct authenticated access; original definitions are saved in the existing backup table.

Reconciliation snapshots include original currency receipts, totals per currency/method and separately recorded courtesies. Existing approved snapshots and historical calculations are never rewritten. Legacy clients without new metadata continue to work.

`database/fridge_sale_context_rollback.sql` routes legacy writes to the prior implementation and rejects cached new forms rather than silently dropping their currency/context. It deliberately retains additive columns, identities and the read/report extension so new records remain traceable. Revert the frontend alongside write rollback; do not delete records.

## Verification

Full `npm run test:fridge` passed. New SQL checks cover project/staff/manual account resolution, CUP conversion, invalid currency/rate/identity, stock rollback, idempotency, courtesy-only reports, immutable submitted courtesy snapshots and denied access. UI checks cover context-specific required fields, manual and automatic CUP, partial payments, failed reference, manual-rate race, courtesy cart clearing and legacy flows. Reconciliation UI includes project context, original CUP/tasa and courtesies. DOM/CSS verification does not claim a physical-device browser review or a real cash collection.

Production migration applied. Before/after counts and hashes match for the 15 actual products and 30 operations; sales, payments, customer accounts and reports remained unchanged. Anonymous writes and direct wrapper bypass remain denied. No test sale, courtesy, customer account, payment or report was created in production. Security advisors reported no checkout/fridge finding; unrelated pre-existing advisories were not altered.
