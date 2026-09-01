<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import type { ModeRealization } from "../services/build-mode-realizations";
  import type { VtgMode } from "../services/shape-matrix-realizations";
  import RelationshipChoiceChip from "./RelationshipChoiceChip.svelte";

  interface PropResultDescription {
    key: string;
    label: string;
    detail: string;
    color: string;
    icon: string | null;
    mode: VtgMode | null;
  }

  let {
    realizations,
    selectedMode,
    selectedPropMode,
    activePropMode,
    disabled = false,
    building = false,
    ontarget,
  }: {
    realizations: ModeRealization[];
    selectedMode: VtgMode | null;
    selectedPropMode: VtgMode | null;
    activePropMode: VtgMode | null;
    disabled?: boolean;
    building?: boolean;
    ontarget: (mode: VtgMode) => void;
  } = $props();

  function elementName(raw: string): string {
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function describe(realization: ModeRealization): PropResultDescription {
    const relationship = realization.propRelationship;
    if (relationship.kind === "full") {
      return {
        key: relationship.element.familyId,
        label: elementName(relationship.element.element),
        detail: relationship.element.name,
        color: relationship.element.accentColor,
        icon: relationship.element.iconPath,
        mode: realization.propMode,
      };
    }
    if (relationship.kind === "direction-only") {
      const same = relationship.direction === "same";
      return {
        key: `direction-${relationship.direction}`,
        label: same ? "Same" : "Opposite",
        detail: "Direction only · different rates",
        color: same
          ? "var(--prop-blue, #73b8ff)"
          : "var(--theme-accent, #f4b54c)",
        icon: null,
        mode: null,
      };
    }
    return {
      key: "float",
      label: "Float",
      detail: "No prop rotation",
      color: "color-mix(in srgb, var(--theme-text, #fff) 72%, transparent)",
      icon: null,
      mode: null,
    };
  }

  const choices = $derived.by<PropResultDescription[]>(() => {
    if (!selectedMode) return [];
    return realizations
      .filter((realization) => realization.mode === selectedMode)
      .map(describe);
  });
  const selectedChoice = $derived(
    choices.find(
      (choice) => choice.mode === (selectedPropMode ?? activePropMode)
    ) ??
      choices[0] ??
      null
  );
  const resultKey = $derived(
    disabled
      ? "empty"
      : choices.length > 1
        ? `choices:${selectedMode}`
        : (selectedChoice?.key ?? (building ? "building" : "unavailable"))
  );
</script>

<div
  class="prop-result"
  role="group"
  aria-label="Prop timing and direction result"
>
  <span class="result-label">Prop result</span>
  <div class="result-stage">
    <Crossfade key={resultKey} fill duration={DURATION.fast}>
      {#if disabled}
        <div class="passive-result pending-result">
          <span class="result-dot" aria-hidden="true"></span>
          <span>Pick a cell</span>
        </div>
      {:else if choices.length > 1}
        <div class="result-choices" aria-label="Exact prop phase choices">
          {#each choices as choice (choice.key)}
            {#if choice.mode}
              <RelationshipChoiceChip
                accent={choice.color}
                icon={choice.icon}
                code={choice.detail}
                compactCode={choice.mode}
                label={choice.label}
                active={selectedChoice?.key === choice.key}
                disabled={building}
                ariaLabel={`${choice.detail} ${choice.label}`}
                onpick={() => ontarget(choice.mode!)}
              />
            {/if}
          {/each}
        </div>
      {:else if selectedChoice}
        <output
          class="passive-result"
          style="--result-accent: {selectedChoice.color}"
          aria-label={`Props: ${selectedChoice.detail} ${selectedChoice.label}`}
        >
          {#if selectedChoice.icon}
            <img src={selectedChoice.icon} alt="" />
          {:else}
            <span class="result-dot" aria-hidden="true"></span>
          {/if}
          <span class="passive-copy">
            <strong>{selectedChoice.detail}</strong>
            <small>{selectedChoice.label}</small>
          </span>
          <span class="derived-label">Derived</span>
        </output>
      {:else}
        <div class="passive-result pending-result" aria-live="polite">
          <span class="result-dot" aria-hidden="true"></span>
          <span
            >{building
              ? "Finding exact prop result…"
              : "No exact prop result"}</span
          >
        </div>
      {/if}
    </Crossfade>
  </div>
</div>

<style>
  .prop-result {
    display: grid;
    grid-template-columns: 5.4rem minmax(0, 1fr);
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
  }

  .result-label {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.62));
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
    white-space: nowrap;
  }

  .result-stage {
    position: relative;
    width: min(100%, 24rem);
    min-width: 0;
    min-height: 3.25rem;
  }

  .result-choices {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem;
    width: 100%;
  }

  .result-choices :global(.relationship-choice) {
    min-height: 3.25rem;
    padding-block: 0.3rem;
  }

  .passive-result {
    display: flex;
    width: min(100%, 15rem);
    min-height: 3.25rem;
    align-items: center;
    gap: 0.55rem;
    padding: 0.35rem 0.65rem;
    border: 1px solid
      color-mix(
        in srgb,
        var(--result-accent, var(--theme-text)) 32%,
        transparent
      );
    border-radius: 10px;
    background: color-mix(
      in srgb,
      var(--result-accent, var(--theme-text)) 7%,
      transparent
    );
    color: var(--theme-text, #fff);
  }

  .passive-result img {
    width: 1.45rem;
    height: 1.45rem;
    flex: 0 0 auto;
    object-fit: contain;
  }

  .passive-copy {
    display: grid;
    min-width: 0;
  }

  .passive-copy strong,
  .passive-copy small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .passive-copy strong {
    color: color-mix(in srgb, var(--result-accent) 80%, white);
    font-size: var(--font-size-min, 0.875rem);
  }

  .passive-copy small,
  .derived-label {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.62));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .derived-label {
    margin-left: auto;
  }

  .result-dot {
    width: 0.7rem;
    height: 0.7rem;
    flex: 0 0 auto;
    border-radius: 999px;
    background: var(--result-accent, var(--theme-text-dim, #999));
  }

  .pending-result {
    --result-accent: var(--theme-text-dim, #999);
    color: var(--theme-text-dim, rgb(255 255 255 / 0.62));
    font-size: var(--font-size-min, 0.875rem);
  }

  @container shape-matrix-drill (max-width: 30rem) {
    .prop-result {
      grid-template-columns: 1fr;
      gap: 0.3rem;
    }

    .result-stage,
    .passive-result {
      width: 100%;
      max-width: none;
    }
  }

  @container shape-matrix-drill (min-width: 42rem) and (max-height: 24rem) {
    .prop-result {
      grid-template-columns: 1fr;
      gap: 0.3rem;
    }

    .result-stage,
    .passive-result {
      width: 100%;
      max-width: none;
    }
  }
</style>
