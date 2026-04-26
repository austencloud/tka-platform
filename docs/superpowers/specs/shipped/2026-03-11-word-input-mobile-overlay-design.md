# Word Input Mobile Overlay — Design Spec

**Date:** 2026-03-11
**Problem:** On mobile, tapping the word input card in the Generate tab opens the device keyboard, which covers ~60% of the Generate button. No clear "done" action exists.
**Solution:** Focused overlay that takes over the screen during word entry, with a MobileInputToolbar above the keyboard providing a Done button.

---

## Interaction Flow

1. User taps word card on mobile → overlay opens with input auto-focused → keyboard appears
2. MobileInputToolbar appears above keyboard with "Done" button
3. User types their word (Greek key mapping works via existing `greekKeyMapper` service)
4. User taps Done → keyboard dismisses → overlay closes → word committed to state
5. Generate button is fully visible and tappable

Desktop: no change. Inline input stays as-is.

---

## Component Structure

### New Components

**`WordInputOverlay.svelte`** (`src/lib/features/create/generate/components/cards/WordInputOverlay.svelte`)
- Focused overlay view: backdrop + input field
- Semi-transparent backdrop (`rgba(0,0,0,0.5)`) dimming the cards behind
- Centered input card using `--theme-*` variables
- Auto-focuses input on mount
- Closes on: Done button, Enter key, backdrop tap, back button
- Reads/writes the same `word` state as the inline WordInputCard

### Moved to Shared

**`MobileInputToolbar.svelte`** — move from `src/lib/features/feedback/components/submit/` to `src/lib/shared/components/MobileInputToolbar.svelte`
- Already has: VirtualKeyboard API detection, visualViewport fallback, DevTools simulation guard, debounced height updates, Done button
- Update imports in feedback tab to point to new shared location
- No logic changes needed

### Modified Components

**`WordInputCard.svelte`**
- On mobile: tap opens overlay instead of focusing inline input
- On desktop: no change (inline input as-is)
- Uses `isMobile` from existing `generate-device.svelte.ts`

**`CardBasedSettingsContainer.svelte`**
- Hosts the `WordInputOverlay` component
- Passes word state and open/close callbacks

---

## State

One new reactive field in the existing generate state:

```
isWordInputOpen: boolean ($state, default false)
```

- `WordInputCard` sets to `true` on tap (mobile only)
- `WordInputOverlay` sets to `false` on Done/dismiss
- Same `word` state used by both inline and overlay views — no duplication

Mobile detection via existing `generate-device.svelte.ts` `isMobile` flag.

---

## Overlay Visual Design

- Backdrop: semi-transparent dark overlay dimming cards behind
- Input card: generous touch-friendly sizing, uppercase display matching current card style
- Typography: `--theme-*` variables, same font treatment as WordInputCard
- Animation: simple fade in/out, respects `prefers-reduced-motion`
- Toolbar: sits above keyboard with Done button (via MobileInputToolbar)

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Empty word on dismiss | Keep whatever was typed (matches current) |
| Enter key | Commits and closes overlay |
| Backdrop tap | Closes overlay, keeps current word |
| Back button | Closes overlay, keeps current word |
| Orientation change while open | Keyboard height recalculates via toolbar's viewport listener |

---

## Files Changed

| File | Change |
|------|--------|
| `WordInputOverlay.svelte` | **New** — focused overlay component |
| `MobileInputToolbar.svelte` | **Move** to `src/lib/shared/components/` |
| `WordInputCard.svelte` | Tap opens overlay on mobile |
| `CardBasedSettingsContainer.svelte` | Hosts overlay, passes state |
| `FeedbackForm.svelte` | Update import path for MobileInputToolbar |
| `FeedbackSubmitTab.svelte` | Update import path for MobileInputToolbar |
| Generate state factory | Add `isWordInputOpen` field |
