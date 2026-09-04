# Firestore Cost Discipline — ENFORCED

## The Problem This Solves

For five months the project billed ~$63/month against a $5 budget. Three
separate line items — reads, egress, and storage — were each dominated by a
mistake that looked harmless in the code that caused it.

**One bug, two SKUs.** `scripts/fetch-feedback.js` queried the `feedback`
collection without a status filter. That collection is 995 documents, 971 of
them archived. Agents run `/fb`, `/done`, `/prioritizefb`, `/release`,
`/sessions`, and `/voice-review` constantly, and one of the scans sat on the
*idle* path — the legacy fallback in `claimNextFeedback` fires whenever the
"new" queue is empty, so it ran most often when nothing was happening. Cloud
Monitoring showed 5,644 RunQuery calls over 7 days carrying ~5.5M reads, about
960 documents per query. That produced 29.8M reads ($16.85) and, because the
documents left Google on their way to a local script, 137.41 GiB of egress
($15.29). Fixed in `b38add8306`.

**Automatic indexing.** The database billed 8.41 GiB while its ~57,000
documents held ~0.5 GB. Firestore indexes every leaf of a nested map and every
array element, ascending *and* descending. `shortcodes.sequenceData` is 47.35 KB
of a 48.29 KB document across 21,912 documents, and nothing ever queried it.
Database size drives three line items at once — Firestore storage, backup
storage, and PITR. Fixed in `d34e69075d`.

**Silent drift.** Production had 65 composite indexes; the repo declared 38. The
27 extras were created by clicking the console's "create index" link when a
query failed at runtime, and never committed. A single
`firebase deploy --only firestore:indexes --force` would have deleted 27 live
production indexes, each failing later as `FAILED_PRECONDITION` rather than at
deploy. Reconciled in `d34e69075d`.

None of this showed up in `npm run check`, in tests, or in the app. It showed up
on an invoice, months late.

## The Rule

**1. Every collection query carries a bound.** A `where()` that eliminates the
bulk of the collection, a `limit()`, or both. Firestore bills per document
returned, so an unbounded `.get()` on a growing collection is a cost bug that
gets worse on its own. This applies hardest to scripts and agent tooling, which
run far more often than product code.

**2. `.select()` does NOT reduce the read count.** It reduces bytes over the
wire, nothing else. Projecting fields off a 995-document scan still bills 995
reads. Do not reach for it as a cost fix.

**3. A new index goes in `firestore.indexes.json` and is deployed from there.**
Never click the console's "create index" link. It fixes the query in front of
you and silently skips the repo, which is how 27 indexes went untracked. A plain
`firebase deploy --only firestore:indexes` is always safe — it only adds. Only
`--force` deletes.

**4. A large opaque payload field gets an index exemption when the collection is
created,** not after it costs money. If a field holds a blob that is only ever
read back by document id — a serialized payload, a nested map of steps, an array
of families — add a `fieldOverrides` entry with `"indexes": []`.

**5. Before adding an exemption, check both gates.** An exemption on a field
that a query filters or orders by breaks that query with `FAILED_PRECONDITION`
at runtime, not at deploy:

```bash
# Gate 1 — nothing queries it
grep -rn "where(\|orderBy(" src/lib firebase-functions/src scripts | grep "<field>"
# Gate 2 — no composite index references it
grep -n "<field>" firestore.indexes.json
```

Verify after deploying. An exempt field returns an index config with no
`indexes` array; a normal field still shows ASCENDING, DESCENDING, and
ARRAY_CONTAINS:

```bash
gcloud firestore indexes fields describe <field> \
  --collection-group=<collection> --project=the-kinetic-alphabet --format=json
```

**6. Read the drift line on every index deploy.** The CLI prints "there are N
indexes defined in your project that are not present in your firestore indexes
file." N should be zero. (It also reports 2 missing field overrides; one is the
`__default__/fields/*` wildcard, which by design can never appear in the file.
That line is expected noise.)

## Forbidden

- An unbounded `.get()` on a collection that grows, especially in `scripts/`.
- Using `.select()` and calling the read cost reduced.
- Creating an index through the Firebase console instead of the repo file.
- `firebase deploy --only firestore:indexes --force` without first diffing the
  live indexes against the file and confirming every deletion is intended.
- Adding a `fieldOverrides` exemption without running both gates above.
- Storing a multi-KB payload blob in a new collection without deciding, at that
  moment, whether it needs an exemption.

## Related

- `docs/architecture/firestore-cost-anatomy.md` — the measured record: the
  August SKU table, what each fix removed, and the levers already ruled out
- `resource-budget.md` — the same discipline for local machine resources
- `verification-protocol.md`, `no-assumption-without-evidence.md`
