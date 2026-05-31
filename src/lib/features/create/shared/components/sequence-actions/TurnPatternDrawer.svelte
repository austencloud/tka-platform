<!--
  TurnPatternDrawer.svelte

  Drawer for applying turn patterns via the PatternStripEditor.
  The strip is the source of truth: Length × Rhythm × Amount edits an
  editable 2-lane (blue/red) turn strip, which Apply converts to a
  TurnPattern and runs through the proven turn-pattern-manager.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import PatternStripEditor from "$lib/shared/create/components/pattern-strip/PatternStripEditor.svelte";
  import type {
    StripBinding,
    StripValue,
  } from "$lib/shared/create/components/pattern-strip/pattern-strip-types";
  import { PER_HAND_RHYTHMS } from "$lib/shared/create/domain/rhythm/rhythm-catalog";
  import { stampPerHand } from "$lib/shared/create/domain/rhythm/rhythm-mask";
  import { stripToTurnPattern } from "../../domain/pattern-strip-apply";
  import * as turnPatternManager from "$lib/shared/create/services/turn-pattern-manager";
  import type { TargetHand } from "../../state/panel-coordination-state.svelte";

  interface Props {
    isOpen: boolean;
    sequence: SequenceData | null;
    /** Accepted for parent compatibility; unused — the strip encodes per-hand. */
    targetHand?: TargetHand;
    /** Measured tool panel width for desktop sizing (to match parent panel). */
    toolPanelWidth?: number;
    onClose: () => void;
    onApply: (result: {
      sequence: SequenceData;
      warnings?: readonly string[];
    }) => void;
  }

  let {
    isOpen = $bindable(),
    sequence,
    toolPanelWidth = 0,
    onClose,
    onApply,
  }: Props = $props();

  const TURN_VALUES: StripValue[] = [0, 0.5, 1, 1.5, 2, 2.5, 3, "fl"];
  const fmtTurn = (v: StripValue) => (v === "fl" ? "fl" : String(v));
  const binding: StripBinding = {
    lanes: 2,
    rhythms: PER_HAND_RHYTHMS,
    valueList: TURN_VALUES,
    amountList: [0.5, 1, 1.5, 2, 2.5, 3],
    base: 0,
    format: fmtTurn,
    laneColors: ["blue", "red"],
    laneLabels: ["Blue", "Red"],
  };

  const seqLen = $derived(sequence?.steps.length ?? 8);
  const initPeriod = $derived(
    seqLen % 4 === 0 ? 4 : seqLen % 2 === 0 ? 2 : 1
  );
  let strip = $state<StripValue[][]>([
    [0, 1],
    [1, 0],
  ]);
  let lastOpen = false;
  $effect(() => {
    if (isOpen && !lastOpen) {
      const alt = stampPerHand(PER_HAND_RHYTHMS[2]!, initPeriod, 1, 1, 0); // alternating x1
      strip = [alt.blue, alt.red];
    }
    lastOpen = isOpen;
  });

  const drawerStyle = $derived(
    toolPanelWidth > 0 ? `--measured-panel-width: ${toolPanelWidth}px` : ""
  );

  function applyStrip() {
    if (!sequence) return;
    const pattern = stripToTurnPattern(
      strip[0]!,
      strip[1]!,
      sequence.steps.length
    );
    const result = turnPatternManager.applyPattern(pattern, sequence, "both");
    if (result.success && result.sequence) {
      onApply({ sequence: result.sequence, warnings: result.warnings });
    }
  }
</script>

<div style={drawerStyle}>
  <Drawer
    bind:isOpen
    placement="right"
    onclose={onClose}
    showHandle={false}
    respectLayoutMode={true}
    class="turn-pattern-drawer"
    backdropClass="turn-pattern-backdrop"
  >
    <div class="tp-content">
      <DrawerHeader title="Turn Patterns" onClose={onClose} />
      <div class="tp-body">
        <PatternStripEditor
          {binding}
          sequenceLength={seqLen}
          value={strip}
          onChange={(v) => (strip = v)}
        />
        <button class="apply-btn" onclick={applyStrip} disabled={!sequence}>
          Apply to sequence
        </button>
      </div>
    </div>
  </Drawer>
</div>

<style>
  /* Position turn pattern drawer to cover Sequence Actions panel on desktop. */
  /* Must include [data-placement] for specificity to override Drawer.css */
  :global(.turn-pattern-drawer[data-placement="right"].side-by-side-layout) {
    width: var(--measured-panel-width, clamp(360px, 44.44vw, 900px)) !important;
    max-width: 100% !important;
  }

  /* Backdrop transparent - cover sequence actions, don't dim everything */
  :global(.turn-pattern-backdrop) {
    background: transparent !important;
    backdrop-filter: none !important;
    pointer-events: none !important;
  }

  .tp-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg);
    color: var(--theme-text);
  }

  .tp-body {
    flex: 1;
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .apply-btn {
    width: 100%;
    max-width: 540px;
    min-height: 48px;
    margin-top: 4px;
    padding: 0 14px;
    border: none;
    border-radius: 12px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    background: linear-gradient(135deg, var(--theme-blue, #6f9bff), #4b7bff);
    color: #fff;
  }

  .apply-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
