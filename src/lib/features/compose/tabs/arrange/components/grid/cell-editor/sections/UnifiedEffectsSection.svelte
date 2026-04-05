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
