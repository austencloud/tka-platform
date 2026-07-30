---
status: shipped
value: 3
effort: S
remaining: ""
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-29
---
# Creator Profile — Readability + Density Pass

**Date:** 2026-06-30
**Status:** Shipped (verified 2026-07-29)
**Scope:** Visual/UX polish of the creator profile page (`/browse/creators/[id]`). No data-model changes, no layout rewrite.

> **Queue closeout:** The readability and density pass shipped in `7b72aefa6d`, followed by the profile audit fixes in `df6bc2f1cc`. The current Creators module retains the compact panel state, frosted profile surface, and collapsed admin controls after its move from Browse to Social.

## Problem

The April 2026 profile redesign (`docs/superpowers/plans/shipped/2026-04-30-profile-page-redesign.md`) shipped a sound structure — hero / showcase / tabs / connection / admin — but two months later the page reads as low-quality. Three root causes, all evidence-backed:

1. **No readable surface.** Every section is a `--theme-card-bg` card (`rgba(255,255,255,0.04)`, ~4% white) with **no `backdrop-filter`**, and the entire render chain (`BrowseModule .browse-content` → `.tab-panel` → `UserProfilePanel .profile-panel` → `.profile-content`) is `background: transparent`. Content therefore floats directly over the app's undimmed, animated ocean background (fish, jellyfish, bubbles). Text-on-moving-water = contrast/readability failure. This is ~80% of the ugliness. The `GlassCard` "glass" primitive shares the flaw — it uses the same token with no blur, so it is glass in name only.
2. **Empty-state sprawl.** A new creator (no sequences, no connection) renders a 300px "No Sequences" void (`PanelState` padding `60px 20px` + `.gallery-content { min-height: 300px }`), plus an empty "No shared sequences yet" block, plus empty notes — a long scroll of nothing.
3. **Admin block dominates.** `ProfileAdminSection` is an always-open, red-tinted panel with **Delete User** visible at the bottom of every profile an admin visits.

The design system mandates transparent backgrounds (`feedback_design_system_mandatory`), so the fix is not opaque panels — it is a proper **frosted surface** (translucent + `backdrop-filter`) the sections currently skip.

## Decision (locked)

- **Scope:** readability + density pass. Keep the April layout bones. (User choice.)
- **Admin:** collapsed disclosure, collapsed by default. (User choice.)

## Reuse targets (never-hand-roll)

| Need | Reuse | Path / token |
|---|---|---|
| Readable frosted surface | App modal-surface tokens | `--theme-panel-bg` = `rgba(18,18,28,0.98)`; blur value from `--modal-backdrop-blur` (`8px`) semantics (`src/lib/shared/foundation/ui/modal/modal-tokens.css`) |
| Collapsible admin section | ConnectionSection's existing collapse pattern (in-family: button + `aria-expanded` + `max-height`/`opacity`), cross-referenced against `DangerZone.svelte` (destructive-action disclosure) | `ProfileConnectionSection.svelte:93-166`; `src/lib/shared/navigation/components/profile-settings/DangerZone.svelte` |
| Compact empty state | **Extend** `PanelState` with a `compact` prop (do not fork) | `src/lib/shared/components/panel/PanelState.svelte` |

No generic `Collapsible`/`Disclosure` primitive exists (the pattern is hand-rolled per feature: ConnectionSection, ShortcutContextSection, DangerZone, FaqAccordion). Reusing ConnectionSection's pattern keeps the two sibling sections consistent; a shared primitive is out of scope for this pass.

## Design

### A. Single frosted profile sheet

Wrap the profile content column in one frosted surface instead of N transparent cards.

- New wrapper inside `.profile-content` (or applied to a new `.profile-sheet` element around the section stack): 
  - `background: var(--theme-panel-bg)` — tune toward `rgba(18,20,30,0.9)` if fully-opaque reads too heavy over the ocean; the target is legible body text at `--theme-text-dim`, not a specific alpha. Final alpha chosen during implementation by screenshot.
  - `backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);`
  - `border: 1px solid var(--theme-stroke); border-radius: clamp(16px, 3cqi, 24px);`
  - centered, `max-width: 920px`, internal padding `clamp(16px, 4cqi, 32px)`.
- Inner sections **shed their own card chrome**: `ProfileConnectionSection` and `ProfileAdminSection` drop their outer `background`/`border`/`border-radius` and become blocks inside the sheet, separated by a hairline `border-top: 1px solid var(--theme-stroke)`. Hero and showcase are already borderless. Gallery thumbnail cards (`ProfileTabs .gallery-card`) keep their own card look — they hold rendered pictographs and read fine.
- The sheet is a **detail-view treatment**: drilling into a person yields a contained readable surface. The Creators list stays airy (its image cards provide their own surface). This asymmetry is intentional, not an inconsistency to fix.
- Ocean remains visible in the sheet's outer margins, preserving the aesthetic.

**Layout-shift + motion:** the sheet is static (no runtime content resizing its box). Respect `prefers-reduced-motion` (already handled per-section; no new animation added beyond the existing hero fade).

### B. Empty-state density

- **`PanelState` gains a `compact` prop** (boolean, default `false`). Compact = padding `~20px 16px`, icon at `--font-size-xl` (not `3xl`), title at `--font-size-base`. Non-compact behavior unchanged (backward compatible; existing call sites unaffected).
- **`ProfileTabs`**: pass `compact` to the empty `PanelState`; remove `min-height: 300px` from `.gallery-content` (or reduce to `auto`) so the empty case is ~1–2 rows, not a void. Populated grid unchanged.
- **`ProfileConnectionSection`**: when the connection is genuinely empty (not mutual, not following either way, `sharedSequenceCount === 0`, no notes), render one compact summary line instead of the three stacked sub-blocks. The **notes textarea stays** (the useful part). `ConnectionSharedSequences`' large empty state collapses to compact/hidden. When there IS content (mutual/shared/notes), the current three-block layout stands.
- **`ProfileShowcase`**: others' empty showcase already hidden; own empty prompt kept. No change.

### C. Admin collapsed disclosure

- `ProfileAdminSection` wraps its body (Known As, role, notes, actions) in a collapse using ConnectionSection's pattern: a header row button (`🛡 Admin Controls` + chevron, `aria-expanded`, `aria-controls`), **collapsed by default**, expandable on click. Chevron rotates on expand.
- Red accent shrinks to a **header tint only** (icon + subtle left accent), not a full red-filled panel body. The outer red card background/border is removed (the section now lives inside the sheet, per A).
- Expanded body keeps role buttons, Known-As input, admin notes, and account actions exactly as today. **Delete User** and its type-to-confirm modal are unchanged in behavior — just no longer visible until the admin expands the section.
- Touch target for the header ≥ 44px (`feedback_design_system_mandatory`).

### D. One width

All sheet content aligns to the single `max-width: 920px`, replacing today's mismatched widths (hero `900px`, connection/admin full-width). Removes the scattered-cards feel.

## Files touched

| File | Change |
|---|---|
| `src/lib/features/browse/creators/components/UserProfilePanel.svelte` | Add frosted `.profile-sheet` wrapper around the section stack; set single max-width; remove per-section width divergence. |
| `src/lib/shared/components/panel/PanelState.svelte` | Add `compact` prop (extend; backward compatible). |
| `src/lib/features/browse/creators/components/profile/ProfileTabs.svelte` | Compact empty `PanelState`; drop `min-height: 300px`. |
| `src/lib/features/browse/creators/components/profile/ProfileConnectionSection.svelte` | De-card (drop outer bg/border → hairline divider block); compact empty summary; keep notes. |
| `src/lib/features/browse/creators/components/profile/ProfileAdminSection.svelte` | De-card; wrap body in collapsed disclosure (default collapsed); reduce red to header tint. |

No changes to data models, services, Firestore, or navigation. No file deletions.

## Non-goals (YAGNI)

- No full layout/IA rethink (hero/showcase/tabs order stays).
- No new shared `Collapsible` primitive (reuse in-family pattern).
- No change to the Creators list surface, or to the app-wide "content over ocean" convention beyond this detail view.
- No pin-management UI, no new content types.

## Verification

Per `verification-protocol` and `visualization-routing` (test page default for existing components):

1. Iterate on `src/routes/test/profile-redesign/+page.svelte` and/or the live route via HMR (`https://localhost:5173/browse/creators/<id>`).
2. Before/after screenshots for: (a) empty profile (e.g. "Dimples"), (b) a populated profile, each at desktop (~1440px) and mobile (~390px) widths.
3. Confirm: text legible over ocean (frosted sheet), no 300px empty void, admin collapsed by default with Delete hidden until expanded, one aligned column width.
4. `npm run check` clean before commit (full pass at the gate, per `fast-iteration-loop`).

## Related

- Prior work: `docs/superpowers/plans/shipped/2026-04-30-profile-page-redesign.md`
- Rules: `never-hand-roll.md`, `no-layout-shift.md`, `crossfade-primitive.md` (N/A here), `visualization-routing.md`, `verification-protocol.md`
- Memory: `feedback_design_system_mandatory`
