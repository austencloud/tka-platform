<script lang="ts">
  /**
   * Codex companion controls — rendered inside GuideCompanion when the reader's
   * active page is the Codex (spec: 2026-07-10-guide-codex-rebuild-design.md).
   * The Codex PAGE is the printable artifact (see GuideCodexPage.svelte); every
   * control that used to live in an on-page toolbar moves here. All three knobs
   * read/write the shared guide-codex-state.svelte.ts singleton, which the page
   * renders from live.
   */
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import CodexControlPanel from "$lib/features/learn/codex/components/CodexControlPanel.svelte";
  import PropTurnsControl from "$lib/features/create/shared/components/sequence-actions/PropTurnsControl.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { MotionColor, RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { getGuideCodexState } from "../_data/guide-codex-state.svelte";
  import type { GuideCodexVisibility } from "../_data/guide-codex-persistence";

  const state = getGuideCodexState();

  const PROP_OPTIONS: { value: PropType; label: string; icon: string }[] = [
    { value: PropType.STAFF, label: "Staff", icon: "fas fa-grip-lines-vertical" },
    { value: PropType.CLUB, label: "Club", icon: "fas fa-bowling-ball" },
    { value: PropType.BUUGENG, label: "Buugeng", icon: "fas fa-infinity" },
    { value: PropType.TRIAD, label: "Triad", icon: "fas fa-share-nodes" },
    { value: PropType.FAN, label: "Fan", icon: "fas fa-fan" },
    { value: PropType.MINIHOOP, label: "Mini Hoop", icon: "fas fa-ring" },
    { value: PropType.HAND, label: "Hand", icon: "fas fa-hand" },
  ];

  const VISIBILITY_CHIPS: { key: keyof GuideCodexVisibility; label: string; icon: string }[] = [
    { key: "showGlyph", label: "Glyph", icon: "fas fa-fire" },
    { key: "showGrid", label: "Grid", icon: "fas fa-border-all" },
    { key: "showTKA", label: "TKA", icon: "fas fa-font" },
    { key: "showPositions", label: "Positions", icon: "fas fa-location-dot" },
    { key: "showReversals", label: "Reversals", icon: "fas fa-left-right" },
    { key: "showNonRadialPoints", label: "Non-Radial", icon: "fas fa-circle-dot" },
  ];
</script>

<div class="codex-controls">
  <div class="group">
    <span class="group-label">Prop</span>
    <SegmentedControl
      options={PROP_OPTIONS}
      value={state.propType}
      onchange={(v) => state.setPropType(v)}
      color="accent"
      size="sm"
    />
  </div>

  <div class="group">
    <span class="group-label">Show</span>
    <div class="chip-row">
      {#each VISIBILITY_CHIPS as chip (chip.key)}
        <FilterChipBase
          mode="toggle"
          size="sm"
          label={chip.label}
          icon={chip.icon}
          active={state.visibility[chip.key]}
          onclick={() => state.toggleVisibility(chip.key)}
        />
      {/each}
    </div>
  </div>

  <div class="group">
    <span class="group-label">Turns</span>
    <div class="turns-row">
      <PropTurnsControl
        color="blue"
        turns={state.blueTurns}
        rotationDirection={RotationDirection.NO_ROTATION}
        showRotation={false}
        compact={true}
        onTurnsChange={(delta) => state.adjustTurns(MotionColor.BLUE, delta)}
        onRotationChange={() => {}}
      />
      <PropTurnsControl
        color="red"
        turns={state.redTurns}
        rotationDirection={RotationDirection.NO_ROTATION}
        showRotation={false}
        compact={true}
        onTurnsChange={(delta) => state.adjustTurns(MotionColor.RED, delta)}
        onRotationChange={() => {}}
      />
    </div>
  </div>

  <div class="group">
    <div class="group-label-row">
      <span class="group-label">Transform</span>
      {#if state.hasTransform}
        <FilterChipBase
          mode="action"
          size="sm"
          label="Reset"
          icon="fas fa-rotate-left"
          onclick={() => state.resetTransform()}
        />
      {/if}
    </div>
    <CodexControlPanel
      showOrientation={false}
      onRotate={() => state.applyTransform("rotate")}
      onMirror={() => state.applyTransform("mirror")}
      onColorSwap={() => state.applyTransform("colorswap")}
    />
  </div>
</div>

<style>
  .codex-controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-bottom: 0.65rem;
    margin-bottom: 0.15rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .group-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .group-label {
    font-size: var(--font-size-compact, 11px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }
  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .turns-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
