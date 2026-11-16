# Nevera control center — 2026-11-16

Implements selected proposal 2: a graphical inventory status card with a refrigerator icon, segmented ring, labeled status counts and expected units; three compact money cards; photo replenishment rows with minimum-level bars; accounts and activity cards. The existing mobile dock remains unchanged.

Inventory counts include active products only. Statuses are exclusive: stock at or below zero is exhausted, positive stock at or below minimum requires replenishment, remaining stock is adequate. The ring shows product counts, not money or sales history. Its labels expose counts without relying on color. The zero-product state avoids division by zero. Total expected units use those same active products. Replenishment shows the first four with access to the full inventory and existing product forms.

Money figures reuse server sales_today, collected_today and owed. The note distinguishes prior-account collections and total outstanding debt from today's sales. No financial, pricing, currency, permissions, ledger or database changes. Existing account and history routes remain available.

Scoped CSS replaces the old serif/open layout with compact sans-serif typography, graphite cards, yellow icons, amber/red inventory warnings and responsive stacking. Existing navigation, checkout and desktop/tablet workflows are preserved. Asset URLs are bumped to load the new design.

Verification: summary DOM checks cover active/inactive, exact minimum, below minimum, zero stock, empty catalog, exclusive ring percentages, expected units, money figures, and product/account/history navigation. Full fridge regressions run before publishing. Responsive verification is source/DOM based; no physical-device browser review is claimed.

Rollback: revert this frontend commit; no stored data was changed.
