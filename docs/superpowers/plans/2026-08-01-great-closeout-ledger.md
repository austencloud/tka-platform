# The Great Close-Out — Ledger (week of 2026-08-01)

Goal: convert done-but-gated work into shipped specs. Every line is checkable.
Scores are `value × effort_multiplier` from the queue. This ledger survives
compaction; update boxes here, not in conversation memory.

Already closed this session:
- [x] `generate-saved-setups-favorites` (PHANTOM_OPEN, 25/25) → shipped in `bc2daf5d4a`

---

## Block A — Austen's hands (batch these; ~2.5 hours total)

### A1. Stripe block (~1 hr) — unblocks 65 points of shop specs
- [ ] **Rotate the exposed credentials** (found by the shop audit; see
      `specs/active/2026-06-26-shop-operations-go-live-design.md`). Everything
      shop-related resumes only after this.
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

- [ ] `qr-account-funnel` (16): DevTools viewport + auth-state verification, rerun check
- [ ] `inbox-multiline-message-rendering` (15): signed-in Inbox verification, send/edit test messages
- [ ] `choreo-act-playback` (12): authenticated Write-module run + disposable audio file
- [ ] `choreo-sheet-v2` (12): authenticated Write-module run + visual PDF review
- [ ] `gallery-thumbnail-warm-pass` (12): signed-in admin warm + manifest/static sync
- [ ] `shop-transitions` (16): stale env blocker ("Chrome connector cannot initialize")
      — retry in a fresh session with the standard launcher; likely just closes
- [ ] `variation-picker-polish` (12): DevTools pass; code landed in `fd182587b6`
- [ ] `create-tutorial-mobile-fullscreen` (12): DevTools pass; landed `5609c75ac1`

## Block C — Tree-dependent (fix once, closes several)

- [ ] Identify owner of untracked `WorkspaceShareControl.svelte` whose type errors
      block the shared `npm run check` (named by 4+ specs). Owner lands or shelves it.
- [ ] Land the verified-but-uncommitted shop remediation (7 suites, 44 tests,
      per shop-operations spec) with scoped commits — after A1 credential rotation
- [ ] Reconcile remaining working-tree clusters (map: tree-map agent, this session)
- Unblocks the shared full check for: `3d-trail-parity` (12) · `performance-audit` (12)
  · both DevTools-blocked specs above · every future session's commit gate

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
