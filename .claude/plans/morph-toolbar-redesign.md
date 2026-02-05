# MorphToolbar Redesign Plan v2

## Final Design

**Footer buttons:**
```
[Save] [Copy Link] [Download]
                       ↓ morphs to full-width:
   [Image] [Animation] [Side-by-Side] [Compose→] | [✓ Done] [✕]
           ↑ live preview updates in viewer above
```

**Button behaviors:**
- **Save** - Saves to library (logged in only) - instant, no expansion
- **Copy Link** - Copies shareable URL to clipboard - instant, no expansion
- **Download** - Morphs footer to show format options with live preview

## Implementation Steps

### Step 1: Fix MorphChip click-to-collapse
**File:** `MorphChip.svelte`

Currently clicking anywhere on expanded chip calls collapse. Fix:
- Add `onclick` with `stopPropagation` to `.custom-content` div
- Clicks on buttons inside work normally
- Only clicking chip background or X button collapses

### Step 2: Hide chip-content when expanded
**File:** `MorphChip.svelte`

The label/value header wastes space when expanded. Add CSS:
```css
.chip.expanding.auto-height .chip-content {
  display: none;
}
```

### Step 3: Restructure ViewerMorphToolbar
**File:** `ViewerMorphToolbar.svelte`

**Collapsed state:**
```
[▶ Play] [Save] [Copy Link] [Download]
```

- Remove the BPM chip (playback controls move into Download's expanded state)
- Save = instant action
- Copy Link = instant action
- Download = triggers morph

**Expanded state (Download tapped):**
The entire footer becomes the morph chip showing:
```
[Image] [Animation] [Side-by-Side] [Compose→] | [✓ Done] [✕]
```

When expanded:
- Play button hides (`display: none`)
- Save button hides
- Copy Link button hides
- MorphChip takes full width

### Step 4: Format toggle buttons
**File:** `ViewerMorphToolbar.svelte`

Four format options as toggle buttons:
- **Image** - Static choreo card
- **Animation** - Animated GIF/video
- **Side-by-Side** - Both together
- **Compose→** - Opens Compose module (different action)

Visual treatment:
- Selected format has accent border/background
- Compose has arrow icon indicating navigation

### Step 5: Live preview coordination
**File:** `ViewerMorphToolbar.svelte` + parent coordination

When format is selected, emit event to parent:
```typescript
onPreviewModeChange?: (mode: 'image' | 'animation' | 'side-by-side' | null) => void;
```

Parent (SequenceViewer or ViewerFooter) updates the preview area above.

### Step 6: Done button action
**File:** `ViewerMorphToolbar.svelte`

Done button:
1. Gets currently selected format
2. Triggers download of that format
3. Collapses morph chip
4. Returns to normal footer

### Step 7: X button / Escape
**File:** `ViewerMorphToolbar.svelte`

X button or Escape key:
1. Cancels export mode
2. Collapses morph chip
3. Emits `onPreviewModeChange(null)` to restore normal preview
4. Returns to normal footer

## Component Structure

```
ViewerMorphToolbar
├── Collapsed state
│   ├── PlayButton
│   ├── SaveButton (instant)
│   ├── CopyLinkButton (instant)
│   └── DownloadButton (triggers expand)
│
└── Expanded state (MorphChip covers all)
    ├── FormatToggles
    │   ├── ImageToggle
    │   ├── AnimationToggle
    │   ├── SideBySideToggle
    │   └── ComposeButton (navigates away)
    ├── DoneButton
    └── CloseButton (X)
```

## Props Interface

```typescript
interface ViewerMorphToolbarProps {
  isPlaying: boolean;
  isLoggedIn: boolean;
  sequenceUrl: string; // For copy link

  onPlayPause: () => void;
  onSave: () => void;
  onExport: (format: 'image' | 'animation' | 'side-by-side') => void;
  onCompose: () => void;
  onPreviewModeChange?: (mode: 'image' | 'animation' | 'side-by-side' | null) => void;
}
```

Note: Removed all the BPM/tempo props since playback controls are no longer in this toolbar.

## Questions Resolved

1. **BPM controls** - Moving out of this toolbar. User can control playback from the animation itself or we add controls elsewhere.

2. **Mobile** - Will need similar treatment but separate implementation. Focus on mid-width first.

3. **Share behavior** - Copy Link is instant, no expansion needed.

## Files to Modify

1. `MorphChip.svelte` - Stop propagation, hide chip-content when expanded
2. `ViewerMorphToolbar.svelte` - Complete restructure
3. `ViewerFooter.svelte` - May need to pass new props, handle preview mode

## Testing Checklist

- [ ] Save button works (logged in)
- [ ] Copy Link copies URL to clipboard
- [ ] Download button expands morph chip to full width
- [ ] Format toggles are mutually exclusive (except Compose)
- [ ] Selecting format updates preview above
- [ ] Done triggers download of selected format
- [ ] X closes without downloading
- [ ] Escape key closes
- [ ] Clicking format buttons does NOT close morph
- [ ] Compose navigates to Compose module
- [ ] Works at Z Fold dimensions
- [ ] Collapsed state shows all buttons properly

## Risks

1. **Preview coordination** - Need to wire up parent component to respond to format selection. May require prop drilling or context.

2. **Export logic** - The actual export/download logic exists somewhere. Need to find it and wire it up to Done button.

3. **Compose navigation** - Need to understand how module navigation works to implement Compose button.

## Order of Implementation

1. MorphChip fixes (stop propagation, hide header) - LOW RISK
2. Restructure toolbar collapsed state - MEDIUM RISK
3. Implement expanded state with format toggles - MEDIUM RISK
4. Wire up preview mode changes - MEDIUM RISK
5. Wire up Done/export action - NEED TO INVESTIGATE
6. Test everything - HIGH IMPORTANCE
