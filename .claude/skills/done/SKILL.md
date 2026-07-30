---
description: Use when completing a feedback item or logging a quick fix as done
---

# Done Command

**Args:** `$ARGUMENTS`

## Scope

For working on feedback (reading, claiming, implementing): use `/fb`. This skill only marks items done or quick-logs completed work.

## Mode Detection

- First arg is 20+ alphanumeric chars -> complete existing feedback
- First arg has spaces/is descriptive -> auto-create and complete
- No args -> quick-log the work completed in this session

## The status chain is enforced

`VALID_TRANSITIONS` (`config/feedback.config.js`) allows only:

```
new -> in-progress -> in-review -> completed -> archived
```

There is **no** shortcut to `completed`. A single `fetch-feedback.js <id> completed`
on a `new` item is rejected with `Invalid transition`. Walk the chain.

## Complete Existing

An item already on the board has a real history, so it moves through the states:

```bash
node scripts/fetch-feedback.js <id> in-progress "Implementing"
node scripts/fetch-feedback.js <id> in-review  "Verified"
node scripts/fetch-feedback.js <id> completed  "admin notes"
```

Skip whichever leading steps it has already passed — check its current status first.

## Auto-Create (Quick Log)

Work that shipped before any feedback item existed for it was never `new`, never
`in-progress`, never `in-review`. Create it **already completed** rather than
walking a history it did not have — the journal is append-only, so those extra
entries would permanently assert a review that never happened:

```bash
node scripts/submit-feedback.js "Title" "Description" \
  --type bug --module <module> --tab general --user austen --status completed
node scripts/fetch-feedback.js <new-id> internal-only true
```

Parse the feedback ID from the submit output (`📋 Feedback ID: <id>`) for the
`internal-only` call.

`--status` is validated against the shared `FEEDBACK_STATUSES` list. It only sets
the state an item is BORN in; moving an existing item still goes through
`fetch-feedback.js` and its transition guard.

## Writing the entry

Put the root cause and the commit SHA in the description. For most of these the
diagnosis is the valuable part and the patch is a line or two — an entry that
records only what changed loses the half worth keeping.

Mark internal-only unless the item is something a user would recognise from the
changelog.
