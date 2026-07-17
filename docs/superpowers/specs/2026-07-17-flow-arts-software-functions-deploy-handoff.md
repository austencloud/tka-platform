# Flow Arts Software Functions Deploy — Handoff (2026-07-17)

## Mission

Finish the last step of the "flow arts software" SEO checkpoint: deploy
`firebase-functions` so the new `pulseSoftwareSubmission` trigger goes live.
Everything else shipped and merged to main on 2026-07-17 via PR #42
(https://github.com/austencloud/tka-platform/pull/42). The deploy is blocked
on this laptop because the functions codebase declares `defineString` params
(`STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `APP_BASE_URL`) whose values
only exist in the desktop key store, and the CLI refuses non-interactive
deploys without them. Design spec:
`docs/superpowers/specs/2026-07-16-flow-arts-software-seo-design.md` (Round 2
addendum covers the submission feature).

## Done — verified

- **Merged to main.** PR #42 merged 2026-07-17T05:55:10Z (gh confirmed state
  MERGED). Full `npm run check` on the merged state: 0 errors, 0 warnings.
- **Firestore rules deployed** (2026-07-17, from this laptop):
  `npx firebase deploy --only firestore:rules` output ended
  `released rules firestore.rules to cloud.firestore / Deploy complete!`.
  The `software_submissions` collection (open create with shape validation,
  admin-only read, no client update/delete) is LIVE. The public form at
  `/roots/software` ("Add to This List") writes to it with no auth.
- **The trigger code is on main:** `pulseSoftwareSubmission` in
  `firebase-functions/src/pulse/pulseTriggers.ts` (onDocumentCreated on
  `software_submissions/{submissionId}` → `notifyAdmins()`), registered in
  `PULSE_PREF_KEYS` (`notifyAdmins.ts`), `PREF_KEY_MAP` (`pushDispatcher.ts`),
  `PULSE_TITLES` (`onNewNotification.ts`), and exported from
  `firebase-functions/src/index.ts`. Functions package typechecked clean
  (`npx tsc --noEmit -p firebase-functions/tsconfig.json`, exit 0).

## Believed done — unverified

- Nothing in code. The only unverified thing is the end-to-end ping, which
  cannot work until the functions deploy (below).

## In flight

- Nothing uncommitted belongs to this work. NOTE: the laptop's primary
  checkout (`C:\tka-platform`) has other sessions' uncommitted edits to
  `firebase-functions/src/pulse/*` and `push/*` — that is why deploys were run
  from a clean worktree, never from the primary.

## Loose ends (ranked)

1. **Deploy functions from a clean checkout of main** on the desktop:
   ```
   git pull
   cd firebase-functions && npm ci && cd ..
   npx firebase deploy --only functions
   ```
   When the CLI asks for param values, supply from the key store (or run
   interactively and accept the offered current values):
   - `STRIPE_WEBHOOK_SECRET` — Stripe live webhook signing secret
   - `STRIPE_SECRET_KEY` — Stripe live secret key
   - `APP_BASE_URL` — `https://tkaflowarts.com` (code default, safe to accept)
   Non-interactive alternative: put the three values in
   `firebase-functions/.env.the-kinetic-alphabet` (gitignored) and rerun.
   A selective `--only functions:pulseSoftwareSubmission` does NOT dodge the
   param prompts (verified 2026-07-17: param discovery runs on the whole
   codebase before selection).
2. **Verify the deploy:** `npx firebase functions:list` should show
   `pulseSoftwareSubmission`.
3. **Verify the ping end-to-end:** submit a test entry via the live form at
   https://tkaflowarts.com/roots/software#submit (once the site deploy from
   main has gone out) or create a doc in `software_submissions` with fields
   `{name: "test", url: "", notes: "", source: "handoff-test"}`. Austen should
   receive a Web Push titled "Software submission" on devices with FCM tokens.
   Delete the test doc afterward (admin only — client deletes are blocked by
   rules).

## Decisions already made

- Austen, 2026-07-17: "merge. we should be merging to main at checkpoints
  anyway" — the checkpoint flow (merge → deploy) is sanctioned; do not hold
  the deploy for further review.
- Austen, 2026-07-17: submissions feature exists so "I just get a ping
  whenever somebody [submits]" — the ping is the acceptance criterion.
- Taylor Flows is deliberately absent from the lineage page (Austen's call,
  2026-07-17). Do not re-add it.

## Gotchas

- **Never deploy functions from a checkout with uncommitted
  `firebase-functions/` edits** — on the laptop the primary checkout has some
  from a parallel session. Deploy only from clean main.
- The deploy emits two pre-existing warnings that are NOT from this work and
  do not block: Node.js 20 runtime deprecation (decommission 2026-10-30) and
  an outdated `firebase-functions` npm package. Worth a separate ticket;
  upgrading mid-deploy is NOT part of this handoff.
- `firestore.rules` compile shows a pre-existing warning at line ~49
  ("Invalid variable name: request") unrelated to the new block; rules still
  compile and release.
- The laptop worktree used for this work is
  `C:\worktrees\tka-platform\flow-arts-software-seo` (branch
  `feat/flow-arts-software-seo`, fully merged). Safe to remove later; its
  `node_modules` is a junction to the primary checkout's — remove the junction
  with `rmdir` (no `/s`) before `git worktree remove`.
