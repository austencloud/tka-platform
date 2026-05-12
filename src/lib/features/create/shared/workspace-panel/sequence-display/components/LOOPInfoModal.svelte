<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import type { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import LOOPComponentRow from "./LOOPComponentRow.svelte";
  import { generateLoopStructuralCopy } from "../services/loop-structural-copy";

  interface Props {
    open: boolean;
    activeComponents: Set<LOOPComponent>;
    loopDisplayName: string;
    sequence: SequenceData | null;
    period: number;
    onclose: () => void;
  }

  let { open, activeComponents, loopDisplayName, sequence, period, onclose }: Props = $props();

  const structuralCopy = $derived.by(() => {
    if (!sequence || activeComponents.size === 0) return null;
    return generateLoopStructuralCopy(sequence, activeComponents, period);
  });
</script>

<BaseModal {open} {onclose} size="lg" class="loop-info-modal">
  <ModalHeader
    title="{loopDisplayName} LOOP"
    subtitle="Transformation pattern"
    icon="fa-infinity"
    iconColor="#36c3ff"
    onClose={onclose}
  />
  <div class="body">
    <LOOPComponentRow {activeComponents} />
    {#if structuralCopy}
      <p class="explanation">
        {structuralCopy.lead}{#each structuralCopy.parts as part}{#if part.bold}<strong>{part.text}</strong>{:else}{part.text}{/if}{/each}
      </p>
    {/if}
  </div>
</BaseModal>

<style>
  .body {
    padding: clamp(8px, 2vw, 16px) clamp(16px, 3vw, 32px) clamp(16px, 3vw, 32px);
  }

  .explanation {
    margin: clamp(12px, 2vw, 20px) 0 0;
    padding: 0 clamp(8px, 2vw, 24px);
    font-size: clamp(13px, 0.9vw + 0.5rem, 16px);
    line-height: 1.6;
    color: var(--theme-text, #c5c9d2);
    text-align: center;
  }
</style>
