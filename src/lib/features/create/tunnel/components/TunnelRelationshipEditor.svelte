<script lang="ts">
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import FuseRotationDial from "$lib/features/fuse/components/FuseRotationDial.svelte";
  import { copyOpsLabel } from "$lib/shared/sequence-viewer/tunnel/tunnel-composition";
  import { getTunnelCreatorContext } from "../context/tunnel-creator-context";
  import type { TunnelReflection } from "../domain/tunnel-relationship-rule";

  const state = getTunnelCreatorContext();
  const reflectionOptions = [
    { value: "none", label: "None" },
    { value: "mirror", label: "Mirror" },
    { value: "flip", label: "Flip" },
  ] satisfies { value: TunnelReflection; label: string }[];
  const speedOptions = [0.25, 0.5, 1, 2, 4].map((speed) => ({
    value: String(speed),
    label: `${speed}×`,
  }));
</script>

<section
  class="relationship themed-scrollbar"
  aria-labelledby="relationship-title"
>
  <header>
    <div>
      <span class="eyebrow">Pairing transformation</span>
      <h3 id="relationship-title">Performer 1 → Performer 2</h3>
    </div>
    <span class="recipe">{copyOpsLabel(state.relationshipOps)}</span>
  </header>

  <div class="relationship-grid">
    <div class="rotation-card">
      <h4 id="tunnel-rotation-label">Rotation</h4>
      <FuseRotationDial
        value={state.relationship.rotationSteps}
        accent="var(--theme-accent)"
        labelledBy="tunnel-rotation-label"
        onchange={(rotationSteps) => state.setRelationship({ rotationSteps })}
      />
    </div>

    <div class="rule-stack">
      <div class="control-group">
        <span class="control-label">Reflection</span>
        <SegmentedControl
          options={reflectionOptions}
          value={state.relationship.reflect}
          onchange={(reflect) => state.setRelationship({ reflect })}
          semantics="radiogroup"
          ariaLabel="Performer 2 reflection"
          color="accent"
          size="sm"
        />
      </div>

      <div class="chip-row" aria-label="Performer 2 motion transforms">
        <FilterChipBase
          label="Invert"
          icon="fas fa-arrows-rotate"
          mode="toggle"
          active={state.relationship.invert}
          chipColor="var(--theme-accent)"
          onclick={() =>
            state.setRelationship({ invert: !state.relationship.invert })}
        />
        <FilterChipBase
          label="Rewind"
          icon="fas fa-backward"
          mode="toggle"
          active={state.relationship.rewind}
          chipColor="var(--theme-accent)"
          onclick={() =>
            state.setRelationship({ rewind: !state.relationship.rewind })}
        />
      </div>

      <div class="control-group">
        <span class="control-label">Performer 2 speed</span>
        <SegmentedControl
          options={speedOptions}
          value={String(state.partner?.timing.speed ?? 1)}
          onchange={(value) => state.setPartnerTiming({ speed: Number(value) })}
          semantics="radiogroup"
          ariaLabel="Performer 2 speed"
          color="accent"
          size="sm"
        />
      </div>

      <div class="offset-row">
        <div>
          <span class="control-label">Start offset</span>
          <span class="offset-hint">Shift Performer 2 around the sequence</span>
        </div>
        <div class="stepper" aria-label="Performer 2 start offset">
          <button
            type="button"
            aria-label="Decrease Performer 2 offset"
            onclick={() =>
              state.setPartnerTiming({
                stepOffset: Math.max(
                  0,
                  (state.partner?.timing.stepOffset ?? 0) - 1
                ),
              })}><i class="fas fa-minus" aria-hidden="true"></i></button
          >
          <output>{state.partner?.timing.stepOffset ?? 0}</output>
          <button
            type="button"
            aria-label="Increase Performer 2 offset"
            onclick={() =>
              state.setPartnerTiming({
                stepOffset: (state.partner?.timing.stepOffset ?? 0) + 1,
              })}><i class="fas fa-plus" aria-hidden="true"></i></button
          >
        </div>
      </div>
    </div>
  </div>
</section>

<style>
  .relationship {
    container-type: inline-size;
    display: grid;
    gap: var(--settings-spacing-md, 16px);
    min-height: 0;
    padding: var(--settings-spacing-lg, 20px);
    overflow: auto;
    background: var(--theme-panel-bg);
  }

  header,
  .offset-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  header div,
  .offset-row > div:first-child {
    display: grid;
    gap: 2px;
  }

  .eyebrow,
  .control-label {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  h3,
  h4 {
    margin: 0;
    color: var(--theme-text);
  }

  h3 {
    font-size: var(--font-size-md, 16px);
  }
  h4 {
    font-size: var(--font-size-min, 14px);
    text-align: center;
  }

  .recipe {
    max-width: 50%;
    padding: 5px 9px;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--settings-radius-sm, 8px);
    color: var(--theme-text);
    background: var(--theme-card-bg);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    text-align: right;
  }

  .relationship-grid {
    display: grid;
    grid-template-columns: minmax(11rem, 0.8fr) minmax(15rem, 1.2fr);
    gap: var(--settings-spacing-lg, 20px);
    align-items: center;
  }

  .rotation-card,
  .rule-stack,
  .control-group {
    display: grid;
    gap: 10px;
  }

  .rotation-card,
  .rule-stack {
    min-width: 0;
    padding: var(--settings-spacing-md, 16px);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--settings-radius-md, 14px);
    background: var(--theme-card-bg);
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .offset-row {
    min-height: var(--min-touch-target, 44px);
  }

  .offset-hint {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
  }

  .stepper {
    display: grid;
    grid-template-columns: 44px 2.5rem 44px;
    align-items: center;
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    overflow: hidden;
  }

  .stepper button {
    min-width: 44px;
    min-height: 44px;
    border: 0;
    color: var(--theme-text);
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    cursor: pointer;
  }

  .stepper button:hover {
    background: var(--theme-card-hover-bg);
  }
  .stepper button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: -3px;
  }
  output {
    color: var(--theme-text);
    font-weight: 800;
    text-align: center;
  }

  @container (max-width: 660px) {
    .relationship-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .stepper button {
      transition: none;
    }
  }
</style>
