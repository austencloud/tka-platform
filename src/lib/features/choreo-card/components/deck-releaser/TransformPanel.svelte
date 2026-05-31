<script lang="ts">
  /**
   * TransformPanel — the three deck-multiplying axes (Start register, Grid mode,
   * Reversal) as one section that matches the Families / Turn-Pattern sections:
   * a plain uppercase header with a live card count on the right, then the axis
   * controls. No separate card chrome — it reads as part of one cohesive board.
   *
   * Registers and Grid each multiply the deck; Reversal is build-one-apply-all.
   */
  import ModifierAxis from "./ModifierAxis.svelte";
  import TnDReversalStrip from "../TnDReversalStrip.svelte";
  import type { StartOriMode } from "../../services/deck-variation";
  import type { ResolvedReversalPattern } from "../../domain/reversal-transform";

  interface Props {
    startOriModes: Set<StartOriMode>;
    onToggleStartOriMode: (m: StartOriMode) => void;
    gridModes: Set<"diamond" | "box">;
    onToggleGridMode: (m: "diamond" | "box") => void;
    reversalPattern: ResolvedReversalPattern | null;
    onReversalChange: (p: ResolvedReversalPattern) => void;
    /** Initial open state of the Reversal spin grid. Default true (legacy). */
    reversalCustomDefault?: boolean;
  }

  const {
    startOriModes,
    onToggleStartOriMode,
    gridModes,
    onToggleGridMode,
    reversalPattern,
    onReversalChange,
    reversalCustomDefault = true,
  }: Props = $props();

  const ORI_REGISTERS = [
    { id: "radial", label: "Radial", icon: "fa-arrows-up-down" },
    { id: "nonradial", label: "Nonradial", icon: "fa-arrows-left-right" },
    { id: "split", label: "Mixed", icon: "fa-arrows-turn-right" },
  ];
  const GRID_MODES = [
    { id: "diamond", label: "Diamond", icon: "fa-diamond", glyph: "grid" as const },
    { id: "box", label: "Box", icon: "fa-square", glyph: "grid" as const },
  ];
</script>

<section class="transform">
  <header class="section-head">
    <span class="section-label">Transform</span>
  </header>

  <div class="rows">
    <ModifierAxis
      label="Orientations"
      options={ORI_REGISTERS}
      selected={startOriModes as Set<string>}
      onToggle={(id) => onToggleStartOriMode(id as StartOriMode)}
    />
    <ModifierAxis
      label="Grid"
      options={GRID_MODES}
      selected={gridModes as Set<string>}
      onToggle={(id) => onToggleGridMode(id as "diamond" | "box")}
    />
    <div class="reversal-row">
      <span class="section-sublabel">Reversal</span>
      <TnDReversalStrip
        collapsible
        startCustomOpen={reversalCustomDefault}
        activePatternId={reversalPattern?.id ?? null}
        onPatternChange={onReversalChange}
      />
    </div>
  </div>
</section>

<style>
  .transform {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
  }

  /* Same header treatment + hairline as the Families / Turn-Pattern sections. */
  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.07));
  }

  .section-label,
  .section-sublabel {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* Fill the column and distribute the three axes with equal space-evenly — so
     there's matching padding above the first and below the last, not just gaps
     between (space-between flings them to the edges). */
  .rows {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    justify-content: space-evenly;
    gap: 16px;
  }

  .reversal-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
</style>
