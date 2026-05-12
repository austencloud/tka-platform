<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import type { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
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

  const passBeats = $derived.by((): StepData[] => {
    const steps = sequence?.steps;
    if (!steps || steps.length < 4) return [];
    const passLength = Math.floor(steps.length / period);
    if (passLength === 0) return [];
    const beats: StepData[] = [];
    for (let i = 0; i < period; i++) {
      const idx = i * passLength;
      if (steps[idx]) beats.push(steps[idx]);
    }
    return beats;
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
    {#if passBeats.length > 1}
      <div class="pass-comparison">
        {#each passBeats as beat, i (i)}
          {#if i > 0}
            <div class="arrow">
              <i class="fas fa-arrow-right" aria-hidden="true"></i>
            </div>
          {/if}
          <div class="pass-cell">
            <div class="pass-label">Pass {i + 1}</div>
            <div class="pass-pictograph">
              <PictographContainer
                pictographData={beat}
                showTKA={true}
                showGrid={true}
                showReversals={false}
                showVTG={false}
                showElemental={false}
                showPositions={false}
                showHandPoints={false}
                disableTransitions={true}
              />
            </div>
          </div>
        {/each}
      </div>
    {/if}
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

  .pass-comparison {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(4px, 1vw, 12px);
    padding: clamp(8px, 1.5vw, 16px) clamp(8px, 2vw, 24px);
    margin-top: clamp(4px, 1vw, 8px);
  }

  .pass-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(2px, 0.4vw, 4px);
  }

  .pass-label {
    font-size: clamp(9px, 0.4vw + 0.35rem, 11px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .pass-pictograph {
    width: clamp(60px, 10vw, 100px);
    height: clamp(60px, 10vw, 100px);
    background: #fff;
    border-radius: 8px;
    padding: 2px;
    overflow: hidden;
  }

  .arrow {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    font-size: clamp(12px, 1vw, 16px);
    flex-shrink: 0;
    margin-top: clamp(12px, 1.5vw, 18px);
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
