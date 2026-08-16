<!--
  FuseTransformPicker — the symmetry rule editor.

  Two decisions, in order: which path you edit, and the rule the other one is
  rebuilt through. The rule used to be one of nine flat tiles, which put an
  AMOUNT (rotation) and three independent operations on the same list — so five
  of the eight rotations were unreachable and a stretched tile in the last row
  read as the most important choice. It is now the three axes the rule actually
  has, each with its own control and its own primitive's colour.

  Both values are owned + persisted by fuse-state; the composer passes drafts.
-->
<script lang="ts">
  import LOOPChoiceButton from "$lib/shared/components/loop-picker/LOOPChoiceButton.svelte";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import { getFuseContext } from "../context/fuse-context";
  import {
    fuseComponentColor,
    fuseComponentTint,
    fuseRuleGlyph,
  } from "../domain/fuse-transform-presentation";
  import {
    FUSE_REFLECTIONS,
    FUSE_ROTATIONS,
    createFuseRule,
    type FuseReflection,
    type FuseRule,
  } from "../domain/fuse-rule";
  import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";

  let {
    driver,
    rule,
    onDriverChange,
    onRuleChange,
  }: {
    driver?: FuseSide;
    rule?: FuseRule;
    onDriverChange?: (side: FuseSide) => void;
    onRuleChange?: (rule: FuseRule) => void;
  } = $props();

  const { state: fuseState } = getFuseContext();
  const selectedDriver = $derived(driver ?? fuseState.driverSide);
  const selectedRule = $derived(rule ?? fuseState.rule);

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

  // The amount is a single-select over the eight steps the transform layer
  // accepts, so it is a SegmentedControl — the accent it slides in is the
  // ROTATED primitive's own colour, not the app accent.
  const rotationOptions = $derived(
    FUSE_ROTATIONS.map((option) => ({
      value: String(option.steps),
      label: option.steps === 0 ? "No rotation" : `${option.label} clockwise`,
      shortLabel: option.steps === 0 ? "None" : option.label,
      disabled,
    }))
  );
  const rotationAccent = fuseComponentColor(LOOPComponent.ROTATED);

  // Mirror and Flip are the same purple with different axes, so each carries the
  // glyph that separates them — the one a sequence card would show.
  const reflectionOptions = $derived(
    FUSE_REFLECTIONS.map((option) => {
      const glyph = fuseRuleGlyph(createFuseRule({ reflect: option.value }));
      const component =
        option.value === "mirror"
          ? LOOPComponent.MIRRORED
          : option.value === "flip"
            ? LOOPComponent.FLIPPED
            : null;
      return {
        ...option,
        glyph,
        tint: component ? fuseComponentTint(component) : "",
      };
    })
  );

  const invertColor = fuseComponentColor(LOOPComponent.INVERTED);
  const rewoundColor = fuseComponentColor(LOOPComponent.REWOUND);
  const invertGlyph = new Set([LOOPComponent.INVERTED]);
  const rewindGlyph = new Set([LOOPComponent.REWOUND]);

  const followerLabel = $derived(selectedDriver === "blue" ? "Red" : "Blue");
  const driverLabel = $derived(selectedDriver === "blue" ? "Blue" : "Red");

  function handleDriver(value: FuseSide): void {
    if (onDriverChange) onDriverChange(value);
    else fuseState.setDriver(value);
  }

  function commit(next: FuseRule): void {
    if (onRuleChange) onRuleChange(next);
    else fuseState.setRule(next);
  }

  function chooseRotation(value: string): void {
    commit({ ...selectedRule, rotationSteps: Number(value) });
  }

  function chooseReflection(value: FuseReflection): void {
    commit({ ...selectedRule, reflect: value });
  }

  function toggleInvert(): void {
    commit({ ...selectedRule, invert: !selectedRule.invert });
  }

  function toggleRewind(): void {
    commit({ ...selectedRule, rewind: !selectedRule.rewind });
  }
</script>

<div class="transform-picker">
  <div class="field" role="group" aria-label="Path you will edit">
    <div class="field-heading">
      <span class="step-number">1</span>
      <div>
        <span class="field-label">Path you will edit</span>
        <span class="field-help">{driverLabel} stays editable</span>
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

  <div class="rule-field">
    <div class="field-heading">
      <span class="step-number">2</span>
      <div>
        <span class="field-label">Rule applied to {followerLabel}</span>
        <span class="field-help">
          Every change previews a new {followerLabel} path
        </span>
      </div>
    </div>

    <div class="axis">
      <span class="axis-label" id="fuse-rotation-label">Rotate</span>
      <div class="rotation-control" style="--rotation-accent: {rotationAccent}">
        <SegmentedControl
          options={rotationOptions}
          value={String(selectedRule.rotationSteps)}
          onchange={chooseRotation}
          color="accent"
          size="sm"
          density="compact"
          semantics="radiogroup"
          ariaLabelledby="fuse-rotation-label"
        />
      </div>
    </div>

    <div class="axis">
      <span class="axis-label" id="fuse-reflect-label">Reflect</span>
      <div class="reflect-grid" role="radiogroup" aria-labelledby="fuse-reflect-label">
        {#each reflectionOptions as option (option.value)}
          <LOOPChoiceButton
            components={option.glyph.components}
            reflectionAxis={option.glyph.reflectionAxis}
            tint={option.tint}
            name={option.label}
            description={option.description}
            title={option.description}
            fallbackIcon="fa-ban"
            selected={selectedRule.reflect === option.value}
            dense={true}
            glyphSize={22}
            {disabled}
            onclick={() => chooseReflection(option.value)}
          />
        {/each}
      </div>
    </div>

    <div class="axis">
      <span class="axis-label">Also</span>
      <div class="toggle-row" role="group" aria-label="Additional operations">
        <FilterChipBase
          mode="toggle"
          label="Invert"
          ariaLabel="Invert — reverse every turn"
          active={selectedRule.invert}
          chipColor={invertColor}
          {disabled}
          onclick={toggleInvert}
        >
          {#snippet iconSnippet()}
            <LOOPIconStrip
              activeComponents={invertGlyph}
              size={14}
              showFreeformWhenEmpty={false}
            />
          {/snippet}
        </FilterChipBase>
        <FilterChipBase
          mode="toggle"
          label="Rewind"
          ariaLabel="Rewind — reverse the step order"
          active={selectedRule.rewind}
          chipColor={rewoundColor}
          {disabled}
          onclick={toggleRewind}
        >
          {#snippet iconSnippet()}
            <LOOPIconStrip
              activeComponents={rewindGlyph}
              size={14}
              showFreeformWhenEmpty={false}
            />
          {/snippet}
        </FilterChipBase>
      </div>
    </div>
  </div>
</div>

<style>
  .transform-picker {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 14px);
    width: 100%;
    min-width: 0;
  }

  .field,
  .rule-field {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    padding: clamp(12px, 0.45cqw, 17px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-md, 14px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
  }

  /* Naming the container `loop-picker` is what hands LOOPChoiceButton its own
     responsive tiers — the same ones the Extend drawer's shelf gives it.

     The card stays content-sized. Stretching it to reach the pinned footer put
     ~100px between each axis, which read as three unrelated rows; the same
     pixels left as panel background below the card read as a form that has
     simply finished. */
  .rule-field {
    container-type: inline-size;
    container-name: loop-picker;
  }

  /* Room to spend means the choices explain themselves rather than the card
     growing empty rows. LOOPChoiceButton hides a dense choice's description by
     default; this outranks that inside the reflect row only.

     The seam is 1000px, not 900: at a 900-tall viewport the three descriptions
     make the form 22px taller than the drawer body, which pushes the commit row
     below the fold — the one place the footer must never be. */
  @media (min-height: 1000px) {
    .reflect-grid :global(.dense .loop-desc) {
      display: block;
      max-width: none;
    }

    .reflect-grid :global(.dense .loop-text) {
      gap: 0.125rem;
    }

    /* A description needs the whole row to read as a sentence, so the tiles
       stack sooner once they carry one. */
    @container loop-picker (max-width: 26rem) {
      .reflect-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  }

  .axis {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .axis-label {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* Each axis slides in its own primitive's hue, so the control and the rule it
     builds carry the same colour the glyph does on a sequence card. */
  .rotation-control {
    --theme-accent: var(--rotation-accent);
    min-width: 0;
  }

  /* Eight amounts, each a short numeral, so the row is only as wide as its
     labels — the segments trim their padding rather than the row growing a
     second line. */
  .rotation-control :global(.segment) {
    padding-inline: 0.25rem;
    font-variant-numeric: tabular-nums;
  }

  /* Three named choices, three columns. A pinned count, never auto-fill, so the
     row can't strand one of them on its own line. */
  .reflect-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    min-width: 0;
  }

  /* Below the width three glyph-plus-label tiles need, they stack — still one
     per line, no orphan. */
  @container loop-picker (max-width: 21rem) {
    .reflect-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .reflect-grid :global(.loop-button.dense) {
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
  }

  .reflect-grid :global(.dense .loop-glyph) {
    flex: 0 0 1.5rem;
  }

  .toggle-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }

  .toggle-row :global(.filter-chip) {
    flex: 1 1 auto;
    justify-content: center;
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

  .field-control :global(.segmented-control) {
    width: 100%;
  }

  /* Same trade as the composer's short-viewport tiers: the step cards keep their
     numbers and their frames and give up padding first, then the helper line.
     The drawer is portalled out of the `fuse` container, so these are media
     queries. */
  @media (max-height: 1250px) {
    .field,
    .rule-field {
      gap: 8px;
      padding: 8px 10px;
    }
  }

  @media (max-height: 950px) {
    .field-help {
      display: none;
    }
  }

  @media (min-width: 2600px) and (min-height: 1400px) {
    .field,
    .rule-field {
      padding: 20px;
    }

    .step-number {
      width: 36px;
      height: 36px;
    }
  }
</style>
