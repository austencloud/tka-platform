# Smart Collection Composer — Cold Audit Findings + Fix Ledger (2026-08-03)

Reconciled from four read-only Opus audit partitions (compact C-*, fold/tablet
F-*, desktop D-*, cross-cutting X-*) run against the uncommitted redesign at
`https://localhost:5173/test/smart-collections` on 2026-08-02/03. Screenshot
evidence lives under the session scratchpad `audit-*` directories. This doc is
the working ledger for the single fix owner. NO FIX BELOW IS IMPLEMENTED YET —
mark `[x]` only with evidence in hand.

Verified green before fixes: full `svelte-check` — 0 errors, 0 warnings
repo-wide (2026-08-03).

Cross-partition confirmations marked (2×)/(3×)/(4×).

## Phase A — Correctness + accessibility strikes

- [x] A1 (3×: X-5, D-4, C-1, F-9) Footer contradiction FIXED: sheet footer is
      now section-aware ("LOOPs apply as you tap them. Combine several." /
      "Slide to a limit, then apply it." / "Choose a filter to start.") via a
      new GalleryDrill `onSectionChange` prop, and the short-height rules that
      hid the "tap several" hint now exempt .screen-loop/.screen-family.
      Verified 960×412 (hint + footer agree, screenshot) and 1920 (slider
      footer).
- [x] A2 (3×: X-2, C-6, F-12) FIXED: new `isValueApplied` prop; Level, Length,
      Position, Grid mode, Creator, Letters buttons now render
      class:value-applied + aria-pressed from the rule; turn slider seeds from
      the applied limit. Verified: builder-refine/filter-level shows Level 2
      pressed with accent ring. Count note: facet counts for the SAME category
      correctly exclude that category's own filter (standard faceting) — C-6's
      count complaint was a misread; only the missing selected state was real.
- [x] A3 (X-6) FIXED: on section change, focus moves to the incoming screen's
      h2 (tabindex="-1", rAF after crossfade mount). Verified both directions
      (tile → "Pick a level" h2; Back → "Add a filter" h2). Landing takes
      ~500ms under fixture load — acceptable.
- [x] A3b (F-3) REFUTED by probe: the builder renders as a native
      `<dialog open>` with aria-labelledby="smart-builder-title" (implicit
      role dialog). No product change needed.
- [x] A4 (F-1) REFUTED behaviorally at real 820: the 11 zero-sized controls
      sit inside a display:none ancestor and a programmatic focus() sweep
      moved focus to NONE of them (computed style inside hidden subtrees
      reports specified values — that fooled the auditor). No phantom tab
      stops exist. No change needed.
- [~] A5 (2×: X-16, F-2) DEFERRED with cause: the `<style>` ships inside the
      grid SVG asset that EVERY pictograph renders via the shared GridSvg
      (export paths already strip it; live paths depend on it for theming).
      It is an app-wide pre-existing trait, not a Smart Collections
      regression; stripping it live risks every grid consumer. The F-2
      accessible-name leak sits in the unfocusable hidden subtree (see A4).
      Route to prop-positioning/pictograph pipeline owner.
- [x] A6 (2×: X-13, C-16) FIXED: unified-chooser hosts get aria-label "Back to
      filters". Verified at 1920. (Visible-label-only-at-960×412 styling left
      as the deliberate density choice.)
- [x] A7 (X-12) FIXED with explicit `{" · "}` separators. Verified: card reads
      "48 matches · Community · Built in".
- [x] A8 (X-3) FIXED: SmartCollectionRuleSummary gains `countUnavailable`;
      detail surface passes `error`. Verified: error variant pill reads
      "Matches unavailable". Exit-control half was fixture-only (production
      hosts pass onBack; the variant sets showBack=false deliberately).
- [x] A9 (2×: D-6, C-9) FIXED: 44px hit halo via thumb ::before (visual knob
      unchanged). Verified by elementFromPoint probe beyond the visual edge at
      1920. Tappable tick stops deferred to D15 (axis spacing) — the slider
      itself meets the floor everywhere now.
- [x] A10 (2×: C-15, F-14) FIXED: pickCreatorAvatars now skips generated
      `data:` avatar URLs (initials baked for the uploader, not the credited
      creator); RobustAvatar regenerates from the display name. Verified:
      Christofborkott renders "C"; all other creators keep real photos.

## Phase B — State + count clarity

- [x] B1 (X-1) FIXED: sheet holds "Counting matches" (header + preview panel)
      until the prefetch→initialize chain fully resolves (`countSettled`),
      instead of trusting isLoading which goes false after the IndexedDB warm.
      Implemented + type-checked; a cold-cache timing trace (loose end #4 in
      the handoff) is still owed before calling the loading story done.
- [x] B2 (3×: X-10, X-17, D-7, F-9) FIXED: editor now reads "would match N"
      (verified at 1920: "≤1.5 turns would match 762") and the footer says
      "Slide to a limit, then apply it." Pre-selection now seeds from the
      APPLIED limit when one exists (A2); with none, the midpoint default
      stays but is now clearly a projection, not an applied filter.
- [x] B3 (2×: X-4, D-5) FIXED two ways: (1) toggle-mode LOOP/T&D editors keep
      ALL options mounted — zero-count unselected rows render disabled with
      count 0; (2) chooser/catalog tiles use a session presence-latch: once
      shown they never unmount, dimming with "No matches with this rule" /
      "Narrowed out by this rule" instead. Verified live at 1920: selecting
      Mirrored+Swapped keeps all 7 LOOP options (quartered/Rewound disabled
      at 0) and all 10 catalog tiles (Grid mode disabled, no shift).
- [~] B4 (2×: D-12, C-22) PARTIAL: Recently added/Favorites chooser subtitles
      now say "applies instantly" in the builder, and the tiles are latched
      like the rest. The rail (which hides subtitles) still gives no cue —
      revisit with C5's rail redesign. W3 workbench variant still owed.
- [x] B5 (2×: D-8, X-11) FIXED: a picker-rule strip (match count + editable
      chips) renders above the drill whenever the picker is open with an
      active rule, at every width. Verified at 1920 ("31 matches | Mirrored |
      Swapped"). Note: the "stale" preview-header count claim was a misread —
      the header shows the CURRENT rule's count, which is correct while
      browsing options; it only changes when a filter is applied.
- [x] B6 (3×: X-7, D-9, C-7) FIXED: FilterChipBase extended with a split
      `onremove` segment (shared-primitive extension, not a fork). Chip body
      now EDITS (reopens the picker on that filter's own editor via a
      remount seed); the × segment removes, with error-tint hover. Verified
      live: "Edit Mirrored filter" / "Remove Mirrored filter", body click
      landed on the LOOPs editor.

## Phase C — Composition + scale (the structural work)

- [x] C1 (D-1 BLOCKER) ROOT CAUSE FOUND + FIXED: the editor COLUMN is
      deliberately width-capped (clamp(84rem, 46vw, 104rem) — Austen's
      "results absorb surplus" decision), so the drill container is ~1663px
      even at 3840 and every cqw clamp and the ≥2600 tier could never fire.
      Fix respects the width cap and adds HEIGHT-keyed scale tiers
      (min-height 1150 / 1900 + container ≥1200) inside the pane: heading
      32px, Length cards 163×224 → 276×384 in a 4+3 two-row composition
      (dead-above 800→81px), grid art 144→265px, labels 24px, numerals 80px,
      position pictographs 179px @2560, catalog rail 19.2px labels + restored
      inactive borders + wider column. Measured at 4224×2376 and 2816×1584
      (zoom-corrected); 1920×1080 and 1440×900 untouched by construction
      (height gate). Card-interior centering added for D-18. Full-frame
      composition shots at all four widths still owed in the final sweep.
- [ ] C2 (4×: X-8, C-4, C-5, F-15, F-17, F-19, D-18, C-18) Editors are dead
      canvas at nearly every viewport: content bands float mid-stage with
      large empty bands above/below (375 through 820); 960×412 cards are
      229px tall for ~60–110px of content; Length cards hold a ~100px interior
      hollow; per-option counts float detached below cards at 1920; Level
      examples illegible at 375 and absent at 960×412. Fix: editors use the
      canvas — anchor content, grow tiles, pull counts inside cards.
- [~] C3 (4×: C-2, D-2, D-3, F-6, F-7, F-8, D-11, X-21) SPLIT:
      COMPACT HALF FIXED — the fold tier's rule-over-results stacking now
      extends to phones (≤700px, height ≥640: rule 254px over an inline
      564px result pane at 412×960, screenshot-verified) and short landscape
      gets a side-by-side composition (960×412: rule column 384px beside a
      567×295 result pane, geometry verified). The full-screen preview stays
      behind "Preview N"; its stray "← Filters" back button is hidden while
      the inline preview is on screen.
      REMAINING — desktop few-results dead-end (D-2), 5-in-4-col orphans
      (D-3/F-7), ragged unequal-height preview rows (F-8/D-11/X-21), and
      832×750 card slicing (F-6) all live in the shared BrowsePanel virtual
      grid (mixed-height canonical T&D cards). That is shared browse-engine
      surgery that risks the main gallery — its own pass with its own
      verification, not a side effect here.
- [ ] C4 (F-4, F-5, F-10, F-13, F-16, C-3, C-10, C-11) Grid intentionality:
      Length wraps 2/3/2 at 820 and 4+2-with-hole at 375 six-value case;
      Position portrait uses half-empty list rows while landscape's 3-up grid
      is right; Level/Grid-mode editors inset their band AND drag Back inward
      while siblings don't; T&D 2-col at 820 breaks the Same/Opp row
      taxonomy; Length centers orphan rows while Letters left-aligns; letter
      final-row centering hardcoded to the 46-letter catalog; 375 vs 412 flip
      interaction patterns entirely (4 different mental models in 37px). Fix:
      pinned taxonomy-aware columns per tier, one orphan treatment, converge
      375/412, generalize letter centering.
- [x] C5 (D-10) FIXED inside the C1 tiers: rail column widens
      (17–21rem), titles 16→19.2px measured (24px at 4K tier), art 2.75rem+,
      inactive tiles get explicit borders back.

## Phase D — Polish + copy

- [ ] D1 (C-12) Start position is the only chooser tile with a bright white
      art plate — reads as selected/special.
- [ ] D2 (2×: C-13, D-13) Grid mode: Box hollow-rings are low-contrast vs
      Diamond's filled dots at small plates; dot STYLE differs as well as
      position, muddying the one comparison the screen exists to make.
      (D-13's SIZE half is fixed by C1 — art 265px at 4K; the contrast/style
      half remains and lives in GridSvg's mode styling.)
- [ ] D3 (D-14) Unlabeled density bar on every option tile reads as a
      progress/slider affordance.
- [ ] D4 (D-15) Step 3 "Add a filter": no indication which categories are
      already applied; stale subtitle ("Beginner to advanced" with Level 2
      applied) beside siblings whose counts DO update.
- [x] D5 (C-17) FIXED by B5's picker-rule strip: applied chips + live count
      render above the drill at every width whenever the picker is open with
      an active rule, so the chooser always confirms the rule survived.
- [x] D6 (X-18) FIXED: badge keeps its "Built in" text at every width (66px,
      opaque); the description stays visible at compact size. Verified at 375.
- [x] D7 (X-9) FIXED: .rule-facts is now flex with content-sized facts.
      Verified: 131px and 208px instead of two 824px slabs.
- [ ] D8 (D-20) T&D: "Tog"/"Opp" never expanded (label change would ripple to
      chips app-wide — needs a scoped decision). Heading half FIXED: now "Pick
      a Timing & Direction family".
- [x] D9 (F-18) FIXED: all six LOOP descriptions end in periods (normalized at
      the drill's option build).
- [ ] D10 (F-20) "Add filter" stretches to ~224px beside 78px chips.
- [x] D11 (X-20) FIXED in shared PanelState: "Try again" (sentence case),
      accent-filled primary treatment, 44px min height, focus ring. Verified
      on the detail error variant. (App-wide change — every error panel's
      retry gains the primary look.)
- [ ] D12 (2×: X-14, X-15) Preview a11y pollution: redundant per-letter glyph
      images not aria-hidden; ten empty "Saving to cloud" live regions in a
      read-only preview.
- [ ] D13 (X-25) Step 7 loading is a centered spinner, not a skeleton matching
      the result grid (`feedback_skeletons_must_match_layout`).
- [ ] D14 (D-16) 1440 chooser→editor: stage jumps 1320→1054px as the rail
      mounts. Reserve the rail's space across both states.
- [ ] D15 (C-14) Turn slider: filtered-out stops collapse to equal pixel
      spacing, silently lying about magnitude (≤2→≤3 same distance as
      ≤1→≤1.5).
- [ ] D16 (C-19) 412 Length rows: "steps" caption orphans left-aligned to the
      bar, repeated seven times.
- [ ] D17 (X-21/F-21 overlap) Variation pill overlaps card art on ragged
      preview rows (part of C3's grid fix; listed so it isn't lost).
- [ ] D18 (D-17) Creator example thumbnails are illegible smudges at desktop
      (112px row height from 1440 through 3840); stacks collide with count at
      1920.
- [ ] D19 (D-19) Step 1 entry tiles near-invisible border contrast on dark
      background (partially fixture-related, see W2).

## Needs Austen's ruling (defaults chosen, flag before ship)

- [ ] R1 (2×: X-22, F-21) The variation pill is the ONE live control inside
      "Preview only". Proposed default: keep it (44px, labeled,
      non-destructive, preview-consistent). Confirm or remove.
- [ ] R2 (X-24) Rule receipt says "Looks in Community" though the source
      toggle was deliberately removed. Proposed default: keep the truthful
      fact line. Confirm wording or drop it.
- [ ] R3 (X-23) First selection swaps the composition Catalog|Editor|Preview →
      Rule|Results and the catalog disappears. Both auditors judged it
      deliberate-looking; it IS one of the acceptance-test questions.
- [ ] R4 (D-24) Level editor offers 1/2/3 only; counts sum to the full pool so
      it is likely correct for current data. Verify against MCP before
      closing.

## Conflicts to resolve at code level (before fixing the area)

- [ ] V1: D-21/X measured T&D editor icons as designed PNG assets
      (`/images/elements/norm/*.png`); F-23 reports platform emoji (💧🍃☀️…)
      at fold/tablet. Likely two renderers (editor vs chooser tile/rail).
      Verify in code, unify on the PNG assets.
- [ ] V2: F-22 notes fold-open portrait/landscape share one chooser
      composition (contra the per-fold-state decision) but both fit well.
      Decide: acceptable near-square siblings, or differentiate.

## Workbench (not product) fixes

- [ ] W1 (C-21, F-25) Screenshot race: frames captured before modal
      mount/settle read as blank or mid-transition; auditors had to add settle
      delays. Add a settled signal (e.g. data attribute) for automated sweeps.
- [ ] W2 (X-19, F-24, C-20) Step 1/5 fixture stages add dead chrome
      (838px panel around a 560px form; 300px-clamped entry stage) that reads
      as product defects. Make fixture stages hug content.
- [ ] W3 (C-22) No workbench variant exercises "Recently added" — add one.

## Evidence trail

- Compact: 69 frames `audit-compact/` · Fold/tablet: 69 frames
  `audit-foldtablet/` · Desktop: full matrix `audit-desktop/` · Cross-cutting:
  `audit-crosscut/`.
- All partitions: zero app console errors (known noise: debug static-manifest
  404s, DevTools CSP eval).
- All partitions bypassed the scaled workbench iframe and loaded the frame
  route (`?frame=1&surface=…&variant=…`) at 1:1 with zoom-corrected emulation
  (nominal × 1.1, `innerWidth` verified) — reusable method for verification
  passes.
- Cross-cutting PASS list (Back semantics, catalog switching, multi-select
  aria, T&D icon decision in the editor, slider a11y, Escape-when-dirty,
  suggested-name flow, reduced motion, compact touch targets) is recorded in
  the session transcript; do not re-break these while fixing.
