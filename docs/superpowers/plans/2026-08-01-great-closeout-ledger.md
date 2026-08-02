# The Great Close-Out — Ledger (week of 2026-08-01)

Goal: convert done-but-gated work into shipped specs. Every line is checkable.
Scores are `value × effort_multiplier` from the queue. This ledger survives
compaction; update boxes here, not in conversation memory.

Already closed this session:
- [x] `generate-saved-setups-favorites` (PHANTOM_OPEN, 25/25) → shipped in `bc2daf5d4a`
- [x] `turn-in-place-animation` + `anatomical-ik-constraints` (GHOST_PATHS, verified) → archived in `4903684fc5`
- [x] `3d-trail-parity` → shipped in `e61a4028c9` (all proof was complete; only gate was the stale check blocker)
- [x] `performance-audit` → shipped in `e61a4028c9` (systemic remainder recorded as `2026-08-01-scene3d-treeshaking-followup` backlog spec)

---

## Block A — Austen's hands (batch these; ~2.5 hours total)

### A1. Stripe block (~1 hr) — unblocks 65 points of shop specs
- [x] **ROTATION CORE DONE 2026-08-02 ~10:30 CDT.** New restricted key created by
      Austen (morning, challenge state cleared), signing secret rolled with 24h
      grace via SMS verification, both values in `firebase-functions/.env`
      (clipboard flow, never displayed). Deployed clean:
      `createMerchCheckout`, `handleMerchWebhook`, `createDonationCheckout`
      updated + **`createCartCheckout` created (first deploy — production
      finally has the function every buy surface calls)**. Zero
      warnings/errors in function logs post-deploy.
- [x] **Old exposed `sk_live` revoked** by Austen in the Stripe dashboard
      (2026-08-02). Exposure window closed.
- [x] **`BREVO_API_KEY` rotated** (2026-08-02): new key "TKA Composer 2026-08"
      generated, banked to .env via clipboard flow (89 chars, never displayed),
      `sendMagicLink` deployed successfully, old "TKA Composer" key deleted in
      Brevo (deletion toast confirmed). **All credential rotation done.**
- [ ] Original attempt record (2026-08-02 ~01:00-01:40 CDT), kept for the
      incident file — blocked by Stripe itself. Findings that survived:
      - Exposure: `firebase-functions/.env` full `sk_live_` passed through the
        2026-07-27 audit transcript. Never in git; gitignored. Secret key
        last-used = Jul 27 (the audit itself) — nothing else uses it, and the
        payments extension almost certainly has its own key (verify its config
        before revoking anyway).
      - Plan: create restricted key (One-time payments template, name
        "TKA Firebase Functions") → clipboard → .env (never displayed) → one
        deploy of createMerchCheckout/handleMerchWebhook/createCartCheckout/
        createDonationCheckout/sendMagicLink → verify logs → revoke old sk →
        roll whsec (24h grace) + new Brevo key, same deploy pattern.
      - Blocker: dashboard key-management is in a stuck email-verification
        challenge state (started ~01:06). Create key / Create secret key
        buttons no-op CLIENT-SIDE (zero network on click, confirmed in two
        separate browser profiles). One challenge email was consumed
        successfully; subsequent link opens raced and failed; Stripe then
        stopped opening any key dialog. The Workbench dock overlay was ALSO
        eating clicks early on — close it first next time (X, top-right of dock).
      - Resume: wait for challenge expiry (hours) or fresh sign-in, then:
        /apikeys → close Workbench dock if open → Create restricted key wizard →
        "Powering an integration" → One-time payments → name → Create key →
        exactly ONE "Send verification" → open ONLY the newest Gmail link in the
        SAME browser → Copy → clipboard flow. One driver for the whole loop.
- [ ] Clear the Stripe payout requirement
- [ ] Complete Stripe Tax registration
- [ ] Register the webhook event (Stripe Dashboard) for `shop-spin-up`
- Unblocks: `shop-spin-up` (25) · `shop-operations-go-live` (20) · `shop-cart-order-doc` (20)
- Then agents: deploy `createCartCheckout`/`createMerchCheckout`/`handleMerchWebhook`,
  paid checkout + refund proof, `orders.expiresAt` TTL, shipBy metadata, remove `/shop` gate.

### A2. iPhone-in-hand pass (~45 min)
- [ ] `inbox-ios-focus-zoom` (20): focus, keyboard, reply, edit flows on device
- [ ] `train-screen-wake-lock` (16): needs elevated `pymobiledevice3 tunneld` bridge + hands-on
- [ ] `gallery-thumbnail-tail-latency` (15): iPhone + desktop benchmarks, then production cohort
- [ ] Provide the real performance clip + its ground-truth sequence for
      `fable-real-flow-notation-validation` (12) — the moonshot's only remaining gate

### A3. Sign-offs (~30 min)
- [ ] `hardening-verification-reconciliation` (12): review OPEN-FLAGGED items
- [ ] `account-deletion-provider-aware-reauth` (12): authorize disposable test
      accounts + destructive live deletion run
- [ ] One-time authorization for Block B's signed-in Chrome flows (say the word;
      agents then run all of B unattended)

---

## Block B — Agent-runnable once authorized (each closes a spec)

**Austen authorized signed-in browser control + disposable test writes on
2026-08-02.** Batch run started same day; results below.

- [~] `qr-account-funnel` (16): 5 of 6 criteria PASS in DevTools MCP (isolated
      guest context for signed-out cases, default context for signed-in). Check
      is 0 errors / 0 warnings. **Only criterion 2 left** — the live Google
      popup sign-in and auto-resume, which needs Austen's own credentials.
      ~30 seconds: open `/q/003N` in incognito → Export Animation → sign in →
      confirm the export starts with no second tap.
- [x] `inbox-multiline-message-rendering` (15) → shipped in `c18f6d0265`. All
      eight acceptance criteria measured against the real `MessageBubble` via a
      new `/test/message-multiline` harness (avoids messaging a real person):
      `pre-wrap` + `break-word` on every fixture, no overflow at either width,
      markup escaped, previews still `nowrap`. Fix is one CSS line → no
      data-rewrite risk.
- [ ] `choreo-act-playback` (12): authenticated Write-module run + disposable audio file
- [ ] `choreo-sheet-v2` (12): authenticated Write-module run + visual PDF review
- [ ] `gallery-thumbnail-warm-pass` (12): signed-in admin warm + manifest/static sync
- [!] `shop-transitions` (16): **verified and FAILED** (`a9e5d18506`). The
      "Chrome connector" blocker was stale and does not reproduce. Real finding:
      the shop was restructured into bespoke per-product routes, so
      `ProductDetailPage` (the only destination declaring a
      `view-transition-name`) is unreachable and NO product morphs. Section 2
      was never implemented. Reopened as design work — do not re-verify.
- [x] `variation-picker-polish` (12) → shipped in `e97ff714b5` (live modal + pill proof this session)
- [x] `create-tutorial-mobile-fullscreen` (12) → shipped in `e97ff714b5` (viewport proof on /test/tutorial-fullscreen)

## Block C — Tree reconciliation (both headline blockers turned out STALE)

Corrected findings (tree-map agent + direct verification, 2026-08-01):
- [x] `WorkspaceShareControl.svelte` blocker is DEAD: file is tracked, committed
      (`0d36fe77fa`, `ce62cb4b75`), zero diff vs HEAD. Full `npm run check` ran
      **0 errors, 0 warnings** this session. Four specs' `depends_on` were stale.
- [x] Shop remediation is ALREADY COMMITTED (`afb0f2985a` et al.): merch
      functions + store code clean in the tree. Shop specs' only real gates are
      the Stripe dashboard actions in A1 + deploy + paid-order proof.
- [ ] Reconcile the remaining working-tree clusters — map at
      `scratchpad/tree-map.md` (session 068589ff): 376 entries, ~35 clusters.
      Largest: admin panel rebuild (~32 files, tests included), viewer
      share/export unification (~30), My Collections smart collections (~30,
      GalleryDrill +2743), notation "playable archive" consolidation (~24 with
      11 deletions), museum core+lobby (30), auth (~16). Most large clusters
      have matching tests and look land-ready; owners must confirm before any
      commit (other sessions are live).

## Block D — Drift adjudication (paper moves, no code)

LIKELY_DONE (verify claim, then `git mv` to shipped/):
- [ ] `2026-06-16-performance-audit-design.md` (also in C)
- [ ] `2026-06-29-create-tutorial-mobile-fullscreen-design.md` (also in B)
- [ ] `2026-06-29-instant-scan-card-pictographs-design.md` (internal dep: readiness budgets)
- [ ] `2026-06-30-account-deletion-provider-aware-reauth-design.md` (gate in A3)
- [ ] `2026-07-05-qr-account-funnel-design.md` (gate in B)

GHOST_PATHS (deliverables deleted from disk; likely superseded → archive):
- [ ] `2026-04-11-turn-in-place-animation-design.md` (100% paths deleted, 113d)
- [ ] `2026-05-12-anatomical-ik-constraints-design.md`

DIVERGENT (spec claims not-built; heavy traffic since — reconcile spec text against repo, do NOT build):
- [ ] `2026-04-01-physical-merch-store-design.md` (shop shipped around it)
- [ ] `2026-05-20-scene-composer-design.md`
- [ ] `2026-05-23-cross-feature-decoupling-design.md`
- [ ] `2026-05-23-error-boundary-system-design.md` (frontmatter says code complete; body stale)
- [ ] `2026-05-23-social-sharing-ssr-design.md`
- [ ] `2026-05-25-mandala-phase2-trails-design.md`
- [ ] `2026-06-20-real-flow-notation-aruco-design.md` (superseded by markerless track?)
- [ ] `2026-06-26-shop-transitions-design.md` (also in B)
- [ ] `2026-07-02-scan-card-to-collection-design.md` (dep: card production ledger)

WATCH (glance only): sequence-engine-unification · header-pattern-glyphs ·
canon-prop-creators · personal-museum · crossfade-primitive ·
**glb-environment-registry** (note: this is the existing spec for the 3D loader
priority — extend it, don't re-spec)

NO_STATE backlog (55 specs, state unknowable): batch a Haiku sweep to add a
status line + ledger to each frontmatter — one session, mechanical.

---

## Runbook

- Every close: verify claim → update `remaining`/`last_triaged` → `git mv` to
  shipped/ → scoped commit (`git commit -- <paths>`, never bare).
- Drift reconciliations edit spec text only; no code changes from Block D.
- Model routing: Blocks B/D run on Sonnet (Haiku for the NO_STATE sweep);
  Fable judges only DIVERGENT verdicts and reviews the final state.
- Related session deliverable: `specs/backlog/2026-08-01-rules-fable5-modernization-design.md`
