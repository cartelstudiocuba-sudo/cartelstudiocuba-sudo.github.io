Trial closure state reconciliation

The finish_without_advance event records the authoritative destination. A legacy browser could reopen the same trial after closure, and the RPC's same-decision retry returned without restoring hr_candidates or the trial stage. This left the route and candidate status inconsistent.

The RPC now reconciles the original candidate and trial on an identical retry, without creating another event or application. It refuses to overwrite a later unrelated candidate state or active employment. A stage trigger prevents reopening a trial with a confirmed closure; a new selection process requires its own trial. The decision dialog checks for a saved closure before offering continuation.

Production repair was limited to the reported candidate and used the original not_selected event and reason. A transaction compared hashes of every other candidate before and after and verified no changes. No WhatsApp was sent.

Regression tests cover the three outcomes after legacy reopening, duplicate prevention, rollback, authorization, stage guards, and mobile/desktop browser flows against an isolated database.
