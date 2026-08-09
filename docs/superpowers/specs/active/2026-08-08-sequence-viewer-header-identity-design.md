# Sequence Viewer Header Identity

**Status:** Approved for implementation on 2026-08-08  
**Surfaces:** Viewer drawer, QR viewer, and `/sequence/[id]`

## Problem

The center of the viewer header currently names whichever tool is open. It can
read `Sequence Viewer`, `Animation Export`, or `Record Scene` while the same
sequence remains on screen. That makes the header identity unstable and gives
secondary workflow state the most prominent position.

The actions around that title also use several visual languages. Favorite,
Save, Remix, Share, and Close differ in shape, color, borders, and density.
Copy Data and Make Public or Make Private stay in More even when a desktop row
has enough space for them. The title itself also doubles as the sequence action
menu, mixing word actions with document and management actions.

## Decision

The centered identity is the full simplified TKA word. It uses the animation
engine's existing WordHeader behavior, including active-letter highlighting,
and does not change when the user switches views or opens an export workflow.

Inside the sequence viewer, the live 2D canvas suppresses its duplicate DOM
word band. The animation export pipeline keeps its independent word-header
visibility setting, so the word can still be baked into exported video without
appearing twice in the viewer.

Selecting the word opens only word actions:

- Copy word
- Read aloud

More remains a separate, explicit overflow button. It contains actions that are
rare, destructive, unavailable at the current width, or specific to a host.

The action row uses one 44px control grammar. Neutral actions share the same
surface, border, radius, icon weight, focus ring, and hover treatment. State is
shown with semantic color. Share remains the primary action. Close remains a
neutral utility action and gains an error-colored hover state.

## Header hierarchy

| Area   | Contents                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Left   | Back or Exit Practice when supplied by the host; otherwise Favorite, Library, Remix, Practice, motion visibility, Copy Data, visibility, and More according to width and permissions |
| Center | Full TKA word with active-letter highlighting and a small disclosure indicator for word actions                                                                                      |
| Right  | Account entry when applicable, export settings when applicable, Share, and Close                                                                                                     |

Export and recording state belongs inside the body and export controls. The
word remains the header identity throughout those workflows.

## Responsive behavior

### Full desktop, 1840 CSS px and wider

Eligible frequent actions show an icon and label. Copy Data appears directly
for admins. Make Public or Make Private appears directly for an owner with a
saved sequence. More holds Open TKA, Guide, Upload Video, Delete, and any host
specific action that does not belong in the frequent row.

The visibility action keeps its label collapsed until 2200 CSS px because it
is the only optional desktop action long enough to displace the centered word.

### Desktop, 1080 through 1839 CSS px

The same eligible actions remain direct, but they use icon-only controls with
tooltips and accessible names. This preserves the action hierarchy without
crowding the centered word.

### Compact, below 1080 CSS px

Practice, Share, More, and Close remain direct when they apply. Favorite,
Library, Remix, Copy Data, visibility, and management actions move into More.
The word stays centered as long as the physical controls leave a usable center
slot. On the narrowest account-enabled layout, the word glyph may reduce in
width but does not change to a workflow title.

## Stable states

- Favorite keeps a heart icon. The selected state uses the semantic favorite
  color and `aria-pressed`.
- Library keeps a bookmark icon. The saved state remains in place, becomes
  disabled, and uses the semantic success color.
- Remix uses the shared neutral action surface.
- Practice uses the theme accent because it changes the working mode.
- Copy Data keeps its width while the icon changes to a success check.
- Visibility reserves the wider label so Make Public and Make Private do not
  move neighboring controls.
- Share uses the existing shared ShareActionMenu behavior and the same geometry
  as the other header actions.
- Close uses the same neutral geometry, with an error-colored hover state.

## Ownership and reuse evidence

Search terms included `Copy word`, `Read aloud`, `WordLabel`,
`getPronunciationPlayer`, `WordHeader`, `wordHeader`, `highlightedStepIndex`,
`ShareActionMenu`, `header-action-btn`, `Copy Data`, and `Make Private`.

- Extend the workspace `WordLabel` word-action behavior into
  `src/lib/shared/choreo-card/components/WordActionMenu.svelte`. Both the
  workspace label and viewer header compose that owner. Clipboard,
  pronunciation, long press, right click, error reporting, and menu semantics
  stay in one place.
- Extend `src/lib/shared/sequence-viewer/components/ViewerHeader.svelte` as the
  presentation owner for viewer header chrome. It composes
  `ViewerOverflowMenu`, `ShareActionMenu`, `MotionVisibilityToggle`, and
  `buildHeaderActions` instead of reproducing their behavior.
- Extend the animation engine's `WordHeader.svelte` with a chrome presentation.
  ViewerHeader composes that owner for glyph loading, repeated-word
  simplification, entrance motion, and active-letter highlighting. The live
  canvas uses its existing `hideHeader` seam; export visibility state is not
  changed.
- Keep `SequenceViewerShell.svelte` as the owner of the overall viewer chrome.
  The header is an internal section composed by the shell.
- Migrate `/sequence/[id]` to `SequenceViewerShell` so it no longer imports and
  assembles viewer internals. Route-only SEO context and swipe dismissal pass
  through narrow shell seams.

This follows current toolbar guidance: frequent actions remain visible,
overflow is used when actions do not fit, and overflow items keep text labels.
The word and More controls follow the ARIA menu-button disclosure pattern.

References:

- [Fluent 2 Toolbar usage](https://fluent2.microsoft.design/components/web/react/core/toolbar/usage)
- [WAI-ARIA Menu Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)

## Planned files

- `src/lib/shared/choreo-card/components/WordActionMenu.svelte`
- `src/lib/features/create/shared/workspace-panel/sequence-display/components/WordLabel.svelte`
- `src/lib/shared/sequence-viewer/components/ViewerHeader.svelte`
- `src/lib/shared/sequence-viewer/components/SequenceViewerShell.svelte`
- `src/routes/sequence/[id]/SequenceViewerPage.svelte`
- `tests/unit/sequence-viewer-shell-contract.test.ts`
- Focused component tests for the shared word actions

## Risks

- A centered word can collide with asymmetric action groups. The header uses
  equal outer grid tracks and explicit density tiers, then viewport
  verification checks the center slot.
- Dynamic labels can shift neighboring controls. Ghost sizing or reserved
  widths cover feedback and visibility labels.
- Moving word actions can regress pointer or keyboard access. Existing
  workspace tests continue through the new shared owner and focused tests cover
  click, right click, long press, clipboard, and pronunciation.
- The legacy route currently owns swipe and fullscreen behavior. Its migration
  preserves those host behaviors through shell props and keeps its loading,
  SEO, URL, and handoff logic in the route.

## Verification

1. Run the focused word-action and shell-contract tests with the repository
   Vitest configuration.
2. Run the project type check after the shared-symbol refactor.
3. Use the shared authenticated Chrome DevTools target and inspect the viewer
   at 1920x1080, 2560x1440, 3840x2160, 1440x900, 820x1180, 960x412, and
   375x667.
4. Measure the header center, action-group bounds, control sizes, and horizontal
   overflow. Capture WebP screenshots and inspect each frame.
5. Verify the word menu, More menu, direct desktop actions, Share menu, export
   transitions, and Close behavior without changing the browser window size.
