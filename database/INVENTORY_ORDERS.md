# Pedidos y entregas de insumos

Apply the SQL files in order: inventory_orders.sql, inventory_order_preparation.sql,
inventory_order_security.sql, inventory_order_sequences.sql. Deploy the HTML and assets,
then apply inventory_order_activation.sql and inventory_order_system_date.sql. Approval enforcement is disabled during setup.

The Administrator's Nueva salida opens the shared request form. Submission and approval
do not post stock movements. Approval reserves quantities. Preparation is persisted per
line. Each proof-backed partial or complete delivery posts through the existing stock
and economic movement triggers in one transaction. The legacy direct-out route rejects
unapproved postings after activation; retries of movements already committed still work.

Creation: existing inventory writers or active area-lead roles. Area leads receive only
their department plus Generales through the catalogue RPC. Approvals: manager_general
or the platform owner; the requester cannot approve their own request. Fulfilment:
existing inventory writers. This adds no user role grants or employee assignments.

Evidence: private inventory-delivery-evidence bucket, JPEG, maximum 200 KiB. Original
aspect ratio is preserved for delivery photos; there is no AI retouching. A tactile
signature is stored on white JPEG. Each delivery has a unique immutable evidence path.
Linked evidence cannot be removed by the upload owner. Requests and deliveries retain
their payloads, actor snapshots, exact timestamps and an append-only event history.

The browser keeps an unresolved submission in sessionStorage before posting. Recovery
replays the same UUID and payload. A session-storage failure prevents posting. In an
uncertain network failure, the user must verify the pending operation before another
delivery. The server enforces idempotency, per-line quantities, stock and reservation
limits under the same transaction advisory lock as the existing inventory system.

Validation: node --test tests/inventory-orders-ui.cjs; execute tests/inventory-orders.sql
only as a transaction ending in ROLLBACK. Test fixtures and inventory changes roll back.

New requests use the server date in America/Havana; client-supplied needed_on is ignored. Existing requests retain their date and idempotent payload. Delivery locations offer Oficina comercial, Taller de producciones gráficas, Estudio audiovisual, and a custom place. Empty selector prompts are disabled and hidden.
