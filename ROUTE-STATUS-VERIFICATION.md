# Candidate route and status pop-ups

- The route retains Captación, Entrevista, Período de prueba and Contratación. Closed applications distinguish completed, exit and unstarted stages. The latest rejection history takes precedence over related trial/interview evidence; applications without later-stage evidence start at Captación.
- Completed trial receipts retain Consultar cierre y WhatsApp. Existing transitions, reason selection, trial guards and server permissions remain in place. No schema or policy changes.
- Status controls use a body portal and the browser top layer, with a fixed-position fallback. Position follows the visual viewport and scrolling anchor. Outside pointer, Escape, focus cycling, anchor removal and re-render are handled explicitly.
- Dashboard refresh restores search, role, status, order and list scroll. Counters still use the existing dashboard renderer.

## Reproducible validation

Run `node tests/route-status-popups.cjs` with Playwright and Microsoft Edge available. The full page uses synthetic candidates and a simulated backend; all network requests are intercepted. Its standalone harness suppresses only the desktop top-level redirect to reproduce the embedded panel.

The matrix covers No seleccionados, Cantera and Total at 320, 390, 430 and 1440 px, first/middle/last rows, viewport bounds and hit testing, touch/mouse, keyboard activation and focus, Escape and outside dismissal, cancellation, simulated save failure and retry, filter preservation, the existing rejection-reason dialog and four exit stages. Screenshots and JSON results are generated locally.

`tests/trial-receipt.cjs` separately verifies the existing closure/WhatsApp receipt at six viewports with 30 checks and no network requests.

The older `candidate-stage-back.cjs` expects the obsolete internal five-step back chain. The current regression for the simplified visible route is `trial-visible-flow.cjs`.
