<!--
TurnsExpandedOverlay.svelte

Where turns are configured, either way round. Intensity sets a ceiling and lets
the generator roll its own values under it; Pattern hands the generator an
exact repeating figure instead — the same strip the Actions panel uses on a
finished sequence, moved in front of generation so the search can pick letters
that suit it rather than having turns pushed onto them after.

Both live here rather than on the tile: the strip is three stacked controls and
a two-lane grid, around 550px tall, and the tile's cell in the settings grid is
under 200px.

Under the strip, what the pattern will do to the sequence's layers. That
reading needs no letters, so it is available while the user is still setting
up: a prop crosses on a half turn and holds on a whole one, and where it starts
is already known.
-->
<script lang="ts">
  import PatternStripEditor from "$lib/shared/create/components/pattern-strip/PatternStripEditor.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import LayerReadout from "./LayerReadout.svelte";
  import TurnIntensityCard from "./TurnIntensityCard.svelte";
  import { PER_HAND_RHYTHMS } from "$lib/shared/create/domain/rhythm/rhythm-catalog";
  import type {
    StripBinding,
    StripValue,
  } from "$lib/shared/create/components/pattern-strip/pattern-strip-types";
  import { getTurnPool } from "@tka/sequence-engine/generation";
  import type { TurnValue } from "$lib/shared/create/domain/turn-pattern-data";
  import { predictLayerSignature } from "$lib/shared/create/domain/layer-prediction";
  import type { TurnsOverlayProps } from "$lib/shared/create/state/panel-coordination-state.svelte";
  import GenerationSettingsOverlay from "./GenerationSettingsOverlay.svelte";

  let {
    turnPattern,
    level,
    maxTurnIntensity,
    allowedValues,
    onIntensityChange,
    blueStartOrientation,
    redStartOrientation,
    sequenceLength,
    loopPeriod,
    onTurnPatternChange,
    onClose,
  }: TurnsOverlayProps & { onClose: () => void } = $props();

  type Mode = "intensity" | "pattern";

  // A pattern that survived from a previous session is already in force, so the
  // drawer has to open showing it rather than claiming to be capping intensity.
  let mode = $state<Mode>(turnPattern ? "pattern" : "intensity");

  // The drawer's props are a snapshot taken when it opened, so it keeps its own
  // copies and reports every change upward as it happens.
  let lanes = $state<StripValue[][]>(
    turnPattern ? [[...turnPattern.blue], [...turnPattern.red]] : [[0], [0]]
  );
  let intensity = $state(maxTurnIntensity);

  // The strip may only offer values this level actually has. getTurnPool is the
  // single owner of that answer, so a half turn cannot be drawn into a level 2
  // sequence just because it happens to sit under the intensity cap.
  const turnValues = $derived(
    getTurnPool(level, intensity, {
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

  // StripValue also admits booleans, for strips whose cells are toggles. This
  // strip's cells are turn values, so anything else is dropped rather than
  // cast, which would hand the engine a boolean where it expects a turn.
  function toTurnLane(lane: StripValue[]): TurnValue[] {
    return lane.filter(
      (v): v is TurnValue => typeof v === "number" || v === "fl"
    );
  }

  const prediction = $derived(
    predictLayerSignature({
      blueStartOrientation,
      redStartOrientation,
      lanes: {
        blue: toTurnLane(lanes[0] ?? []),
        red: toTurnLane(lanes[1] ?? []),
      },
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

  function handleIntensityChange(next: number) {
    intensity = next;
    onIntensityChange(next);
  }

  function handleModeChange(next: Mode) {
    mode = next;
    // Leaving Pattern mode clears the figure so generation goes back to rolling
    // turns at random rather than silently keeping the last strip.
    onTurnPatternChange(
      next === "pattern"
        ? {
            blue: toTurnLane(lanes[0] ?? []),
            red: toTurnLane(lanes[1] ?? []),
          }
        : null
    );
  }
</script>

<GenerationSettingsOverlay title="Turns" closeLabel="Close turns" {onClose}>
  {#snippet children()}
    <div class="turns-body">
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
        <p class="mode-note">
          A ceiling. The generator picks its own turns underneath it.
        </p>
        <div class="intensity-slot">
          <TurnIntensityCard
            currentIntensity={intensity}
            {allowedValues}
            onIntensityChange={handleIntensityChange}
          />
        </div>
      {:else}
        <p class="mode-note">
          An exact figure, repeated across the sequence. The search only picks
          letters that can carry it.
        </p>
        <PatternStripEditor
          {binding}
          sequenceLength={stripLength}
          value={lanes}
          onChange={handleStripChange}
        />

        {#if showReadout}
          <LayerReadout
            signature={prediction.signature}
            uncertain={prediction.uncertain}
          />
        {/if}
      {/if}
    </div>
  {/snippet}
</GenerationSettingsOverlay>

<style>
  .turns-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
    overflow-y: auto;
  }

  .mode-note {
    margin: -6px 0 0;
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.65));
  }

  /* The stepper is a card, and a card fills whatever box it is given. Without a
     height it would stretch to the whole drawer. */
  .intensity-slot {
    height: 160px;
    flex: 0 0 auto;
  }
</style>
