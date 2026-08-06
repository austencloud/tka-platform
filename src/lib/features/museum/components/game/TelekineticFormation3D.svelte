<script lang="ts">
  import CovenStation from "$lib/features/coven-hub/components/CovenStation.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import { MUSEUM_EXHIBIT_SEQUENCES } from "../../data/museum-exhibit-sequences";

  interface Props {
    stationId: string;
    worldX: number;
    worldZ: number;
    sequenceId?: string;
    autoPlay?: boolean;
    presentation?: "ritual" | "sculpture";
    scale?: number;
    /**
     * Optional injection map for resolving a sequenceId to a user's PRIVATE
     * library sequence. Checked BEFORE MUSEUM_EXHIBIT_SEQUENCES. Undefined in
     * the official museum (default behavior).
     */
    userSequenceDataMap?: Map<string, SequenceData>;
    /** Override the presentation's default effect (elemental motif work). */
    effectId?: string | null;
    /** Hide the centre staffs and leave only the effect trace. */
    showProps?: boolean;
    /** Cap the overlaid centre rigs. See CovenStation.centerPlanes. */
    centerPlanes?: number;
  }
  const props: Props = $props();

  const sequence = $derived.by((): SequenceData | null => {
    // Injected branch: resolve from a user's private library map first. Only
    // fires when the map has this id, so the official museum is unaffected.
    const injected = props.sequenceId ? props.userSequenceDataMap?.get(props.sequenceId) : null;
    if (injected) return injected;

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
  effectId={props.effectId ?? (props.presentation === "sculpture" ? "trails" : "led")}
  autoPlay={props.autoPlay ?? true}
  presentation={props.presentation}
  scale={props.scale}
  showProps={props.showProps ?? true}
  centerPlanes={props.centerPlanes}
/>
