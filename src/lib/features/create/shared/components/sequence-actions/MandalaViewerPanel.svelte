<script lang="ts">
  import { saveMandalaToCollection } from "$lib/features/mandala/tabs/collection/services/save-mandala-to-collection";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type {
    MandalaPathShape,
    MandalaRenderOptions,
  } from "$lib/shared/mandala/domain/mandala-types";
  import {
    BLUE_STROKE,
    RED_STROKE,
  } from "$lib/shared/mandala/domain/mandala-constants";
  import PanelHeader from "$lib/shared/create/components/PanelHeader.svelte";
  import MandalaPane from "$lib/shared/sequence-viewer/components/MandalaPane.svelte";
  import type { ControlDockAction } from "$lib/shared/sequence-viewer/components/ControlDock.svelte";
  import { MandalaViewerController } from "$lib/shared/sequence-viewer/state/mandala-viewer-controller.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

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

  const ctrl = new MandalaViewerController(
    {
      getSequence: () => sequence,
      getBluePropType: () => bluePropType,
      getRedPropType: () => redPropType,
      pathPolicy: getAnimationVisibilityManager(),
    },
    {
      // This focused viewer always opens in the standard stroke colors.
      // Palette controls can change them without replacing the full viewer's
      // saved look.
      viewOverrides: {
        colorMode: "solid",
        preset: "custom",
        customBlue: BLUE_STROKE,
        customRed: RED_STROKE,
      },
      persistViewState: false,
    }
  );

  $effect(() => {
    ctrl.show = variant;
    ctrl.pathShape = pathShape;
  });

  async function handleSave(): Promise<void> {
    if (saving) return;
    saving = true;
    try {
      const name = await saveMandalaToCollection({
        steps: sequence.steps ?? [],
        variant: ctrl.show,
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

  const saveAction = $derived<ControlDockAction>({
    icon: "fa-folder-plus",
    label: saving ? "Saving mandala" : "Save mandala to collection",
    onClick: () => void handleSave(),
    disabled: saving,
    busy: saving,
    accent: true,
  });
</script>

<div class="mandala-viewer-panel">
  <PanelHeader title="Mandala" {isMobile} {onClose} />
  <div class="mandala-stage">
    <MandalaPane
      {sequence}
      {bluePropType}
      {redPropType}
      {ctrl}
      showDownload={false}
      dockAction={saveAction}
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
  }

  .mandala-stage {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }
</style>
