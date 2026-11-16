# Training welcome: advance only when the form closes

The operator can prepare and open WhatsApp for the candidate and tutor in either order. Opening either recipient retains the form, values and notification actions and does not change the visible route. Preparing the tutor presentation and guide retains the existing private publication and role checks.

The explicit **Cerrar y avanzar** button completes the notification step as the operator's acknowledgement and opens step 11 (Preparar contratación). The help text explains that closing confirms completion of both notification tasks. Dismissing via background click or Escape follows the same close-and-advance path. The system does not verify delivery in WhatsApp. No new message is sent by closing.

Close uses the existing authorized/idempotent `hr_manage_trial_closure` action. Failed saves leave the form and values open with an error and a retryable close button. Duplicate close requests are blocked while saving. The existing session recovery marker now requires `action: form_closed`: legacy markers written merely by opening WhatsApp cannot advance a newly reopened training stage. Recovery stores no contact details, message bodies or private URLs.

No schema/permission changes are required. Existing contracts, dossiers, trial stages and documents remain unchanged. Verification: `npm run test:training:notification` covers both WhatsApp targets, preserved fields, no progress on opening, close-only progress, failed save, retry, duplicate close, Escape and legacy-marker rejection; all inline scripts are compiled. Tests use synthetic data and JSDOM, without real notifications or browser/device QA.
