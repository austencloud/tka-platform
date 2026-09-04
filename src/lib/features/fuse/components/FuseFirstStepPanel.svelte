<script lang="ts">
  import CreatePanelDrawer from "$lib/features/create/shared/components/CreatePanelDrawer.svelte";
  import PanelHeader from "$lib/shared/create/components/PanelHeader.svelte";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import type { BrowseViewMode } from "$lib/shared/browse/domain/browse-view-mode";
  import { responsiveLayoutManager } from "$lib/shared/create/services/responsive-layout-manager";
  import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";
  import { getFuseContext } from "../context/fuse-context";

  let {
    isOpen = $bindable(false),
    side,
    onClose,
  }: {
    isOpen: boolean;
    side: FuseSide | null;
    onClose: () => void;
  } = $props();

  const { state: fuseState } = getFuseContext();
  const settings = getSettings();
  const source = $derived(
    side === "left" ? fuseState.left : side === "right" ? fuseState.right : null
  );
  const sequence = $derived(source?.sequence ?? null);
  const label = $derived(side === "right" ? "Right" : "Left");
  const browseViewMode = $derived<BrowseViewMode>({
    subject: "props",
    granularity: "solo",
    hand: side ?? "left",
  });
  let isMobile = $state(responsiveLayoutManager.isMobilePortrait());

  $effect(() => {
    const update = () => {
      isMobile = responsiveLayoutManager.isMobilePortrait();
    };
    update();
    return responsiveLayoutManager.onLayoutChange(update);
  });

  async function chooseFirstStep(stepIndex: number): Promise<void> {
    if (!side) return;
    await fuseState.adjustSource(side, {
      kind: "first-step",
      step: stepIndex + 1,
    });
    onClose();
  }
</script>

<CreatePanelDrawer
  bind:isOpen
  panelName="fuse-first-step"
  closeOnBackdrop={true}
  ariaLabel="Choose {label} LOOP first step"
  {onClose}
>
  <div class="first-step-panel">
    <PanelHeader
      title="Choose First Step"
      subtitle="{label} LOOP"
      {isMobile}
      {onClose}
    />
    <div class="first-step-content">
      <p>Choose the step that should become step 1.</p>
      {#if sequence}
        <div class="first-step-card themed-scrollbar">
          <ChoreoCard
            {sequence}
            {browseViewMode}
            includeStartPosition={false}
            showMandala={false}
            showWord={false}
            showStepNumbers={true}
            showDifficultyLevel={false}
            showNotes={false}
            showLoopGlyph={false}
            darkMode={true}
            leftPropType={settings.leftPropType}
            rightPropType={settings.rightPropType}
            hideSoloHeader={true}
            fitWidth={true}
            onStepClick={(stepIndex) => void chooseFirstStep(stepIndex)}
          />
        </div>
      {/if}
    </div>
  </div>
</CreatePanelDrawer>

<style>
  :global(
    .drawer-content.fuse-first-step-panel-container.side-by-side-layout[data-placement="right"]
  ) {
    width: clamp(620px, 22vw, 820px);
    max-width: min(820px, calc(100vw - var(--desktop-sidebar-width, 64px)));
    border-radius: 0;
  }

  .first-step-panel,
  .first-step-content {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .first-step-panel {
    width: 100%;
    height: 100%;
    background: var(--theme-panel-bg);
  }

  .first-step-content {
    flex: 1;
    gap: 14px;
    padding: 16px;
  }

  .first-step-content > p {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 14px);
    text-align: center;
  }

  .first-step-card {
    flex: 1;
    min-height: 0;
    padding: 10px;
    overflow: auto;
    border: 1px solid var(--theme-stroke);
    border-radius: 18px;
    background: var(--theme-card-bg);
  }
</style>
