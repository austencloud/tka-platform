<script lang="ts">
  import CovenStation from "$lib/features/coven-hub/components/CovenStation.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import { MUSEUM_EXHIBIT_SEQUENCES } from "../../data/museum-exhibit-sequences";

  interface Props {
    stationId: string;
    worldX: number;
    worldZ: number;
    sequenceId?: string;
    autoPlay?: boolean;
  }
  const props: Props = $props();

  const sequence = $derived.by((): SequenceData | null => {
    const ms = props.sequenceId ? MUSEUM_EXHIBIT_SEQUENCES[props.sequenceId] : null;
    if (!ms) return null;
    return {
      id: `museum-formation-${props.stationId}`,
      word: ms.word,
      steps: ms.steps as readonly StepData[],
      isCircular: true,
    } as SequenceData;
  });
</script>

<CovenStation
  stationId={props.stationId}
  worldX={props.worldX}
  worldZ={props.worldZ}
  {sequence}
  effectId="led"
  autoPlay={props.autoPlay ?? true}
/>
