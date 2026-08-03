# Viewer Auth Unification + Shop Morph — Handoff (2026-08-02)

## Mission

Two threads ran this session on top of a spec-queue close-out pass.

1. **Viewer auth unification** — the `/q` scan page rendered its own hand-rolled
   `SignInSheet` whose Google button dead-ended for real users. Replaced by the
   shared `AuthModal`. Design spec:
   `docs/superpowers/specs/shipped/2026-08-02-viewer-auth-surface-unification-design.md`.
2. **Shop shared-element morph** — the morph described in
   `docs/superpowers/specs/active/2026-06-26-shop-transitions-design.md` had
   never worked. Three stacked blockers found; two fixed.

Surrounding context: the Great Close-Out ledger at
`docs/superpowers/plans/2026-08-01-great-closeout-ledger.md` is the running
checklist for the spec queue and survives compaction. Read it second.

---

## Done — verified

### 1. Credential rotation complete (`9049414bf2`, `2606a2883b`)

Both exposed credentials in `firebase-functions/.env` are dead and replaced.

- Stripe: new restricted key + rolled webhook signing secret (24h grace).
  Old `sk_live` **revoked by Austen** in the dashboard.
- Brevo: new key "TKA Composer 2026-08" generated, banked via clipboard (never
  displayed), `sendMagicLink` deployed, old key deleted — Brevo showed "API key
  has been deleted successfully" and the list dropped to two keys.
- Evidence: `npx firebase functions:list` shows `createCartCheckout`,
  `createDonationCheckout`, `createMerchCheckout`, `handleMerchWebhook`,
  `sendMagicLink` all deployed, `nodejs20`, `us-central1`.

**`createCartCheckout` was deployed for the first time here.** Before this,
production did not have it while every buy surface called it.

### 2. `shop-spin-up` closed (`88bacc724b`)

Score 25 — the highest-scoring spec in the queue. Its sole remaining gate (B4,
webhook-event registration) was already satisfied.

- Evidence: Stripe Dashboard → Workbench → Webhooks shows the
  `handleMerchWebhook` destination **Active**, "5 events", error rate 0%.
- Corroborated by the 2026-07-27 table in the go-live spec ("Merch webhook … Done").
- Moved to `shipped/`.

### 3. `inbox-multiline-message-rendering` closed (`c18f6d0265`)

All eight acceptance criteria verified against the **real** `MessageBubble` via
a new harness at `/test/message-multiline` (added in the same commit) — chosen
so no live message was sent to another person.

- Measured on `p.content`: `white-space: pre-wrap` and
  `overflow-wrap: break-word` on **all 8** fixtures; zero overflow at wide
  (42rem) and narrow (18rem).
- Line-box counts: single `\n` → 2 line heights; `\n\n` → 3; edited 3-paragraph
  → 5 plus an `(edited)` marker.
- Markup escaped (rendered `&lt;b&gt;bold?&lt;/b&gt;`), long unbroken token wraps
  inside the bubble, attachment caption keeps its break.
- Previews stay compact: `ReplyPreview.svelte:89` and
  `ConversationItem.svelte:245,275` retain `white-space: nowrap`.
- `git show --stat 9dfe3bdb86` = one CSS line in `MessageBubble.svelte`, so the
  "must not rewrite data" requirement holds by construction.
- Full-page screenshot reviewed at 1920.

### 4. Viewer auth unification + One Tap dead-end fix (`a0b1835945`)

`SignInSheet.svelte` deleted; `SequenceViewerOrchestrator` now lazy-renders the
shared `AuthModal` with `reason={authQueue.signInTrigger}`. Net **−179 lines**,
no new props on any shared component.

Reproduced the bug first, in an isolated (incognito-equivalent) browser context
on `/q/003N`, by instrumenting the page:

| Probe | Before | After |
|---|---|---|
| `window.open` (real OAuth popup) | **0** | **1** |
| `google.accounts.id.prompt()` calls | 1, with **0** arguments | **0** |
| `google.accounts.id.cancel()` (race guard) | 0 | **1** |
| One Tap iframe rendered | no | n/a |
| Sheet falsely self-closes | yes | no |

A live `accounts.google.com/v3/signin/identifier` page opened as its own tab,
confirming the OAuth flow genuinely launches rather than merely appearing to.

Surface: desktop 1920 and mobile 375 both render "Continue with Google" **and**
"Continue with email" under a branded header with the contextual ask. At 375 the
dialog is 343px in a 375px viewport (no overflow) with buttons at 44/46/46/44px.

`npm run check`: **0 errors, 0 warnings**.

### 5. Shop morph — blockers 1 and 2 fixed (`21d0bcba85`)

- **Allowlist.** `navigationMorphs()` gated on route id
  `/(public)/shop/[productId]`, which no shipped product uses, so no transition
  ever started. Measured `document.startViewTransition` calls: **0**. Now
  path-matched (any `/shop` descendant that is not the index and not
  `/shop/success`). Measured after: **1**.
- **Shared participant.** `DeckFanCover` gained an optional
  `viewTransitionName` applied to its root; both ends of two pairs are named.
  Measured on `/shop`: `root`, `shop-fan-loop-deck`, `shop-fan-tnd-trilogy`,
  `shop-book-cover`.
- `npm run check`: 0 errors, 0 warnings.

### 6. Queue hygiene

- `88bacc724b` — corrected stale `depends_on` on `shop-operations-go-live` and
  `shop-cart-order-doc` (rotation + remediation commit + cart deploy all landed).
- `d5e9f15f68` — cleared stale external blockers on `gallery-thumbnail-warm-pass`,
  `choreo-act-playback`, `choreo-sheet-v2`. Austen's authorization resolved them;
  the files still claimed otherwise, which was distorting the ranking.
- `a9e5d18506`, `d5b3de6d3a` — shop-transitions findings and re-scope.

---

## Believed done — unverified

- **`qr-account-funnel` criterion 2 (post-auth replay).** The popup now
  demonstrably opens; what is *not* proven is that the export auto-resumes after
  a completed sign-in. Needs one real Google sign-in with Austen's credentials.
  An agent cannot do this.
- **Magic-link email delivery after the Brevo rotation.** `sendMagicLink`
  deployed cleanly and the key is prefix-valid, but no email was actually sent.
  Next magic-link sign-in confirms it.
- **The book product's morph path.** An earlier note in the shop spec claimed
  *no* product morphs. That is verified for `/shop/loop-deck` and
  `/shop/tnd-trilogy` only. The book tile links to `/shop/{book.id}`, which may
  still reach `ProductDetailPage` (where `shop-book-cover` genuinely exists) via
  the generic `[productId]` route. Treat as **untested**, not broken. I could
  not confirm because the `guide`-type product did not appear in the first page
  of the `products` collection.

---

## In flight

**Nothing of mine is uncommitted.** Every file I touched is committed.

**Local `main` is ahead 19, behind 3, and I did NOT push.** This is deliberate:

- The 3 incoming commits (`fc19ae3201`, `c80c839ea2`, `200eb0ca86`) touch only
  `launchers/install-codex-tka.ps1` and `patches/codex-tka-status-bars.patch`.
- **Both of those files are dirty in the working tree** — another session is
  actively editing exactly them. Pulling or merging risks that session's work,
  and force-pushing is off the table.
- Next agent: do not "fix" this by pulling. Ask Austen, or wait until that
  session lands its work.

The working tree also carries a large volume of **other sessions'** changes
(notation, museum cave, landing-directions, smart-collections, agent-hub). None
of it is mine. Commit only your own paths — see
`.claude/rules/commit-only-your-own-changes.md`.

---

## Loose ends (ranked)

### 1. Finish the shop morph — third blocker (START HERE)

Each product route renders through:

```svelte
{#if browser}
  {#await import("$lib/features/store/LoopDeckConfiguratorPage.svelte") then { default: Page }}
    <Page />
  {/await}
{:else}
  <div class="seo-shell">…</div>
{/if}
```

That is a second layer of laziness on top of SvelteKit's route splitting, so the
destination hero has not mounted when the browser snapshots. Verified with the
chunk already warm: the destination still carried **no** named participant
shortly after navigation.

**Do not delete the wrapper** — the `{#if browser}` branch is what lets SSR emit
the SEO shell on indexed marketing pages.

Fix (full write-up in the shop-transitions spec): resolve the module in the
route's `load` and render synchronously.

```ts
// +page.ts
export const load = async () => {
  const mod = browser
    ? await import("$lib/features/store/LoopDeckConfiguratorPage.svelte")
    : null;
  return { Page: mod?.default ?? null };
};
```

```svelte
{#if data.Page}<data.Page />{:else}<div class="seo-shell">…</div>{/if}
```

`navigation.complete` awaits `load`, so the component renders synchronously and
its named fan exists for the snapshot. Then: name the remaining two pairs
(`choreography-cards`, `starter-pack`), settle the book path, and run criteria
2–5 (F5 no deadlock, browse→sequence still correct, reduced-motion instant cut,
grid stagger) with screenshots.

### 2. Three now-unblocked verification specs (~36 pts)

`choreo-act-playback` (12), `choreo-sheet-v2` (12),
`gallery-thumbnail-warm-pass` (12). No longer blocked on Austen.

- Both choreo specs need a **WriteTab** run. The existing `/test/choreo-sheet`
  harness renders `ChoreoSheetView` but does **not** mount `ActsDock` /
  `ActPlayer`, so the dock criteria cannot be exercised there — confirmed this
  session. `choreo-act-playback` also needs a disposable local audio file;
  `choreo-sheet-v2` needs a visual PDF review.
- `choreo-sheet-v2` is partially verified already: the harness paginated 8 real
  sequences (step counts 8, 16, 8, 4, 4, 16, 4, 8) into 2 pages at 8×6, cell
  91.9pt, with continuity dots and working 4/6/8 column controls.
- `gallery-thumbnail-warm-pass` needs a signed-in admin warm plus manifest and
  static sync, then proof of warmed cloud/static counts and no warmed-key 404s.

### 3. The `NO_STATE` sweep (57 specs)

`active/` is at 74 specs; 57 of 126 have no status line and no ledger, so the
queue cannot score, rank, or close them. This is why the count keeps climbing.
Mechanical Haiku sweep, one session: add a status line + ledger to each
frontmatter. Do this before starting anything new.

### 4. Austen-only (cannot be delegated)

- **Stripe payout requirement (past due)** and **Stripe Tax registration**.
  Together they gate ~40 points of shop specs with an October 1 deck behind them,
  and the payout block is holding his own money.
- One live Google sign-in on `/q` to close `qr-account-funnel` criterion 2.
- The iPhone pass: `inbox-ios-focus-zoom` (20), `train-screen-wake-lock` (16),
  `gallery-thumbnail-tail-latency` (15).

---

## Decisions already made

- **2026-08-02, on the auth approach:** presented three options; Austen chose the
  `AuthModal` route — *"Go for it I'll take your recommendation."* Do not
  re-litigate `AuthSheet`-plus-subtitle-prop; it was considered and rejected as
  strictly more code for the same result.
- **2026-08-02, standing authorization:** *"Agents may indeed drive a signed in
  session and write disposable test data in order to closeout these specs."*
  This covers authenticated browser runs and throwaway test data. It does **not**
  cover destructive operations — `account-deletion-provider-aware-reauth` still
  needs separate explicit sign-off for its live deletion run.
- **2026-08-02:** auth unification and the shop morph are two independent
  projects with separate specs, not one braided effort.
- **Standing (memory `feedback_skip_spec_gating`, 2026-07-11):** design is agreed
  in conversation; write the spec for the record but do **not** stop and ask
  Austen to approve a spec before implementing.
- **2026-08-02, on `/q` sign-in copy:** the contextual ask stays. It rides the
  existing `viewer-signin-*` trigger keys — no new copy path.

No expert agent in `.claude/rules/expert-routing.md` owns auth or view
transitions, so no expert `.md` needed updating for this work.

---

## Gotchas

- **Do not try to "fix" One Tap by passing a callback.** Google's FedCM
  migration *removes* `isNotDisplayed()`, `getNotDisplayedReason()`,
  `isSkippedMoment()`, and `getSkippedReason()`, and delays moment
  notifications by up to a minute. "Try One Tap, detect failure, fall back" is
  not implementable. That is precisely why the fix was deletion, not a patch.
- **The `:5173` dev server does not pick up NEW route directories.** Adding
  `src/routes/test/message-multiline/` and loading it on :5173 served a
  completely different page (`vtg-base-rotation`). Spawning a own vite on a free
  port resolved it instantly. Existing routes HMR fine.
- **Pressing Escape on `/q` closes the whole viewer** and navigates to
  `/browse/gallery`. Dismiss menus by clicking elsewhere, not by keyboard.
- **Use an isolated browser context for signed-out testing**
  (`new_page(..., isolatedContext: "name")`). It gives a clean cookie/storage jar
  without touching Austen's signed-in default context. Signing him out to test
  is never necessary and never acceptable.
- **Firestore MCP full-collection queries blow up context** — one `products`
  query returned 317k characters. The tool saves oversized output to a file;
  parse it with `node -e`, not by reading it.
- **Git Bash here has no `jq` and no `python`.** Use `node -e`.
- **Backticks in `git commit -m` get shell-executed** and silently drop words
  from the message. Use a `-F -` heredoc for any message containing backticks.
- **Reap any dev server you spawn** (`.claude/rules/resource-budget.md`). :5173
  is Austen's and is never yours to kill.
- `DeckFanCover`'s `viewTransitionName` must be unique per snapshot — exactly one
  visible fan may carry a given name at a time.
