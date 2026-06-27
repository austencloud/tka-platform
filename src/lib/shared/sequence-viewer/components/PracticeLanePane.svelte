<!--
  PracticeLanePane.svelte

  The read-ahead lane shown in place of the side-by-side preview during focused
  practice. Pure wrapper: derives cells from the sequence and renders the shared
  BeatStrip with prefs-driven zoom + beat-pulse + tap-to-seek. No playback ownership
  (the viewer orchestrator owns currentStep/bpm and the seek).
-->
<script lang="ts">
  import BeatStrip from "$lib/shared/timeline/BeatStrip.svelte";
  import { buildNotationCells } from "$lib/shared/timeline/notation-cell";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  let {
    sequence,
    currentStep,
    bpm,
    cellSize,
    bluePropType = null,
    redPropType = null,
    onSeek = null,
  }: {
    sequence: SequenceData | null | undefined;
    /** Float step from playback (integer step + fractional progress). */
    currentStep: number;
    bpm: number;
    cellSize: number;
    bluePropType?: PropType | null;
    redPropType?: PropType | null;
    /** Jump playback to a step (0 = start position, 1..N = beats). */
    onSeek?: ((stepNumber: number) => void) | null;
  } = $props();

  const cells = $derived(buildNotationCells(sequence));
</script>

<div class="practice-lane">
  <BeatStrip
    {cells}
    {currentStep}
    {bpm}
    {cellSize}
    {bluePropType}
    {redPropType}
    beatPulse={true}
    onCellClick={onSeek}
  />
</div>

<style>
  .practice-lane {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.25);
  }
</style>
