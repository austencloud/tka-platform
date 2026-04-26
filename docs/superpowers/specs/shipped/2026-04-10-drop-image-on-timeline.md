# Spec: Drop an image directly onto the pattern timeline

**Date:** 2026-04-10
**Status:** Ready for implementation
**Owner:** Next available sub-agent
**Estimated size:** Small (~1-2 hours)
**Priority:** Quick win — addresses a real UX friction point.

---

## Motivation

Today, to get an uploaded image onto the pattern timeline, the user has to do a two-step dance:

1. Drop the image onto the "upload zone" in `PatternPicker` (left column). This replaces the active pattern with the image.
2. Drag across beats on the timeline lane to paint a clip. The clip snapshots the (now image-based) active pattern.

This is unintuitive. The natural impulse — confirmed by the user in conversation — is to drag the PNG straight from the desktop onto the timeline lane and have it land as a clip right there, with no intermediate step.

This spec adds that direct interaction. The existing two-step flow still works; we're just adding a new path.

---

## Goals

- Let the user drag an image file from outside the browser directly onto the `.timeline-lane` element and have it become a new clip at the drop position.
- Show a visible ghost-preview of the drop region while the cursor is over the lane so the user knows what beats the clip will cover.
- Keep the left-column "active pattern" untouched when dropping on the timeline — the two are independent.
- Use the existing `insertClip` logic so dropping on top of an existing clip trims/splits cleanly, matching the paint-by-dragging behavior.

## Non-goals

- **No change to the disc/staff free-run behavior.** The active pattern stays whatever it was.
- **No raw-strip-mode toggle.** The dropped image goes through the same `fromImage` code path as the existing upload (tiled disc-mode). A "this is a strip-formatted image, not a disc" mode is a separate spec.
- **No resize handles on the dropped clip.** Default length is 4 beats, user can delete and re-paint if wrong.
- **No drop-to-replace of existing clips.** Overlap handling is the standard trim/split.

---

## Design

### Drop range

On drop, create a clip covering `[dropBeat .. min(dropBeat + 3, totalBeats)]` — a 4-beat span starting at the hovered beat, clamped to the timeline end.

Rationale: 4 beats = one musical measure = "a phrase". Feels natural. Easy to adjust by overpainting.

### Ghost preview

While a file is being dragged over the timeline lane, show the `.drag-preview` style (already defined in `PatternTimeline.svelte`) at the prospective drop range. Update it as the cursor moves. Hide it on `dragleave` or `drop`.

The same CSS class is already used by the click-drag paint flow, so the visual will be consistent.

### Separation from active pattern

The drop is a pure "add a clip" action. It must **not** call `poi.loadFromFile()` (which replaces the active pattern). Instead, it should:

1. Read the file into an `ImageData`.
2. Call `patternEngine.fromImage(imageData, ledCount)` to build a `StripPattern`.
3. Build a `PatternClip` directly and call `insertClip(patternTimeline, newClip)`.

This keeps the left-column authoring state independent of the timeline.

### Clip label

Use the file's basename (without extension) as the clip's `label` and leave `presetId` as `undefined`. Same convention as the paint-from-image flow after the bugfix in `poi-state.paintClip`.

---

## Data model changes

**None.** Uses existing `PatternClip`, `PatternTimeline`, and `insertClip`.

## State changes

Add one new action to `createPoiState` in `src/lib/features/poi/state/poi-state.svelte.ts`:

```typescript
/**
 * Build a StripPattern from an image file and drop it as a new clip
 * at the given beat range. Does NOT touch the active pattern — this
 * is a pure "add a clip" operation, independent of the left-column
 * authoring state.
 */
async function dropImageAsClip(
  file: File,
  startBeat: number,
  endBeat: number,
): Promise<PatternClip | null> {
  // Decode the file to ImageData (reuse the same dance as loadFromFile)
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();

  // Generate a fresh StripPattern — note this is a new pattern object,
  // unrelated to activePattern
  const pattern = patternEngine.fromImage(imgData, ledCount);
  pattern.metadata.name = file.name.replace(/\.[^.]+$/, "");
  pattern.metadata.source = "image-upload";
  pattern.metadata.sourceImagePath = file.name;

  // Clamp + normalize bounds
  const s = Math.max(1, Math.min(totalBeats, Math.round(startBeat)));
  const e = Math.max(1, Math.min(totalBeats, Math.round(endBeat)));
  const lo = Math.min(s, e);
  const hi = Math.max(s, e);

  const clip: PatternClip = {
    id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    startBeat: lo,
    endBeat: hi,
    pattern,
    presetId: undefined,
    label: pattern.metadata.name || file.name,
  };

  patternTimeline = insertPatternClip(patternTimeline, clip);
  return clip;
}
```

Expose via the returned object: `dropImageAsClip` in the Actions section.

## UI changes

Modify `src/lib/features/poi/components/PatternTimeline.svelte`:

### Add drag-hover state

```typescript
let fileDragOver = $state(false);
let fileDragStart = $state(0);
let fileDragEnd = $state(0);
```

### Handlers

```typescript
function handleDragOver(e: DragEvent): void {
  // Only respond to file drags (items with kind "file")
  if (!e.dataTransfer?.types.includes("Files")) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
  const beat = getBeatFromX(e.clientX);
  const DEFAULT_SPAN = 4;
  fileDragOver = true;
  fileDragStart = beat;
  fileDragEnd = Math.min(totalBeats, beat + DEFAULT_SPAN - 1);
}

function handleDragLeave(e: DragEvent): void {
  // Only clear when leaving the lane itself, not moving between children
  if (e.target === timelineEl) {
    fileDragOver = false;
  }
}

async function handleFileDrop(e: DragEvent): Promise<void> {
  e.preventDefault();
  fileDragOver = false;
  const file = e.dataTransfer?.files[0];
  if (!file || !file.type.startsWith("image/")) return;
  await poi.dropImageAsClip(file, fileDragStart, fileDragEnd);
}
```

### Wire to the lane

Add `ondragover`, `ondragleave`, `ondrop` to the existing `<div class="timeline-lane">`.

### Ghost preview

Add a second preview element that renders when `fileDragOver` is true, styled the same as `.drag-preview` but with a distinct border color (maybe a dashed green border with a `fas fa-image` icon) so it's visually distinct from the paint-to-create preview:

```svelte
{#if fileDragOver}
  <div
    class="file-drop-preview"
    style:left="{((Math.min(fileDragStart, fileDragEnd) - 1) / totalBeats) * 100}%"
    style:width="{((Math.abs(fileDragEnd - fileDragStart) + 1) / totalBeats) * 100}%"
  >
    <i class="fas fa-image" aria-hidden="true"></i>
  </div>
{/if}
```

CSS:

```css
.file-drop-preview {
  position: absolute;
  top: 4px;
  bottom: 4px;
  background: rgba(34, 197, 94, 0.15);
  border: 2px dashed rgba(34, 197, 94, 0.7);
  border-radius: 6px;
  pointer-events: none;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(34, 197, 94, 0.9);
  font-size: 16px;
}
```

---

## Files to touch

1. `src/lib/features/poi/state/poi-state.svelte.ts` — add `dropImageAsClip` action
2. `src/lib/features/poi/components/PatternTimeline.svelte` — add drag-over handlers + ghost preview

**No new files.** No domain type changes.

---

## Implementation plan

1. Add `dropImageAsClip` to `poi-state.svelte.ts` (mirror the `loadFromFile` decode steps, but build a `PatternClip` instead of setting `activePattern`).
2. Add drag-over / drag-leave / drop handlers to `PatternTimeline.svelte`.
3. Add `fileDragOver` state + ghost preview element.
4. Add CSS for `.file-drop-preview`.
5. Verify `npm run check` is clean for touched files.
6. Verify in browser: open `/lab/pov-pattern`, drag a PNG onto the lane from the filesystem, confirm the ghost preview tracks the cursor, confirm a clip appears at the drop point with the filename as label and the image as its pattern.

---

## Verification / acceptance criteria

- [ ] Dragging a file from the desktop over the lane shows a green ghost preview that tracks the cursor.
- [ ] Dropping creates a 4-beat clip at the drop point (clamped to timeline end).
- [ ] The clip's label is the filename (no extension).
- [ ] The clip's preview (the tiny 2D canvas inside the clip) shows the dropped image's pattern, not the active pattern.
- [ ] The active pattern in the left column is unchanged after the drop (disc and free-run staves still show whatever was active before).
- [ ] Dropping on top of an existing clip trims/splits the existing one (standard `insertClip` behavior).
- [ ] Dragging a non-image file (e.g. a .txt) over the lane shows no ghost preview (the dragover handler ignores it).

---

## Open questions

- **Should we also handle drag-over on individual clips to replace them?** Probably not in this spec — keep scope tight. Drop replacement is a separate concern.
- **Is 4 beats the right default span?** Easy to tweak later. If feedback suggests otherwise, make it a setting.
