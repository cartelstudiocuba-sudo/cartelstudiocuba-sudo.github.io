# Inventory WhatsApp action — 2026-11-15

Adds a green WhatsApp action beside Export inventory in the existing read-only Bar inventory dialog. Mobile stacks the actions.

The prefilled message uses the same frozen snapshot and currently visible rows (search, category and stock filters). It contains timestamp in Havana time, product names, quantities, minimums/status, inactive labels and totals. It omits prices, costs and private photo paths. WhatsApp opens with an encoded text draft; the operator selects the recipient and confirms the send. No automatic messages, attachments, public inventory URLs or database writes are performed.

The action is disabled for empty filters and while an export is running. Existing JPG, PDF, Excel and multipage ZIP exports remain unchanged. Cache versions updated in nevera-audiovisual.html.

Verification: inventory tests passed (snapshot, filtering, message content, no prices/costs, disabled empty state, Excel, JPG with photo, PDF, multipage ZIP and cleanup). Fridge UI integration tests passed. Responsive layout reviewed as CSS/DOM, not a physical WhatsApp delivery test. No message was sent.

Rollback: revert this frontend commit. No schema or production-data changes.
