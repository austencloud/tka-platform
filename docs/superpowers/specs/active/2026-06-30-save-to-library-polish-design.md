---
status: active
value: 3
effort: M
remaining: "Body status: Design (awaiting review)"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Save to Library — Polish Design

Date: 2026-06-30
Status: Design (awaiting review)
Surface: `SaveToLibraryPanel.svelte` (Create > Generate/Construct/etc. → "Save to Library")

## Problem

User feedback on the Save to Library panel (2026-06-30):

1. **Text weirdly sized** — the "Save to Library" wording / panel typography reads off, and the card footer text crowds itself.
2. **Wrong prop in the preview** — the preview pictographs show the default staff, not the prop the user has selected in settings.
3. **No mandalas or QR codes** — the card's empty info cell renders as a black hole; the user expects the QR / mandala that the viewer card shows.

## Root cause

The repo already has a documented **single source of truth** for card render settings:
`src/lib/shared/share/services/card-render-options.ts` → `buildCardRenderOptions()`.
Its header states it exists precisely so *"the card PREVIEW (ChoreoCard) and the exported PNG are two separate renderers"* don't drift on *"LOOP glyph, mandala, QR, grid, columns, start-layout."* Every card path is supposed to funnel through it.

Two callers were never migrated onto it:

- **The library save thumbnail.** `LibrarySaveService.generateAndUploadThumbnail` (`library-save-service.ts:267-324`) hand-builds `thumbnailOptions` from `DEFAULT_SHARE_OPTIONS` and passes them through `Sharer.getImageBlob` → `convertToRenderOptions` (`sharer.ts:165-185`), which sets `visibilityOverrides: { darkMode }` **only**. Result: the saved PNG has **no QR and no mandala** (`card-front-assembler.ts:296-302` gates both on `visibilityOverrides.showQRCode` / `.showMandala`). Prop is correct only by accident — the composer falls back to `appSettings.bluePropType/redPropType` (`image-composer.ts:182-195, 236-237`).
- **The panel preview.** `SaveToLibraryPanel.svelte:149-160` renders `<ChoreoCard>` passing **only** `includeStartPosition`. No prop types → preview renders default staff (concern #2). No `showQRCode`/`showMandala` → empty cell stays black (concern #3). Footer/word/level toggles are hardcoded `true` regardless of the user's actual save settings.

Composition defaults are `showQRCode: true` and `showMandala: true` (`image-composition-state.svelte.ts:78,81`), and the viewer/deck cards already render them via `buildCardRenderOptions`. The save path + preview are the only two that don't.

The screenshot is the panel's `isMobileLayout` branch (`save-panel-state.svelte.ts:88`, `panelWidth < 640`). Windows DPI scaling pushes the side panel under 640 CSS px, so it renders the full `ChoreoCard` instead of the desktop word-only view. The blue circular-arrows glyph at top-right is the `LOOPIconStrip` (`CardHeader.svelte:103-118`), not a control.

## Decisions (locked with user)

- **Preview fidelity:** keep the live interactive `ChoreoCard`, fed all real composition settings (not a static PNG).
- **Scope:** broader polish pass (the 3 fixes + general panel cleanup), not just the minimum.
- **Saved thumbnail QR/mandala:** **enable on saves.** Saved PNG matches the viewer card and composition defaults. Guests still get no QR (existing `project_qr_display_policy`). Ripple is limited: the main browse grid renders via `PropAwareThumbnail` (separate cloud-cached path), so only `thumbnails[0]` consumers (inbox-send card, share-sheet fallback) start showing QR/mandala — acceptable.
- **Desktop preview:** **always show the full card.** Drop the wide-panel word-only branch so "is the image right" is answerable on every screen.
- **Text target:** the "Save to Library" panel typography + the footer collision.

## Goals

- Preview is WYSIWYG: it renders the exact card the save will produce (prop, QR, mandala, word/number/level/user-info, LOOP glyph, columns, start layout).
- Saved library thumbnail embeds QR + mandala + the user's selected prop, per composition settings.
- Panel text reads cleanly; the card footer never overlaps itself or shifts layout.
- No regression to the guest QR policy, the gallery grid, or offline save.

## Non-goals

- Redesigning the composition-settings UI (the toggles themselves).
- Changing `PropAwareThumbnail` / the browse gallery render path.
- Changing the public-index / gallery sync behavior.

## Design

### Change 1 — Saved thumbnail funnels through `buildCardRenderOptions`

Reuse the existing single-source-of-truth builder rather than the lossy `ShareOptions` path.

- Add `Sharer.getCardImageBlob(sequence, { darkMode, userName, format })` that calls `buildCardRenderOptions(sequence, { darkMode, userName })`, spreads in output-format fields (stepSize/format/quality), and calls `renderService.renderSequenceToBlob`. This keeps the funnel rule intact and gives any future "render the user's card" caller one entry point.
- `generateAndUploadThumbnail` calls the new method instead of hand-building `thumbnailOptions`.
- Preserve cache reuse: the cached-preview lookup must key on the same options the preview `ChoreoCard` renders with, so a warm preview blob is reused on save (no double render). Plan-phase detail.

Result: saved PNG gains QR + mandala + correct prop + all toggles, sourced from the user's settings.

### Change 2 — Preview `ChoreoCard` mirrors the saved card

In `SaveToLibraryPanel.svelte`, drive the `<ChoreoCard>` from the same composition settings the save uses:

- `bluePropType={getSettings().bluePropType}`, `redPropType={getSettings().redPropType}` — fixes concern #2.
- `showQRCode={compositionManager.showQRCode}`, `showMandala={compositionManager.showMandala}` — ChoreoCard already resolves the single empty-cell choice internally (`effectiveInfoCell` via `resolveInfoCellDisplay`). Fixes concern #3.
- Replace hardcoded `showCreatorName/showBirthday/showNotes/showDifficultyLevel=true` with the real `compositionManager` values so the preview equals the saved file.
- Pass `columnCount` / start-layout consistent with `buildCardRenderOptions` so geometry matches.

To avoid a third hand-built options object, derive the ChoreoCard prop set from a shared helper aligned with `buildCardRenderOptions` (so preview + save can't drift again).

### Change 3 — Desktop always shows the full card

Remove the `isMobileLayout` word-only branch (`SaveToLibraryPanel.svelte:162-167`); always render the `ChoreoCard` preview. Verify the card contains within the desktop side panel (`.choreo-preview` is `flex:1; min-height:0`). Retire `.word-display` styles if unused.

### Change 4 — Text / typography (concern #1)

- Panel header `h2` + primary button hierarchy review (`SaveToLibraryPanel.svelte:398-403, 639-653`) — confirm the "Save to Library" title and button read at intentional, consistent scale.
- Footer collision (`CardFooter.svelte:101-104`): `footer-notes` is `position:absolute; left:50%; translateX(-50%)` while `footer-name` and `footer-birthday` flex — they overlap on a narrow card. Refit the footer as a 3-track grid (`name | notes | date`), each track `min-width:0` with ellipsis, so the three never overlap and the box never resizes when text changes (compliant with `no-layout-shift.md`). The canvas footer (`TextRenderer.renderUserInfo`) is a separate renderer, not shared code — if its three-up layout has the same overlap risk, apply the matching fix there so the preview and the saved PNG stay visually identical.

### Change 5 — Broader polish

- The empty black cell resolves itself once QR/mandala fill it (Changes 1+2).
- Tighten panel spacing/hierarchy and the community-toggle + "Add Notes" block. Use existing design tokens / primitives (`design_system_mandatory`); no new toggle primitives, no checkboxes.

## Reuse justification (never-hand-roll gate)

- **`buildCardRenderOptions`** — reusing the documented single source of truth; no new options builder. Grep: `card-render-options.ts` is already consumed by viewer/deck paths.
- **`ChoreoCard`** + `CardHeader`/`CardFooter`/`CardGridLayout` — reused as-is; only props passed change.
- **`resolveInfoCellDisplay`** — reused for the empty-cell QR-vs-mandala choice (already inside ChoreoCard).
- New code is limited to one `Sharer` method (a funnel, not a renderer) and prop wiring. No new components.

## Verification plan

- **Test page:** `src/routes/test/save-panel/` rendering the live `SaveToLibraryPanel` with a fixed sample sequence + prop/QR/mandala settings, for HMR iteration (per `visualization-routing.md`; no mockups).
- **Prop match:** set a non-staff prop in settings → preview pictographs + saved PNG both show it.
- **QR/mandala:** signed-in save of a 3-step LOOP → empty cell shows QR (or mandala per info-cell choice) in both preview and saved PNG; guest save → no QR (mandala if loopType present).
- **Footer:** narrowest card width → name / notes / date do not overlap; toggling dark mode / changing the date does not resize or shift the footer.
- **Desktop:** wide side panel shows the full card, contained, no clipping.
- **Regression:** `npm run check`; gallery grid unchanged; offline save still works (Dexie path untouched).

## Risks / ripples

- `thumbnails[0]` consumers (inbox-send card, share-sheet fallback) now show QR/mandala — intended per decision.
- Saved-thumbnail cache key changes when options change; must rekey carefully so existing warm previews still hit (plan detail).
- Footer grid refit touches a shared component (`CardFooter`) used by every card — verify no regression in viewer/deck/gallery footers.

## Out of scope

- Composition-settings UI redesign.
- Public-index / gallery sync changes.
- `PropAwareThumbnail` render path.
