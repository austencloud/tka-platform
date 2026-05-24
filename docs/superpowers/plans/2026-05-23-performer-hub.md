# Performer Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bottom-center PerformerRail + right-rail per-performer popovers with an integrated "Performer Hub" component anchored at the bottom-left of the 3D viewer. The hub combines performer selection (vertical spine) and per-performer controls (horizontal detail band) into one cohesive glass panel.

**Architecture:** Three new Svelte 5 components: `PerformerSpine` (vertical chip rail), `PerformerHubDetail` (three-column detail band), and `PerformerHub` (composition shell). The hub renders inside `ViewerSplitPane.svelte` in the `animation-3d` pane, replacing `PerformerRail`. The existing `RightRail.svelte` (top-right icon strip with popovers) stays for global/scene controls but dims when a performer is selected. No new state managers — reads/writes existing `viewer-3d-state` and `avatar-instance-state` APIs.

**Tech Stack:** Svelte 5 (runes), existing viewer-3d-context, existing effect-registry, performer-colors, PerformerPropSizeSlider, AvatarSettingsPanel

---

## Spec Corrections (discovered during research)

These corrections apply to `docs/superpowers/specs/2026-05-23-performer-hub-design.md`:

1. **Right rail is `RightRail.svelte`, not `Animation3DSidePanel.svelte`.** Animation3DSidePanel is dead code — not imported anywhere. RightRail is a compact popover icon strip at `position: absolute; top: 12px; right: 12px`. The dim behavior applies to RightRail.

2. **Per-performer speed doesn't exist.** `PerformerSettings` has no `speed` field. BPM is global (passed to `Viewer3DCanvas`). The detail band's Controls column should show **Prop Size** only (via existing `PerformerPropSizeSlider`). Speed bar is cut from this plan. If per-performer speed is wanted later, it needs new state infrastructure first.

3. **Detail band effect grid should reuse existing patterns.** The `EffectsSettingsPanel` already handles per-performer mode via `toPerformerEffect()` mapping. The hub's effect column should embed or closely follow this component's logic, not reinvent it.

---

## File Structure

### Create
| File | Responsibility |
|------|---------------|
| `src/lib/shared/3d/components/controls/PerformerSpine.svelte` | Vertical chip rail (All, performers 1-N, Add). Replaces horizontal PerformerRail. |
| `src/lib/shared/3d/components/controls/PerformerHubDetail.svelte` | Three-column detail band (Identity, Controls, Effects). Visible when a performer is selected. |
| `src/lib/shared/3d/components/controls/PerformerHub.svelte` | Composition shell — positions spine + detail band as one glass panel at bottom-left. |

### Modify
| File | Change |
|------|--------|
| `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` | Swap `PerformerRail` import for `PerformerHub` (line 21 import, line 373 render) |
| `src/lib/shared/sequence-viewer/components/RightRail.svelte` | Add dim state: `opacity: 0.3; pointer-events: none` when `selectedPerformerIndex !== null` |

### Delete (after visual approval)
| File | Reason |
|------|--------|
| `src/lib/shared/3d/components/controls/PerformerRail.svelte` | Replaced by PerformerSpine inside PerformerHub |

---

## Task 1: PerformerSpine — Vertical Chip Rail

**Files:**
- Create: `src/lib/shared/3d/components/controls/PerformerSpine.svelte`

This component is a vertical version of the existing `PerformerRail.svelte`. Same chip styles, same APIs, new layout direction.

- [ ] **Step 1: Create PerformerSpine.svelte**

```svelte
<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { STAGE } from "@austencloud/scene-3d";
  import { getPerformerColor } from "../../constants/performer-colors";

  const viewer = getViewer3DContext();
  const performers = $derived(viewer.performerManager.performers);
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const canAdd = $derived(performers.length < STAGE.MAX_VIEWER_PERFORMERS);

  function selectAll(): void {
    viewer.selectPerformerScope(null);
    viewer.closePopover();
  }

  function selectPerformer(i: number): void {
    const newIndex = selectedIndex === i ? null : i;
    viewer.selectPerformerScope(newIndex);
    if (newIndex === null) viewer.closePopover();
  }

  function addPerformer(): void {
    viewer.spawnPerformerFromUI();
  }
</script>

{#if performers.length >= 1}
  <div class="performer-spine" role="toolbar" aria-label="Performer selection">
    <button
      class="spine-chip add-chip"
      aria-label="Add performer"
      data-tooltip="Add"
      disabled={!canAdd}
      onclick={addPerformer}
    >
      <i class="fas fa-plus"></i>
    </button>

    <div class="separator" aria-hidden="true"></div>

    {#each [...performers].reverse() as _, ri (performers.length - 1 - ri)}
      {@const i = performers.length - 1 - ri}
      {@const color = getPerformerColor(i)}
      <button
        class="spine-chip performer-chip"
        aria-pressed={selectedIndex === i}
        aria-label="Performer {i + 1}"
        data-tooltip="P{i + 1}"
        style:--performer-color={color}
        onclick={() => selectPerformer(i)}
      >
        <span class="performer-number">{i + 1}</span>
        <span class="performer-dot"></span>
      </button>
    {/each}

    <div class="separator" aria-hidden="true"></div>

    <button
      class="spine-chip all-chip"
      aria-pressed={selectedIndex === null}
      aria-label="All performers"
      data-tooltip="All"
      onclick={selectAll}
    >
      <i class="fas fa-users"></i>
    </button>
  </div>
{/if}

<style>
  .performer-spine {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 6px;
  }

  .spine-chip {
    width: 48px;
    height: 48px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.62);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
    flex-shrink: 0;
  }

  .spine-chip:hover:not(:disabled) {
    transform: scale(1.08);
    border-color: rgba(255, 255, 255, 0.22);
  }

  .spine-chip:hover:not(:disabled)::after {
    content: attr(data-tooltip);
    position: absolute;
    left: calc(100% + 10px);
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    white-space: nowrap;
    pointer-events: none;
  }

  .spine-chip i {
    font-size: 18px;
  }

  .spine-chip:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* All chip */
  .all-chip[aria-pressed="true"] {
    background: color-mix(in srgb, #4a9eff 18%, transparent);
    border-color: color-mix(in srgb, #4a9eff 50%, transparent);
    color: #8fc3ff;
    box-shadow: 0 4px 20px color-mix(in srgb, #4a9eff 25%, transparent);
  }

  /* Performer chip */
  .performer-chip {
    position: relative;
  }
  .performer-number {
    font-size: 18px;
    font-weight: 700;
    line-height: 1;
  }
  .performer-dot {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--performer-color);
  }
  .performer-chip[aria-pressed="true"] {
    border-color: var(--performer-color);
    box-shadow: 0 4px 20px color-mix(in srgb, var(--performer-color) 30%, transparent);
  }
  .performer-chip[aria-pressed="true"] .performer-number {
    color: var(--performer-color);
  }
  .performer-chip[aria-pressed="true"] .performer-dot {
    box-shadow: 0 0 8px var(--performer-color);
  }

  /* Add chip */
  .add-chip {
    border-style: dashed;
  }

  /* Separator */
  .separator {
    width: 32px;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }
</style>
```

- [ ] **Step 2: Verify no type errors**

Run: `npx svelte-check --threshold error --filter src/lib/shared/3d/components/controls/PerformerSpine.svelte`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/controls/PerformerSpine.svelte
git commit -m "feat(performer-hub): add PerformerSpine vertical chip rail"
```

---

## Task 2: PerformerHubDetail — Three-Column Detail Band

**Files:**
- Create: `src/lib/shared/3d/components/controls/PerformerHubDetail.svelte`

The detail band shows per-performer controls in three columns: Identity, Controls (prop size), Effects (chip grid). Only renders when a performer is selected.

- [ ] **Step 1: Create PerformerHubDetail.svelte**

```svelte
<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { getPerformerColor } from "../../constants/performer-colors";
  import PerformerPropSizeSlider from "./PerformerPropSizeSlider.svelte";
  import { EFFECTS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
  import type { EffectId } from "../../state/performer-settings-types";
  import { AVATAR_DEFINITIONS, type AvatarId } from "@austencloud/scene-3d";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);

  const performer = $derived.by(() => {
    if (selectedIndex === null) return null;
    return viewer.performerManager.performers[selectedIndex] ?? null;
  });

  const color = $derived(selectedIndex !== null ? getPerformerColor(selectedIndex) : "#6b7280");

  // Avatar info
  const avatarName = $derived.by(() => {
    if (!performer) return "";
    const def = AVATAR_DEFINITIONS.find((d) => d.id === performer.avatarModelId);
    return def?.name ?? "Avatar";
  });

  // Sequence info from the performer's loaded sequence
  const seqLabel = $derived.by(() => {
    if (!performer) return "";
    const seq = performer.sequence;
    if (!seq) return "No sequence";
    const word = seq.word || "Sequence";
    const beats = seq.steps?.length ?? 0;
    return `${word} · ${beats} beats`;
  });

  // Per-performer effect chip grid.
  // Only effects representable in EffectId union are shown.
  // Maps: zap -> electricity, hides echo/water/bubbles/petals/smoke/ink.
  type EffectChip = { key: string; effectId: EffectId; label: string; icon: string; color: string };

  const PER_PERFORMER_EFFECTS: EffectChip[] = (() => {
    const hidden = new Set(["echo", "water", "bubbles", "petals", "smoke", "ink"]);
    const chips: EffectChip[] = [];
    for (const e of EFFECTS) {
      if (hidden.has(e.id)) continue;
      const effectId: EffectId = e.id === "zap" ? "electricity" : (e.id as EffectId);
      chips.push({
        key: e.id,
        effectId,
        label: e.label,
        icon: e.icon.replace(/^fa-/, ""),
        color: e.color,
      });
    }
    // Add frost, silk, pulse from EFFECTS (they're already in the registry)
    // Add motion as the final chip
    chips.push({
      key: "motion",
      effectId: "motion",
      label: "Motion",
      icon: "wind",
      color: "#22d3ee",
    });
    return chips;
  })();

  function isEffectEnabled(eid: EffectId): boolean {
    if (!performer) return false;
    return performer.effectiveEffects.has(eid);
  }

  function toggleEffect(eid: EffectId): void {
    performer?.toggleEffect(eid);
  }

  function changeAvatar(id: AvatarId): void {
    performer?.setAvatarModel(id);
  }

  let showAvatarPicker = $state(false);
</script>

{#if performer && selectedIndex !== null}
  <div class="hub-detail" style:--hub-accent={color}>
    <!-- Column 1: Identity -->
    <div class="col identity-col">
      <div class="avatar-circle" style:border-color={color}>
        <span class="avatar-initials">{avatarName.slice(0, 2).toUpperCase()}</span>
      </div>
      <div class="identity-info">
        <span class="performer-name">{avatarName}</span>
        <span class="seq-label">{seqLabel}</span>
        <span class="performer-badge" style:background={color}>P{selectedIndex + 1}</span>
      </div>
      <button class="change-avatar-btn" onclick={() => (showAvatarPicker = !showAvatarPicker)}>
        Change Avatar
      </button>
      {#if showAvatarPicker}
        <div class="avatar-picker">
          {#each AVATAR_DEFINITIONS as def}
            <button
              class="avatar-option"
              class:active={performer.avatarModelId === def.id}
              onclick={() => { changeAvatar(def.id); showAvatarPicker = false; }}
            >
              {def.name}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Column 2: Controls -->
    <div class="col controls-col">
      <span class="col-header">Controls</span>
      <PerformerPropSizeSlider {performer} />
    </div>

    <!-- Column 3: Effects -->
    <div class="col effects-col">
      <span class="col-header">Effects</span>
      <div class="effect-grid">
        {#each PER_PERFORMER_EFFECTS as effect}
          {@const enabled = isEffectEnabled(effect.effectId)}
          <button
            class="effect-chip"
            class:active={enabled}
            style="--eff-color: {effect.color}"
            onclick={() => toggleEffect(effect.effectId)}
            aria-pressed={enabled}
            aria-label="{effect.label} effect"
          >
            <i class="fas fa-{effect.icon}" aria-hidden="true"></i>
            <span>{effect.label}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .hub-detail {
    display: flex;
    gap: 1px;
    padding: 12px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    min-height: 0;
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .col-header {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.4);
  }

  /* Identity column */
  .identity-col {
    width: 160px;
    flex-shrink: 0;
    padding-right: 14px;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
  }

  .avatar-circle {
    width: 40px;
    height: 44px;
    border-radius: 10px;
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.06);
  }

  .avatar-initials {
    font-size: 14px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.8);
  }

  .identity-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .performer-name {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .seq-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.45);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }

  .performer-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: fit-content;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 800;
    color: white;
    letter-spacing: 0.06em;
  }

  .change-avatar-btn {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.55);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 6px 10px;
    cursor: pointer;
    transition: all 150ms;
    min-height: 32px;
  }

  .change-avatar-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }

  .avatar-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .avatar-option {
    font-size: 11px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 150ms;
  }

  .avatar-option:hover {
    background: rgba(255, 255, 255, 0.12);
    color: white;
  }

  .avatar-option.active {
    border-color: var(--hub-accent);
    color: var(--hub-accent);
    background: color-mix(in srgb, var(--hub-accent) 15%, transparent);
  }

  /* Controls column */
  .controls-col {
    width: 160px;
    flex-shrink: 0;
    padding: 0 14px;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
  }

  /* Effects column */
  .effects-col {
    flex: 1;
    min-width: 0;
    padding-left: 14px;
  }

  .effect-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .effect-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 6px 2px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.45);
    font-size: 9px;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms;
    min-height: 44px;
  }

  .effect-chip i {
    font-size: 12px;
    opacity: 0.5;
  }

  .effect-chip:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
  }

  .effect-chip:hover i {
    opacity: 0.8;
  }

  .effect-chip.active {
    background: color-mix(in srgb, var(--eff-color) 20%, transparent);
    border-color: var(--eff-color);
    color: rgba(255, 255, 255, 0.9);
  }

  .effect-chip.active i {
    color: var(--eff-color);
    opacity: 1;
  }
</style>
```

- [ ] **Step 2: Verify no type errors**

Run: `npx svelte-check --threshold error --filter src/lib/shared/3d/components/controls/PerformerHubDetail.svelte`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/controls/PerformerHubDetail.svelte
git commit -m "feat(performer-hub): add PerformerHubDetail three-column detail band"
```

---

## Task 3: PerformerHub — Composition Shell

**Files:**
- Create: `src/lib/shared/3d/components/controls/PerformerHub.svelte`

Composes PerformerSpine + PerformerHubDetail into one glass panel anchored at bottom-left. Detail band only appears when a performer is selected.

- [ ] **Step 1: Create PerformerHub.svelte**

```svelte
<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import PerformerSpine from "./PerformerSpine.svelte";
  import PerformerHubDetail from "./PerformerHubDetail.svelte";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const hasSelection = $derived(selectedIndex !== null);
  const performers = $derived(viewer.performerManager.performers);
</script>

{#if performers.length >= 1}
  <div class="performer-hub" class:expanded={hasSelection}>
    <div class="hub-glass">
      <div class="hub-layout">
        <PerformerSpine />
        {#if hasSelection}
          <PerformerHubDetail />
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .performer-hub {
    position: absolute;
    bottom: 16px;
    left: 16px;
    z-index: 20;
    max-width: calc(100% - 100px);
  }

  .hub-glass {
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .hub-layout {
    display: flex;
    flex-direction: row;
  }

  .performer-hub.expanded .hub-glass {
    border-radius: 14px;
  }
</style>
```

- [ ] **Step 2: Verify no type errors**

Run: `npx svelte-check --threshold error --filter src/lib/shared/3d/components/controls/PerformerHub.svelte`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/components/controls/PerformerHub.svelte
git commit -m "feat(performer-hub): add PerformerHub composition shell"
```

---

## Task 4: Visual Approval Gate — Render Hub Alongside Existing Rail

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` (line 21 imports, line 373 render)

Add the PerformerHub next to the existing PerformerRail so both are visible simultaneously. This is the checkpoint where Austen compares old vs new before approving the swap.

- [ ] **Step 1: Add PerformerHub import to ViewerSplitPane.svelte**

At line 21, after the PerformerRail import, add:

```typescript
import PerformerHub from "$lib/shared/3d/components/controls/PerformerHub.svelte";
```

- [ ] **Step 2: Render PerformerHub alongside PerformerRail**

At line 373, after `<PerformerRail />`, add on the next line:

```svelte
<PerformerHub />
```

Both components now render simultaneously in the 3D pane. PerformerRail stays at bottom-center, PerformerHub appears at bottom-left.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte
git commit -m "feat(performer-hub): render hub alongside existing rail for visual comparison"
```

- [ ] **Step 5: VISUAL CHECKPOINT — Austen reviews**

**Stop here and get visual approval from Austen.** Open the app at `localhost:5173`, navigate to the 3D viewer with multiple performers, and compare:
- Bottom-center: existing PerformerRail
- Bottom-left: new PerformerHub

**Austen must approve** before proceeding. If the hub doesn't meet visual standards, iterate on Tasks 1-3 until approved.

Ask: *"The hub is now rendering alongside the existing rail. Please open the 3D viewer with at least 2 performers and compare. Click performers in the hub to see the detail band. Does the visual quality meet your standards? What needs to change before I replace the old rail?"*

---

## Task 5: Swap — Replace PerformerRail with PerformerHub

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte`

Only execute this task after Austen has approved the visual quality in Task 4.

- [ ] **Step 1: Remove PerformerRail import**

In `ViewerSplitPane.svelte`, remove the import line:

```typescript
import PerformerRail from "$lib/shared/3d/components/controls/PerformerRail.svelte";
```

- [ ] **Step 2: Remove PerformerRail render**

In the `animation-3d` branch (around line 373), remove `<PerformerRail />`. Only `<PerformerHub />` remains.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte
git commit -m "feat(performer-hub): replace PerformerRail with PerformerHub"
```

---

## Task 6: Dim RightRail When Performer Selected

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/RightRail.svelte`

When a performer is selected (`selectedPerformerIndex !== null`), dim the right rail. Per-performer controls now live in the hub detail band, so the right rail's per-performer popovers are redundant when the hub is active.

- [ ] **Step 1: Add dim class logic**

In `RightRail.svelte`, the `selectedIndex` reactive already exists (line 26). Add a `dimmed` derived:

After line 27 (`const isIndividualMode = ...`), add:

```typescript
const dimmed = $derived(renderMode === "3d" && selectedIndex !== null);
```

- [ ] **Step 2: Apply dim class to the rail container**

On the `<div class="right-rail" ...>` element (line 48), add the dim class:

```svelte
class:dimmed
```

- [ ] **Step 3: Add dim CSS**

In the `<style>` section, add:

```css
.right-rail.dimmed {
  opacity: 0.3;
  pointer-events: none;
  transition: opacity 200ms ease-out;
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/RightRail.svelte
git commit -m "feat(performer-hub): dim right rail when performer selected"
```

---

## Task 7: Delete PerformerRail

**Files:**
- Delete: `src/lib/shared/3d/components/controls/PerformerRail.svelte`

Only after Task 5 is complete and verified.

- [ ] **Step 1: Verify no remaining imports of PerformerRail**

Run: `grep -r "PerformerRail" src/ --include="*.svelte" --include="*.ts"`
Expected: 0 matches (the import was already removed in Task 5)

- [ ] **Step 2: Delete the file**

```bash
rm src/lib/shared/3d/components/controls/PerformerRail.svelte
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add -u src/lib/shared/3d/components/controls/PerformerRail.svelte
git commit -m "chore(performer-hub): remove replaced PerformerRail component"
```

---

## Task 8: Detail Band Animation

**Files:**
- Modify: `src/lib/shared/3d/components/controls/PerformerHub.svelte`

Add smooth transitions for the detail band sliding in/out.

- [ ] **Step 1: Add slide transition**

In `PerformerHub.svelte`, import `slide` from `svelte/transition` and `cubicOut` from `svelte/easing`:

```typescript
import { slide } from "svelte/transition";
import { cubicOut } from "svelte/easing";
```

- [ ] **Step 2: Wrap the detail band conditional in a transition**

Replace the `{#if hasSelection}` block:

```svelte
{#if hasSelection}
  <div class="detail-enter" transition:slide={{ axis: "x", duration: 280, easing: cubicOut }}>
    <PerformerHubDetail />
  </div>
{/if}
```

- [ ] **Step 3: Add transition CSS**

```css
.detail-enter {
  overflow: hidden;
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/components/controls/PerformerHub.svelte
git commit -m "feat(performer-hub): add slide animation for detail band"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Full typecheck**

Run: `npm run check`
Expected: 0 errors

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Visual verification**

Open `localhost:5173` in browser. Navigate to 3D viewer. Test:

1. **Single performer**: Hub shows at bottom-left with spine only (All chip active)
2. **Add performer**: Click (+) chip, second performer appears in spine
3. **Select performer**: Click P1 chip → detail band slides in with identity, prop size slider, effects grid
4. **Toggle effect**: Click an effect chip in the detail band → effect toggles on performer
5. **Deselect**: Click All → detail band slides away, right rail un-dims
6. **Right rail dimming**: When P1 selected, right rail at `opacity: 0.3` and non-interactive
7. **Change avatar**: Click "Change Avatar" → picker shows, select different avatar

- [ ] **Step 4: Commit any final adjustments**

```bash
git add -A
git commit -m "feat(performer-hub): final polish and verification"
```
