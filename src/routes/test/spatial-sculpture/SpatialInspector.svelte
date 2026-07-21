<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import {
    HAND_OPTIONS,
    LOCATION_LABELS,
    ORIENTATION_OPTIONS,
    PLANE_LABELS,
    PLANE_OPTIONS,
    PRESET_OPTIONS,
    TURN_OPTIONS,
    type BeatOrientation,
    type BeatTurns,
    type PrimaryPlane,
    type PropSide,
    type SculpturePreset,
    type SpatialBeat,
  } from "./spatial-sculpture-model";

  interface Props {
    beat: SpatialBeat;
    beatIndex: number;
    beatCount: number;
    activeHand: PropSide;
    preset: SculpturePreset;
    showGrid: boolean;
    showNodes: boolean;
    showTrails: boolean;
    onhandchange: (side: PropSide) => void;
    onplanechange: (plane: PrimaryPlane) => void;
    onorientationchange: (orientation: BeatOrientation) => void;
    onturnchange: (turns: BeatTurns) => void;
    onpresetchange: (preset: SculpturePreset) => void;
    ontogglegrid: () => void;
    ontogglenodes: () => void;
    ontoggletrails: () => void;
    onremovebeat: () => void;
  }

  let {
    beat,
    beatIndex,
    beatCount,
    activeHand,
    preset,
    showGrid,
    showNodes,
    showTrails,
    onhandchange,
    onplanechange,
    onorientationchange,
    onturnchange,
    onpresetchange,
    ontogglegrid,
    ontogglenodes,
    ontoggletrails,
    onremovebeat,
  }: Props = $props();

  const activeLocation = $derived(
    activeHand === "blue" ? beat.blueLocation : beat.redLocation
  );
  const activeOrientation = $derived(
    activeHand === "blue" ? beat.blueOrientation : beat.redOrientation
  );
  const copyCount = $derived(
    PRESET_OPTIONS.find((option) => option.value === preset)?.count ?? 1
  );
</script>

<div class="inspector-stack">
  <section class="inspector-section selected-card">
    <div class="selected-copy">
      <span class="eyebrow">Selected beat</span>
      <strong>Beat {beatIndex + 1}</strong>
      <span class="beat-summary">
        {PLANE_LABELS[beat.plane]} · {beat.turns} turn
      </span>
    </div>
    <span class="beat-count">{beatIndex + 1} / {beatCount}</span>
  </section>

  <section class="inspector-section">
    <div class="section-heading">
      <span>Editing</span>
      <span class="section-value {activeHand}">
        {activeHand === "blue" ? "Blue" : "Red"}
      </span>
    </div>
    <SegmentedControl
      options={HAND_OPTIONS}
      value={activeHand}
      onchange={onhandchange}
      color={activeHand}
      size="sm"
    />
    <div class="location-card">
      <span class="location-label">Point</span>
      <strong>{LOCATION_LABELS[activeLocation]}</strong>
    </div>
    <p class="field-help">Pick a point in the viewport to move this path.</p>
  </section>

  <section class="inspector-section">
    <div class="section-heading">
      <span>Plane</span>
      <span class="section-value">Per beat</span>
    </div>
    <SegmentedControl
      options={PLANE_OPTIONS}
      value={beat.plane}
      onchange={onplanechange}
      color="accent"
      size="sm"
    />
  </section>

  <section class="inspector-section split-fields">
    <div class="field-group">
      <div class="section-heading">
        <span>Orientation</span>
      </div>
      <SegmentedControl
        options={ORIENTATION_OPTIONS}
        value={activeOrientation}
        onchange={onorientationchange}
        color={activeHand}
        size="sm"
      />
    </div>
    <div class="field-group">
      <div class="section-heading">
        <span>Turns</span>
      </div>
      <SegmentedControl
        options={TURN_OPTIONS}
        value={beat.turns}
        onchange={onturnchange}
        color="accent"
        size="sm"
      />
    </div>
  </section>

  <section class="inspector-section">
    <div class="section-heading">
      <span>Symmetry recipe</span>
      <span class="section-value copies">{copyCount} paths</span>
    </div>
    <SegmentedControl
      options={PRESET_OPTIONS}
      value={preset}
      onchange={onpresetchange}
      color="accent"
      size="sm"
    />
  </section>

  <section class="inspector-section">
    <div class="section-heading">
      <span>Display</span>
    </div>
    <div class="display-toggles">
      <FilterChipBase
        mode="toggle"
        emphasis="solid"
        size="sm"
        label="Planes"
        icon="fas fa-border-all"
        active={showGrid}
        onclick={ontogglegrid}
      />
      <FilterChipBase
        mode="toggle"
        emphasis="solid"
        size="sm"
        label="Nodes"
        icon="fas fa-circle-dot"
        active={showNodes}
        onclick={ontogglenodes}
      />
      <FilterChipBase
        mode="toggle"
        emphasis="solid"
        size="sm"
        label="Trails"
        icon="fas fa-route"
        active={showTrails}
        onclick={ontoggletrails}
      />
    </div>
  </section>

  <div class="remove-action">
    <PanelButton
      variant="secondary"
      fullWidth
      disabled={beatCount <= 2}
      onclick={onremovebeat}
    >
      <i class="fas fa-trash-can" aria-hidden="true"></i>
      <span>Remove beat</span>
    </PanelButton>
  </div>
</div>

<style>
  .inspector-stack {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 10px);
    min-width: 0;
  }

  .inspector-section {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 9px);
    padding: 13px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 14px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
  }

  .selected-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #8b6cff) 42%,
      var(--theme-stroke, transparent)
    );
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--theme-accent, #8b6cff) 14%, transparent),
        transparent 72%
      ),
      var(--theme-card-bg, rgba(255, 255, 255, 0.045));
  }

  .selected-copy {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .selected-copy strong {
    font-size: 1.05rem;
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
  }

  .eyebrow,
  .section-heading,
  .location-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 650;
    letter-spacing: 0.065em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
  }

  .beat-summary,
  .field-help {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
  }

  .beat-count {
    min-width: 5.5ch;
    padding: 6px 8px;
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b6cff) 16%,
      transparent
    );
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 18px;
  }

  .section-value {
    min-width: 7ch;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    text-align: right;
    text-transform: none;
    letter-spacing: 0;
  }

  .section-value.blue {
    color: var(--prop-blue, #38a9ff);
  }

  .section-value.red {
    color: var(--prop-red, #ff516a);
  }

  .section-value.copies {
    min-width: 7ch;
    font-variant-numeric: tabular-nums;
  }

  .location-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 11px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-sm, 10px);
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #11111b) 72%,
      transparent
    );
  }

  .location-card strong {
    min-width: 10ch;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    text-align: right;
  }

  .field-help {
    min-height: 2.7em;
    margin: 0;
    line-height: 1.35;
  }

  .split-fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .field-group {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .display-toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .remove-action {
    padding: 2px 0 8px;
  }

  @container inspector (max-width: 300px) {
    .split-fields {
      grid-template-columns: 1fr;
    }
  }
</style>
