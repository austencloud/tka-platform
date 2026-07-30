# Sequence Viewer Shell — ENFORCED

## The Problem This Solves

The /q scan page and the in-app sequence-viewer drawer drifted apart for days:
hand-rolled headers, a hardcoded navy palette shadowing the theme pipeline, a
forked mobile breakpoint (960 vs 768), and export tabs running different layout
rules. Austen (2026-07-02): _"didn't I just tell you that I want all of the same
things that exist in the actual sequence viewer drawer to exist in the QR page?
... you're still making this hand rolled header and you're absolutely refusing
to fix the other variation so it does look exactly the same."_

The fix was structural: ALL viewer chrome now lives in one shared component,
rendered by both hosts, so the surfaces are identical by construction. This rule
keeps it that way — the same playbook that stopped chip and crossfade drift
(`chip-primitives.md`, `crossfade-primitive.md`).

## The Canonical Component

`src/lib/shared/sequence-viewer/components/SequenceViewerShell.svelte`

Owns EVERYTHING between the host wrapper and the sequence: header, title menu,
overflow menu, rail, split pane, export panels (video + card), practice
workstation, delete dialog, all layout/breakpoint math, and all chrome CSS.

Host deltas go through the prop seam, never through forked markup:

| Prop              | Purpose                                                        |
| ----------------- | -------------------------------------------------------------- |
| `onClose`         | Host-specific dismiss (drawer close vs `goto`)                 |
| `onRemix`         | Override remix routing (/q → composer handoff)                 |
| `openAppHref`     | "Open TKA" target for standalone hosts                         |
| `onAccountSignIn` | Guest sign-in / full-account avatar entry for standalone hosts |
| `startInSplit`    | Boot into split view (/q scan landing)                         |
| `exportOverrides` | Host-owned export funnels (gated downloads on /q)              |

## The Host Contract

A host (today: `SequenceViewerDrawerHost.svelte`, `src/routes/q/[code]/+page.svelte`)
is THIN. It owns only: its wrapper (Drawer / route page), data
resolution/bootstrap, open/close routing, and host-specific funnels (scan
logging, gated export). Hosts MUST NOT:

1. **Rebuild chrome.** No host-side header, rail, export panel, or practice bar.
   No importing chrome internals (`ViewerHeader`, `ViewerSplitPane`,
   `ViewerOverflowMenu`, `ExportImagePanel`, `VideoPreviewPanel`, `PracticeBar`,
   `PracticeSetupBar`, `DeleteConfirmDialog`, `viewer-actions`) — those compose
   only inside the shell.
2. **Declare calculator-owned CSS vars.** No `--theme-*` / `--semantic-*`
   declarations in host styles — they shadow the `:root` values set by
   `applyThemeForBackground()` for the whole subtree and re-create the
   color-mismatch bug. Consuming them via `var()` is fine. Standalone hosts run
   the theme pipeline instead (see the /q `onMount`).
3. **Fork behavior.** Mobile breakpoint is `width < 768` everywhere. Layout and
   export-narrow rules live in the shell only.

Need something the shell doesn't expose? **Add a prop to the shell** (as
`exportOverrides` was added). If the shell's own behavior is wrong, fix it in
the shell — both surfaces get the fix.

## Enforcement

`tests/unit/sequence-viewer-shell-contract.test.ts` statically asserts the
contract (shell rendered by both hosts, no chrome imports, no theme-var
declarations, shared breakpoint) and runs in the `web-ci` unit-test job. If it
fails, fix the host — do not loosen the test.

## The Third Surface: /sequence/[id]

`src/routes/sequence/[id]/+page.svelte` predates the shell and still
hand-assembles chrome from internals. It is grandfathered, NOT a pattern:

- Do not extend its legacy chrome with new viewer features.
- The next substantial viewer change on that route starts by migrating it to
  `SequenceViewerShell` (add props for its deltas: fullscreen controls, LAN
  sync, handoff).

## Forbidden

- A new viewer surface that renders viewer chrome without going through the shell.
- Host-side `--theme-*` / `--semantic-*` declarations.
- A second breakpoint or export-layout rule outside the shell.
- Loosening the contract test to make a host change pass.
- "The /q version just needs a small tweak" → that tweak goes in the shell or
  through a prop.

## Related

- ADR: `docs/architecture/sequence-viewer-shell.md`
- Spec: `docs/superpowers/specs/2026-07-05-viewer-shell-anti-drift-design.md`
- `never-hand-roll.md` (master), `chip-primitives.md`, `crossfade-primitive.md`,
  `no-layout-shift.md`
