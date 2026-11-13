-- Run only after inventario-pedidos.html, its assets, dashboard navigation and
-- inventory-orders-launch.js have deployed. Existing movement retries remain idempotent.
update studio_access_private.inventory_order_settings set enforce_approval=true where id=true;
