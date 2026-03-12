<!--
  TrailPointAssignmentSection.svelte

  Lets users assign trail endpoints to existing tip points or custom
  positions. Appears below the Actions section in the Tip Points tab.
  Both trail endpoints use the same source — tap a numbered tip point
  chip to assign it, or tap Auto/Off/Custom.
-->
<script lang="ts">
  import type { EffectPointEditorState } from "../state/effect-point-editor-state.svelte";
  import type { TrailPointConfig, TrailPointSource } from "$lib/shared/animation-engine/domain/types/TrailPointTypes";

  interface Props {
    editorState: EffectPointEditorState;
  }

  const { editorState }: Props = $props();

  // Both sides use the same source, so just read from left
  let source = $derived(editorState.trailConfig?.left ?? null);

  function getActiveChip(s: TrailPointSource | null): string {
    if (!s) return "auto";
    if (s.type === "none") return "off";
    if (s.type === "tip") return `tip-${s.index}`;
    if (s.type === "custom") return "custom";
    return "auto";
  }

  let activeChip = $derived(getActiveChip(source));

  function selectChip(chipId: string) {
    if (chipId === "auto") {
      editorState.clearTrailConfig();
      return;
    }

    let newSource: TrailPointSource;
    if (chipId === "off") {
      newSource = { type: "none" };
    } else if (chipId === "custom") {
      if (source?.type === "custom") {
        newSource = source;
      } else {
        newSource = { type: "custom", dx: 0, dy: 0 };
      }
    } else if (chipId.startsWith("tip-")) {
      const index = parseInt(chipId.replace("tip-", ""), 10);
      newSource = { type: "tip", index };
    } else {
      return;
    }

    // Same source for both endpoints
    const config: TrailPointConfig = { left: newSource, right: newSource };
    editorState.saveTrailConfig(config);
  }

  function handleCustomDxDy(field: "dx" | "dy", raw: string) {
    const value = parseFloat(raw);
    if (!Number.isFinite(value)) return;
    const rounded = Math.round(value * 10) / 10;

    if (source?.type !== "custom") return;

    const updated: TrailPointSource = {
      type: "custom",
      dx: field === "dx" ? rounded : source.dx,
      dy: field === "dy" ? rounded : source.dy,
    };

    const config: TrailPointConfig = { left: updated, right: updated };
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

  <div class="chip-row" role="radiogroup" aria-label="Trail endpoint source">
    <!-- Auto chip -->
    <button
      class="chip"
      class:active={activeChip === "auto"}
      role="radio"
      aria-checked={activeChip === "auto"}
      onclick={() => selectChip("auto")}
      title="Use geometric calculation (default)"
    >Auto</button>

    <!-- Tip point chips -->
    {#each editorState.points as _, i}
      <button
        class="chip chip-tip"
        class:active={activeChip === `tip-${i}`}
        role="radio"
        aria-checked={activeChip === `tip-${i}`}
        onclick={() => selectChip(`tip-${i}`)}
        title="Tip {i + 1}: ({editorState.points[i].dx}, {editorState.points[i].dy})"
      >{i + 1}</button>
    {/each}

    <!-- Custom chip -->
    <button
      class="chip"
      class:active={activeChip === "custom"}
      role="radio"
      aria-checked={activeChip === "custom"}
      onclick={() => selectChip("custom")}
      title="Custom dx/dy offset"
    >
      <i class="fas fa-pen" aria-hidden="true"></i>
    </button>

    <!-- Off chip -->
    <button
      class="chip chip-off"
      class:active={activeChip === "off"}
      role="radio"
      aria-checked={activeChip === "off"}
      onclick={() => selectChip("off")}
      title="No trails"
    >
      <i class="fas fa-ban" aria-hidden="true"></i>
    </button>
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
          onchange={(e) => handleCustomDxDy("dx", (e.target as HTMLInputElement).value)}
        />
      </label>
      <label class="coord-field">
        <span class="coord-label">dy</span>
        <input
          type="number"
          class="coord-input"
          step="0.1"
          value={source.dy}
          onchange={(e) => handleCustomDxDy("dy", (e.target as HTMLInputElement).value)}
        />
      </label>
    </div>
  {/if}
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
    margin: 0 0 var(--spacing-sm, 8px);
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
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

  /* Numbered tip chips */
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
    margin-top: var(--spacing-sm, 8px);
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
