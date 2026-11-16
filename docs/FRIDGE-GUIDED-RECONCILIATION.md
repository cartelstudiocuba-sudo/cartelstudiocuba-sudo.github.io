# Guided reconciliation — selected proposal 2

Landing view shows the existing unsettled amount and three visual steps: Revisar, Generar, Enviar. Cobros y cuentas and Existencias reveal current draft details on request. Revisar y generar opens the existing report preview; Enviar opens the existing explicit confirmation form. No command is run merely by navigating steps. Reports, status filters and manager actions remain within Seguimiento; this opens automatically for review-only managers and when viewing a report. Pricing/legacy allocation settings remain secondary actions.

Report snapshot sections start collapsed. Historical fund and recipe relations, approvals, role checks, idempotent recovery and server fingerprints are preserved. No database, permission or ledger changes.

Verification: reconciliation UI checks cover steps, expandable details, manager access, actual submit fingerprint, explicit cash confirmation and frozen allocations; settlement UI checks preserve fund/ingredients/percentage breakdown and payout actions. Route checks pass. Responsive CSS/DOM checks do not constitute a physical device review.
