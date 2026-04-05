<!--
  EffortMatrixDrawer.svelte

  Matrix UI for assigning effort qualities to individual prop tip points.
  Three scope levels: Cell (1 row), Per Hand (2 rows), Per Tip (N rows).
  Opens as an overlay from the Effort section in CellEditorPanel.
-->
<script lang="ts">
  import type {
    TipEffortMap,
  } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";
  import { EFFORTS } from "$lib/features/effort-lab/domain/effort-types";
  import { getTipPoints } from "$lib/shared/animation-engine/domain/types/PropTipPoints";

  type Scope = "cell" | "hand" | "tip";

  const allProps: {
    currentMap: TipEffortMap;
    bluePropType: string;
    redPropType: string;
    onUpdateMap: (map: TipEffortMap) => void;
    onClose: () => void;
  } = $props();

  // Initialize from currentMap via $effect.pre — access through allProps to track reactively.
  // The drawer mounts fresh each time, so this runs once per lifecycle.
  let scope: Scope = $state<Scope>("cell");
  let localMap: TipEffortMap = $state<TipEffortMap>({});
  $effect.pre(() => {
    scope = inferScope(allProps.currentMap);
    localMap = { ...allProps.currentMap };
  });

  const scopes: { value: Scope; label: string; icon: string }[] = [
    { value: "cell", label: "Cell", icon: "fa-border-all" },
    { value: "hand", label: "Per Hand", icon: "fa-hand" },
    { value: "tip", label: "Per Tip", icon: "fa-crosshairs" },
  ];

  // Build channel rows based on current scope
  interface ChannelRow {
    key: string;
    color: string;
    label: string;
  }

  const blueTipCount = $derived(getTipPoints(allProps.bluePropType).points.length);
  const redTipCount = $derived(getTipPoints(allProps.redPropType).points.length);

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

    // Per-tip scope
    const rows: ChannelRow[] = [];
    for (let t = 0; t < blueTipCount; t++) {
      rows.push({
        key: `0-${t}`,
        color: "#3b82f6",
        label: `Blue ${getTipLabel(allProps.bluePropType, t, blueTipCount)}`,
      });
    }
    for (let t = 0; t < redTipCount; t++) {
      rows.push({
        key: `1-${t}`,
        color: "#ef4444",
        label: `Red ${getTipLabel(allProps.redPropType, t, redTipCount)}`,
      });
    }
    return rows;
  });

  function getTipLabel(
    propType: string,
    tipIndex: number,
    tipCount: number
  ): string {
    if (tipCount === 1) return "tip";
    if (tipCount === 2) return tipIndex === 0 ? "thumb" : "pinky";
    return `tip ${tipIndex + 1}`;
  }

  function getEffortForKey(key: string): EffortId {
    return localMap[key]?.effort ?? "linear";
  }

  function setEffort(key: string, effort: EffortId) {
    localMap = { ...localMap, [key]: { effort } };
    allProps.onUpdateMap(localMap);
  }

  function applyToAll(effort: EffortId) {
    const newMap: TipEffortMap = {};
    for (const ch of channels) {
      newMap[ch.key] = { effort };
    }
    localMap = newMap;
    allProps.onUpdateMap(localMap);
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
      // Per-tip: expand from parent
      if (oldScope === "cell") {
        const base = localMap["*"]?.effort ?? "linear";
        for (let t = 0; t < blueTipCount; t++)
          newMap[`0-${t}`] = { effort: base };
        for (let t = 0; t < redTipCount; t++)
          newMap[`1-${t}`] = { effort: base };
      } else {
        const blueEffort = localMap["0"]?.effort ?? "linear";
        const redEffort = localMap["1"]?.effort ?? "linear";
        for (let t = 0; t < blueTipCount; t++)
          newMap[`0-${t}`] = { effort: blueEffort };
        for (let t = 0; t < redTipCount; t++)
          newMap[`1-${t}`] = { effort: redEffort };
      }
    }

    scope = newScope;
    localMap = newMap;
    allProps.onUpdateMap(localMap);
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
    if (keys.length === 0 || (keys.length === 1 && keys[0] === "*"))
      return "cell";
    if (keys.some((k) => k.includes("-"))) return "tip";
    if (keys.includes("0") || keys.includes("1")) return "hand";
    return "cell";
  }

</script>

<div class="matrix-overlay">
  <div class="matrix-panel">
    <!-- Header -->
    <header class="panel-header">
      <h3 class="panel-title">
        <i class="fas fa-gauge" aria-hidden="true"></i>
        Effort Matrix
      </h3>
      <button class="done-btn" onclick={allProps.onClose}>Done</button>
    </header>

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

    <!-- Channel rows -->
    <div class="matrix-section">
      {#each channels as ch (ch.key)}
        <div class="channel">
          <div class="channel-id">
            <span
              class="channel-dot"
              style:background={ch.color}
            ></span>
            <span class="channel-label">{ch.label}</span>
          </div>
          <div class="channel-efforts">
            {#each EFFORTS as effort}
              <button
                class="effort-btn"
                class:active={getEffortForKey(ch.key) === effort.id}
                title={effort.label}
                onclick={() => setEffort(ch.key, effort.id)}
                style:--effort-color={effort.color}
              >
                <span class="effort-dot" style:background={effort.color}></span>
              </button>
            {/each}
          </div>
        </div>
      {/each}

      <!-- Quick-apply bar -->
      <div class="quick-apply">
        <span class="quick-apply-label">Apply to all:</span>
        <div class="quick-apply-btns">
          {#each EFFORTS as effort}
            <button
              class="quick-btn"
              onclick={() => applyToAll(effort.id)}
              style:--effort-color={effort.color}
            >
              <span class="effort-dot" style:background={effort.color}></span>
              {effort.label}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .matrix-overlay {
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: slideDown 180ms ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .matrix-panel {
    display: flex;
    flex-direction: column;
  }

  /* Header */
  .panel-header {
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .panel-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--theme-text, white);
  }

  .panel-title i {
    opacity: 0.5;
    font-size: 13px;
  }

  .done-btn {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.35);
    cursor: pointer;
    background: none;
    border: none;
    padding: 6px 10px;
    border-radius: 6px;
    min-height: 44px;
    min-width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms ease;
  }

  .done-btn:hover {
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.06);
  }

  /* Scope selector */
  .scope-section {
    padding: 14px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .scope-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.2));
    font-weight: 600;
    margin-bottom: 8px;
    display: block;
  }

  .scope-strip {
    display: flex;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    overflow: hidden;
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

  .scope-seg:last-child {
    border-right: none;
  }

  .scope-seg:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.7);
  }

  .scope-seg.active {
    background: rgba(139, 92, 246, 0.15);
    color: #c084fc;
    box-shadow: inset 0 -2px 0 #a855f7;
  }

  .scope-seg i {
    font-size: 14px;
  }

  /* Matrix section */
  .matrix-section {
    padding: 16px 20px;
    flex: 1;
    overflow-y: auto;
  }

  /* Channel row */
  .channel {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    margin-bottom: 8px;
    min-height: 56px;
    transition: border-color 150ms ease;
  }

  .channel:hover {
    border-color: rgba(255, 255, 255, 0.12);
  }

  .channel-id {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 48px;
  }

  .channel-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1.5px solid rgba(255, 255, 255, 0.15);
  }

  .channel-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.3);
    font-weight: 600;
    text-align: center;
  }

  /* Effort buttons in channel — 2 rows of 4 for the 8 efforts */
  .channel-efforts {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    flex: 1;
  }

  .effort-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
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
    background: color-mix(in srgb, var(--effort-color, #94a3b8) 15%, transparent);
    border-color: color-mix(in srgb, var(--effort-color, #94a3b8) 40%, transparent);
    border-width: 1.5px;
  }

  .effort-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .effort-btn.active .effort-dot {
    box-shadow: 0 0 6px var(--effort-color, #94a3b8);
  }

  /* Quick-apply bar */
  .quick-apply {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 12px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.08);
    border-radius: 8px;
  }

  .quick-apply-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
    padding-top: 6px;
  }

  .quick-apply-btns {
    display: flex;
    gap: 4px;
    flex: 1;
    flex-wrap: wrap;
  }

  .quick-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 10px;
    min-height: 44px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 120ms ease;
  }

  .quick-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
  }

  .quick-btn .effort-dot {
    width: 6px;
    height: 6px;
  }

  @media (prefers-reduced-motion: reduce) {
    .matrix-overlay {
      animation: none;
    }

    .scope-seg,
    .effort-btn,
    .quick-btn,
    .done-btn,
    .channel {
      transition: none;
    }
  }
</style>
