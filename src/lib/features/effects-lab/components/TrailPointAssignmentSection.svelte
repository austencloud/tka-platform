<!--
  TrailPointAssignmentSection.svelte

  Lets users assign trail endpoints to existing tip points or custom
  positions. Appears below the Actions section in the Tip Points tab.
  Each prop type can have up to 2 trail endpoints (left, right).
-->
<script lang="ts">
  import type { EffectPointEditorState } from "../state/effect-point-editor-state.svelte";
  import type { TrailPointConfig, TrailPointSource } from "$lib/shared/animation-engine/domain/types/TrailPointTypes";

  interface Props {
    editorState: EffectPointEditorState;
  }

  const { editorState }: Props = $props();

  // Derive dropdown options from current tip points
  let tipOptions = $derived(
    editorState.points.map((p, i) => ({
      label: `Tip ${i + 1} (${p.dx}, ${p.dy})`,
      value: i,
    }))
  );

  // Current config, or defaults
  let leftSource = $derived(editorState.trailConfig?.left ?? null);
  let rightSource = $derived(editorState.trailConfig?.right ?? null);

  // Convert source to dropdown value for display
  function sourceToDropdownValue(source: TrailPointSource | null): string {
    if (!source) return "default";
    if (source.type === "none") return "none";
    if (source.type === "tip") return `tip-${source.index}`;
    if (source.type === "custom") return "custom";
    return "default";
  }

  // Convert dropdown value back to source.
  // "default" is handled by callers before this is called — should never reach here.
  function dropdownValueToSource(value: string, currentSource: TrailPointSource | null): TrailPointSource {
    if (value === "none") return { type: "none" };
    if (value === "custom") {
      // Preserve existing custom values if switching back to custom
      if (currentSource?.type === "custom") return currentSource;
      return { type: "custom", dx: 0, dy: 0 };
    }
    if (value.startsWith("tip-")) {
      const index = parseInt(value.replace("tip-", ""), 10);
      return { type: "tip", index };
    }
    // Should not reach here — "default" is handled by callers
    return { type: "none" };
  }

  let leftDropdownValue = $derived(sourceToDropdownValue(leftSource));
  let rightDropdownValue = $derived(sourceToDropdownValue(rightSource));

  function handleLeftChange(value: string) {
    const newLeft = value === "default" ? null : dropdownValueToSource(value, leftSource);
    if (value === "default" && rightDropdownValue === "default") {
      // Both default = clear trail config entirely
      editorState.trailConfig = null;
      editorState.clearTrailConfig();
      return;
    }
    const config: TrailPointConfig = {
      left: newLeft ?? { type: "none" },
      right: rightSource ?? { type: "none" },
    };
    editorState.saveTrailConfig(config);
  }

  function handleRightChange(value: string) {
    const newRight = value === "default" ? null : dropdownValueToSource(value, rightSource);
    if (value === "default" && leftDropdownValue === "default") {
      editorState.trailConfig = null;
      editorState.clearTrailConfig();
      return;
    }
    const config: TrailPointConfig = {
      left: leftSource ?? { type: "none" },
      right: newRight ?? { type: "none" },
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
    Pick where trail lines emit from. Defaults use prop geometry.
  </p>

  <div class="trail-assignments">
    <!-- Left trail -->
    <div class="trail-row">
      <label class="trail-label" for="trail-left">Left</label>
      <select
        id="trail-left"
        class="trail-select"
        value={leftDropdownValue}
        onchange={(e) => handleLeftChange((e.target as HTMLSelectElement).value)}
      >
        <option value="default">Geometric (default)</option>
        <option value="none">None (disabled)</option>
        {#each tipOptions as opt}
          <option value="tip-{opt.value}">{opt.label}</option>
        {/each}
        <option value="custom">Custom position</option>
      </select>
      {#if leftSource?.type === "custom"}
        <div class="custom-coords">
          <label class="coord-field">
            <span class="coord-label">dx</span>
            <input
              type="number"
              class="coord-input"
              step="0.1"
              value={leftSource.dx}
              onchange={(e) => handleCustomDxDy("left", "dx", (e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="coord-field">
            <span class="coord-label">dy</span>
            <input
              type="number"
              class="coord-input"
              step="0.1"
              value={leftSource.dy}
              onchange={(e) => handleCustomDxDy("left", "dy", (e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
      {/if}
    </div>

    <!-- Right trail -->
    <div class="trail-row">
      <label class="trail-label" for="trail-right">Right</label>
      <select
        id="trail-right"
        class="trail-select"
        value={rightDropdownValue}
        onchange={(e) => handleRightChange((e.target as HTMLSelectElement).value)}
      >
        <option value="default">Geometric (default)</option>
        <option value="none">None (disabled)</option>
        {#each tipOptions as opt}
          <option value="tip-{opt.value}">{opt.label}</option>
        {/each}
        <option value="custom">Custom position</option>
      </select>
      {#if rightSource?.type === "custom"}
        <div class="custom-coords">
          <label class="coord-field">
            <span class="coord-label">dx</span>
            <input
              type="number"
              class="coord-input"
              step="0.1"
              value={rightSource.dx}
              onchange={(e) => handleCustomDxDy("right", "dx", (e.target as HTMLInputElement).value)}
            />
          </label>
          <label class="coord-field">
            <span class="coord-label">dy</span>
            <input
              type="number"
              class="coord-input"
              step="0.1"
              value={rightSource.dy}
              onchange={(e) => handleCustomDxDy("right", "dy", (e.target as HTMLInputElement).value)}
            />
          </label>
        </div>
      {/if}
    </div>
  </div>
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

  .trail-assignments {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
  }

  .trail-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .trail-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, white);
  }

  .trail-select {
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-overlay-dark, rgba(0, 0, 0, 0.3));
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
  }

  .trail-select:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 1px;
  }

  .custom-coords {
    display: flex;
    gap: 6px;
    padding-left: 4px;
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
    .trail-select {
      transition: none;
    }
  }
</style>
