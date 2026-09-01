<script lang="ts">
  import type { ModeRealization } from "../services/build-mode-realizations";
  import {
    MODE_FAMILY_ID,
    MODE_ORDER,
    type VtgMode,
  } from "../services/shape-matrix-realizations";
  import { TND_BY_FAMILY } from "$lib/features/choreo-card/domain/tnd-element";
  import { growFade } from "$lib/shared/transitions/motion";
  import RelationshipChoiceChip from "./RelationshipChoiceChip.svelte";

  interface TargetGroup {
    key: string;
    label: string;
    detail: string;
    color: string;
    icon: string | null;
    mode: VtgMode | null;
    candidates: ModeRealization[];
  }

  let {
    realizations,
    selectedMode,
    selectedPropMode,
    activePropMode,
    equalRotatingTurns,
    disabled = false,
    building = false,
    ontarget,
    onhandpick,
  }: {
    realizations: ModeRealization[];
    selectedMode: VtgMode | null;
    selectedPropMode: VtgMode | null;
    activePropMode: VtgMode | null;
    equalRotatingTurns: boolean;
    disabled?: boolean;
    building?: boolean;
    ontarget: (mode: VtgMode) => void;
    onhandpick: (mode: VtgMode) => void;
  } = $props();

  function elementName(raw: string): string {
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function targetKey(realization: ModeRealization): string {
    const relationship = realization.propRelationship;
    if (relationship.kind === "full") return relationship.element.familyId;
    if (relationship.kind === "direction-only") {
      return `direction-${relationship.direction}`;
    }
    return "float";
  }

  function describeTarget(
    realization: ModeRealization
  ): Omit<TargetGroup, "candidates"> {
    const relationship = realization.propRelationship;
    if (relationship.kind === "full") {
      return {
        key: targetKey(realization),
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
        key: targetKey(realization),
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

  const groups = $derived.by<TargetGroup[]>(() => {
    if (equalRotatingTurns) {
      return MODE_ORDER.map((mode) => {
        const element = TND_BY_FAMILY[MODE_FAMILY_ID[mode]]!;
        return {
          key: element.familyId,
          label: elementName(element.element),
          detail: element.name,
          color: element.accentColor,
          icon: element.iconPath,
          mode,
          candidates: realizations.filter(
            (realization) => realization.propMode === mode
          ),
        };
      });
    }
    const grouped = new Map<string, TargetGroup>();
    for (const realization of realizations) {
      const description = describeTarget(realization);
      const existing = grouped.get(description.key);
      if (existing) existing.candidates.push(realization);
      else
        grouped.set(description.key, {
          ...description,
          candidates: [realization],
        });
    }
    return [...grouped.values()];
  });

  const selectedGroup = $derived(
    groups.find(
      (group) =>
        group.mode === (selectedPropMode ?? activePropMode) ||
        (group.mode === null &&
          group.candidates.some((candidate) => candidate.mode === selectedMode))
    ) ?? null
  );
  const compactColumns = $derived(
    groups.length <= 4 ? Math.max(groups.length, 1) : 3
  );
</script>

<div class="prop-picker" aria-label="Prop timing and direction">
  <div
    class="target-row"
    role="group"
    aria-label="Prop relationships"
    style="--target-count: {Math.max(
      groups.length,
      1
    )}; --compact-count: {compactColumns}"
  >
    {#each groups as group (group.key)}
      {@const unavailable = !building && group.candidates.length === 0}
      <RelationshipChoiceChip
        accent={group.color}
        icon={group.icon}
        code={group.detail}
        compactCode={group.mode ?? group.detail}
        label={group.label}
        active={selectedGroup?.key === group.key}
        disabled={disabled || unavailable}
        ariaLabel={`${group.detail} ${group.label}`}
        onpick={() => {
          if (group.mode) ontarget(group.mode);
          else if (group.candidates[0]) onhandpick(group.candidates[0].mode);
        }}
      />
    {/each}
  </div>

  {#if selectedGroup && selectedGroup.candidates.length > 1}
    <div
      class="hand-choices"
      role="group"
      aria-label="Hand paths that produce this prop relationship"
      transition:growFade={{ axis: "y" }}
    >
      <span>Hand path</span>
      {#each selectedGroup.candidates as candidate (candidate.mode)}
        <button
          type="button"
          class:active={candidate.mode === selectedMode}
          style="--hand: {candidate.element.accentColor}"
          aria-pressed={candidate.mode === selectedMode}
          disabled={building}
          onclick={() => onhandpick(candidate.mode)}
        >
          <img src={candidate.element.iconPath} alt="" />
          {candidate.mode}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .prop-picker {
    display: grid;
    gap: 0.45rem;
  }
  .target-row {
    display: grid;
    grid-template-columns: repeat(var(--target-count), minmax(0, 1fr));
    gap: 0.5rem;
  }
  .hand-choices img {
    width: 1.55rem;
    height: 1.55rem;
    object-fit: contain;
  }
  .hand-choices {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-height: var(--min-touch-target, 44px);
  }
  .hand-choices > span {
    margin-right: 0.2rem;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.58));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.06em;
  }
  .hand-choices button {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 3.2rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.2rem 0.45rem;
    border: 1px solid color-mix(in srgb, var(--hand) 34%, transparent);
    border-radius: 999px;
    background: transparent;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.72));
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    cursor: pointer;
  }
  .hand-choices button.active {
    border-color: var(--hand);
    background: color-mix(in srgb, var(--hand) 18%, transparent);
    color: var(--theme-text, #fff);
  }
  .hand-choices img {
    width: 1rem;
    height: 1rem;
  }
  button:focus-visible {
    outline: 2px solid var(--target, var(--hand, var(--theme-text, #fff)));
    outline-offset: 2px;
  }
  @container shape-matrix-drill (max-width: 30rem) {
    .target-row {
      grid-template-columns: repeat(var(--compact-count), minmax(0, 1fr));
    }
  }
  @container shape-matrix-drill (min-width: 42rem) and (max-height: 24rem) {
    .target-row {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @container shape-matrix-app (max-width: 25rem) or (max-height: 41.99rem) {
    .hand-choices > span {
      display: none;
    }
    .hand-choices button {
      min-width: 2.75rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hand-choices button {
      transition: none;
    }
  }
</style>
