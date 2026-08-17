<!--
  TurnPatternSection.svelte

  The turn-pattern editor, as one screen of the Customize drill.

  A pattern REPLACES turn intensity rather than sitting beside it — the builder
  reads `options.turnPattern ? patternSource(...) : allocationSource(...)`, so the
  two can never both be in force. That is why this lives under Customize as an
  override you go looking for, and why turn intensity keeps its card in the
  settings grid untouched.
-->
<script lang="ts">
  import PatternStripEditor from "$lib/shared/create/components/pattern-strip/PatternStripEditor.svelte";
  import LayerReadout from "../../cards/LayerReadout.svelte";
  import { PER_HAND_RHYTHMS } from "$lib/shared/create/domain/rhythm/rhythm-catalog";
  import type {
    StripBinding,
    StripValue,
  } from "$lib/shared/create/components/pattern-strip/pattern-strip-types";
  import { getTurnPool } from "@tka/sequence-engine/generation";
  import type { TurnValue } from "$lib/shared/create/domain/turn-pattern-data";
  import { predictLayerSignature } from "$lib/shared/create/domain/layer-prediction";

  let {
    turnPattern,
    level,
    turnIntensity,
    blueStartOrientation,
    redStartOrientation,
    sequenceLength,
    loopPeriod,
    onTurnPatternChange,
  }: {
    turnPattern: { blue: TurnValue[]; red: TurnValue[] } | null;
    level: number;
    turnIntensity: number;
    blueStartOrientation: string;
    redStartOrientation: string;
    sequenceLength: number;
    loopPeriod?: number;
    onTurnPatternChange: (
      lanes: { blue: TurnValue[]; red: TurnValue[] } | null
    ) => void;
  } = $props();

  // Local copy: the overlay's props are a snapshot taken when it opened, so every
  // edit is reported upward as it happens rather than on a save press.
  let lanes = $state<StripValue[][]>(
    turnPattern ? [[...turnPattern.blue], [...turnPattern.red]] : [[1, 0], [0, 1]]
  );

  // The strip may only offer values this level actually has. getTurnPool owns
  // that answer, so a half turn cannot be drawn into a level 2 sequence just
  // because it sits under the intensity ceiling.
  const turnValues = $derived(
    getTurnPool(level, turnIntensity, { allowFloat: level >= 3 }) as StripValue[]
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
    // Blue is the left hand and red the right. The colour identifies the prop;
    // the word teaches which hand it is, which the tint alone cannot do. Matches
    // the APPLY TO / HandSelector convention used across the Actions panel.
    laneLabels: ["Left", "Right"],
    sentence: { verb: "turns" },
  });

  // Periods offered by the editor are divisors of whatever length it is given, so
  // handing it the LOOP's seed block IS the whole LOOP restriction: turns repeat
  // in lockstep with the shape rather than drifting across it.
  const stripLength = $derived(loopPeriod ?? sequenceLength);

  // StripValue also admits booleans, for strips whose cells are toggles. This
  // strip's cells are turn values, so anything else is dropped rather than cast,
  // which would hand the engine a boolean where it expects a turn.
  function toTurnLane(lane: StripValue[]): TurnValue[] {
    return lane.filter(
      (v): v is TurnValue => typeof v === "number" || v === "fl"
    );
  }

  const prediction = $derived(
    predictLayerSignature({
      blueStartOrientation,
      redStartOrientation,
      lanes: { blue: toTurnLane(lanes[0] ?? []), red: toTurnLane(lanes[1] ?? []) },
      length: sequenceLength,
    })
  );

  // Below level 3 there are no half turns and only radial starts, so every step
  // reads as layer 1 and the signature says nothing worth showing.
  const showReadout = $derived(level >= 3);

  function handleStripChange(next: StripValue[][]) {
    lanes = next;
    onTurnPatternChange({
      blue: toTurnLane(next[0] ?? []),
      red: toTurnLane(next[1] ?? []),
    });
  }

  // null, not undefined: updateConfig strips undefined by design, so null is the
  // sentinel that actually clears the field and hands the turns back to intensity.
  function clearPattern() {
    onTurnPatternChange(null);
  }
</script>

<div class="turn-pattern-section">
  <p class="intro">
    Set exactly how much each hand turns. The generator only picks letters that
    can carry the figure.
  </p>

  <PatternStripEditor
    {binding}
    sequenceLength={stripLength}
    value={lanes}
    onChange={handleStripChange}
  />

  <div class="footer">
    {#if showReadout}
      <LayerReadout
        signature={prediction.signature}
        uncertain={prediction.uncertain}
      />
    {/if}
    <button class="clear-button" onclick={clearPattern}>
      Use random turns instead
    </button>
  </div>
</div>

<style>
  /* Grows into a tall pane, never shrinks below its own content. On a short
     landscape phone the pane is shorter than the sentence, the length row and
     two lanes of cells need, and a shrinkable box froze at the pane's height
     while the cells kept painting past it — which put the "use random turns
     instead" button on top of the length row. `1 0 auto` keeps the parts in
     order at any height and lets the panel scroll to whatever runs past. */
  .turn-pattern-section {
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    gap: 14px;
  }

  .intro {
    flex: 0 0 auto;
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    line-height: 1.45;
    color: var(--theme-text-dim);
  }

  /* Natural height, and never shrinks below it. The editor is a stack of
     fixed-size panels with nothing worth stretching, so the leftover height
     goes past it to the footer rule below. On a short screen the no-shrink
     half is what keeps the cells from painting outside the scroller (see
     PatternStepStrip's fill note).

     Centring the stack in the leftover was tried and is worse: it opens a
     170px hole between the intro sentence and the panel it introduces, which
     reads as a broken page rather than as composition. Content at the top and
     the one action at the bottom is what every other settings panel does. */
  .turn-pattern-section :global(.pse) {
    flex: 0 0 auto;
  }

  /* Follows the editor rather than pinning to the bottom of the pane. Pinning
     was tried: at 1080 it looks deliberate, but the drawer is as tall as the
     window, so at 4K it parked this button 1400px below the pattern it undoes,
     with nothing in between. Directly under the rule it reads the same at every
     height — the editor, a divider, and the way back out of it. */
  .footer {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 6px;
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  /* A real button, not a text link — it is a standalone action, and the one way
     back to letting the generator roll its own turns. */
  .clear-button {
    min-height: var(--min-touch-target, 44px);
    padding: 0 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    border-radius: 8px;
    color: var(--theme-text, white);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .clear-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.15));
  }

  .clear-button:focus-visible {
    outline: 2px solid var(--customize-accent);
    outline-offset: 2px;
  }
</style>
