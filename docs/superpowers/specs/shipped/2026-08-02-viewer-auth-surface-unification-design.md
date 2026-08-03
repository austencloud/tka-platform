---
status: active
value: 5
effort: S
remaining: ""
depends_on: ""
plan_path: ""
tags: [auth, viewer, qr, funnel, never-hand-roll, bug]
last_triaged: 2026-08-02
---

# Viewer Auth Surface Unification — Design

**Date:** 2026-08-02
**Status:** Shipped in `a0b1835945`.
**Author:** Claude (Opus 5) + Austen

## Problem

Austen, testing the `/q` download funnel on 2026-08-02:

> "I know that if I click the sign in button at the bottom left of the sidebar
> when I'm on desktop in the main regular app I get a beautiful screen where it
> says do you want to sign in with Google or do you want to use your email and
> it was recently redone to look extra pretty however here you've given me a
> boring sign in which just says sign in create a free account and that's lame
> ... why is there two different versions of this and can we have one version
> ... when I click sign in with Google it does not even open up anything it
> refuses to sign in"

Two complaints, one root cause.

### The duplicate surface

`SignInSheet.svelte` (155 lines, sequence-viewer) was a hand-rolled bottom sheet
with its own markup, its own CSS, and a single Google button. It imported its
copy strings from `auth-nudge-trigger.ts` — the same module the shared
`AuthModal` already uses to render contextual copy properly — and re-rendered
them inside a box of its own. `auth-nudge-trigger.ts` even carried a comment
saying the `viewer-signin-*` keys existed for SignInSheet's benefit.

So the app had three auth surfaces (`AuthModal`, `AuthSheet`, `SignInSheet`) and
the worst-looking one was on the conversion funnel.

### The dead end

`onSignInSheetPrimary` in `auth-action-queue.svelte.ts` preferred Google One Tap:

```js
const oneTap = window.google?.accounts?.id;
if (oneTap) {
  try {
    oneTap.prompt();      // fire-and-forget, no callback
    signInSheetOpen = false;
    return;               // treated as success
  } catch { /* fall through to popup */ }
}
```

`prompt()` does not throw when One Tap is suppressed — it silently declines to
display and reports that through a moment-notification callback this code never
registered. So the `catch` never fired, the popup fallback was never reached,
the sheet closed itself, and the user was left with nothing.

Reproduced in an isolated browser context by instrumenting the page:

| Probe | Before |
|---|---|
| `google.accounts.id.prompt()` calls | 1 (with **0** arguments) |
| `window.open` calls (popup) | **0** |
| One Tap iframe rendered | **no** |
| Sheet still open after click | **no** — it closed itself |

This is not incognito-specific. One Tap is also suppressed by blocked
third-party cookies, by FedCM cooldown, and by Google's exponential backoff
after a user dismisses it a couple of times. Any user in that state hit a
permanent dead end on the download funnel.

### Why it cannot be patched in place

The obvious fix — pass a callback, detect "not displayed", fall back to popup —
is no longer implementable. Google's FedCM migration **removes**
`isNotDisplayed()`, `getNotDisplayedReason()`, `isSkippedMoment()`, and
`getSkippedReason()`, and states that display-moment notifications are
deliberately delayed and may arrive up to a minute after the fact. There is no
reliable synchronous signal that One Tap failed.

## Decision

Render the shared `AuthModal` on the viewer, keyed by reason. Delete
`SignInSheet` and the queue's provider code entirely.

This was chosen over two alternatives:

- **`AuthSheet` + a new subtitle prop.** Works, but `AuthSheet` has no concept
  of a reason, so it needs a new prop *and* a second copy path parallel to
  `AUTH_NUDGE_TEXTS`. Strictly more code for the same result.
- **Keep `SignInSheet`, fix the One Tap call.** Smallest diff, but leaves the
  duplicate surface Austen objected to, and per the section above the detection
  it depends on does not exist.

`AuthModal` already accepted `reason: AuthNudgeTrigger` and already rendered
these exact strings through `ContextualAuthPrompt` — described in its own header
as "the approved visual surface" — which composes `SocialAuthCompact`
(Google/Facebook) and `EmailAuthTabs` (magic link + password). **No new props on
any shared component were required.** The capability existed; the viewer was
hand-rolling around it.

## Architecture

| File | Change |
|---|---|
| `auth-action-queue.svelte.ts` | Add `SIGN_IN_TRIGGERS` + `signInTriggerFor()` mapping `SignInReason` → `AuthNudgeTrigger`. Delete `onSignInSheetPrimary` and every Firebase/One Tap import. Expose `signInTrigger`. |
| `SequenceViewerOrchestrator.svelte` | Render a lazy-imported `AuthModal` with `reason={authQueue.signInTrigger}` in place of `SignInSheet`. Drop the duplicate `GoogleOneTap` mount. |
| `SignInSheet.svelte` | **Deleted.** |
| `auth-nudge-trigger.ts` | Comment now points at the shared modal and names `signInTriggerFor` as the mapping seam. |
| `QScanPage.svelte` | Stale comment reference updated. |

### Reason mapping

`gated-action-policy`'s `FULL_ACCOUNT_ACTIONS` is the gate: only `download`,
`publish`, and `account` ever open the sheet — everything else provisions a
guest silently and never prompts. Those three map 1:1 onto the
`viewer-signin-download` / `viewer-signin-publish` / `viewer-signin-account`
keys that already existed. Unmapped reasons fall back to `null`, which renders
AuthModal's default ask rather than throwing.

### Webview handoff

`SignInSheet` had a bespoke webview mode whose only option was "Continue in
browser". That is superseded, and the replacement is better:

- `SocialAuthCompact` intercepts in-app browsers before any Firebase call and
  offers **Magic Link**, which works *inside* the webview — something the
  Google-only sheet could not do at all.
- Its escape action fires `stripEscapeTestParams(window.location.href)`, i.e.
  the current URL, which already carries `?pending=download` (set by
  `invokeGatedAction` before the sheet opens). So handing off to Chrome still
  replays the pending action and resumes the export.

### Bundle

`AuthModal` is lazy-imported behind `{#if authQueue.signInSheetOpen}`, mirroring
how `MainApplication` already defers it, so the scan landing does not pay for
the auth bundle until a guest actually hits a gate.

## Verification

Chrome DevTools MCP, isolated (incognito-equivalent) browser context, `/q/003N`.

| Probe | Before | After |
|---|---|---|
| Real OAuth popup opened | 0 | **1** |
| One Tap `prompt()` calls | 1 (fire-and-forget) | **0** |
| One Tap `cancel()` calls (race guard) | 0 | **1** |
| Sheet falsely self-closes | yes | no |

A live `accounts.google.com` OAuth page opened as a separate tab, confirming the
flow genuinely launches rather than merely appearing to.

Surface, desktop 1920 and mobile 375:

- Branded header, "Download this sequence", "Sign in or create an account to
  download this sequence."
- **Continue with Google** and **Continue with email**, plus "Already have an
  account? Sign in".
- 375px: dialog 343px in a 375px viewport, no overflow, all buttons 44px+.

`npm run check`: 0 errors, 0 warnings. Net −179 lines.

## Follow-up

`AuthSheet` (sidebar) and `AuthModal` (everywhere else) both remain. They are
not duplicates in the same sense — `AuthSheet` is a Drawer for the app shell,
`AuthModal` is a contextual modal — but consolidating them is a reasonable
future pass now that the viewer no longer adds a third.

## Related

- `.claude/rules/never-hand-roll.md` — the master rule this violated
- `2026-07-05-qr-account-funnel-design.md` — the funnel this unblocks
- [Sign in with Google JS API reference](https://developers.google.com/identity/gsi/web/reference/js-reference)
- [Migrate to FedCM](https://developers.google.com/identity/gsi/web/guides/fedcm-migration)
