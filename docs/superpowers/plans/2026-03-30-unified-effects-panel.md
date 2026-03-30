# Unified Effects Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace diverged Export and Effects Lab UIs with a single shared EffectsPanel component using progressive disclosure (presets for casual users, customize button for power users).

**Architecture:** One `EffectsPanel` component orchestrates effect selection, per-effect presets, and an optional customize view. It composes existing `TempoControl` and `TransportControls` for playback. Each effect type has a preset data file and a customize view that wraps its existing control panel. The component accepts props to show/hide Export-specific sections (FPS, resolution, timing, loops, download) and Lab-specific sections (source picker).

**Tech Stack:** Svelte 5, TypeScript, existing AnimationVisibilityStateManager, existing TempoControl + TransportControls components

**Spec:** `docs/superpowers/specs/2026-03-30-unified-effects-panel-design.md`

---

## File Structure

```
src/lib/shared/animation-engine/components/effects-panel/
├── EffectsPanel.svelte              # NEW: top-level orchestrator
├── EffectSelector.svelte            # NEW: 5 effect buttons (None/Fire/LED/Trails/Coal)
├── EffectPresetsSection.svelte      # NEW: preset grid + summary + customize button
├── presets/
│   ├── led-presets.ts               # NEW: LED preset definitions
│   ├── fire-presets.ts              # NEW: Fire preset definitions
│   ├── trail-presets.ts             # NEW: Trail preset definitions
│   ├── charcoal-presets.ts          # NEW: Charcoal preset definitions
│   └── types.ts                     # NEW: shared EffectPreset interface
├── customize/
│   ├── LedCustomize.svelte          # NEW: wraps LedSection for the customize flow
│   ├── FireCustomize.svelte         # NEW: wraps FireCategory for the customize flow
│   ├── TrailCustomize.svelte        # NEW: wraps TrailsCategory for the customize flow
│   └── CharcoalCustomize.svelte     # NEW: wraps CharcoalCategory for the customize flow

Files to modify:
- src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte
- src/lib/features/effects-lab/components/EffectsLabPlaybackHost.svelte
- src/lib/shared/animation-engine/components/animation-settings-modal/AnimationSettingsModal.svelte
```

---

## Task 1: Effect Preset Types + Data

**Files:**
- Create: `src/lib/shared/animation-engine/components/effects-panel/presets/types.ts`
- Create: `src/lib/shared/animation-engine/components/effects-panel/presets/led-presets.ts`
- Create: `src/lib/shared/animation-engine/components/effects-panel/presets/fire-presets.ts`
- Create: `src/lib/shared/animation-engine/components/effects-panel/presets/trail-presets.ts`
- Create: `src/lib/shared/animation-engine/components/effects-panel/presets/charcoal-presets.ts`

- [ ] **Step 1: Create shared types**

```typescript
// presets/types.ts
export interface EffectPreset {
  id: string;
  name: string;
  /** CSS color for the preview dot, or "rainbow" / "props" for special visuals */
  previewColor: string;
  /** Optional second color for dual-dot previews (e.g. "Prop Colors") */
  previewColor2?: string;
  /** Function to apply this preset via the visibility state manager */
  apply: (vm: any) => void;
}

export interface EffectPresetGroup {
  effectType: string;
  presets: EffectPreset[];
  /** One-line summary of current settings for display below presets */
  getSummary: (vm: any) => string;
}
```

- [ ] **Step 2: Create LED presets**

```typescript
// presets/led-presets.ts
import type { EffectPresetGroup } from "./types";

export const LED_EFFECT_PRESETS: EffectPresetGroup = {
  effectType: "led",
  presets: [
    {
      id: "green-glow",
      name: "Green Glow",
      previewColor: "#00ff88",
      apply: (vm) => {
        vm.setLedPrimaryColor("#00ff88");
        vm.setLedPatternId("solid");
        vm.setLedBrightness(4);
      },
    },
    {
      id: "ice-blue",
      name: "Ice Blue",
      previewColor: "#4488ff",
      apply: (vm) => {
        vm.setLedPrimaryColor("#4488ff");
        vm.setLedPatternId("solid");
        vm.setLedBrightness(4);
      },
    },
    {
      id: "rainbow",
      name: "Rainbow",
      previewColor: "rainbow",
      apply: (vm) => {
        vm.setLedPatternId("rainbow");
        vm.setLedBrightness(5);
      },
    },
    {
      id: "prop-colors",
      name: "Prop Colors",
      previewColor: "#4488ff",
      previewColor2: "#ff4444",
      apply: (vm) => {
        vm.setLedPatternId("solid");
        // Need to check if there's a method to set color mode
        // If not, set primary to blue and secondary to red
        vm.setLedPrimaryColor("#4488ff");
        vm.setLedBrightness(4);
      },
    },
  ],
  getSummary: (vm) => {
    const pattern = vm.getLedPatternId();
    const brightness = vm.getLedBrightness();
    const speed = vm.getLedPatternSpeed?.() ?? 1.0;
    return `${pattern.charAt(0).toUpperCase() + pattern.slice(1)} · Brightness ${brightness} · ${speed.toFixed(1)}x`;
  },
};
```

- [ ] **Step 3: Create fire, trail, charcoal presets**

Follow the same pattern. Read existing `FireControlsPanel.svelte`, `TrailControlsPanel.svelte`, `CharcoalControlsPanel.svelte` to understand what parameters each effect has, then create 4 presets for each that set sensible values.

Fire: Classic Fire, Blue Flame, Spirit Fire, Ghost Fire
Trails: Clean Trace, Soft Glow, Thin Line, Prop Match
Charcoal: Violet Ember, Hot Coal, Jade Dust, Ash

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: no new errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/presets/
git commit -m "feat(effects): add preset definitions for all 4 effect types"
```

---

## Task 2: EffectSelector Component

**Files:**
- Create: `src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte`

- [ ] **Step 1: Create the 5-button effect selector**

A row of 5 buttons: None, Fire, LED, Trails, Coal. Each 48px min-height. Active effect gets its accent color. Emits `onSelect(effectType)`.

Read `EffectPicker.svelte` at `src/lib/shared/animation-engine/components/animation-settings-modal/EffectPicker.svelte` and `EffectModeBar.svelte` at `src/lib/features/effects-lab/components/EffectModeBar.svelte` for reference. The new component should support all 5 states (including "none") and use the effect-specific accent colors:
- None: neutral
- Fire: #f97316
- LED: #22c55e
- Trails: #60a5fa
- Coal: #a855f7

Props:
```typescript
interface Props {
  activeEffect: string;
  onSelect: (effect: string) => void;
}
```

All buttons must meet 44px minimum touch target. Use `var(--theme-*)` CSS variables for base styling, effect colors for active states.

- [ ] **Step 2: Run typecheck**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte
git commit -m "feat(effects): add EffectSelector component with 5 effect buttons"
```

---

## Task 3: EffectPresetsSection Component

**Files:**
- Create: `src/lib/shared/animation-engine/components/effects-panel/EffectPresetsSection.svelte`

- [ ] **Step 1: Create the preset grid + summary + customize button**

This component renders:
1. "CHOOSE A LOOK" label
2. 2x2 grid of preset cards (80px min-height, tappable)
3. Current settings summary line (small dot + text)
4. "Customize [Effect] Settings" button (44px min-height, full width)

Props:
```typescript
interface Props {
  presetGroup: EffectPresetGroup;
  activePresetId: string | null;
  onSelectPreset: (presetId: string) => void;
  onCustomize: () => void;
  effectLabel: string; // "LED", "Fire", etc.
  accentColor: string; // effect-specific accent color
}
```

Each preset card shows:
- A visual preview (colored dot with glow, or special rendering for "rainbow" / dual-color)
- The preset name
- Active state with accent-colored border

The summary line reads from `presetGroup.getSummary(vm)`.

The customize button is a proper button element with 44px height.

- [ ] **Step 2: Run typecheck**

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/EffectPresetsSection.svelte
git commit -m "feat(effects): add EffectPresetsSection with preset grid and customize button"
```

---

## Task 4: Customize Views (LED, Fire, Trails, Charcoal)

**Files:**
- Create: `src/lib/shared/animation-engine/components/effects-panel/customize/LedCustomize.svelte`
- Create: `src/lib/shared/animation-engine/components/effects-panel/customize/FireCustomize.svelte`
- Create: `src/lib/shared/animation-engine/components/effects-panel/customize/TrailCustomize.svelte`
- Create: `src/lib/shared/animation-engine/components/effects-panel/customize/CharcoalCustomize.svelte`

- [ ] **Step 1: Create LedCustomize**

Wraps the existing LedSection content (color presets, pattern grid, speed, brightness) plus the advanced controls (glow radius, bloom, trail persistence, color mode) from LedControlPanel. Read both files:
- `src/lib/shared/animation-engine/components/animation-settings-modal/LedSection.svelte`
- `src/lib/features/effects-lab/components/LedControlPanel.svelte`

Include a "Back to presets" button at top (44px) to return to the preset view.

Props:
```typescript
interface Props {
  onBack: () => void;
}
```

- [ ] **Step 2: Create FireCustomize**

Read `src/lib/shared/animation-engine/components/animation-settings-modal/categories/FireCategory.svelte` and `src/lib/features/effects-lab/components/FireControlsPanel.svelte`. Combine into a single customize view with back button.

- [ ] **Step 3: Create TrailCustomize**

Read `src/lib/shared/animation-engine/components/animation-settings-modal/categories/TrailsCategory.svelte` and `src/lib/features/effects-lab/components/TrailControlsPanel.svelte`. Combine with back button.

- [ ] **Step 4: Create CharcoalCustomize**

Read `src/lib/shared/animation-engine/components/animation-settings-modal/categories/CharcoalCategory.svelte` and `src/lib/features/effects-lab/components/CharcoalControlsPanel.svelte`. Combine with back button.

- [ ] **Step 5: Run typecheck**

Run: `npm run check`

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/customize/
git commit -m "feat(effects): add customize views for all 4 effect types"
```

---

## Task 5: EffectsPanel Orchestrator

**Files:**
- Create: `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte`

- [ ] **Step 1: Create the top-level orchestrator**

This is the main component used by both Export and Lab. It manages which view is shown (presets vs customize) and composes all sub-components.

Props:
```typescript
interface Props {
  showExportControls?: boolean;  // FPS, resolution, timing, loops, download
  showSource?: boolean;          // Source picker (Lab only)
  advancedDefaultOpen?: boolean; // Whether customize views default to expanded
  // Export-specific callbacks/state
  onDownload?: () => void;
  isExporting?: boolean;
  estimatedTime?: string;
  // Slot for source section (Lab passes its own Source component)
}
```

State:
```typescript
let activeEffect = $state(/* from visibility manager */);
let customizeOpen = $state(false);
let activePresetId = $state<string | null>(null);
```

Layout (top to bottom):
1. **Playback section** (always): `TempoControl` centered + `TransportControls` centered below
2. **Source section** (if `showSource`): rendered via snippet/slot
3. **FPS + Resolution** (if `showExportControls`)
4. **EffectSelector**: 5 buttons
5. **If customizeOpen**: render the appropriate customize view (LedCustomize, FireCustomize, etc.)
6. **Else if effect is not "none"**: render `EffectPresetsSection` for the active effect
7. **Timing + Loops** (if `showExportControls`)
8. **Download button** (if `showExportControls`)

Import existing components:
```typescript
import TempoControl from "$lib/shared/sequence-viewer/components/TempoControl.svelte";
import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
```

All effect state reads/writes go through `AnimationVisibilityStateManager` via `getAnimationVisibilityManager()`.

- [ ] **Step 2: Run typecheck**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte
git commit -m "feat(effects): add EffectsPanel orchestrator component"
```

---

## Task 6: Wire EffectsPanel into ExportVideoDrawer

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte`

- [ ] **Step 1: Read ExportVideoDrawer.svelte thoroughly**

Understand the full sidebar structure (lines 469-681 for desktop, lines 203-466 for mobile). Note how FPS, resolution, timing, loops, and download are currently rendered.

- [ ] **Step 2: Replace the effect section with EffectsPanel**

In the desktop sidebar:
- Remove the old effect picker (EffectPicker), category sections (FireCategory, CharcoalCategory, LedSection, TrailsCategory)
- Remove the old TempoControl / BPM row
- Insert `<EffectsPanel showExportControls={true}>` which handles playback, effects, presets, AND the export controls (FPS, resolution, timing, loops, download)

Actually -- the FPS/resolution/timing/loops/download sections are currently part of ExportVideoDrawer's own template. The EffectsPanel needs to either:
(a) Accept these as slots/snippets from the parent, or
(b) Own the entire sidebar content

**Approach (a) is cleaner** -- EffectsPanel handles playback + effects + presets. The export-specific sections (FPS, resolution, timing, loops, download) stay in ExportVideoDrawer but move to render after EffectsPanel.

So the ExportVideoDrawer sidebar becomes:
```svelte
<EffectsPanel />
<!-- FPS, Resolution, Timing, Loops, Download stay here -->
```

- [ ] **Step 3: Remove old imports**

Remove imports for: EffectPicker, FireCategory, CharcoalCategory, LedSection, TrailsCategory. Add import for EffectsPanel.

- [ ] **Step 4: Handle mobile layout**

The mobile layout needs the same treatment. Check lines 203-466 for how effects are shown on mobile and wire EffectsPanel there too.

- [ ] **Step 5: Run typecheck + test**

Run: `npm run check && npx vitest run tests/unit/animation-engine/`

- [ ] **Step 6: Verify in browser**

Navigate to the sequence viewer → Download Animation panel. Verify:
- Centered playback controls render
- Effect selector shows 5 buttons
- Clicking LED shows 4 preset cards
- Clicking a preset applies it (check LED glow on canvas)
- "Customize" button opens full controls
- FPS, resolution, timing, loops, download still work

Take a screenshot to confirm.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte
git commit -m "feat(effects): wire EffectsPanel into ExportVideoDrawer"
```

---

## Task 7: Wire EffectsPanel into Effects Lab

**Files:**
- Modify: `src/lib/features/effects-lab/components/EffectsLabPlaybackHost.svelte`

- [ ] **Step 1: Read EffectsLabPlaybackHost.svelte thoroughly**

Understand how it currently renders: EffectModeBar (line 735), Source section, Playback (lines 747-761), and effect-specific panels (lines 764-795).

- [ ] **Step 2: Replace effect tabs + controls with EffectsPanel**

Remove: EffectModeBar, individual control panels (FireControlsPanel, CharcoalControlsPanel, LedControlPanel, TrailControlsPanel), and the playback section (TempoControl + TransportControls).

Insert EffectsPanel. The Lab needs source section above effects, so either:
- Pass the Source section as a snippet, or
- Keep Source in EffectsLabPlaybackHost and render EffectsPanel below it

The Lab also needs `advancedDefaultOpen={true}` so the customize view is more readily accessible.

- [ ] **Step 3: Remove old imports**

Remove imports for: EffectModeBar, FireControlsPanel, CharcoalControlsPanel, LedControlPanel, TrailControlsPanel, TempoControl, TransportControls. Add import for EffectsPanel.

- [ ] **Step 4: Run typecheck + test**

Run: `npm run check && npx vitest run tests/unit/animation-engine/`

- [ ] **Step 5: Verify in browser**

Navigate to Lab → Effects tab. Verify:
- Centered playback controls render
- Effect selector shows 5 buttons (including None)
- Source section still works
- Clicking LED shows presets
- Customize opens full LED controls
- LED glow renders on canvas

Take a screenshot to confirm.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/effects-lab/components/EffectsLabPlaybackHost.svelte
git commit -m "feat(effects): wire EffectsPanel into Effects Lab"
```

---

## Task 8: Wire EffectsPanel into AnimationSettingsModal

**Files:**
- Modify: `src/lib/shared/animation-engine/components/animation-settings-modal/AnimationSettingsModal.svelte`

- [ ] **Step 1: Read AnimationSettingsModal.svelte**

Understand how it uses EffectPicker (line 220) and the conditional category sections (lines 223-239).

- [ ] **Step 2: Replace EffectPicker + categories with EffectsPanel**

Remove EffectPicker and the conditional category rendering. Insert EffectsPanel in the controls section. This modal doesn't need export controls or source, so no extra props needed.

- [ ] **Step 3: Remove old imports, add EffectsPanel**

- [ ] **Step 4: Run typecheck**

Run: `npm run check`

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/animation-engine/components/animation-settings-modal/AnimationSettingsModal.svelte
git commit -m "feat(effects): wire EffectsPanel into AnimationSettingsModal"
```

---

## Task 9: Cleanup Old Components

**Files:**
- Delete: `src/lib/shared/animation-engine/components/animation-settings-modal/EffectPicker.svelte`
- Delete: `src/lib/shared/animation-engine/components/animation-settings-modal/LedSection.svelte`
- Delete: `src/lib/shared/animation-engine/components/animation-settings-modal/LedColorPresetRow.svelte`
- Delete: `src/lib/shared/animation-engine/components/animation-settings-modal/LedPatternGrid.svelte`
- Delete: `src/lib/features/effects-lab/components/EffectModeBar.svelte`

- [ ] **Step 1: Grep for imports of each file**

Before deleting, verify nothing else imports these files:
```bash
grep -r "EffectPicker" src/ --include="*.svelte" --include="*.ts"
grep -r "LedSection" src/ --include="*.svelte" --include="*.ts"
grep -r "LedColorPresetRow" src/ --include="*.svelte" --include="*.ts"
grep -r "LedPatternGrid" src/ --include="*.svelte" --include="*.ts"
grep -r "EffectModeBar" src/ --include="*.svelte" --include="*.ts"
```

Only delete files with zero remaining imports.

- [ ] **Step 2: Delete confirmed-orphaned files**

- [ ] **Step 3: Run typecheck + full test suite**

Run: `npm run check && npx vitest run tests/unit/animation-engine/`

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor(effects): remove old effect picker and control components replaced by EffectsPanel"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run full typecheck**

Run: `npm run check`

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`

- [ ] **Step 3: Run build**

Run: `npm run build`

- [ ] **Step 4: Browser verification — Export panel**

Open sequence viewer → Download Animation. Verify:
- Playback controls centered (BPM + transport)
- Effect selector with 5 buttons, all 48px+
- LED presets render when LED selected
- Preset cards tappable, canvas glow updates
- Customize opens full controls
- All touch targets >= 44px
- FPS, resolution, timing, loops, download work

Take screenshot.

- [ ] **Step 5: Browser verification — Effects Lab**

Open Lab → Effects. Verify:
- Same effect selector
- Source section works
- LED presets render
- Customize opens full controls
- LED glow renders on canvas

Take screenshot.

- [ ] **Step 6: Browser verification — Animation Settings Modal**

Open the gear icon on the sequence viewer. Verify:
- Effect selector renders
- Preset cards work
- Customize opens

Take screenshot.

- [ ] **Step 7: Commit any fixes**

```bash
git commit -m "fix(effects): resolve integration issues from final verification"
```
