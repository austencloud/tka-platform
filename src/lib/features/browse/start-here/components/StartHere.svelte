<!--
  StartHere — taxonomy-first onboarding shell. Reads the step machine and renders
  the current step inside the shared Crossfade primitive. The top bar (Back +
  "Browse all") shows on every step except the first decision, which carries its
  own "skip to the full gallery" button. Body content is vertically centered.
-->
<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { createStartHereState } from "../state/start-here-state.svelte";
  import DecideStep from "./DecideStep.svelte";
  import ElementFamilyPicker from "./ElementFamilyPicker.svelte";
  import FamilyCardRow from "./FamilyCardRow.svelte";
  import LoopTypePicker from "./LoopTypePicker.svelte";
  import LoopCardRow from "./LoopCardRow.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  const s = createStartHereState();

  interface Props {
    onBrowseAll?: () => void;
    pool?: readonly SequenceData[];
  }
  let { onBrowseAll, pool = [] }: Props = $props();
</script>

<div class="start-here">
  <!-- Bar is always present (constant height) so stepping between the decide
       screen and the pickers never shifts the centered body up or down. -->
  <div class="bar">
    {#if s.step !== "decide"}
      <button class="back" type="button" onclick={() => s.back()}>← Back</button>
      <button class="browse-all" type="button" onclick={() => onBrowseAll?.()}>
        Browse all →
      </button>
    {/if}
  </div>

  <div class="body">
    <Crossfade key={s.step}>
      {#if s.step === "decide"}
        <DecideStep
          onBase={() => s.chooseBase()}
          onLoop={() => s.chooseLoop()}
          onBrowseAll={() => onBrowseAll?.()}
        />
      {:else if s.step === "base-families"}
        <ElementFamilyPicker onSelect={(id) => s.selectFamily(id)} />
      {:else if s.step === "base-cards" && s.familyId}
        <FamilyCardRow familyId={s.familyId} />
      {:else if s.step === "loop-types"}
        <LoopTypePicker onSelect={(t) => s.selectLoopType(t)} />
      {:else if s.step === "loop-cards" && s.loopType}
        <LoopCardRow loopType={s.loopType} {pool} />
      {/if}
    </Crossfade>
  </div>
</div>

<style>
  .start-here {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    min-height: 56px;
    flex: 0 0 auto;
  }
  .back,
  .browse-all {
    background: transparent;
    border: 1px solid var(--theme-border, #2a3140);
    color: var(--theme-text, #e8edf6);
    padding: 0.5rem 0.9rem;
    border-radius: 999px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .back:hover,
  .browse-all:hover { border-color: var(--theme-accent, #6aa0ff); }
  .back { margin-right: auto; }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  /* The Crossfade layer fills the body; each step owns its own scroll/centering
     (pickers center, card grids fill top-down). */
  .body > :global(*) {
    flex: 1;
    min-height: 0;
  }
</style>
