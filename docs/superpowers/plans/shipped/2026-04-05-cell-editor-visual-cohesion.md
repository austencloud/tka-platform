# Cell Editor Visual Cohesion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the cell editor panel's visual language and merge the effects/effort 2-click flows into single inline sections.

**Architecture:** Replace EffectsSection + EffectMatrixDrawer with a single UnifiedEffectsSection that shows pill chips, scope selector, and channel rows in one view. Same for effort. Update LayerSection with prop-color gradient cards. Standardize all button/card styles across the panel.

**Tech Stack:** Svelte 5, TypeScript, CSS custom properties, color-mix()

**Spec:** `docs/superpowers/specs/2026-04-05-cell-editor-visual-cohesion-design.md`

---

## File Structure

All files live under `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/`.

| File | Action | Responsibility |
|------|--------|---------------|
| `sections/UnifiedEffectsSection.svelte` | Create | Merged effects chips + scope + channel matrix |
| `sections/UnifiedEffortSection.svelte` | Create | Merged effort chips + scope + channel matrix |
| `CellEditorPanel.svelte` | Modify | Wire new sections, restyle header/footer |
| `LayerSection.svelte` | Modify | Gradient card, button unification |
| `ChipGrid.svelte` | Modify | Touch target verification only |
| `sections/EffectsSection.svelte` | Delete | Replaced by UnifiedEffectsSection |
| `sections/EffectMatrixDrawer.svelte` | Delete | Replaced by UnifiedEffectsSection |
| `sections/EffortSection.svelte` | Delete | Replaced by UnifiedEffortSection |
| `sections/EffortMatrixDrawer.svelte` | Delete | Replaced by UnifiedEffortSection |

---

### Task 1: Create UnifiedEffectsSection

**Files:**
- Create: `cell-editor/sections/UnifiedEffectsSection.svelte`
- Reference: `cell-editor/sections/EffectsSection.svelte` (pill chips), `cell-editor/sections/EffectMatrixDrawer.svelte` (scope/channel/matrix logic)

- [ ] **Step 1: Create the component file**

This component merges EffectsSection (pill chips) and EffectMatrixDrawer (scope selector + channel rows) into one. All the scope-switching logic, channel row building, and effect assignment logic comes from EffectMatrixDrawer. The pill chips come from EffectsSection. The `onOpenMatrix` prop and the `effectMatrixOpen` state in the parent are eliminated.

```svelte
<!--
  UnifiedEffectsSection.svelte

  Merged effects view: pill chips (quick-apply) + scope selector + channel matrix.
  Replaces the old EffectsSection + EffectMatrixDrawer two-step flow.
-->
<script lang="ts">
  import type {
    TipEffectMap,
    EffectType,
  } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import { getTipPoints } from "$lib/shared/animation-engine/domain/types/PropTipPoints";
  import type { CellEffect } from "$lib/features/compose/compose/domain/types";
  import { TrailMode } from "$lib/shared/animation-engine/domain/types/TrailTypes";

  type Scope = "cell" | "hand" | "tip";

  let {
    currentEffect,
    currentTrailMode,
    currentMap,
    bluePropType,
    redPropType,
    onSetEffect,
    onSetTrailMode,
    onUpdateMap,
  }: {
    currentEffect: CellEffect;
    currentTrailMode: TrailMode | undefined;
    currentMap: TipEffectMap;
    bluePropType: string;
    redPropType: string;
    onSetEffect: (effect: CellEffect) => void;
    onSetTrailMode: (mode: TrailMode) => void;
    onUpdateMap: (map: TipEffectMap) => void;
  } = $props();

  const effects: { value: CellEffect; label: string; icon?: string; dot?: string }[] = [
    { value: "none", label: "None", icon: "fa-ban" },
    { value: "fire", label: "Fire", dot: "#f97316" },
    { value: "charcoal", label: "Charcoal", dot: "#a855f7" },
    { value: "led", label: "LED", dot: "#22c55e" },
    { value: "trails", label: "Trails", icon: "fa-wind" },
  ];

  const trailModes: { value: TrailMode; label: string }[] = [
    { value: TrailMode.FADE, label: "Fade" },
    { value: TrailMode.PERSISTENT, label: "Persistent" },
    { value: TrailMode.LOOP_CLEAR, label: "Loop Clear" },
  ];

  const scopes: { value: Scope; label: string; icon: string }[] = [
    { value: "cell", label: "Cell", icon: "fa-border-all" },
    { value: "hand", label: "Per Hand", icon: "fa-hand" },
    { value: "tip", label: "Per Tip", icon: "fa-crosshairs" },
  ];

  const effectDefs: { value: EffectType; label: string; icon: string; cssClass: string }[] = [
    { value: "none", label: "None", icon: "fa-ban", cssClass: "eff-none" },
    { value: "fire", label: "Fire", icon: "fa-fire", cssClass: "eff-fire" },
    { value: "charcoal", label: "Charcoal", icon: "fa-fire", cssClass: "eff-charcoal" },
    { value: "led", label: "LED", icon: "fa-lightbulb", cssClass: "eff-led" },
    { value: "trails", label: "Trails", icon: "fa-wind", cssClass: "eff-trails" },
  ];

  // Scope + local map state — initialized from currentMap
  let scope: Scope = $state<Scope>("cell");
  let localMap: TipEffectMap = $state<TipEffectMap>({});

  $effect.pre(() => {
    scope = inferScope(currentMap);
    localMap = { ...currentMap };
  });

  const blueTipCount = $derived(getTipPoints(bluePropType).points.length);
  const redTipCount = $derived(getTipPoints(redPropType).points.length);

  interface ChannelRow {
    key: string;
    color: string;
    label: string;
  }

  const channels: ChannelRow[] = $derived.by(() => {
    if (scope === "cell") {
      return [{ key: "*", color: "linear-gradient(135deg, #3b82f6, #ef4444)", label: "Both" }];
    }
    if (scope === "hand") {
      return [
        { key: "0", color: "#3b82f6", label: "Blue" },
        { key: "1", color: "#ef4444", label: "Red" },
      ];
    }
    const rows: ChannelRow[] = [];
    for (let t = 0; t < blueTipCount; t++) {
      rows.push({
        key: `0-${t}`,
        color: "#3b82f6",
        label: `Blue ${getTipLabel(bluePropType, t, blueTipCount)}`,
      });
    }
    for (let t = 0; t < redTipCount; t++) {
      rows.push({
        key: `1-${t}`,
        color: "#ef4444",
        label: `Red ${getTipLabel(redPropType, t, redTipCount)}`,
      });
    }
    return rows;
  });

  function getTipLabel(propType: string, tipIndex: number, tipCount: number): string {
    if (tipCount === 1) return "tip";
    if (tipCount === 2) return tipIndex === 0 ? "thumb" : "pinky";
    return `tip ${tipIndex + 1}`;
  }

  function getEffectForKey(key: string): EffectType {
    return localMap[key]?.effect ?? "none";
  }

  function setEffect(key: string, effect: EffectType) {
    localMap = { ...localMap, [key]: { effect } };
    onUpdateMap(localMap);
  }

  function applyToAll(effect: CellEffect) {
    onSetEffect(effect);
    const newMap: TipEffectMap = {};
    for (const ch of channels) {
      newMap[ch.key] = { effect: effect as EffectType };
    }
    localMap = newMap;
    onUpdateMap(localMap);
  }

  function switchScope(newScope: Scope) {
    if (newScope === scope) return;
    const oldScope = scope;
    const newMap: TipEffectMap = {};

    if (newScope === "cell") {
      const most = mostCommonEffect(Object.keys(localMap));
      newMap["*"] = { effect: most };
    } else if (newScope === "hand") {
      if (oldScope === "tip") {
        const blueKeys = Object.keys(localMap).filter((k) => k.startsWith("0-"));
        const redKeys = Object.keys(localMap).filter((k) => k.startsWith("1-"));
        newMap["0"] = { effect: mostCommonEffect(blueKeys) };
        newMap["1"] = { effect: mostCommonEffect(redKeys) };
      } else {
        const base = localMap["*"]?.effect ?? "none";
        newMap["0"] = { effect: base };
        newMap["1"] = { effect: base };
      }
    } else {
      if (oldScope === "cell") {
        const base = localMap["*"]?.effect ?? "none";
        for (let t = 0; t < blueTipCount; t++) newMap[`0-${t}`] = { effect: base };
        for (let t = 0; t < redTipCount; t++) newMap[`1-${t}`] = { effect: base };
      } else {
        const blueEffect = localMap["0"]?.effect ?? "none";
        const redEffect = localMap["1"]?.effect ?? "none";
        for (let t = 0; t < blueTipCount; t++) newMap[`0-${t}`] = { effect: blueEffect };
        for (let t = 0; t < redTipCount; t++) newMap[`1-${t}`] = { effect: redEffect };
      }
    }

    scope = newScope;
    localMap = newMap;
    onUpdateMap(localMap);
  }

  function mostCommonEffect(keys: string[]): EffectType {
    const counts: Record<string, number> = {};
    for (const k of keys) {
      const e = localMap[k]?.effect ?? "none";
      counts[e] = (counts[e] ?? 0) + 1;
    }
    if (Object.keys(counts).length === 0) {
      return localMap["*"]?.effect ?? "none";
    }
    let best: EffectType = "none";
    let bestCount = 0;
    for (const [e, c] of Object.entries(counts)) {
      if (c > bestCount) {
        best = e as EffectType;
        bestCount = c;
      }
    }
    return best;
  }

  function inferScope(map: TipEffectMap): Scope {
    const keys = Object.keys(map);
    if (keys.length === 0 || (keys.length === 1 && keys[0] === "*")) return "cell";
    if (keys.some((k) => k.includes("-"))) return "tip";
    if (keys.includes("0") || keys.includes("1")) return "hand";
    return "cell";
  }
</script>

<div class="unified-effects">
  <!-- Quick-apply pill chips -->
  <div class="chip-grid" role="radiogroup" aria-label="Visual effect">
    {#each effects as effect}
      <button
        class="chip"
        class:active={currentEffect === effect.value}
        role="radio"
        aria-checked={currentEffect === effect.value}
        onclick={() => applyToAll(effect.value)}
        style:--chip-color={effect.dot ?? "#60a5fa"}
      >
        {#if effect.icon}
          <i class="fas {effect.icon}" aria-hidden="true"></i>
        {:else if effect.dot}
          <span class="color-dot" style:background={effect.dot}></span>
        {/if}
        {effect.label}
      </button>
    {/each}
  </div>

  <!-- Trail mode sub-group -->
  {#if currentEffect === "trails"}
    <div class="sub-group">
      <span class="sub-label" id="trail-mode-label">TRAIL MODE</span>
      <div class="chip-grid" role="radiogroup" aria-labelledby="trail-mode-label">
        {#each trailModes as mode}
          <button
            class="chip"
            class:active={currentTrailMode === mode.value}
            role="radio"
            aria-checked={currentTrailMode === mode.value}
            onclick={() => onSetTrailMode(mode.value)}
          >
            {mode.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Scope selector -->
  <div class="scope-section">
    <span class="scope-label" id="effect-scope-label">SCOPE</span>
    <div class="scope-strip" role="radiogroup" aria-labelledby="effect-scope-label">
      {#each scopes as s}
        <button
          class="scope-seg"
          class:active={scope === s.value}
          role="radio"
          aria-checked={scope === s.value}
          onclick={() => switchScope(s.value)}
        >
          <i class="fas {s.icon}" aria-hidden="true"></i>
          {s.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Channel rows -->
  <div class="matrix-rows">
    {#each channels as ch (ch.key)}
      <div class="channel">
        <div class="channel-id">
          <span class="channel-dot" style:background={ch.color}></span>
          <span class="channel-name">{ch.label}</span>
        </div>
        <div class="channel-effects">
          {#each effectDefs as eff}
            <button
              class="effect-btn {eff.cssClass}"
              class:active={getEffectForKey(ch.key) === eff.value}
              title={eff.label}
              onclick={() => setEffect(ch.key, eff.value)}
            >
              <i class="fas {eff.icon}" aria-hidden="true"></i>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="hint">Tap a chip to apply to all. Change scope for per-channel control.</div>
</div>
```

- [ ] **Step 2: Add styles**

Add the `<style>` block. Use the unified design system: 10px card radius, color-mix active states, 44px min touch targets, `prefers-reduced-motion` support.

```css
<style>
  .unified-effects {
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: slideDown 180ms ease-out;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    min-height: 44px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .chip:hover {
    background: rgba(255, 255, 255, 0.07);
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
  }

  .chip.active {
    background: color-mix(in srgb, var(--chip-color, #f97316) 10%, transparent);
    border-color: color-mix(in srgb, var(--chip-color, #f97316) 30%, transparent);
    color: var(--chip-color, #f97316);
  }

  .color-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .sub-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 4px;
  }

  .sub-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.2));
    font-weight: 600;
  }

  /* Scope selector */
  .scope-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .scope-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.2);
    font-weight: 600;
    flex-shrink: 0;
  }

  .scope-strip {
    display: flex;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    overflow: hidden;
    flex: 1;
  }

  .scope-seg {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 8px;
    min-height: 44px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.45);
    background: transparent;
    border: none;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    transition: all 150ms ease;
  }

  .scope-seg:last-child { border-right: none; }

  .scope-seg:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.7);
  }

  .scope-seg.active {
    background: rgba(139, 92, 246, 0.15);
    color: #c084fc;
    box-shadow: inset 0 -2px 0 #a855f7;
  }

  .scope-seg i { font-size: 14px; }

  /* Channel rows */
  .matrix-rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .channel {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    min-height: 48px;
    transition: border-color 150ms ease;
  }

  .channel:hover { border-color: rgba(255, 255, 255, 0.12); }

  .channel-id {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 36px;
  }

  .channel-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .channel-name {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.25);
    font-weight: 600;
    text-align: center;
  }

  .channel-effects {
    display: flex;
    gap: 4px;
    flex: 1;
    flex-wrap: wrap;
  }

  .effect-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    min-width: 44px;
    min-height: 44px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    cursor: pointer;
    transition: all 120ms ease;
  }

  .effect-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .effect-btn i {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
  }

  .effect-btn.active { border-width: 1.5px; }
  .effect-btn.active.eff-none { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.2); }
  .effect-btn.active.eff-none i { color: rgba(255, 255, 255, 0.7); }
  .effect-btn.active.eff-fire { background: rgba(249, 115, 22, 0.15); border-color: rgba(249, 115, 22, 0.4); }
  .effect-btn.active.eff-fire i { color: #fb923c; }
  .effect-btn.active.eff-charcoal { background: rgba(168, 85, 247, 0.15); border-color: rgba(168, 85, 247, 0.4); }
  .effect-btn.active.eff-charcoal i { color: #a78bfa; }
  .effect-btn.active.eff-led { background: rgba(34, 197, 94, 0.15); border-color: rgba(34, 197, 94, 0.4); }
  .effect-btn.active.eff-led i { color: #4ade80; }
  .effect-btn.active.eff-trails { background: rgba(96, 165, 250, 0.15); border-color: rgba(96, 165, 250, 0.4); }
  .effect-btn.active.eff-trails i { color: #60a5fa; }

  .hint {
    text-align: center;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.2);
    font-style: italic;
  }

  @media (prefers-reduced-motion: reduce) {
    .unified-effects { animation: none; }
    .chip, .scope-seg, .effect-btn { transition: none; }
  }
</style>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No TypeScript errors. Component compiles.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/UnifiedEffectsSection.svelte
git commit -m "feat(cell-editor): create UnifiedEffectsSection merging chips + matrix"
```

---

### Task 2: Create UnifiedEffortSection

**Files:**
- Create: `cell-editor/sections/UnifiedEffortSection.svelte`
- Reference: `cell-editor/sections/EffortSection.svelte`, `cell-editor/sections/EffortMatrixDrawer.svelte`

- [ ] **Step 1: Create the component file**

Same pattern as UnifiedEffectsSection but for effort qualities. Uses EFFORTS array from effort-lab domain. Channel rows use a 4x2 grid for the 8 effort buttons instead of a flex row.

```svelte
<!--
  UnifiedEffortSection.svelte

  Merged effort view: pill chips (quick-apply) + scope selector + channel matrix.
  Replaces the old EffortSection + EffortMatrixDrawer two-step flow.
-->
<script lang="ts">
  import type {
    TipEffortMap,
  } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";
  import { EFFORTS } from "$lib/features/effort-lab/domain/effort-types";
  import { getTipPoints } from "$lib/shared/animation-engine/domain/types/PropTipPoints";

  type Scope = "cell" | "hand" | "tip";

  let {
    currentEffort,
    currentMap,
    bluePropType,
    redPropType,
    onSetEffort,
    onUpdateMap,
  }: {
    currentEffort: string | undefined;
    currentMap: TipEffortMap;
    bluePropType: string;
    redPropType: string;
    onSetEffort: (effort: string) => void;
    onUpdateMap: (map: TipEffortMap) => void;
  } = $props();

  const scopes: { value: Scope; label: string; icon: string }[] = [
    { value: "cell", label: "Cell", icon: "fa-border-all" },
    { value: "hand", label: "Per Hand", icon: "fa-hand" },
    { value: "tip", label: "Per Tip", icon: "fa-crosshairs" },
  ];

  let scope: Scope = $state<Scope>("cell");
  let localMap: TipEffortMap = $state<TipEffortMap>({});

  $effect.pre(() => {
    scope = inferScope(currentMap);
    localMap = { ...currentMap };
  });

  const blueTipCount = $derived(getTipPoints(bluePropType).points.length);
  const redTipCount = $derived(getTipPoints(redPropType).points.length);

  interface ChannelRow {
    key: string;
    color: string;
    label: string;
  }

  const channels: ChannelRow[] = $derived.by(() => {
    if (scope === "cell") {
      return [{ key: "*", color: "linear-gradient(135deg, #3b82f6, #ef4444)", label: "Both" }];
    }
    if (scope === "hand") {
      return [
        { key: "0", color: "#3b82f6", label: "Blue" },
        { key: "1", color: "#ef4444", label: "Red" },
      ];
    }
    const rows: ChannelRow[] = [];
    for (let t = 0; t < blueTipCount; t++) {
      rows.push({
        key: `0-${t}`,
        color: "#3b82f6",
        label: `Blue ${getTipLabel(bluePropType, t, blueTipCount)}`,
      });
    }
    for (let t = 0; t < redTipCount; t++) {
      rows.push({
        key: `1-${t}`,
        color: "#ef4444",
        label: `Red ${getTipLabel(redPropType, t, redTipCount)}`,
      });
    }
    return rows;
  });

  function getTipLabel(propType: string, tipIndex: number, tipCount: number): string {
    if (tipCount === 1) return "tip";
    if (tipCount === 2) return tipIndex === 0 ? "thumb" : "pinky";
    return `tip ${tipIndex + 1}`;
  }

  function getEffortForKey(key: string): EffortId {
    return localMap[key]?.effort ?? "linear";
  }

  function setEffort(key: string, effort: EffortId) {
    localMap = { ...localMap, [key]: { effort } };
    onUpdateMap(localMap);
  }

  function applyToAll(effortId: string) {
    onSetEffort(effortId);
    const newMap: TipEffortMap = {};
    for (const ch of channels) {
      newMap[ch.key] = { effort: effortId as EffortId };
    }
    localMap = newMap;
    onUpdateMap(localMap);
  }

  function switchScope(newScope: Scope) {
    if (newScope === scope) return;
    const oldScope = scope;
    const newMap: TipEffortMap = {};

    if (newScope === "cell") {
      const most = mostCommonEffort(Object.keys(localMap));
      newMap["*"] = { effort: most };
    } else if (newScope === "hand") {
      if (oldScope === "tip") {
        const blueKeys = Object.keys(localMap).filter((k) => k.startsWith("0-"));
        const redKeys = Object.keys(localMap).filter((k) => k.startsWith("1-"));
        newMap["0"] = { effort: mostCommonEffort(blueKeys) };
        newMap["1"] = { effort: mostCommonEffort(redKeys) };
      } else {
        const base = localMap["*"]?.effort ?? "linear";
        newMap["0"] = { effort: base };
        newMap["1"] = { effort: base };
      }
    } else {
      if (oldScope === "cell") {
        const base = localMap["*"]?.effort ?? "linear";
        for (let t = 0; t < blueTipCount; t++) newMap[`0-${t}`] = { effort: base };
        for (let t = 0; t < redTipCount; t++) newMap[`1-${t}`] = { effort: base };
      } else {
        const blueEffort = localMap["0"]?.effort ?? "linear";
        const redEffort = localMap["1"]?.effort ?? "linear";
        for (let t = 0; t < blueTipCount; t++) newMap[`0-${t}`] = { effort: blueEffort };
        for (let t = 0; t < redTipCount; t++) newMap[`1-${t}`] = { effort: redEffort };
      }
    }

    scope = newScope;
    localMap = newMap;
    onUpdateMap(localMap);
  }

  function mostCommonEffort(keys: string[]): EffortId {
    const counts: Record<string, number> = {};
    for (const k of keys) {
      const e = localMap[k]?.effort ?? "linear";
      counts[e] = (counts[e] ?? 0) + 1;
    }
    if (Object.keys(counts).length === 0) {
      return localMap["*"]?.effort ?? "linear";
    }
    let best: EffortId = "linear";
    let bestCount = 0;
    for (const [e, c] of Object.entries(counts)) {
      if (c > bestCount) {
        best = e as EffortId;
        bestCount = c;
      }
    }
    return best;
  }

  function inferScope(map: TipEffortMap): Scope {
    const keys = Object.keys(map);
    if (keys.length === 0 || (keys.length === 1 && keys[0] === "*")) return "cell";
    if (keys.some((k) => k.includes("-"))) return "tip";
    if (keys.includes("0") || keys.includes("1")) return "hand";
    return "cell";
  }
</script>

<div class="unified-effort">
  <!-- Quick-apply pill chips -->
  <div class="chip-grid" role="radiogroup" aria-label="Effort quality">
    {#each EFFORTS as effort}
      <button
        class="chip"
        class:active={currentEffort === effort.id}
        role="radio"
        aria-checked={currentEffort === effort.id}
        onclick={() => applyToAll(effort.id)}
        style:--chip-color={effort.color}
      >
        <span class="color-dot" style:background={effort.color}></span>
        {effort.label}
      </button>
    {/each}
  </div>

  <!-- Scope selector -->
  <div class="scope-section">
    <span class="scope-label" id="effort-scope-label">SCOPE</span>
    <div class="scope-strip" role="radiogroup" aria-labelledby="effort-scope-label">
      {#each scopes as s}
        <button
          class="scope-seg"
          class:active={scope === s.value}
          role="radio"
          aria-checked={scope === s.value}
          onclick={() => switchScope(s.value)}
        >
          <i class="fas {s.icon}" aria-hidden="true"></i>
          {s.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Channel rows with 4x2 effort grids -->
  <div class="matrix-rows">
    {#each channels as ch (ch.key)}
      <div class="channel">
        <div class="channel-id">
          <span class="channel-dot" style:background={ch.color}></span>
          <span class="channel-name">{ch.label}</span>
        </div>
        <div class="effort-grid">
          {#each EFFORTS as effort}
            <button
              class="effort-btn"
              class:active={getEffortForKey(ch.key) === effort.id}
              title={effort.label}
              onclick={() => setEffort(ch.key, effort.id)}
              style:--effort-color={effort.color}
            >
              <span class="effort-dot" style:background={effort.color}></span>
              <span class="effort-label">{effort.label}</span>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="hint">Tap a chip to apply to all. Change scope for per-channel control.</div>
</div>
```

- [ ] **Step 2: Add styles**

Same unified system as UnifiedEffectsSection. Effort grid uses `grid-template-columns: repeat(4, 1fr)` for a 4x2 layout.

```css
<style>
  .unified-effort {
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: slideDown 180ms ease-out;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    min-height: 44px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .chip:hover {
    background: rgba(255, 255, 255, 0.07);
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
  }

  .chip.active {
    background: color-mix(in srgb, var(--chip-color, #a855f7) 10%, transparent);
    border-color: color-mix(in srgb, var(--chip-color, #a855f7) 30%, transparent);
    color: var(--chip-color, #a855f7);
  }

  .color-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .scope-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .scope-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.2);
    font-weight: 600;
    flex-shrink: 0;
  }

  .scope-strip {
    display: flex;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    overflow: hidden;
    flex: 1;
  }

  .scope-seg {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 8px;
    min-height: 44px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.45);
    background: transparent;
    border: none;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    transition: all 150ms ease;
  }

  .scope-seg:last-child { border-right: none; }
  .scope-seg:hover { background: rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.7); }
  .scope-seg.active { background: rgba(139, 92, 246, 0.15); color: #c084fc; box-shadow: inset 0 -2px 0 #a855f7; }
  .scope-seg i { font-size: 14px; }

  .matrix-rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .channel {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 9px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    min-height: 48px;
    transition: border-color 150ms ease;
  }

  .channel:hover { border-color: rgba(255, 255, 255, 0.12); }

  .channel-id {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 36px;
    padding-top: 8px;
  }

  .channel-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .channel-name {
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.25);
    font-weight: 600;
    text-align: center;
  }

  .effort-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    flex: 1;
  }

  .effort-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 44px;
    padding: 6px 4px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    cursor: pointer;
    transition: all 120ms ease;
  }

  .effort-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .effort-btn.active {
    background: color-mix(in srgb, var(--effort-color) 15%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--effort-color) 40%, transparent);
  }

  .effort-btn .effort-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .effort-btn .effort-label {
    font-size: 9px;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 500;
  }

  .effort-btn.active .effort-label {
    color: var(--effort-color);
  }

  .hint {
    text-align: center;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.2);
    font-style: italic;
  }

  @media (prefers-reduced-motion: reduce) {
    .unified-effort { animation: none; }
    .chip, .scope-seg, .effort-btn { transition: none; }
  }
</style>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/UnifiedEffortSection.svelte
git commit -m "feat(cell-editor): create UnifiedEffortSection merging chips + matrix"
```

---

### Task 3: Wire new sections into CellEditorPanel

**Files:**
- Modify: `cell-editor/CellEditorPanel.svelte`

- [ ] **Step 1: Update imports**

Replace the old imports (lines 23-26) and add the new ones:

```diff
- import EffectsSection from "./sections/EffectsSection.svelte";
- import EffectMatrixDrawer from "./sections/EffectMatrixDrawer.svelte";
- import EffortSection from "./sections/EffortSection.svelte";
- import EffortMatrixDrawer from "./sections/EffortMatrixDrawer.svelte";
+ import UnifiedEffectsSection from "./sections/UnifiedEffectsSection.svelte";
+ import UnifiedEffortSection from "./sections/UnifiedEffortSection.svelte";
```

- [ ] **Step 2: Remove effectMatrixOpen and effortMatrixOpen state**

Delete lines 71-72:

```diff
- let effectMatrixOpen = $state(false);
- let effortMatrixOpen = $state(false);
```

- [ ] **Step 3: Replace the effects expanded section (lines 189-206)**

Replace the `panelState.expandedSection === 'effects'` block:

```svelte
{:else if panelState.expandedSection === 'effects'}
  <UnifiedEffectsSection
    currentEffect={cell.effect ?? "none"}
    currentTrailMode={cell.trailMode}
    currentMap={cell.tipEffectMap ?? {}}
    bluePropType="staff"
    redPropType="staff"
    onSetEffect={effect => p.onSetEffect?.(effect)}
    onSetTrailMode={mode => p.onSetTrailMode?.(mode)}
    onUpdateMap={map => p.onSetTipEffectMap?.(map)}
  />
```

- [ ] **Step 4: Replace the effort expanded section (lines 212-227)**

Replace the `panelState.expandedSection === 'effort'` block:

```svelte
{:else if panelState.expandedSection === 'effort'}
  <UnifiedEffortSection
    currentEffort={cell.effort}
    currentMap={cell.tipEffortMap ?? {}}
    bluePropType="staff"
    redPropType="staff"
    onSetEffort={effort => p.onSetEffort?.(effort)}
    onUpdateMap={map => p.onSetTipEffortMap?.(map)}
  />
```

- [ ] **Step 5: Update header styling**

Update the header badge to use accent tint and the close button to use card styling. In the CSS section:

```css
/* Replace .layer-ratio-badge styles */
.layer-ratio-badge {
  font-size: clamp(0.65rem, 2cqi, 0.75rem);
  color: rgba(167, 139, 250, 0.8);
  padding: 2px clamp(6px, 1.5cqi, 8px);
  background: rgba(139, 92, 246, 0.12);
  border-radius: clamp(3px, 1cqi, 4px);
}

/* Replace .panel-header border-bottom */
.panel-header {
  /* ... existing flex layout ... */
  border-bottom: 1px solid rgba(139, 92, 246, 0.12);
}

/* Replace .close-btn styles */
.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  cursor: pointer;
  border-radius: 10px;
  transition: all var(--duration-fast, 150ms) ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--theme-text, white);
}
```

- [ ] **Step 6: Update footer styling**

```css
.copy-all-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
}

.copy-all-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
}

.clear-all-btn {
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.1);
  color: rgba(239, 68, 68, 0.6);
}

.clear-all-btn:hover {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.2);
}
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: No errors. Old components no longer imported.

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/CellEditorPanel.svelte
git commit -m "feat(cell-editor): wire unified effects/effort sections, restyle header/footer"
```

---

### Task 4: Restyle LayerSection

**Files:**
- Modify: `cell-editor/LayerSection.svelte`

- [ ] **Step 1: Update layer card background to horizontal gradient**

The layer card needs to derive its gradient from the layer's prop colors. The `TunnelLayerConfig` already has `propColors.left` and `propColors.right`. Update the template (line 74):

```svelte
<div
  class="layer-chip"
  style:--left-color={layer.propColors.left}
  style:--right-color={layer.propColors.right}
>
```

- [ ] **Step 2: Update layer card CSS**

Replace the `.layer-chip` styles:

```css
.layer-chip {
  display: flex;
  align-items: center;
  gap: clamp(8px, 2cqi, 12px);
  min-height: 52px;
  padding: clamp(8px, 2cqi, 12px) clamp(10px, 2.5cqi, 14px);
  background: linear-gradient(to right, color-mix(in srgb, var(--left-color) 8%, transparent), color-mix(in srgb, var(--right-color) 8%, transparent));
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}
```

- [ ] **Step 3: Add glow to prop dots**

Update `.color-dot` styles:

```css
.color-dot {
  width: clamp(12px, 3cqi, 14px);
  height: clamp(12px, 3cqi, 14px);
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 0 6px color-mix(in srgb, var(--dot-color, currentColor) 25%, transparent);
}
```

And update the dots in the template to pass their color:

```svelte
<span class="color-dot" style:background={layer.propColors.left} style:--dot-color={layer.propColors.left}></span>
<span class="color-dot" style:background={layer.propColors.right} style:--dot-color={layer.propColors.right}></span>
```

- [ ] **Step 4: Standardize action buttons**

Replace `.chip-action-btn` styles:

```css
.chip-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.04);
  color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
  border-radius: 8px;
  cursor: pointer;
  transition: background var(--duration-fast, 150ms) ease,
    border-color var(--duration-fast, 150ms) ease,
    color var(--duration-fast, 150ms) ease;
}

.chip-action-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--theme-text, white);
}

.chip-action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.15);
  color: rgba(239, 68, 68, 0.7);
}
```

- [ ] **Step 5: Update Add Layer and Paste buttons**

Replace `.add-sequence-btn` and `.paste-btn` styles — drop dashed borders, use solid card system:

```css
.add-sequence-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(6px, 2cqi, 10px);
  min-height: 44px;
  padding: clamp(10px, 2.5cqi, 14px);
  background: rgba(16, 185, 129, 0.04);
  border: 1px solid rgba(16, 185, 129, 0.1);
  border-radius: 10px;
  color: rgba(16, 185, 129, 0.55);
  font-size: clamp(0.8rem, 2.8cqi, 0.95rem);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast, 150ms) ease;
}

.add-sequence-btn:hover {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.2);
  color: rgba(16, 185, 129, 0.75);
}

.paste-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(6px, 2cqi, 10px);
  min-height: 44px;
  padding: clamp(10px, 2.5cqi, 14px);
  background: rgba(139, 92, 246, 0.04);
  border: 1px solid rgba(139, 92, 246, 0.1);
  border-radius: 10px;
  color: rgba(167, 139, 250, 0.55);
  font-size: clamp(0.8rem, 2.8cqi, 0.95rem);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast, 150ms) ease;
}

.paste-btn:hover {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.2);
  color: rgba(167, 139, 250, 0.75);
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/LayerSection.svelte
git commit -m "feat(cell-editor): restyle layer cards with prop-color gradient and unified buttons"
```

---

### Task 5: Delete old components

**Files:**
- Delete: `cell-editor/sections/EffectsSection.svelte`
- Delete: `cell-editor/sections/EffectMatrixDrawer.svelte`
- Delete: `cell-editor/sections/EffortSection.svelte`
- Delete: `cell-editor/sections/EffortMatrixDrawer.svelte`

- [ ] **Step 1: Verify no other imports exist**

Run: `grep -r "EffectsSection\|EffectMatrixDrawer\|EffortSection\|EffortMatrixDrawer" src/ --include="*.svelte" --include="*.ts" -l`

Expected: No results (CellEditorPanel no longer imports them after Task 3).

- [ ] **Step 2: Delete the files**

```bash
rm src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/EffectsSection.svelte
rm src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/EffectMatrixDrawer.svelte
rm src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/EffortSection.svelte
rm src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/EffortMatrixDrawer.svelte
```

- [ ] **Step 3: Verify build still passes**

Run: `npm run build`
Expected: Clean build, no missing import errors.

- [ ] **Step 4: Commit**

```bash
git add -u src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/
git commit -m "refactor(cell-editor): remove old EffectsSection, EffectMatrixDrawer, EffortSection, EffortMatrixDrawer"
```

---

### Task 6: Verify touch targets and reduced motion

**Files:**
- Modify: `cell-editor/ChipGrid.svelte` (if needed)

- [ ] **Step 1: Audit ChipGrid touch targets**

Read `ChipGrid.svelte` line 228: confirm `.chip` has `min-height: 44px`. It does (line 227 in the current code shows `min-height: 44px`). No changes needed.

- [ ] **Step 2: Run full build + typecheck**

Run: `npm run build && npm run check`
Expected: Both pass cleanly.

- [ ] **Step 3: Final commit if any ChipGrid tweaks were needed**

Only commit if changes were made. Otherwise skip.

---

### Task 7: Smoke test the panel

- [ ] **Step 1: Open the app and navigate to compose > arrange**

Use the dev server on port 5173 (user's server). Navigate to the compose module, arrange tab.

- [ ] **Step 2: Click on a cell to open the cell editor drawer**

Verify:
- Header badge is purple-tinted
- Close button has card-style background
- Header divider has subtle purple tint

- [ ] **Step 3: Check layer card**

Verify:
- Layer card has horizontal blue→red gradient background
- Prop color dots have subtle glow
- Copy/remove action buttons have card-style borders
- Add Layer button uses solid border (no dashed)

- [ ] **Step 4: Click Effects chip**

Verify:
- Opens merged view: pill chips + scope selector + channel row(s)
- Clicking a pill chip applies to all channels
- Switching scope to "Per Hand" shows 2 channel rows
- Switching to "Per Tip" shows 4 rows (2 tips per staff)

- [ ] **Step 5: Click Effort chip**

Verify same merged pattern: pill chips + scope + 4x2 effort grid per channel.

- [ ] **Step 6: Check footer**

Verify Copy All and Clear All use the quieter styling.
