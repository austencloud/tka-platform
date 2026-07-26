---
status: active
value: 2
effort: S
remaining: "Body status: Active"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# What's New: Toast Instead of Modal — Design

Date: 2026-07-02
Status: Active

## Problem

On app load, a new version with changelog content triggers a full-screen
blocking modal (`WhatsNewModal`) over the app before the user does anything.
For a beta tool shipping frequently, a modal-wall every release is friction.

## Decision

Replace the auto-popup modal with a **non-blocking toast** that carries a
"See what's new" button. The toast is the notification; the existing
`WhatsNewModal` becomes the detail view, reached only when the user opts in.

```
new version + has changelog
   → toast.info("TKA vX.Y.Z · N updates", 10s)
        action: [See what's new →]  →  opens WhatsNewModal (detail)
   → markVersionAsSeen(version)      ← fires immediately, never re-nags
```

Precedent: `BetaNoticeToast.svelte` already fires a one-time non-blocking
toast after onboarding and marks-seen on fire. Same shape.

## Product choices (locked)

- **Persistence:** auto-dismiss ~10s. Changelog is opt-in info, not a consent
  gate — some users never click, that's acceptable.
- **Seen timing:** mark seen the moment the toast fires (like BetaNotice).
  Click-through optional. Never re-shows even if ignored.
- **Major-release wall:** deferred (YAGNI). Pure toast for now. A per-version
  severity flag that forces the modal can be added when a genuinely breaking
  release needs it.

## Changes

Two files. `WhatsNewModal.svelte` untouched.

### `src/lib/shared/settings/state/whats-new-state.svelte.ts`

Add a method to open the modal with an already-loaded version, skipping the
refetch that `openManual()` does:

```ts
/** Open modal with an already-loaded version (no refetch). Used by the update toast. */
openDetail(version: AppVersion) {
  this.mode = "manual";
  this.version = version;
  this.isOpen = true;
}
```

### `src/lib/shared/settings/components/WhatsNewChecker.svelte`

Replace the modal-open branch in `checkForNewVersion()` (the
`versionData.changelogEntries?.length` block) with a toast fire + immediate
mark-seen:

```ts
if (versionData && versionData.changelogEntries?.length) {
  whatsNewState.markVersionAsSeen(currentVersion);          // seen-on-fire
  const count = versionData.changelogEntries.length;
  showToast({
    message: `TKA v${currentVersion} · ${count} ${count === 1 ? "update" : "updates"}`,
    type: "info",
    duration: 10000,
    action: {
      label: "See what's new",
      onClick: () => whatsNewState.openDetail(versionData),
    },
  });
} else {
  whatsNewState.markVersionAsSeen(currentVersion);           // unchanged
}
```

Import `showToast` from `$lib/shared/toast/state/toast-state.svelte`.

## Preserved

- Auth-gate, `appEntryState.isComplete()` hold, first-ever-visitor silent
  baseline, cross-device cloud sync, high-water-mark seen tracking — all stay.
- `openManual()` (version-number click) untouched — still the manual entry.
- `WhatsNewModal.close()`/`dismiss()` re-mark seen (idempotent no-op after
  seen-on-fire).
- Toast placement, mobile, reduced-motion, touch-target, action-button render
  — all already owned by `ToastContainer`.

## Reuse (never-hand-roll)

Toast system, `ToastAction` API, `BetaNoticeToast` precedent, and
`WhatsNewModal` all exist. Net new: ~12 lines in the checker + one 4-line
method. Zero new components.

## Not doing

Major-release wall, sticky toast, engagement/analytics tracking.
