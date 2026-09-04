---
paths:
  - "firestore*.{json,rules}"
  - "firebase-functions/**/*"
  - "src/lib/**/*firestore*"
  - "scripts/**/*firestore*"
  - "scripts/fetch-feedback.js"
---

# Firestore Cost Contract

- Every query on a growing collection needs a selective `where()`, a `limit()`,
  or both. Treat unbounded agent and maintenance scripts as production cost
  risks.
- `.select()` reduces transferred bytes, not billed document reads.
- Declare new indexes in `firestore.indexes.json`. Do not create them from a
  console error link and do not use `--force` until every live deletion is
  explicitly reviewed.
- Add an empty `indexes` field override for a large opaque payload that is read
  only by document ID. Before doing so, verify that no query filters or orders by
  the field and no composite index references it.

```bash
# Gate 1 — nothing queries it
grep -rn "where(\|orderBy(" src/lib firebase-functions/src scripts | grep "<field>"
# Gate 2 — no composite index references it
grep -n "<field>" firestore.indexes.json
```

After an index deployment, inspect the drift report. Unexpected live indexes or
field overrides are a blocker, not permission to force reconciliation. External
deployment still requires authorization from the current request.

Measured cost history and rejected alternatives belong in
`docs/architecture/firestore-cost-anatomy.md`, not this contract.
