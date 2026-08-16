<!--
TurnsCard.svelte - how much a sequence turns, or exactly how it turns.

Two modes behind one card. Intensity is the original card, unchanged: a ceiling,
with the generator rolling its own values underneath it. Pattern hands the
generator a repeating figure instead — the same strip the Actions panel uses to
rewrite turns after the fact, moved in front of generation so the search can
pick letters that suit it.

Intensity mode renders TurnIntensityCard rather than reimplementing it. That
card is also used on its own by the deck releaser, Fuse, the deck architect and
the public composer page, so its stepper and its colour ramp stay in one place.
-->
<script lang="ts">
  import TurnIntensityCard from "./TurnIntensityCard.svelte";
  import PatternStripEditor from "$lib/shared/create/components/pattern-strip/PatternStripEditor.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import LayerReadout from "./LayerReadout.svelte";
  import { PER_HAND_RHYTHMS } from "$lib/shared/create/domain/rhythm/rhythm-catalog";
  import type {
    StripBinding,
    StripValue,
  } from "$lib/shared/create/components/pattern-strip/pattern-strip-types";
  import { getTurnPool, type TurnLanes } from "@tka/sequence-engine/generation";
  import type { TurnValue } from "$lib/shared/create/domain/turn-pattern-data";
  import { predictLayerSignature } from "$lib/shared/create/domain/layer-prediction";

  let {
    currentIntensity,
    allowedValues,
    onIntensityChange,
    level,
    turnPattern,
    onTurnPatternChange,
    blueStartOrientation,
    redStartOrientation,
    sequenceLength,
    loopPeriod,
    brightBackgroundOverride,
    shadowColor = "0deg 0% 0%", // Neutral shadow (adapts to any color)
    gridColumnSpan = 2,
    cardIndex = 0,
    headerFontSize = "9px",
  } = $props<{
    currentIntensity: number;
    allowedValues: number[];
    onIntensityChange: (intensity: number) => void;
    level: number;
    /** Absent means Intensity mode. */
    turnPattern: TurnLanes | null | undefined;
    onTurnPatternChange: (lanes: TurnLanes | null) => void;
    blueStartOrientation: string;
    redStartOrientation: string;
    sequenceLength: number;
    /** When a LOOP is active, periods restrict to divisors of its seed block. */
    loopPeriod?: number;
    /** Pins the palette for isolated embeds that do not share app settings. */
    brightBackgroundOverride?: boolean;
    shadowColor?: string;
    gridColumnSpan?: number;
    cardIndex?: number;
    headerFontSize?: string;
  }>();

  type Mode = "intensity" | "pattern";

  // A pattern that survived from a previous session is already in force, so the
  // card has to open showing it rather than claiming to be capping intensity.
  let mode = $state<Mode>(turnPattern ? "pattern" : "intensity");

  // The strip may only offer values this level actually has. getTurnPool is the
  // single owner of that answer, so a half turn cannot be drawn into a level 2
  // sequence just because it happens to be under the intensity cap.
  const turnValues = $derived(
    getTurnPool(level, currentIntensity, {
      allowFloat: level >= 3,
    }) as StripValue[]
  );

  const binding = $derived<StripBinding>({
    lanes: 2,
    rhythms: PER_HAND_RHYTHMS,
    valueList: turnValues,
    amountList: turnValues.filter(
      (v): v is number => typeof v === "number" && v > 0
    ),
    base: 0,
    format: (v) => (v === "fl" ? "fl" : String(v)),
    laneColors: ["blue", "red"],
    laneLabels: ["Blue", "Red"],
  });

  // Periods offered by the editor are divisors of whatever length it is given.
  // Handing it the LOOP's seed block is therefore the whole of the LOOP
  // restriction: turns then repeat in lockstep with the shape rather than
  // drifting across it.
  const stripLength = $derived(loopPeriod ?? sequenceLength);

  const lanes = $derived<StripValue[][]>(
    turnPattern ? [[...turnPattern.blue], [...turnPattern.red]] : [[0], [0]]
  );

  const prediction = $derived(
    turnPattern
      ? predictLayerSignature({
          blueStartOrientation,
          redStartOrientation,
          lanes: turnPattern,
          length: sequenceLength,
        })
      : { signature: "", uncertain: false }
  );

  // Below level 3 there are no half turns and only radial starts, so the
  // signature is always all ones and says nothing worth reading.
  const showReadout = $derived(level >= 3 && mode === "pattern");

  // StripValue also admits booleans, for strips whose cells are toggles. This
  // strip's cells are turn values, so anything else is dropped rather than
  // cast, which would hand the engine a boolean where it expects a turn.
  function toTurnLane(lane: StripValue[]): TurnValue[] {
    return lane.filter(
      (v): v is TurnValue => typeof v === "number" || v === "fl"
    );
  }

  function handleStripChange(next: StripValue[][]) {
    onTurnPatternChange({
      blue: toTurnLane(next[0] ?? []),
      red: toTurnLane(next[1] ?? []),
    });
  }

  function handleModeChange(next: Mode) {
    mode = next;
    // Leaving Pattern mode clears the pattern so generation goes back to
    // rolling turns at random rather than silently keeping the last strip.
    onTurnPatternChange(next === "pattern" ? { blue: [0], red: [0] } : null);
  }
</script>

<div class="turns-card">
  <SegmentedControl
    options={[
      { value: "intensity", label: "Intensity" },
      { value: "pattern", label: "Pattern" },
    ]}
    value={mode}
    onchange={handleModeChange}
    size="sm"
    ariaLabel="Turn mode"
  />

  {#if mode === "intensity"}
    <div class="mode-body">
      <TurnIntensityCard
        {currentIntensity}
        {allowedValues}
        {onIntensityChange}
        {brightBackgroundOverride}
        {shadowColor}
        {gridColumnSpan}
        {cardIndex}
        {headerFontSize}
      />
    </div>
  {:else}
    <div class="mode-body">
      <PatternStripEditor
        {binding}
        sequenceLength={stripLength}
        value={lanes}
        onChange={handleStripChange}
        fitAvailableHeight
      />
    </div>
    {#if showReadout}
      <LayerReadout
        signature={prediction.signature}
        uncertain={prediction.uncertain}
      />
    {/if}
  {/if}
</div>

<style>
  .turns-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
    height: 100%;
  }

  /* Both modes fill whatever height the card cell has left. Without this the
     strip sizes to its own content and leaves the rest of the cell empty. */
  .mode-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
</style>
