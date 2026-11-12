# Step 11 procedure restoration — 2026-11-11

## Historical evidence

- `0107238` introduced `Notificar al candidato →` on the candidate sheet. It opened `openHiringPreparationNotification`, which prepared the candidate's protected labor-file and employment-contract links. WhatsApp and explicit notification confirmation were internal actions; document verification and signature reception were separate controls.
- `9219955` preserved editable WhatsApp text and exposed the two individual links. `22b07f8` is the last hiring.js version before the automatic-advance change: `Abrir WhatsApp` revealed `Confirmar notificación enviada`; confirmation called `hr_manage_hiring(..., 'notify')`. The historic closing action was `Cerrar` (including the dialog's ×), not an independently evidenced button called `Volver a la ficha`.
- `d374801` removed explicit confirmation and made opening WhatsApp persist notification/advance automatically, including on return/reload.
- `a4c7d03` spread notification, document review, and continuation across sheet buttons. `567ff4f` then explicitly substituted `Continuar a inserción en sistema →` for the reopened hired candidate's Step 11 action. Its browser test asserted the absence of the notification button, encoding the reported regression.

## Restored behavior

The sheet has one principal `Notificar al candidato →` button. The previous-stage arrow remains on the sheet only. The procedure contains the historical message, personalized links, WhatsApp, explicit notification confirmation, document controls, and return to the sheet. `Volver a la ficha` is the requested descriptive label for closing; it changes no stage or candidate data.

Opening WhatsApp never writes notification status. Confirmation advances through the existing notification persistence function. Interrupted/legacy pending actions require explicit confirmation on return; popup, expiry, revocation, stage, duplicate-click, and retry protections remain.

Reopening a stored case reads its dossier and contract rather than calling `hr_prepare_hiring`. That function rotates bearer tokens, writes history, and rejects formalized cases; calling it automatically would invalidate existing links or fail. Consequently stored cases open their existing document procedure without regeneration. Renewal is explicit and remains unavailable after formalization. The bearer token itself is stored only as a hash on the server, so prior public links cannot be reconstructed from the saved row. Confirmed cases continue to Step 12 from inside the procedure without resending a notification or requiring completed document validation.

The canonical and legacy RRHH pages are synchronized. Step 12 email prefill/editability, linked-account protection, roles, access inheritance, history, immutable contract rendering, storage and database policies are preserved. No database changes or production mutation tests were performed.

## Verification

- `hiring-whatsapp-browser.cjs`: 320/390/1440, exact message and token destinations, editing/paste, popup rejection, explicit confirmation, failure/retry, duplicate clicks, return/reload, interrupted request, revoked links, full application, dashboard refresh; intercepted requests only.
- `step12-return-browser.cjs`: 320/390/1440; 12→11→10→11→12→11→12; one principal button, modal entry, sheet-only back arrow, reload, cancellation, request failure, existing-account warning, unchanged candidate records.
- `hiring-review-browser.cjs`: 320/390/1440; principal entry into stored cases, pending/received/validated/formalized documents, inherited identity documents, immutable original contract display and PDF download, escaped values, protected formalized controls.
- `onboarding-fresh-browser.cjs`: 36 cases at 320/390/1440, including labor-file email and protected existing identities.
- `onboarding-sql.cjs`: isolated PostgreSQL permissions/RLS, legacy account preservation, pending documents, idempotency, leases, verification and one-use activation.
- `roles-individual-browser.cjs` and `roles-individual-sql.cjs`: current role catalog, inherited views, individual grants, history, stale-save rejection and ceilings.
- `hiring-submission-browser.cjs` and `hiring-flow-sql.cjs`: upload/submit recovery and existing hiring database protections.
- Contract generation parity (43 functions), immutable renderer, and canonical/legacy entry parity. Generation checked with normalized Windows line endings; generated assets were not changed.
- A private read-only candidate snapshot was rendered at 320/390/1440 through the actual principal procedure entry. Live before/after candidate, hiring and employee hashes and history counts were identical. No private snapshot was committed.

Limitations: native manual Firefox interaction was blocked by Computer Use browser URL-policy support. Automated browser interaction and visual inspection of its captures do not constitute a completed manual browser test. The older `onboarding-browser.cjs` stops on the obsolete `Plantilla versión 1` label; current role and fresh-onboarding suites cover the replacement interface. No real WhatsApp message, account creation, document submission, signature or hiring-state change was performed.
