<!--
  TrailPointAssignmentSection.svelte

  Lets users assign trail endpoints to existing tip points or custom
  positions. Appears below the Actions section in the Tip Points tab.
  Each prop type can have up to 2 trail endpoints (left, right).

  Uses a chip selector instead of dropdowns — tap a numbered tip point
  chip to assign it, or tap Auto/Off/Custom.
-->
<script lang="ts">
  import type { EffectPointEditorState } from "../state/effect-point-editor-state.svelte";
  import type { TrailPointConfig, TrailPointSource } from "$lib/shared/animation-engine/domain/types/TrailPointTypes";

  interface Props {
    editorState: EffectPointEditorState;
  }

  const { editorState }: Props = $props();

  let leftSource = $derived(editorState.trailConfig?.left ?? null);
  let rightSource = $derived(editorState.trailConfig?.right ?? null);

  // Which chip is active for each side
  function getActiveChip(source: TrailPointSource | null): string {
    if (!source) return "auto";
    if (source.type === "none") return "off";
    if (source.type === "tip") return `tip-${source.index}`;
    if (source.type === "custom") return "custom";
    return "auto";
  }

  let leftActive = $derived(getActiveChip(leftSource));
  let rightActive = $derived(getActiveChip(rightSource));

  function selectChip(side: "left" | "right", chipId: string) {
    const otherSource = side === "left" ? rightSource : leftSource;
    const otherActive = side === "left" ? rightActive : leftActive;
    const currentSource = side === "left" ? leftSource : rightSource;

    // Auto = clear this side's assignment
    if (chipId === "auto") {
      if (otherActive === "auto") {
        // Both auto = clear entire trail config
        editorState.clearTrailConfig();
        return;
      }
      const config: TrailPointConfig = {
        left: side === "left" ? { type: "none" } : (leftSource ?? { type: "none" }),
        right: side === "right" ? { type: "none" } : (rightSource ?? { type: "none" }),
      };
      // Actually for "auto" we want geometric fallback, but TrailPointSource
      // doesn't have a "default" type. If we set both to "none", the calculator
      // returns center. Instead, if this side is "auto" and the other has a config,
      // we need a way to say "use geometric for this side." The simplest approach:
      // when one side is auto, don't include it in the config at all.
      // But TrailPointConfig requires both. So "auto" = clear the whole config
      // if the other side is also auto, or set this side to a tip that matches
      // the geometric position. Actually the cleanest solution: if the user picks
      // "auto" for one side, we interpret it as "none" (disabled) when the other
      // side has an assignment. The geometric fallback only kicks in when there's
      // NO trail config at all.
      //
      // Revised: "Auto" clears the entire config. If you want one side only,
      // use "Off" on the other.
      editorState.clearTrailConfig();
      return;
    }

    let newSource: TrailPointSource;
    if (chipId === "off") {
      newSource = { type: "none" };
    } else if (chipId === "custom") {
      // Preserve existing custom values
      if (currentSource?.type === "custom") {
        newSource = currentSource;
      } else {
        newSource = { type: "custom", dx: 0, dy: 0 };
      }
    } else if (chipId.startsWith("tip-")) {
      const index = parseInt(chipId.replace("tip-", ""), 10);
      newSource = { type: "tip", index };
    } else {
      return;
    }

    const config: TrailPointConfig = {
      left: side === "left" ? newSource : (leftSource ?? { type: "none" }),
      right: side === "right" ? newSource : (rightSource ?? { type: "none" }),
    };
    editorState.saveTrailConfig(config);
  }

  function handleCustomDxDy(side: "left" | "right", field: "dx" | "dy", raw: string) {
    const value = parseFloat(raw);
    if (!Number.isFinite(value)) return;
    const rounded = Math.round(value * 10) / 10;

    const currentSource = side === "left" ? leftSource : rightSource;
    if (currentSource?.type !== "custom") return;

    const updated: TrailPointSource = {
      type: "custom",
      dx: field === "dx" ? rounded : currentSource.dx,
      dy: field === "dy" ? rounded : currentSource.dy,
    };

    const config: TrailPointConfig = {
      left: side === "left" ? updated : (leftSource ?? { type: "none" }),
      right: side === "right" ? updated : (rightSource ?? { type: "none" }),
    };
    editorState.saveTrailConfig(config);
  }
</script>

<div class="section">
  <h3>
    <i class="fas fa-route" aria-hidden="true"></i>
    Trail Points
  </h3>
  <p class="section-desc">
    Pick where trail lines emit from. Auto uses prop geometry.
  </p>

  {#each ["left", "right"] as side}
    {@const active = side === "left" ? leftActive : rightActive}
    {@const source = side === "left" ? leftSource : rightSource}

    <div class="trail-side">
      <span class="side-label">{side === "left" ? "L" : "R"}</span>

      <div class="chip-row" role="radiogroup" aria-label="{side} trail endpoint">
        <!-- Auto chip -->
        <button
          class="chip"
          class:active={active === "auto"}
          role="radio"
          aria-checked={active === "auto"}
          onclick={() => selectChip(side as "left" | "right", "auto")}
          title="Use geometric calculation (default)"
        >Auto</button>

        <!-- Tip point chips -->
        {#each editorState.points as _, i}
          <button
            class="chip chip-tip"
            class:active={active === `tip-${i}`}
            role="radio"
            aria-checked={active === `tip-${i}`}
            onclick={() => selectChip(side as "left" | "right", `tip-${i}`)}
            title="Tip {i + 1}: ({editorState.points[i].dx}, {editorState.points[i].dy})"
          >{i + 1}</button>
        {/each}

        <!-- Custom chip -->
        <button
          class="chip"
          class:active={active === "custom"}
          role="radio"
          aria-checked={active === "custom"}
          onclick={() => selectChip(side as "left" | "right", "custom")}
          title="Custom dx/dy offset"
        >
          <i class="fas fa-pen" aria-hidden="true"></i>
        </button>

        <!-- Off chip -->
        <button
          class="chip chip-off"
          class:active={active === "off"}
          role="radio"
          aria-checked={active === "off"}
          onclick={() => selectChip(side as "left" | "right", "off")}
          title="No trail from this end"
        >
          <i class="fas fa-ban" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <!-- Custom coordinate inputs -->
    {#if source?.type === "custom"}
      <div class="custom-coords">
        <label class="coord-field">
          <span class="coord-label">dx</span>
          <input
            type="number"
            class="coord-input"
            step="0.1"
            value={source.dx}
            onchange={(e) => handleCustomDxDy(side as "left" | "right", "dx", (e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="coord-field">
          <span class="coord-label">dy</span>
          <input
            type="number"
            class="coord-input"
            step="0.1"
            value={source.dy}
            onchange={(e) => handleCustomDxDy(side as "left" | "right", "dy", (e.target as HTMLInputElement).value)}
          />
        </label>
      </div>
    {/if}
  {/each}
</div>

<style>
  .section {
    padding: var(--spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
  }

  .section h3 {
    margin: 0 0 var(--spacing-xs, 4px);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
  }

  .section-desc {
    margin: 0 0 var(--spacing-md, 16px);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* Each side row: label + chips */
  .trail-side {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    margin-bottom: var(--spacing-sm, 8px);
  }

  .side-label {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    background: var(--theme-overlay-dark, rgba(0, 0, 0, 0.25));
    border-radius: 6px;
    flex-shrink: 0;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  /* Base chip */
  .chip {
    min-width: 36px;
    height: 36px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 9999px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 120ms ease;
    user-select: none;
  }

  .chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    color: var(--theme-text, white);
    background: rgba(255, 255, 255, 0.04);
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 1px;
  }

  /* Active state — glowing accent */
  .chip.active {
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-accent, #8b5cf6);
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 12%, transparent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--theme-accent, #8b5cf6) 25%, transparent);
  }

  /* Numbered tip chips — slightly wider to look like badges */
  .chip-tip {
    min-width: 36px;
    font-weight: 700;
    font-size: var(--font-size-min, 14px);
  }

  /* Off chip — red tint when active */
  .chip-off.active {
    border-color: var(--semantic-error, #ef4444);
    color: var(--semantic-error, #ef4444);
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--semantic-error, #ef4444) 20%, transparent);
  }

  /* Custom coordinate inputs */
  .custom-coords {
    display: flex;
    gap: 6px;
    padding-left: 32px;
    margin-bottom: var(--spacing-sm, 8px);
  }

  .coord-field {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .coord-label {
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    flex-shrink: 0;
  }

  .coord-input {
    width: 100%;
    min-width: 0;
    height: 36px;
    padding: 6px 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: var(--border-radius-sm, 4px);
    background: var(--theme-overlay-dark, rgba(0, 0, 0, 0.3));
    color: var(--theme-text, white);
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-min, 14px);
    text-align: right;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  .coord-input::-webkit-inner-spin-button,
  .coord-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .coord-input:focus {
    outline: none;
    border-color: var(--theme-accent, #8b5cf6);
  }

  @media (prefers-reduced-motion: reduce) {
    .chip {
      transition: none;
    }
  }
</style>
