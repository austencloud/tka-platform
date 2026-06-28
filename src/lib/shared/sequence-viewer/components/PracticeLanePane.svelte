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

  // Practice loops continuously, so drop the start-position cell: its pose equals
  // the sequence's end, and the lane shouldn't travel back through it each loop.
  // Beats only, cycled. currentStep is shifted −1 so beat k focuses its own cell
  // now that the start segment [0,1) no longer has a cell of its own.
  const cells = $derived(buildNotationCells(sequence).filter((c) => !c.isStart));
  const shiftedStep = $derived((currentStep ?? 0) - 1);

  // Wide aspect → side-by-side tall column → fill its height with a big focus
  // pictograph (a fixed px reads tiny on a large monitor). Portrait foot keeps
  // the fixed cellSize. Matches the ViewerSplitPane side-by-side breakpoint.
  let wide = $state(false);
  $effect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 768px), (orientation: landscape)");
    wide = mq.matches;
    const on = () => (wide = mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  });
</script>

<div class="practice-lane">
  <BeatStrip
    {cells}
    currentStep={shiftedStep}
    {bpm}
    {cellSize}
    {bluePropType}
    {redPropType}
    beatPulse={true}
    onCellClick={onSeek}
    anchor="start"
    fillHeight={wide}
    loop={true}
  />
</div>

<style>
  /* height:100% serves both layouts via the parent grid row:
       - foot (portrait, `auto` row): the row is content-sized, so 100% resolves
         to `auto` → the strip's intrinsic height; the carousel sits as a foot.
       - side-by-side (wide, `1fr` row): the row is definite, so 100% fills the
         tall column and the carousel centres vertically in it.
     Vertical padding gives breathing room; border-box keeps it inside the fill. */
  .practice-lane {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-block: 16px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.25);
  }
</style>
