# Reconciliation by original currency

Cash to deliver is shown separately in CUP and USD from frozen original receipt amounts. Transfers are displayed separately and never included in physical cash. USD equivalents remain secondary accounting references; no present-day exchange rate is applied to historical receipts.

Three closed sections hold receipts and historical sales, inventory and debts, and allocation of funds. The existing cost reserve and commission rules remain unchanged. The reserve is part of the same collected money, not an extra payment. Manager confirmation requires an explicit amount for each cash currency and verification of each transfer currency. The database validates exact original amounts and retains these confirmations in the existing audit event payload. Legacy snapshots without original receipt information retain their recorded USD amounts.

The embedded reconciliation uses the intrinsic main content height and a dark background to avoid iframe growth and white empty areas. Hidden dialogs remain hidden.

Validation: mixed CUP/USD cash and CUP transfers, wrong amount rejection, missing and duplicate currency rejection, transfer verification, idempotency, immutable snapshots, audit, rollback, operator/manager UI, and the fridge regression suite. Tests use synthetic local data only.

Deployment order: apply database/fridge_reconciliation_currencies.sql, then publish frontend assets. Rollback frontend approval form and database wrapper together using database/fridge_reconciliation_currencies_rollback.sql. Rollback preserves reports and audit records.
