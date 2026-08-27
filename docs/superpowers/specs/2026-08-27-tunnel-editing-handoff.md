# Tunnel Editing Identity — Handoff (2026-08-27)

Written for a fresh agent (Codex or otherwise) taking over on this machine.
Everything below is on local `main` in `E:/tka-platform`. Nothing is pushed.

## Mission

Saved tunnels became first-class this week: the Tunnel creator (`/create/tunnel`)
can now compose any tunnel, so a tunnel is no longer just "one sequence applied
to itself." Two usability defects Austen reported followed from that shift, and
both are fixed:

1. Renaming a saved tunnel required opening its detail view and finding a bare
   pencil next to the title. The gallery — where you actually notice that two
   tunnels share a name — offered nothing.
2. "Edit choreography" crossed a tab switch into the creator and landed on an
   empty picker titled "Edit tunnel". Nothing on screen said which saved tunnel
   that was, and a tunnel saved before the creator existed arrived with no cast
   at all.

There is no separate design spec; the reasoning lives in the commit messages and
in the module docstrings cited below.

## Done — verified

### 1. Renaming a tunnel happens where its name is — `d009fa9faf`

The name itself becomes the control, on the gallery card and in the detail
title. One file, +323/−62.

Evidence: `npm run check` exit 0 at the time of commit; tunnel suites green (see
the run under item 2, which covers the same files).

### 2. A tunnel arrives at the creator with its cast and its name — `f6458bca63`

9 files, +421/−45. Three parts:

- **New shared owner** `src/lib/features/tunnel-collection/domain/collected-tunnel-source.ts`.
  `collectedTunnelSequence()` rebuilds the saved `SequenceData` (recovering
  `gridMode` from the steps). `collectedTunnelComposition()` returns the authored
  cast, or — for a tunnel with no `composition` — reconstructs a lead holding the
  saved sequence plus a partner derived from it with `transforms: []`.
- **Both reopen paths route through it**: `open-tunnel-in-viewer.ts` (de-duplicated
  onto `collectedTunnelSequence`) and `tunnel-creator-handoff.ts` (now always
  resolves a composition, and carries `poster` across the tab switch).
- **The creator header became the tunnel's identity**: its own poster, the eyebrow
  "Editing saved tunnel", and its name rendered through `TkaLabel` in the TKA
  glyph font. `TunnelLayout.svelte`, plus `editingTunnel` plumbed through
  `TunnelTab.svelte` to `tunnel-creator-state.svelte.ts` to the draft schema
  (`TunnelEditTarget`, persisted, so it survives a remount).

**Why the reconstruction emits two performers and not one.** Layer plans assign
arms `arm % composition.performers.length`, so a partner that resolves to the
same sequence with the same ops paints exactly what one performer across every
arm painted — the pixels do not move. What it buys is a tunnel the creator can
edit, because the creator's two slots and its linked/separate mode are expressed
in performers, and `createTunnelCreatorState` does **not** call
`rebuildLinkedPartner()` at construction. A one-performer cast would leave
slot[1] null, `isReady()` false, and "Preview changes" disabled. An identity copy
reads back as `DEFAULT_TUNNEL_RELATIONSHIP` ("Copy"), not an invented rotation.

**Evidence (all captured 2026-08-27):**

| Check | Command / method | Result |
|---|---|---|
| Types | `npm run check` | exit 0 — "svelte-check found 0 errors and 0 warnings" |
| Tests | `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/sequence-viewer/tunnel src/lib/features/tunnel-collection tests/unit/tunnel-creator-handoff.test.ts` | 12 files / **109 tests passed** |
| Pixel-equivalence lock | `collected-tunnel-source.test.ts` -> "paints exactly what the one-performer tunnel painted" | compares `resolveTunnelLayerPlans` op-for-op, step-for-step, offset and speed, solo vs reconstructed |
| Regression lock | `tests/unit/tunnel-creator-handoff.test.ts` -> "reconstructs a cast for a tunnel saved without one" | passes |
| Live, before | tunnel `PΛ` (legacy, `hasComposition: false`) via Edit choreography | "Edit tunnel" · "No sequence loaded" · "Waiting for Performer 1" |
| Live, after | same tunnel, same button | eyebrow "Editing saved tunnel", `posterPresent: true`, `nameGlyphs: 2`, "Performer 1 · 8 steps", "Performer 2 · 8 steps · Copy", "4 performers · 8 props", Preview changes enabled |

**Viewport sweep** (Chrome DevTools MCP, signed-in instance, webp/70):

| Viewport | Poster | Identity | Header | Eyebrow lines | Overflow-x |
|---|---|---|---|---|---|
| 1920×1080 | 48px | 168.1×47.3 | 84 | 1 | none |
| 2560×1440 | 48px | 168.1×47.3 | 84 | 1 | none |
| 3840×2160 | 48px | 192.2×54.9 | 104 | 1 | none |
| 1440×900 | 48px | 144.1×44.3 | 73 | 1 | none |
| 820×1180 | 48px | 144.2×39.7 | 72.7 | 1 | none |
| 960×412 | 32px | 144.2×42 | 68.7 | 1 | none |
| 375×667 | 32px | 144.2×38.5 | 132.7 | 1 | none |

The sweep found and fixed one defect: at 820 the squeezed title block wrapped
"EDITING SAVED / TUNNEL" onto two lines. `.title-block.editing` is now
`flex: 0 0 auto` with a `nowrap` eyebrow, so the mode switch yields instead — it
has a `min-width: 12rem` floor to give.

### 3. Routing index updated

`.claude/rules/canonical-capabilities.md` gained a row for the new shared owner,
per the `never-hand-roll.md` evidence gate. Committed with this handoff.

No `.claude/agents/*.md` expert file owns tunnel composition, so none needed
updating (checked against the `expert-routing.md` table).

## Believed done — unverified

- **Republishing three live public artifacts.** Earlier in this program Austen
  was asked for permission to republish three already-public artifacts after a
  data change, and answered "it's all good, do it." Whether the republish ran is
  not provable from this session's remaining context. Verify by opening the
  Explore visuals surface and checking those artifacts' `updatedAt` against the
  change that motivated it. Do not re-publish blindly — publishing is
  outward-facing.
- **The non-editing creator header** ("Build a tunnel") was not re-screenshotted
  after the CSS change. The new rules are all scoped to `.title-block.editing`
  and the markup branch is untouched, but it was not proven with a frame. Proving
  it requires clearing `localStorage['tka-create-tunnel-draft-v1']`, which would
  destroy whatever draft Austen has in flight — do not do that without asking.

## In flight

- **Uncommitted, mine:** nothing after the handoff commit.
- **Uncommitted, NOT mine:** the working tree carries ~160 modified files from
  other concurrent sessions — 3D scenes (ember, celestial, ocean, winter),
  `packages/camera-3d`, `flow-fest-graybox`, `walk-lab`, `BaseModal`, and more.
  **Do not stage, commit, revert, or "clean up" any of them.** The git index is
  shared; always commit with an explicit pathspec:
  `git commit -m "..." -- path/a path/b`.
- **Branch:** `main`, primary checkout. No worktree.
- **Unpushed:** 10 commits sit on local `main` ahead of `origin/main`, only two
  of which are this program's (`d009fa9faf`, `f6458bca63`). Some of the other
  eight may be push-gated by their own sessions. **Do not push without Austen
  saying so in the live conversation.**

## Loose ends (ranked)

### 1. Films as a third section in community visuals — blessed, not started

Austen: *"we're creating this whole directorial scene experience and I wonder if
the community visuals need another section which is basically films — films that
you've created, or scenes within those films, which are 3D environments that have
been set to specific parameters involving who's there, what is being performed,
how it's being performed … a film is multiple 3D environments subsequently placed
next to each other."*

Plan already agreed: **films-first as a third section**, with scenes as anchors
inside a film's detail view (not a fourth peer section).

Seams, verified 2026-08-27:

| What | Where | Current state |
|---|---|---|
| Public artifact union | `src/lib/shared/artifact-revisions/domain/public-artifact.ts:29` | `["tunnel","mandala","scene"]` — no `film` |
| Browse router union | `src/lib/shared/browse/navigation/browse-route-resolver.ts:12` | `"tunnels" \| "mandalas" \| "scenes"` — no `films` |
| Explore panel narrowing | `src/lib/features/browse/visuals/components/ExploreVisualsPanel.svelte:39` | `Extract<BrowseVisualType, "tunnels" \| "mandalas">`, with a `TYPES` array at `:48` |
| Analytics union | `src/lib/shared/analytics/browse-events.ts:25` | already has `"film"` |
| Film collection module | `src/lib/features/film-collection/` | exists (module, gallery, domain, services, state) — **no publication service** |
| Tunnel publication reference impl | `src/lib/features/tunnel-collection/services/tunnel-publication-service.ts` | the shape to copy |

**Hard gate:** `firestore.rules:1746` and `:1804` whitelist
`['tunnel','mandala','scene']`. Films cannot publish until those lines change AND
the rules are deployed. Rules deployment is Austen's call — surface it before
building the client half, or the feature will look finished and silently fail
with permission-denied.

### 2. Legacy tunnel posters are never refreshed

`refreshTunnelPoster()` (`tunnel-poster-refresh.ts`) runs **after a save**, off
the critical path: saving keeps the fast live-stage frame, and the canonical
render replaces it seconds later. Tunnels saved before that landed keep their
fast frame forever. That is why `PΛ`'s poster is a faint crosshair while its live
preview is a rich four-arm figure — and the creator header now shows that same
weak picture, because it deliberately shows exactly what the gallery card shows.

Decide with Austen: backfill on open, backfill on migration, or a manual refresh
control. He has already objected twice to poster quality
(*"so pixelated that I can literally count the pixels on one hand"*), so this is
likely to come up again on its own.

### 3. Task chip `task_3818e7ca` — browse deep-link bounce

Cold-loading `/browse/you/visuals/tunnels` directly bounces instead of landing on
the tunnels list. Filed as a background task. **Do not work it unless asked.**

### 4. Source cards render empty step strips at 960×412

Observed 2026-08-27 during the sweep. At a wide-and-short viewport the
`.source-card` is 156px tall with a 65px heading, and the step strip inside it
draws nothing. Pre-existing geometry in the source panel, unrelated to the header
work — reported, not fixed, not diagnosed further.

## Decisions already made

Do not re-litigate these.

- **Films are a third section; scenes are anchors inside a film's detail view.**
  Agreed after presenting the alternative (scenes as their own peer section).
- **`exploreVisualsVisible()` stays off production visibility.** Austen's call.
  Do not promote it.
- **The seven ambiguous media associations stay unresolved** until Phase 4 curator
  evidence arrives. Never guess an association to close the list.
- **R2 playback URLs are effectively durable.** Do not promise revocation to a
  user, and do not design a flow that depends on it.
- **A tunnel can be called whatever you want**, and its generated name is derived
  from the tunnel's own parameters, not from the source sequence
  (`src/lib/shared/sequence-viewer/tunnel/tunnel-name.ts` -> `deriveTunnelName`,
  13 tests). TKA letters must render in the canonical TKA font — `TkaLabel`,
  always with `darkMode`.
- **Do not push `main`** without his word in the live conversation.
- **:5173 is his dev server.** Never start, restart, stop, or kill it. He has an
  Agent Hub button; the tunnel and pm2 supervision ride on it. If it is down,
  diagnose and ask him to press the button.

## Gotchas

- **Run vitest with the project config.** `npx vitest run <paths>` picks up a
  stale duplicate test at
  `.claude/worktrees/optimistic-shaw-af2caf/tests/unit/tunnel-creator-handoff.test.ts`
  and dies with `ReferenceError: sessionStorage is not defined`. Always:
  `npx vitest run --config tests/config/vitest.config.ts <paths>`. That nested
  worktree belongs to another session — leave it alone.
- **DevTools `emulate` does not override the window dpr.** On this machine the
  factor is **0.9**: request `target × 0.9` for desktop widths (1920 -> 1728,
  2560 -> 2304, 3840 -> 3456, 1440 -> 1296). Appending `,mobile,touch` resets the
  factor to 1.0, so mobile sizes are requested 1:1. Always read back `innerWidth`
  before trusting a measurement.
- **Switching to mobile emulation remounts the Create module** ("Loading Create…").
  Poll for `.title-block` before measuring. The editing header survives the
  remount because `editingTunnel` is in the persisted draft — that round-trip is
  itself a proof the draft schema works.
- **The Create module scales through design tokens, not the root font ramp.**
  Root font stays 16px at 3840; `--font-size-compact` is what steps (12 -> 14 ->
  16). So `rem` does **not** scale inside this module — the usual
  `4k-native-layout` advice to prefer rem does not apply here, and a token is the
  only thing that tracks the tier.
- **`validateTunnelComposition` errors when `imageCount(formation) < performers.length`**
  (`imageCount = fold * (mirror?2:1) * (flip?2:1)`, `FOLD_OPTIONS = [1,2,4,8]`).
  That is why the reconstruction guards on `imageCount(formation) > 1` and stays
  a solo cast for a fold-1 formation. Do not remove that guard.
- **`TunnelCreatorHandoff` is consumed exactly once** at `TunnelTab.svelte`
  construction (sessionStorage key `tka:tunnel-creator-handoff`). Reading it
  twice returns null; a reload after a handoff falls back to the persisted draft.
- **Delivery is the in-app Browser pane, and it is signed out.** The pane cannot
  reach Austen's saved tunnels, so an editing-state frame has to come from the
  DevTools Chrome instance (`scripts/launch-chrome-debug.ps1`) where he is signed
  in. Say so explicitly rather than silently downgrading to a link — and still
  end the message with a clickable `https://` link, because the pane card
  expires.
