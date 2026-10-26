Trial closure state reconciliation

The finish_without_advance event records the authoritative destination. A legacy browser could reopen the same trial after closure, and the RPC's same-decision retry returned without restoring hr_candidates or the trial stage. This left the route and candidate status inconsistent.

The RPC now reconciles the original candidate and trial on an identical retry, without creating another event or application. It refuses to overwrite a later unrelated candidate state or active employment. A stage trigger prevents reopening a trial with a confirmed closure; a new selection process requires its own trial. The decision dialog checks for a saved closure before offering continuation.

Production repair was limited to the reported candidate and used the original not_selected event and reason. A transaction compared hashes of every other candidate before and after and verified no changes. No WhatsApp was sent.

Regression tests cover the three outcomes after legacy reopening, duplicate prevention, rollback, authorization, stage guards, and mobile/desktop browser flows against an isolated database.

Restart from Por decidir

Availability proposals now use the owner-only hr_request_trial RPC. A closed attempt is retained with superseded_at and a new attempt is created atomically. One partial unique index enforces one current attempt per candidate. Candidate locks and the expected trial ID reject duplicate or stale restart requests. New attempts begin without the old agreement, completion timestamps or closure. Candidate history records both trial IDs; existing acta links and closure events remain attached to the original trial.

Install trial-attempts.sql followed by trial-attempts-compatibility.sql before deploying the updated pages. Compatibility changes preserve existing function signatures and ACLs and restrict candidate-based agreement, hiring and file-transfer lookups to the current attempt. Browser screens likewise load only current attempts.

Validation: isolated mobile and desktop tests exercised the availability form after a closed attempt, reload, a second independent closure, invalid terms, and stale requests. A production rollback test reproduced the reported candidate's restart, verified the old closure was unchanged and all other candidates were unchanged, then rolled back. The reported candidate remains Por decidir, ready for the user to submit the new proposal.
