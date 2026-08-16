<!--
  FuseTransformPicker — symmetry-mode controls.

  A color-coded SegmentedControl chooses the driver. The shared wrapping
  OptionChipRow handles the larger transform family without crushing nine labels
  into one equal-width row. Both values are owned + persisted by fuse-state.
  Shown by FuseLayout only while the tab is in symmetry mode.
-->
<script lang="ts">
  import LOOPChoiceButton from "$lib/shared/components/loop-picker/LOOPChoiceButton.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import {
    fuseTransformGlyph,
    fuseTransformTint,
  } from "../domain/fuse-transform-presentation";
  import {
    FUSE_TRANSFORMS,
    type FuseTransformId,
  } from "../state/fuse-state.svelte";
  import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";

  let {
    embedded = false,
    driver,
    transform,
    onDriverChange,
    onTransformChange,
    relationshipLayout = false,
  }: {
    embedded?: boolean;
    driver?: FuseSide;
    transform?: FuseTransformId;
    onDriverChange?: (side: FuseSide) => void;
    onTransformChange?: (id: FuseTransformId) => void;
    relationshipLayout?: boolean;
  } = $props();
  const { state: fuseState } = getFuseContext();
  const selectedDriver = $derived(driver ?? fuseState.driverSide);
  const selectedTransform = $derived(transform ?? fuseState.transformId);

  // Inert while a length load or a fuse is in flight, so a change can't race the
  // derive it would trigger.
  const disabled = $derived(
    fuseState.isLoadingLength ||
      fuseState.pendingSide !== null ||
      fuseState.isFusing
  );

  const driverOptions = $derived(
    (
      [
        { value: "blue", label: "Blue", tone: "blue" },
        { value: "red", label: "Red", tone: "red" },
      ] as {
        value: FuseSide;
        label: string;
        tone: "blue" | "red";
      }[]
    ).map((option) => ({ ...option, disabled }))
  );

  // Each rule IS a LOOP primitive, so each renders as the same choice button
  // the Extend drawer uses — same glyph, same brand colours, and the same
  // two-stop sweep when a rule composes two primitives.
  const transformOptions = $derived(
    FUSE_TRANSFORMS.map((transform) => ({
      ...transform,
      glyph: fuseTransformGlyph(transform.id),
      tint: fuseTransformTint(transform.id),
    }))
  );

  const followerLabel = $derived(selectedDriver === "blue" ? "Red" : "Blue");
  const driverLabel = $derived(selectedDriver === "blue" ? "Blue" : "Red");

  function handleDriver(value: FuseSide): void {
    if (onDriverChange) onDriverChange(value);
    else fuseState.setDriver(value);
  }

  function handleTransform(value: FuseTransformId): void {
    if (onTransformChange) onTransformChange(value);
    else fuseState.setTransform(value);
  }
</script>

<div
  class="transform-picker"
  class:embedded
  class:relationship-layout={relationshipLayout}
>
  <div class="field" role="group" aria-label="Path you will edit">
    <div class="field-heading">
      {#if relationshipLayout}<span class="step-number">1</span>{/if}
      <div>
        <span class="field-label">
          {relationshipLayout ? "Path you will edit" : "Driver"}
        </span>
        {#if relationshipLayout}
          <span class="field-help">{driverLabel} stays editable</span>
        {/if}
      </div>
    </div>
    <div class="field-control driver-control">
      <SegmentedControl
        options={driverOptions}
        value={selectedDriver}
        onchange={handleDriver}
        color="accent"
        size="md"
      />
    </div>
  </div>

  <div class="transform-options">
    <!-- One heading, not a heading plus a label repeating it: the rule and the
         path it rebuilds fit in the same two lines. -->
    {#if relationshipLayout}
      <div class="field-heading" id="fuse-rule-label">
        <span class="step-number">2</span>
        <div>
          <span class="field-label">Rule applied to {followerLabel}</span>
          <span class="field-help">
            Each choice previews a new {followerLabel} path
          </span>
        </div>
      </div>
    {:else}
      <span class="options-label" id="fuse-rule-label">
        {followerLabel} follows {driverLabel}
      </span>
    {/if}
    <div
      class="options-grid"
      role="radiogroup"
      aria-labelledby="fuse-rule-label"
      data-count={transformOptions.length}
    >
      {#each transformOptions as option (option.id)}
        <LOOPChoiceButton
          components={option.glyph.components}
          reflectionAxis={option.glyph.reflectionAxis}
          rotationPeriod={option.glyph.rotationPeriod}
          tint={option.tint}
          name={option.label}
          description={option.description}
          selected={selectedTransform === option.id}
          dense={true}
          glyphSize={24}
          {disabled}
          onclick={() => handleTransform(option.id)}
        />
      {/each}
    </div>
  </div>
</div>

<style>
  .transform-picker {
    display: grid;
    grid-template-columns: minmax(11rem, 0.72fr) minmax(22rem, 3fr);
    align-items: flex-end;
    flex: 4 1 46rem;
    gap: var(--settings-spacing-md, 12px);
    width: auto;
    min-width: 0;
    padding: var(--settings-spacing-sm, 10px) var(--settings-spacing-md, 14px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-lg, 20px);
    background: var(--theme-panel-bg, rgba(12, 14, 22, 0.94));
  }

  .transform-picker.embedded {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--settings-spacing-md, 14px);
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .transform-picker.embedded.relationship-layout {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    gap: var(--settings-spacing-md, 14px);
    width: 100%;
    max-width: 34rem;
    margin-inline: auto;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .relationship-layout .field,
  .relationship-layout .transform-options {
    padding: clamp(12px, 0.45cqw, 17px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-md, 14px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
  }

  .relationship-layout .transform-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Naming the container `loop-picker` is what hands LOOPChoiceButton its own
     responsive tiers — the same ones the Extend drawer's shelf gives it. */
  .transform-options {
    container-type: inline-size;
    container-name: loop-picker;
  }

  .options-label {
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
  }

  /* The editor only ever renders in the recipe drawer, which is 480–620px wide,
     so two columns of dense rows is the shape: 9 rows of 60px fits the panel
     where 9 tiles of 140px could not. The column count is pinned per tier and
     never chosen by auto-fill. */
  .options-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    min-width: 0;
  }

  /* Nine into two columns strands the ninth. It takes the full width instead,
     which reads as the closing row rather than an orphan. */
  .options-grid > :global(:last-child) {
    grid-column: 1 / -1;
  }

  @container loop-picker (max-width: 20rem) {
    .options-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .field-heading {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .field-heading > div {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .step-number {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b6cff) 55%, transparent);
    border-radius: 50%;
    color: var(--theme-text, #fff);
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b6cff) 18%,
      transparent
    );
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
  }

  .field-label {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .relationship-layout .field-label {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 750;
  }

  .field-help {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    line-height: 1.3;
  }

  .field-control {
    display: flex;
    min-width: 0;
  }

  .driver-control {
    width: 100%;
  }

  .relationship-layout .driver-control {
    padding-block: 8px;
  }

  .field-control :global(.segmented-control) {
    width: 100%;
  }

  @container fuse (max-width: 960px) {
    .transform-picker:not(.embedded) {
      grid-template-columns: minmax(0, 1fr);
      width: 100%;
    }

    .transform-picker.embedded.relationship-layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @container fuse (min-width: 1181px) and (max-width: 1679px) and (min-height: 780px) {
    .relationship-layout .field,
    .relationship-layout .transform-options {
      padding: 10px;
    }

    .relationship-layout .field-help {
      display: none;
    }

    .relationship-layout .driver-control {
      margin-block: auto;
      padding-block: 4px;
    }
  }

  /* Same trade as the composer's short-viewport tiers: the step cards keep their
     numbers and their frames and give up padding first, then the helper line.
     The drawer is portalled out of the `fuse` container, so these are media
     queries. */
  @media (max-height: 1250px) {
    .relationship-layout .field,
    .relationship-layout .transform-options {
      padding: 8px 10px;
    }

    .relationship-layout .transform-options {
      gap: 8px;
    }

    .relationship-layout .driver-control {
      padding-block: 0;
    }
  }

  @media (max-height: 950px) {
    .relationship-layout .field-help {
      display: none;
    }
  }

  @container fuse (min-width: 2600px) and (min-height: 1400px) {
    .relationship-layout .field,
    .relationship-layout .transform-options {
      padding: 20px;
    }

    .step-number {
      width: 36px;
      height: 36px;
    }
  }
</style>
