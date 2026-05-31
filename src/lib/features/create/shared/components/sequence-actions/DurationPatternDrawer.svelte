<!--
  DurationPatternDrawer.svelte

  Single-lane duration binding via PatternStripEditor. Length × Rhythm × Amount
  over a beat strip; Apply tiles the strip to a DurationPattern and runs the
  proven duration-pattern-manager.applyPattern.
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
  import { DURATION_RHYTHMS } from "$lib/shared/create/domain/rhythm/rhythm-catalog";
  import { stampSingle } from "$lib/shared/create/domain/rhythm/rhythm-mask";
  import { stripToDurationPattern } from "../../domain/pattern-strip-apply";
  import * as durationPatternManager from "$lib/features/create/shared/services/duration-pattern-manager";

  interface Props {
    isOpen: boolean;
    sequence: SequenceData | null;
    /** Measured tool panel width for desktop sizing (to match parent panel). */
    toolPanelWidth?: number;
    onClose: () => void;
    onApply: (result: {
      sequence: SequenceData;
      warnings?: readonly string[];
    }) => void;
    /** Accepted for parent compatibility; unused in the strip editor. */
    onPreview?: (sequence: SequenceData) => void;
    /** Accepted for parent compatibility; unused in the strip editor. */
    previewMode?: boolean;
  }

  let {
    isOpen = $bindable(),
    sequence,
    toolPanelWidth = 0,
    onClose,
    onApply,
  }: Props = $props();

  const DUR_VALUES: StripValue[] = [1, 1.25, 1.5, 2, 4];
  const fmtDur = (v: StripValue) => (v === 1 ? "1×" : `${v}×`);

  const binding: StripBinding = {
    lanes: 1,
    rhythms: DURATION_RHYTHMS,
    valueList: DUR_VALUES,
    amountList: [1.25, 1.5, 2, 4],
    base: 1,
    format: fmtDur,
    laneColors: ["accent"],
    laneLabels: ["Hold"],
  };

  const seqLen = $derived(sequence?.steps.length ?? 8);
  const initPeriod = $derived(
    seqLen % 4 === 0 ? 4 : seqLen % 2 === 0 ? 2 : 1
  );

  let strip = $state<StripValue[][]>([[2, 1, 1, 1]]);
  let lastOpen = false;
  $effect(() => {
    if (isOpen && !lastOpen) {
      // Stamp the downbeat rhythm (P---) at x2 hold when the drawer opens.
      strip = [stampSingle(DURATION_RHYTHMS[2]!, initPeriod, 2, 1)];
    }
    lastOpen = isOpen;
  });

  const drawerStyle = $derived(
    toolPanelWidth > 0 ? `--measured-panel-width: ${toolPanelWidth}px` : ""
  );

  function applyStrip() {
    if (!sequence) return;
    const pattern = stripToDurationPattern(
      strip[0]! as number[],
      sequence.steps.length
    );
    const result = durationPatternManager.applyPattern(pattern, sequence);
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
    showHandle={true}
    respectLayoutMode={true}
    class="duration-pattern-drawer"
    backdropClass="duration-pattern-backdrop"
  >
    <div class="dp-content">
      <DrawerHeader title="Duration Patterns" onBack={onClose} onClose={onClose} />
      <div class="dp-body">
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
  /* Position duration pattern drawer to cover Sequence Actions panel on desktop */
  :global(.duration-pattern-drawer[data-placement="right"].side-by-side-layout) {
    width: var(--measured-panel-width, clamp(360px, 44.44vw, 900px)) !important;
    max-width: 100% !important;
  }

  /* Backdrop transparent - we cover sequence actions, not dim everything */
  :global(.duration-pattern-backdrop) {
    background: transparent !important;
    backdrop-filter: none !important;
    pointer-events: none !important;
  }

  .dp-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg);
    color: var(--theme-text);
  }

  .dp-body {
    flex: 1;
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .apply-btn {
    width: 100%;
    max-width: 600px;
    min-height: 52px;
    margin: 6px auto 0;
    padding: 0 14px;
    border: none;
    border-radius: 12px;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    background: linear-gradient(135deg, var(--theme-accent, #2dd4bf), #0e8f80);
    color: #fff;
  }

  .apply-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
