# Alt Hotkey Overlay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace bare-key transforms with unified Alt+key shortcuts and add a hold-Alt overlay that shows all available bindings with clickable items.

**Architecture:** One new Svelte component (`AltHotkeyOverlay.svelte`) mounted in CreateModule.svelte. Keyboard changes happen in two existing files: `register-create-shortcuts.ts` (replace bare-key with Alt+key) and `ArrangeKeyboardHandler.ts` (remove transform handling). The overlay reads existing state via context and settings — no new services or state factories.

**Tech Stack:** Svelte 5 (runes, `$state`, `$derived`, `$effect`), TypeScript, existing ShortcutRegistry, existing PropTypeDisplayRegistry for prop SVGs.

**Spec:** `docs/superpowers/specs/2026-04-04-alt-hotkey-overlay-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/features/create/components/AltHotkeyOverlay.svelte` | **Create** | Alt key listener, overlay UI, clickable transforms + prop presets |
| `src/lib/shared/keyboard/utils/register-create-shortcuts.ts` | **Edit** | Remove bare-key transforms (lines 486–627), register Alt+key replacements |
| `src/lib/features/compose/tabs/arrange/services/implementations/ArrangeKeyboardHandler.ts` | **Edit** | Remove `KEY_TO_TRANSFORM` and `SHIFT_KEY_TO_TRANSFORM` maps + bare-key/shift handling (lines 16–28, 139–167) |
| `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/TransformSection.svelte` | **Edit** | Update hotkey badge labels in `rearrangeButtons` array (lines 33–89) |
| `src/lib/features/create/shared/components/CreateModule.svelte` | **Edit** | Import and mount `<AltHotkeyOverlay />` |

---

### Task 1: Remove bare-key transform shortcuts from register-create-shortcuts.ts

**Files:**
- Modify: `src/lib/shared/keyboard/utils/register-create-shortcuts.ts:486-627`

This task removes the old bare-key transform registrations and replaces them with Alt+key versions. The existing `condition` and `action` patterns are preserved — only `key`, `modifiers`, and `id`/`label`/`description` change. Two new shortcuts are added: Alt+L (rotate CCW, previously Shift+R) and Alt+V/Alt+I/Alt+F (previously only in Arrange).

- [ ] **Step 1: Remove the 5 bare-key transform registrations**

Delete the entire block from line 486 (`// ==================== Sequence Transforms ====================`) through line 627 (end of the `create.transform-rewind` registration). This removes:
- `create.transform-mirror` (bare M, line 490–515)
- `create.transform-swap-hands` (bare H, line 518–543)
- `create.transform-rotate-cw` (bare R, line 546–571)
- `create.transform-rotate-ccw` (Shift+R, line 574–598)
- `create.transform-rewind` (bare W, line 600–627)

- [ ] **Step 2: Add unified Alt+key transform registrations**

In the same location (after `// ==================== Sequence Transforms ====================` comment), add these 8 registrations. Each uses `modifiers: ["alt"]` and does NOT check `enableSingleKeyShortcuts` (Alt is a modifier, not a single key):

```typescript
// ==================== Sequence Transforms (Alt+key) ====================
// Unified hotkeys for sequence transforms — require Alt modifier to prevent accidental triggers.

// Alt+M - Mirror sequence (flip left/right)
service.register({
  id: "create.transform-mirror",
  label: "Mirror Sequence",
  description: "Mirror the sequence (flip left and right)",
  key: "m",
  modifiers: ["alt"],
  context: "create",
  scope: "sequence-management",
  priority: "medium",
  condition: () => {
    const ref = getCreateModuleRef();
    if (!ref) return false;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    return sequenceState?.hasSequence() ?? false;
  },
  action: async () => {
    const ref = getCreateModuleRef();
    if (!ref) return;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    if (!sequenceState?.hasSequence()) return;
    await sequenceState.mirrorSequence();
  },
});

// Alt+V - Flip sequence (top/bottom)
service.register({
  id: "create.transform-flip",
  label: "Flip Sequence",
  description: "Flip the sequence vertically (top and bottom)",
  key: "v",
  modifiers: ["alt"],
  context: "create",
  scope: "sequence-management",
  priority: "medium",
  condition: () => {
    const ref = getCreateModuleRef();
    if (!ref) return false;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    return sequenceState?.hasSequence() ?? false;
  },
  action: async () => {
    const ref = getCreateModuleRef();
    if (!ref) return;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    if (!sequenceState?.hasSequence()) return;
    await sequenceState.flipSequence();
  },
});

// Alt+S - Swap hands (swap colors)
service.register({
  id: "create.transform-swap-hands",
  label: "Swap Hands",
  description: "Swap hand movements (left becomes right, right becomes left)",
  key: "s",
  modifiers: ["alt"],
  context: "create",
  scope: "sequence-management",
  priority: "medium",
  condition: () => {
    const ref = getCreateModuleRef();
    if (!ref) return false;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    return sequenceState?.hasSequence() ?? false;
  },
  action: async () => {
    const ref = getCreateModuleRef();
    if (!ref) return;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    if (!sequenceState?.hasSequence()) return;
    await sequenceState.swapColors();
  },
});

// Alt+I - Invert direction
service.register({
  id: "create.transform-invert",
  label: "Invert Sequence",
  description: "Invert the motion direction of the sequence",
  key: "i",
  modifiers: ["alt"],
  context: "create",
  scope: "sequence-management",
  priority: "medium",
  condition: () => {
    const ref = getCreateModuleRef();
    if (!ref) return false;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    return sequenceState?.hasSequence() ?? false;
  },
  action: async () => {
    const ref = getCreateModuleRef();
    if (!ref) return;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    if (!sequenceState?.hasSequence()) return;
    await sequenceState.invertSequence();
  },
});

// Alt+F - Shift start beat
service.register({
  id: "create.transform-shift-start",
  label: "Shift Start",
  description: "Advance the starting beat of the sequence",
  key: "f",
  modifiers: ["alt"],
  context: "create",
  scope: "sequence-management",
  priority: "medium",
  condition: () => {
    const ref = getCreateModuleRef();
    if (!ref) return false;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    return sequenceState?.hasSequence() ?? false;
  },
  action: async () => {
    const ref = getCreateModuleRef();
    if (!ref) return;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    const sequence = sequenceState?.currentSequence;
    if (!sequence || sequence.steps.length <= 1) return;
    // Shift start: rotate steps so beat 1 moves to end
    const [first, ...rest] = sequence.steps;
    sequenceState.setCurrentSequence({ ...sequence, steps: [...rest, first!] });
  },
});

// Alt+W - Rewind/reverse sequence
service.register({
  id: "create.transform-rewind",
  label: "Rewind Sequence",
  description: "Reverse the sequence to return to start position",
  key: "w",
  modifiers: ["alt"],
  context: "create",
  scope: "sequence-management",
  priority: "medium",
  condition: () => {
    const ref = getCreateModuleRef();
    if (!ref) return false;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    return sequenceState?.hasSequence() ?? false;
  },
  action: async () => {
    const ref = getCreateModuleRef();
    if (!ref) return;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    if (!sequenceState?.hasSequence()) return;
    await sequenceState.rewindSequence();
  },
});

// Alt+R - Rotate clockwise 45°
service.register({
  id: "create.transform-rotate-cw",
  label: "Rotate Clockwise",
  description: "Rotate the sequence 45° clockwise",
  key: "r",
  modifiers: ["alt"],
  context: "create",
  scope: "sequence-management",
  priority: "medium",
  condition: () => {
    const ref = getCreateModuleRef();
    if (!ref) return false;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    return sequenceState?.hasSequence() ?? false;
  },
  action: async () => {
    const ref = getCreateModuleRef();
    if (!ref) return;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    if (!sequenceState?.hasSequence()) return;
    await sequenceState.rotateSequence("clockwise");
  },
});

// Alt+L - Rotate counter-clockwise 45°
service.register({
  id: "create.transform-rotate-ccw",
  label: "Rotate Counter-Clockwise",
  description: "Rotate the sequence 45° counter-clockwise",
  key: "l",
  modifiers: ["alt"],
  context: "create",
  scope: "sequence-management",
  priority: "medium",
  condition: () => {
    const ref = getCreateModuleRef();
    if (!ref) return false;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    return sequenceState?.hasSequence() ?? false;
  },
  action: async () => {
    const ref = getCreateModuleRef();
    if (!ref) return;
    const sequenceState = ref.CreateModuleState.getActiveTabSequenceState();
    if (!sequenceState?.hasSequence()) return;
    await sequenceState.rotateSequence("counterclockwise");
  },
});
```

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No type errors related to keyboard shortcuts.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/keyboard/utils/register-create-shortcuts.ts
git commit -m "refactor: replace bare-key transforms with Alt+key in Create module"
```

---

### Task 2: Remove transform handling from ArrangeKeyboardHandler

**Files:**
- Modify: `src/lib/features/compose/tabs/arrange/services/implementations/ArrangeKeyboardHandler.ts:16-28, 139-167`

The Arrange tab had its own transform key maps (`KEY_TO_TRANSFORM`, `SHIFT_KEY_TO_TRANSFORM`) that duplicate what the ShortcutRegistry now handles via Alt+key. Remove them while keeping all non-transform keyboard handling (arrow nav, delete, space, copy/paste, undo/redo).

- [ ] **Step 1: Remove the transform map constants**

Delete lines 16–28 (the `KEY_TO_TRANSFORM` and `SHIFT_KEY_TO_TRANSFORM` objects).

- [ ] **Step 2: Remove the transform dispatch block at the bottom of handleKeyDown**

Delete lines 139–167 — the block starting at `// Transform hotkeys — only when no Ctrl/Meta, cell selected with layers` through the final `return false;` of the method. Replace with just `return false;` to close the method.

Also remove the `break;` on line 111 (`// Bare "v" → fall through to transform handling below`) and replace with `return false;` since there's no longer a transform block to fall through to.

- [ ] **Step 3: Clean up unused import**

Remove the `TransformType` import from line 9 since it's no longer used in this file.

- [ ] **Step 4: Verify build**

Run: `npm run check`
Expected: No type errors. The `IArrangeKeyboardHandler` interface may still reference `TransformType` in the callbacks — if `transformLayer` is in the callbacks type, that's fine (it's still called from TransformSection click handlers).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/services/implementations/ArrangeKeyboardHandler.ts
git commit -m "refactor: remove bare-key transform handling from ArrangeKeyboardHandler"
```

---

### Task 3: Update TransformSection hotkey badges

**Files:**
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/TransformSection.svelte:33-89`

The `rearrangeButtons` array has `hotkey` strings displayed as tiny badges on each transform button. Update them to reflect the new Alt+key bindings.

- [ ] **Step 1: Update the hotkey field values**

In the `rearrangeButtons` array (line 26–89), change each `hotkey` value:

| Button | Old `hotkey` | New `hotkey` |
|--------|-------------|-------------|
| mirror (line 43) | `"M"` | `"Alt+M"` |
| flip (line 51) | `"V"` | `"Alt+V"` |
| swapColors (line 59) | `"S"` | `"Alt+S"` |
| invert (line 67) | `"I"` | `"Alt+I"` |
| shiftStart (line 75) | `"F"` | `"Alt+F"` |
| rewind (line 83) | `"\u21e7R"` (⇧R) | `"Alt+W"` |

Note: Rewind changes from Shift+R to Alt+W — both the key and the mnemonic change.

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/TransformSection.svelte
git commit -m "refactor: update TransformSection hotkey badges to Alt+key"
```

---

### Task 4: Build the AltHotkeyOverlay component

**Files:**
- Create: `src/lib/features/create/components/AltHotkeyOverlay.svelte`

This is the main new component. It listens for Alt keydown/keyup, renders the wide horizontal overlay, and makes each item clickable.

**Key references to read before implementing:**
- `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/TransformSection.svelte` — visual style to match
- `src/lib/shared/settings/components/tabs/prop-type/PresetChip.svelte` — how prop SVGs are rendered (rotation, cat/dog mode)
- `src/lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry.ts` — `getPropTypeDisplayInfo()` returns `{ label, image }` per prop type
- `src/lib/features/create/shared/context/create-module-context.ts` — `getCreateModuleContext()` for sequence state
- `src/lib/shared/navigation/state/navigation-state.svelte.ts` — `navigationState.setCurrentModule("settings", "props")` for the Edit button

- [ ] **Step 1: Create the component file**

Create `src/lib/features/create/components/AltHotkeyOverlay.svelte` with the full implementation:

**Script section:**
```typescript
<script lang="ts">
  import { container } from "$lib/shared/di";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { getCreateModuleContext } from "../shared/context/create-module-context";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import type { PropPreset } from "$lib/shared/settings/domain/AppSettings";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

  const ctx = getCreateModuleContext();

  let altHeld = $state(false);
  let visible = $state(false);
  let fadeOut = $state(false);

  // Read sequence state for transform enable/disable
  // $derived takes an expression, not a function
  const hasSequence = $derived(
    ctx.CreateModuleState.getActiveTabSequenceState()?.hasSequence() ?? false
  );

  // Read prop presets from settings
  const settingsState = container.items.settingsState;
  const presets = $derived<(PropPreset | null)[]>(
    settingsState?.settings?.propPresets ?? []
  );
  const selectedPresetIndex = $derived(
    settingsState?.settings?.selectedPresetIndex ?? 0
  );

  // Desktop-only check
  const isMobile = typeof window !== "undefined" && (
    "ontouchstart" in window || window.innerWidth < 768
  );

  // Transform definitions matching TransformSection visual language
  const transforms = [
    { type: "mirror", label: "Mirror", icon: "fa-left-right", color: "#60a5fa", bgTint: "rgba(59,130,246,0.12)", keyBg: "rgba(59,130,246,0.2)", keyBorder: "rgba(59,130,246,0.3)", keyColor: "#7ba3ff", key: "M" },
    { type: "flip", label: "Flip", icon: "fa-up-down", color: "#a78bfa", bgTint: "rgba(168,85,247,0.12)", keyBg: "rgba(168,85,247,0.2)", keyBorder: "rgba(168,85,247,0.3)", keyColor: "#b99aff", key: "V" },
    { type: "swapColors", label: "Swap", icon: "fa-right-left", color: "#fb7185", bgTint: "rgba(244,63,94,0.12)", keyBg: "rgba(244,63,94,0.2)", keyBorder: "rgba(244,63,94,0.3)", keyColor: "#ff8fa0", key: "S" },
    { type: "invert", label: "Invert", icon: "fa-circle-half-stroke", color: "#fbbf24", bgTint: "rgba(234,179,8,0.12)", keyBg: "rgba(234,179,8,0.2)", keyBorder: "rgba(234,179,8,0.3)", keyColor: "#fcd34d", key: "I" },
    { type: "shiftStart", label: "Shift", icon: "fa-step-backward", color: "#818cf8", bgTint: "rgba(99,102,241,0.12)", keyBg: "rgba(99,102,241,0.2)", keyBorder: "rgba(99,102,241,0.3)", keyColor: "#a5b4fc", key: "F" },
    { type: "rewind", label: "Rewind", icon: "fa-backward", color: "#34d399", bgTint: "rgba(16,185,129,0.12)", keyBg: "rgba(16,185,129,0.2)", keyBorder: "rgba(16,185,129,0.3)", keyColor: "#6ee7b7", key: "W" },
  ] as const;

  const rotateButtons = [
    { direction: "counterclockwise" as const, label: "CCW", icon: "fa-rotate-left", key: "L" },
    { direction: "clockwise" as const, label: "CW", icon: "fa-rotate-right", key: "R" },
  ];

  function isInputFocused(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
  }

  function getSequenceState() {
    return ctx.CreateModuleState.getActiveTabSequenceState();
  }

  async function executeTransform(type: string) {
    const seqState = getSequenceState();
    if (!seqState?.hasSequence()) return;

    switch (type) {
      case "mirror": await seqState.mirrorSequence(); break;
      case "flip": await seqState.flipSequence(); break;
      case "swapColors": await seqState.swapColors(); break;
      case "invert": await seqState.invertSequence(); break;
      case "rewind": await seqState.rewindSequence(); break;
      case "shiftStart": {
        const seq = seqState.currentSequence;
        if (seq && seq.steps.length > 1) {
          const [first, ...rest] = seq.steps;
          seqState.setCurrentSequence({ ...seq, steps: [...rest, first!] });
        }
        break;
      }
    }
  }

  async function executeRotate(direction: "clockwise" | "counterclockwise") {
    const seqState = getSequenceState();
    if (!seqState?.hasSequence()) return;
    await seqState.rotateSequence(direction);
  }

  async function applyPreset(index: number) {
    const preset = presets[index];
    if (!preset) return;
    settingsState.updateSettings({
      selectedPresetIndex: index,
      bluePropType: preset.bluePropType,
      redPropType: preset.redPropType,
      catDogMode: preset.catDogMode,
      blueBuugengFlipped: preset.blueBuugengFlipped,
      redBuugengFlipped: preset.redBuugengFlipped,
    });
  }

  function handleEditPresets() {
    altHeld = false;
    visible = false;
    navigationState.setCurrentModule("settings", "props");
  }

  function needsRotation(propType: string): boolean {
    return propType !== PropType.HAND;
  }

  // Alt key listener
  $effect(() => {
    if (isMobile || typeof window === "undefined") return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Alt") return;
      if (isInputFocused()) return;
      e.preventDefault();
      fadeOut = false;
      altHeld = true;
      visible = true;
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key !== "Alt") return;
      if (!altHeld) return;
      altHeld = false;
      fadeOut = true;
      setTimeout(() => {
        if (!altHeld) {
          visible = false;
          fadeOut = false;
        }
      }, 120);
    }

    // Dismiss if window loses focus while Alt held
    function onBlur() {
      if (altHeld) {
        altHeld = false;
        visible = false;
        fadeOut = false;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  });
</script>
```

**Template section:**
```svelte
{#if visible && !isMobile}
  <div
    class="alt-overlay"
    class:fade-out={fadeOut}
    role="toolbar"
    aria-label="Keyboard shortcuts (Alt held)"
  >
    <!-- Alt badge -->
    <div class="alt-badge-section">
      <span class="alt-key-badge">Alt</span>
      <span class="alt-hint">hold</span>
    </div>

    <div class="divider"></div>

    <!-- Rotate section -->
    <div class="section">
      <span class="section-label">Rotate</span>
      <div class="rotate-row">
        {#each rotateButtons as btn}
          <button
            class="rotate-btn"
            disabled={!hasSequence()}
            onclick={() => executeRotate(btn.direction)}
            title="Rotate {btn.label} (Alt+{btn.key})"
          >
            <span class="icon-badge rotate-icon">
              <i class="fas {btn.icon}" aria-hidden="true"></i>
            </span>
            <span class="item-label">{btn.label}</span>
            <span class="key-badge rotate-key">{btn.key}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="divider"></div>

    <!-- Transform section -->
    <div class="section">
      <span class="section-label">Transform</span>
      <div class="transform-row">
        {#each transforms as t}
          <button
            class="transform-item"
            disabled={!hasSequence()}
            onclick={() => executeTransform(t.type)}
            title="{t.label} (Alt+{t.key})"
          >
            <span class="icon-badge" style="background: {t.bgTint}; color: {t.color};">
              <i class="fas {t.icon}" aria-hidden="true"></i>
            </span>
            <span class="item-label">{t.label}</span>
            <span class="key-badge" style="background: {t.keyBg}; border-color: {t.keyBorder}; color: {t.keyColor};">{t.key}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="divider"></div>

    <!-- Prop presets section -->
    <div class="section section-grow">
      <div class="section-header">
        <span class="section-label">Props</span>
        <button class="edit-btn" onclick={handleEditPresets} title="Edit prop presets">
          <i class="fas fa-pen" aria-hidden="true"></i>
          Edit
        </button>
      </div>
      <div class="preset-row">
        {#each presets as preset, i}
          {@const displayKey = i === 9 ? "0" : String(i + 1)}
          {@const isSelected = i === selectedPresetIndex}
          <button
            class="preset-item"
            class:selected={isSelected}
            class:cat-dog={preset?.catDogMode}
            onclick={() => applyPreset(i)}
            title={preset ? `${getPropTypeDisplayInfo(preset.bluePropType).label} (Alt+${displayKey})` : `Empty slot (Alt+${displayKey})`}
          >
            {#if preset}
              <div class="preset-icon" class:no-rotate={!needsRotation(preset.bluePropType)}>
                {#if preset.catDogMode}
                  <img
                    src={getPropTypeDisplayInfo(preset.bluePropType).image}
                    alt=""
                    class="prop-svg blue-prop"
                  />
                  <img
                    src={getPropTypeDisplayInfo(preset.redPropType).image}
                    alt=""
                    class="prop-svg red-prop"
                  />
                {:else}
                  <img
                    src={getPropTypeDisplayInfo(preset.bluePropType).image}
                    alt=""
                    class="prop-svg"
                  />
                {/if}
              </div>
            {:else}
              <div class="preset-icon empty">
                <i class="fas fa-plus" aria-hidden="true"></i>
              </div>
            {/if}
            <span class="key-badge preset-key" class:selected-key={isSelected}>{displayKey}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}
```

**Style section:**
```css
<style>
  .alt-overlay {
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    max-width: 960px;
    width: calc(100% - 32px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.97));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 12px 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    gap: 20px;
    animation: slideDown 180ms ease-out;
    pointer-events: auto;
  }

  .alt-overlay.fade-out {
    animation: fadeUp 120ms ease-in forwards;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  @keyframes fadeUp {
    from { opacity: 1; transform: translateX(-50%) translateY(0); }
    to { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  }

  /* Alt badge */
  .alt-badge-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4px 0;
  }

  .alt-key-badge {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 4px 10px;
    font-family: monospace;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 600;
  }

  .alt-hint {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.12);
    margin-top: 4px;
  }

  /* Dividers */
  .divider {
    width: 1px;
    align-self: stretch;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  /* Sections */
  .section {
    flex-shrink: 0;
  }

  .section-grow {
    flex: 1;
    min-width: 0;
  }

  .section-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.2));
    font-weight: 600;
    margin-bottom: 6px;
    display: block;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .section-header .section-label {
    margin-bottom: 0;
  }

  /* Rotate row */
  .rotate-row {
    display: flex;
    gap: 4px;
  }

  .rotate-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 7px;
    cursor: pointer;
    color: inherit;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .rotate-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .rotate-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .rotate-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .rotate-icon {
    background: rgba(59, 130, 246, 0.12);
    color: #60a5fa;
  }

  .rotate-key {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.3);
    color: #7ba3ff;
  }

  /* Transform row */
  .transform-row {
    display: flex;
    gap: 4px;
  }

  .transform-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    min-width: 50px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 7px;
    cursor: pointer;
    color: inherit;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .transform-item:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .transform-item:active:not(:disabled) {
    transform: scale(0.97);
  }

  .transform-item:disabled {
    opacity: 0.3;
    cursor: default;
  }

  /* Icon badge (shared) */
  .icon-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    font-size: 12px;
  }

  /* Item label */
  .item-label {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
  }

  /* Key badge (shared) */
  .key-badge {
    border-radius: 4px;
    padding: 1px 6px;
    font-size: 11px;
    font-family: monospace;
    font-weight: 600;
    border: 1px solid transparent;
  }

  /* Preset row */
  .preset-row {
    display: flex;
    gap: 3px;
  }

  .preset-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 5px 4px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 7px;
    flex: 1;
    min-width: 0;
    cursor: pointer;
    color: inherit;
    transition: background 150ms ease, border-color 150ms ease;
  }

  .preset-item:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .preset-item.selected {
    border-color: var(--theme-accent, #a855f7);
  }

  .preset-item.cat-dog {
    border-color: rgba(255, 180, 50, 0.15);
  }

  .preset-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preset-icon:not(.no-rotate) .prop-svg {
    transform: rotate(-90deg);
  }

  .preset-icon.empty {
    color: rgba(255, 255, 255, 0.15);
    font-size: 10px;
  }

  .prop-svg {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }

  .prop-svg.red-prop {
    filter: hue-rotate(125deg) saturate(1.2);
    width: 14px;
    height: 14px;
  }

  .prop-svg.blue-prop {
    width: 14px;
    height: 14px;
  }

  .preset-key {
    background: rgba(255, 180, 50, 0.2);
    border-color: rgba(255, 180, 50, 0.3);
    color: #f5c842;
  }

  .preset-key.selected-key {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.3);
    color: #a855f7;
  }

  /* Edit button */
  .edit-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 5px;
    padding: 2px 8px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.3);
    font-size: 9px;
    transition: all 150ms ease;
  }

  .edit-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .edit-btn i {
    font-size: 8px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .alt-overlay {
      animation: none;
    }

    .alt-overlay.fade-out {
      animation: none;
      opacity: 0;
    }

    .rotate-btn,
    .transform-item,
    .preset-item,
    .edit-btn {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify build**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/components/AltHotkeyOverlay.svelte
git commit -m "feat: add AltHotkeyOverlay component with clickable transforms and prop presets"
```

---

### Task 5: Mount AltHotkeyOverlay in CreateModule

**Files:**
- Modify: `src/lib/features/create/shared/components/CreateModule.svelte`

- [ ] **Step 1: Add the import**

Add at the top of the `<script>` block, near the other component imports (around line 58):

```typescript
import AltHotkeyOverlay from "../../components/AltHotkeyOverlay.svelte";
```

- [ ] **Step 2: Add the component to the template**

Inside the `{:else if CreateModuleState && constructTabState && services}` block (after line 698, before the `<div class="create-tab">` line), add:

```svelte
  <!-- Alt Hotkey Overlay (desktop only, shows on Alt hold) -->
  <AltHotkeyOverlay />
```

Since the overlay uses `position: fixed`, placement in the template doesn't affect visual position — it just needs to be inside the conditional block so it has access to the Create module context.

- [ ] **Step 3: Verify build**

Run: `npm run check`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/create/shared/components/CreateModule.svelte
git commit -m "feat: mount AltHotkeyOverlay in Create module composition root"
```

---

### Task 6: Manual verification

This task is for the human to verify the feature works end-to-end.

- [ ] **Step 1: Test overlay appears on Alt hold**

Navigate to the Create module. Hold Alt. Verify:
- Overlay slides down from top center
- Three sections visible: Rotate, Transform, Props
- Release Alt → overlay fades out

- [ ] **Step 2: Test transform execution**

Create a sequence (at least 2 beats). Hold Alt, press M. Verify the sequence mirrors. Try Alt+R (rotate), Alt+W (rewind), Alt+S (swap). Verify each transform applies.

- [ ] **Step 3: Test click execution**

Hold Alt, click the Mirror button in the overlay. Verify the transform applies and the overlay stays visible.

- [ ] **Step 4: Test prop preset switching**

Hold Alt, press 2 (or click the Fan preset). Verify the prop type changes to Fan.

- [ ] **Step 5: Test Edit button**

Hold Alt, click the Edit button in the Props section. Verify navigation to Settings > Props tab.

- [ ] **Step 6: Test disabled state**

Clear the sequence (or start fresh with no sequence). Hold Alt. Verify transform items appear dimmed/disabled. Click one — nothing should happen. Prop presets should still work.

- [ ] **Step 7: Test bare keys are removed**

With a sequence active, press bare M, R, W, H, V, S, I keys. Verify none of them trigger transforms anymore.

- [ ] **Step 8: Test in Arrange tab**

Switch to the Arrange tab. Select a cell with content. Verify bare keys no longer trigger transforms. Hold Alt+M — verify it triggers the mirror transform on the sequence level.

- [ ] **Step 9: Test text input suppression**

Click into a text input (e.g., sequence name field). Hold Alt. Verify the overlay does NOT appear.
