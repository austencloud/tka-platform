<script lang="ts">
  import { saveMandalaToCollection } from "$lib/features/mandala/tabs/collection/services/save-mandala-to-collection";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type {
    MandalaPathShape,
    MandalaRenderOptions,
  } from "$lib/shared/mandala/domain/mandala-types";
  import PanelHeader from "$lib/shared/create/components/PanelHeader.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import MandalaPane from "$lib/shared/sequence-viewer/components/MandalaPane.svelte";
  import { MandalaViewerController } from "$lib/shared/sequence-viewer/state/mandala-viewer-controller.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import AddToLibraryButton from "../../workspace-panel/shared/components/buttons/AddToLibraryButton.svelte";
  import HandSelector from "./HandSelector.svelte";

  type MotionMode = "static" | "animated";

  const MOTION_OPTIONS: { value: MotionMode; label: string }[] = [
    { value: "static", label: "Static" },
    { value: "animated", label: "Animated" },
  ];

  interface Props {
    sequence: SequenceData;
    variant: MandalaRenderOptions["show"];
    pathShape: MandalaPathShape;
    bluePropType: string;
    redPropType: string;
    isMobile?: boolean;
    onClose: () => void;
  }

  let {
    sequence,
    variant,
    pathShape,
    bluePropType,
    redPropType,
    isMobile = false,
    onClose,
  }: Props = $props();

  let saving = $state(false);
  let displayedVariant = $state<MandalaRenderOptions["show"]>(variant);

  const ctrl = new MandalaViewerController({
    getSequence: () => sequence,
    getBluePropType: () => bluePropType,
    getRedPropType: () => redPropType,
  });

  $effect(() => {
    displayedVariant = variant;
    ctrl.pathShape = pathShape;
  });

  const motionMode = $derived<MotionMode>(
    ctrl.paused ? "static" : "animated",
  );

  function handleMotionModeChange(mode: MotionMode): void {
    ctrl.paused = mode === "static";
  }

  async function handleSave(): Promise<void> {
    if (saving) return;
    saving = true;
    try {
      const name = await saveMandalaToCollection({
        steps: sequence.steps ?? [],
        variant: displayedVariant,
        bluePropType,
        redPropType,
        pathShape: ctrl.pathShape,
        sequenceWord: sequence.word ?? "",
      });
      if (name) toast.success(`Saved "${name}" to collection`);
    } finally {
      saving = false;
    }
  }
</script>

{#snippet headerActions()}
  <AddToLibraryButton
    onclick={() => void handleSave()}
    disabled={saving}
    ariaLabel={saving ? "Saving mandala" : "Save mandala to collection"}
  />
{/snippet}

<div class="mandala-viewer-panel">
  <PanelHeader
    title="Mandala"
    {isMobile}
    {onClose}
    actionButtons={headerActions}
  />
  <div class="viewer-options">
    <div
      class="motion-selector"
      role="group"
      aria-labelledby="mandala-motion-label"
    >
      <span class="section-label" id="mandala-motion-label">Motion</span>
      <SegmentedControl
        options={MOTION_OPTIONS}
        value={motionMode}
        onchange={handleMotionModeChange}
        color="accent"
        size="sm"
      />
    </div>
    <HandSelector
      value={displayedVariant}
      onChange={(value) => (displayedVariant = value)}
      sectionLabel="Show"
      labelId="mandala-show-label"
      labels={{ blue: "Blue", both: "Purple", red: "Red" }}
    />
  </div>
  <div class="mandala-stage">
    <MandalaPane
      {sequence}
      show={displayedVariant}
      {bluePropType}
      {redPropType}
      {ctrl}
      showDownload={false}
    />
  </div>
</div>

<style>
  .mandala-viewer-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: var(--theme-panel-bg);
    container-type: inline-size;
  }

  .mandala-stage {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }

  .viewer-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-bottom: 1px solid var(--theme-stroke);
  }

  .viewer-options :global(.hand-selector-section) {
    border-bottom: 0;
  }

  .motion-selector {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    border-right: 1px solid var(--theme-stroke);
  }

  .section-label {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  @container (max-width: 520px) {
    .viewer-options {
      grid-template-columns: 1fr;
    }

    .motion-selector {
      border-right: 0;
      border-bottom: 1px solid var(--theme-stroke);
    }
  }
</style>
