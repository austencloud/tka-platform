<!--
  SpinnerNowPlaying.svelte

  The one line of identity above the stage: canonical LOOP chips for whatever
  is playing right now, same in both modes. The word itself lives on the
  canvas (TKA glyph font); step counts and stats intentionally do not exist —
  the notation shows them better than a number can.
-->
<script lang="ts">
  import LoopChips from "$lib/features/store/components/LoopChips.svelte";
  import { parseLoopComponents } from "$lib/shared/create/services/loop-type-utils";
  import { Period } from "$lib/shared/foundation/domain/models/generation/circular-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { GeneratedSequenceInfo } from "$lib/features/landing/domain/models/spinner-models";

  let {
    sequence,
    generatedInfo = null,
  }: {
    sequence: SequenceData | null;
    /** Infinite mode's generation record; null in Library mode. */
    generatedInfo?: GeneratedSequenceInfo | null;
  } = $props();

  // The sequence's own metadata is the primary source (library sequences
  // carry components/loopType/period); the generator's settings are the
  // fallback for generated sequences whose snapshot lacks them.
  const components = $derived.by((): string[] => {
    if (sequence?.components?.length) return [...sequence.components];
    const loopType =
      sequence?.loopType ?? generatedInfo?.settings.loopType ?? null;
    return [...parseLoopComponents(loopType)];
  });

  const rotationPeriod = $derived.by((): Period | undefined => {
    if (sequence?.period === 4) return Period.QUARTERED;
    if (sequence?.period === 2) return Period.HALVED;
    return generatedInfo?.settings.period;
  });
</script>

{#if components.length > 0}
  <LoopChips {components} {rotationPeriod} />
{/if}
