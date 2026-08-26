<!--
  PropChiralityRow.svelte

  Chirality picker for buugeng-family props, docked at the bottom of
  BentoPropGrid so every surface that mounts the picker inherits it.

  Chirality used to live on an unlabelled 36px icon button in two places only
  (the Create step-editor row and the Settings readout) while the picker itself
  — mounted in eleven surfaces — had no way to express it at all. Moving the
  control into the picker is what makes it reachable from the Animation Panel,
  the Arena drawer, My Props and Tunnel art settings without adding a twelfth
  copy of the button.

  Exactly one of two states is always active, so this routes to
  SegmentedControl per .claude/rules/chip-primitives.md. Each segment renders
  the selected prop's own art — one upright, one mirrored — through the
  primitive's existing optionContent slot; the word underneath carries the same
  distinction for anyone who cannot resolve the glyph at this size.
-->
<script lang="ts">
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPropTypeDisplayInfo } from "./prop-type-registry";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";

  type Chirality = "standard" | "mirrored";

  let {
    propType,
    flipped,
    hand,
    onChange,
  }: {
    /** The prop whose art the two segments preview. */
    propType: PropType;
    flipped: boolean;
    /** Which hand this writes. Omitted means the host writes both. */
    hand?: "blue" | "red";
    onChange: (flipped: boolean) => void;
  } = $props();

  const displayInfo = $derived(getPropTypeDisplayInfo(propType));
  const value = $derived<Chirality>(flipped ? "mirrored" : "standard");

  const options = $derived([
    { value: "standard" as const, label: "Standard" },
    { value: "mirrored" as const, label: "Mirrored" },
  ]);

  // The hand belongs in the accessible name because the visible label cannot
  // carry it — the same row is used by hosts that write one hand and by hosts
  // that write both.
  const groupLabel = $derived(
    hand ? `${hand} buugeng chirality` : "Buugeng chirality"
  );
</script>

<div class="chirality-row" class:blue={hand === "blue"} class:red={hand === "red"}>
  <span class="chirality-label" id="chirality-label">Chirality</span>
  <SegmentedControl
    {options}
    {value}
    onchange={(next) => onChange(next === "mirrored")}
    color={hand ?? "accent"}
    semantics="radiogroup"
    ariaLabel={groupLabel}
  >
    {#snippet optionContent(option)}
      <img
        src={displayInfo.image}
        alt=""
        class="chirality-art"
        class:mirrored={option === "mirrored"}
      />
      <span class="chirality-word"
        >{option === "mirrored" ? "Mirrored" : "Standard"}</span
      >
    {/snippet}
  </SegmentedControl>
</div>

<style>
  .chirality-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 10px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .chirality-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text-secondary, var(--theme-text));
    white-space: nowrap;
  }

  .chirality-row :global(.segmented-control) {
    flex: 1;
    min-width: 0;
    /* The row is a two-option selector, not a progress bar. Without a ceiling
       it stretches to whatever the host panel is wide — the exact failure
       .claude/rules/visual-verification-mandatory.md opens with. */
    max-width: 22rem;
  }

  .chirality-row :global(.segment-label) {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .chirality-art {
    width: 26px;
    height: 26px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .chirality-art.mirrored {
    transform: scaleX(-1);
  }

  .chirality-word {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Tint the previews to the hand they belong to, matching CompactPropDisplay. */
  .chirality-row.red .chirality-art {
    filter: hue-rotate(125deg) saturate(1.2);
  }

  @container prop-grid (max-width: 340px) {
    .chirality-label {
      /* The SegmentedControl's own aria-label still names the group. */
      display: none;
    }
  }
</style>
