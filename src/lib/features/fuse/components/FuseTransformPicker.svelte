<!--
  FuseTransformPicker — the symmetry rule editor.

  Two decisions, in order: which path you edit, and the rule the other one is
  rebuilt through.

  The rule has an AMOUNT and a set of OPERATIONS, so it gets two controls, not
  three. The amount is a position on a circle and is picked on one — see
  FuseRotationDial. The operations are four chips of one kind: Mirror and Flip
  are the same choice twice (picking one drops the other, pressing the chosen
  one again clears it), Invert and Rewind are independent, and all four toggle
  the same way and look the same. They used to be a row of three bordered tiles
  labelled REFLECT above a row of two pills labelled ALSO — two styles and two
  headings for one question, which made Invert and Rewind read as a different
  KIND of thing than Mirror. They are not; they are all operations applied to
  the follower path.

  Both values are owned + persisted by fuse-state; the composer passes drafts.
-->
<script lang="ts">
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import FuseRotationDial from "./FuseRotationDial.svelte";
  import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import { getFuseContext } from "../context/fuse-context";
  import { fuseComponentColor } from "../domain/fuse-transform-presentation";
  import type { FuseReflection, FuseRule } from "../domain/fuse-rule";
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

  const rotationAccent = fuseComponentColor(LOOPComponent.ROTATED);

  // One row, one control type, one visual weight. Mirror and Flip carry the
  // reflection axis in their glyph because they are the same violet by brand;
  // the other two carry their own primitive's colour.
  type Operation = {
    id: string;
    label: string;
    ariaLabel: string;
    color: string;
    glyph: Set<LOOPComponent>;
    active: boolean;
    toggle: () => void;
    axis?: "vertical" | "horizontal";
  };

  function setReflect(value: FuseReflection): void {
    commit({
      ...selectedRule,
      reflect: selectedRule.reflect === value ? "none" : value,
    });
  }

  const operations = $derived<Operation[]>([
    {
      id: "mirror",
      label: "Mirror",
      ariaLabel: "Mirror — reflect left and right",
      color: fuseComponentColor(LOOPComponent.MIRRORED),
      glyph: new Set([LOOPComponent.MIRRORED]),
      axis: "vertical",
      active: selectedRule.reflect === "mirror",
      toggle: () => setReflect("mirror"),
    },
    {
      id: "flip",
      label: "Flip",
      ariaLabel: "Flip — reflect top and bottom",
      color: fuseComponentColor(LOOPComponent.FLIPPED),
      glyph: new Set([LOOPComponent.FLIPPED]),
      axis: "horizontal",
      active: selectedRule.reflect === "flip",
      toggle: () => setReflect("flip"),
    },
    {
      id: "invert",
      label: "Invert",
      ariaLabel: "Invert — reverse every turn",
      color: fuseComponentColor(LOOPComponent.INVERTED),
      glyph: new Set([LOOPComponent.INVERTED]),
      active: selectedRule.invert,
      toggle: () => commit({ ...selectedRule, invert: !selectedRule.invert }),
    },
    {
      id: "rewind",
      label: "Rewind",
      ariaLabel: "Rewind — reverse the step order",
      color: fuseComponentColor(LOOPComponent.REWOUND),
      glyph: new Set([LOOPComponent.REWOUND]),
      active: selectedRule.rewind,
      toggle: () => commit({ ...selectedRule, rewind: !selectedRule.rewind }),
    },
  ]);

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

  function chooseRotation(steps: number): void {
    commit({ ...selectedRule, rotationSteps: steps });
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
      <FuseRotationDial
        value={selectedRule.rotationSteps}
        accent={rotationAccent}
        labelledBy="fuse-rotation-label"
        {disabled}
        onchange={chooseRotation}
      />
    </div>

    <div class="axis">
      <span class="axis-label" id="fuse-operations-label">Then</span>
      <div
        class="operation-row"
        role="group"
        aria-labelledby="fuse-operations-label"
      >
        {#each operations as operation (operation.id)}
          <FilterChipBase
            mode="toggle"
            label={operation.label}
            ariaLabel={operation.ariaLabel}
            title={operation.ariaLabel}
            active={operation.active}
            chipColor={operation.color}
            {disabled}
            onclick={operation.toggle}
          >
            {#snippet iconSnippet()}
              <LOOPIconStrip
                activeComponents={operation.glyph}
                reflectionAxis={operation.axis}
                size={14}
                showFreeformWhenEmpty={false}
              />
            {/snippet}
          </FilterChipBase>
        {/each}
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

  /* The card stays content-sized. Stretching it to reach the pinned footer put
     ~100px between the dial and the chips, which read as two unrelated rows; the
     same pixels left as panel background below the card read as a form that has
     simply finished. */
  .rule-field {
    container-type: inline-size;
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

  /* Four chips, one row, equal shares — never auto-fill, so the row cannot
     strand one of them on a line by itself. Below the width four labels need
     they go two-by-two, which is still even. */
  .operation-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    min-width: 0;
  }

  @container (max-width: 25rem) {
    .operation-row {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .operation-row :global(.filter-chip) {
    width: 100%;
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
