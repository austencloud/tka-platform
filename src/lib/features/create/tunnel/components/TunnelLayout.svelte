<script lang="ts">
  import { onMount, tick } from "svelte";
  import { motionDuration } from "$lib/shared/transitions/motion";
  import CreatePanelDrawer from "$lib/features/create/shared/components/CreatePanelDrawer.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import PanelHeader from "$lib/shared/create/components/PanelHeader.svelte";
  import GeneratePanel from "$lib/features/create/generate/components/GeneratePanel.svelte";
  import type { GenerationAnimationTarget } from "$lib/features/create/generate/state/generate-actions.svelte";
  import { createSequenceState } from "$lib/features/create/shared/state/sequence-state-orchestrator.svelte";
  import type { PlaybackMode } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import TunnelArtSettings from "$lib/shared/sequence-viewer/components/art-settings/TunnelArtSettings.svelte";
  import TunnelArtView from "$lib/shared/sequence-viewer/tunnel/TunnelArtView.svelte";
  import { copyOpsLabel } from "$lib/shared/sequence-viewer/tunnel/tunnel-composition";
  import { DEFAULT_CONFIG } from "$lib/shared/sequence-viewer/tunnel/tunnel-config";
  import { TunnelViewController } from "$lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { createGlobalChiralitySeam } from "$lib/shared/settings/components/tabs/prop-type/prop-chirality-seam";
  import TkaLabel from "$lib/shared/components/TkaLabel.svelte";
  import { getTunnelCreatorContext } from "../context/tunnel-creator-context";
  import type { TunnelCreatorMode } from "../state/tunnel-creator-state.svelte";
  import TunnelPerformerCard from "./TunnelPerformerCard.svelte";
  import TunnelRelationshipEditor from "./TunnelRelationshipEditor.svelte";

  type TunnelInspector = "settings" | "pairing" | "generation";

  const creator = getTunnelCreatorContext();
  let syncingGenerationSequence = false;
  let syncedGenerationSource = $state<string | null>(null);
  let generateCurrentRecipe = $state<(() => Promise<void>) | null>(null);
  type GenerationCardRef = {
    prepareGenerationAnimation: (stepCount: number) => void;
    clearGenerationAnimation: () => void;
  };
  let performerOneCard: GenerationCardRef | undefined = $state();
  let performerTwoCard: GenerationCardRef | undefined = $state();
  const generationSequenceState = createSequenceState({
    onCurrentSequenceChange(sequence) {
      if (syncingGenerationSequence || !sequence || !creator.generationTargetId)
        return;
      creator.setPerformerSequence(
        creator.generationTargetId,
        sequence,
        "generated"
      );
    },
  });
  let performerTwoLayerSequence = $state<SequenceData | null>(null);
  let performerTwoStageTransform = $state<string | null>(null);
  const controller = new TunnelViewController({
    getSequence: () => creator.leadSequence,
    getComposition: () =>
      creator.compositionWithFormation(creator.initialFormation),
    onLayersChange: (layers) => {
      const performerTwoLayer =
        layers.find((layer) => layer.authoredPerformerIndex === 1) ??
        (creator.mode === "linked" ? layers[1] : undefined);
      // The card is the performer's choreography, not merely their source.
      // Showing the pre-formation sequence made a rotated/reflected arm look
      // identical to Performer 1 even while the stage rendered it correctly.
      performerTwoLayerSequence = performerTwoLayer?.sequence ?? null;
      performerTwoStageTransform = performerTwoLayer?.formationOps.length
        ? copyOpsLabel(performerTwoLayer.formationOps)
        : null;
    },
  });
  controller.applyConfig(creator.initialFormation ?? DEFAULT_CONFIG);

  let rootWidth = $state(1200);
  let rootHeight = $state(800);
  let bpm = $state(60);
  let playing = $state(true);
  let playbackMode = $state<PlaybackMode>("continuous");
  let reduceMotion = $state(false);
  let inspectorColumn = $state<TunnelInspector | null>(null);

  const compact = $derived(rootWidth < 720);
  const canInlineInspector = $derived(rootWidth >= 1000 && rootHeight >= 700);
  const settingsOpen = $derived(creator.activePanel === "settings");
  const pairingOpen = $derived(creator.activePanel === "pairing");
  const generationOpen = $derived(creator.activePanel === "generation");
  const activeInlineInspector: TunnelInspector | null = $derived(
    canInlineInspector
      ? settingsOpen
        ? "settings"
        : pairingOpen
          ? "pairing"
          : generationOpen
            ? "generation"
            : null
      : null
  );
  const generationTargetLabel = $derived(
    creator.performerSlots.find(
      (slot) => slot.id === creator.generationTargetId
    )?.label ?? "Performer"
  );
  const performerOneId = $derived(creator.performerIdAt(0));
  const performerTwoId = $derived(creator.performerIdAt(1));
  const performerTwoDisplaySequence = $derived(
    creator.mode === "linked"
      ? (performerTwoLayerSequence ?? creator.leadSequence)
      : null
  );
  const bluePropType = $derived(
    settingsService.settings.bluePropType ?? undefined
  );
  const redPropType = $derived(
    settingsService.settings.redPropType ?? undefined
  );
  const propType = $derived(bluePropType ? String(bluePropType) : "staff");
  const modeOptions = [
    {
      value: "separate",
      label: "Separate",
      ariaLabel: "Separate: two independent complete sequences",
    },
    {
      value: "linked",
      label: "Linked",
      ariaLabel: "Linked: one sequence rebuilds the second performer",
    },
  ] as const;
  const generationAnimationTarget: GenerationAnimationTarget = {
    clear() {
      generationTargetCard()?.clearGenerationAnimation();
    },
    prepare(stepCount) {
      generationTargetCard()?.prepareGenerationAnimation(stepCount);
    },
  };

  $effect(() => {
    controller.active = creator.leadSequence !== null;
  });

  $effect(() => {
    creator.setFormation(controller.config);
  });

  // Rehydrate the generator scratch sequence after draft restoration so the
  // reopened recipe belongs to the same performer and previews their source.
  $effect(() => {
    const targetId = creator.generationTargetId;
    if (!targetId) {
      syncedGenerationSource = null;
      return;
    }

    const performer = creator.performerSlots.find(
      (slot) => slot.id === targetId
    )?.performer;
    const sequence =
      performer?.source.kind === "independent"
        ? performer.source.sequence
        : null;
    const sourceKey = `${targetId}:${sequence?.id ?? "empty"}`;
    if (sourceKey === syncedGenerationSource) return;

    syncedGenerationSource = sourceKey;
    syncingGenerationSequence = true;
    generationSequenceState.setCurrentSequence(sequence);
    queueMicrotask(() => (syncingGenerationSequence = false));
  });

  $effect(() => {
    if (activeInlineInspector) {
      inspectorColumn = activeInlineInspector;
      return;
    }
    if (settingsOpen || pairingOpen || generationOpen) {
      inspectorColumn = null;
      return;
    }
    const timer = setTimeout(
      () => (inspectorColumn = null),
      motionDuration(280)
    );
    return () => clearTimeout(timer);
  });

  onMount(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => (reduceMotion = media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  });

  function setMode(mode: TunnelCreatorMode): void {
    creator.setMode(mode);
  }

  function toggleSettings(): void {
    if (settingsOpen) {
      creator.closeWorkspacePanel();
    } else {
      creator.openWorkspacePanel("settings");
    }
  }

  function openSettings(): void {
    creator.openWorkspacePanel("settings");
  }

  function openPairing(): void {
    creator.openWorkspacePanel("pairing");
  }

  function openGeneration(targetId: string): void {
    creator.openGenerationPanel(targetId);
  }

  function generationTargetCard() {
    return creator.generationTargetId === performerOneId
      ? performerOneCard
      : performerTwoCard;
  }

  async function generatePerformer(targetId: string): Promise<void> {
    if (!creator.selectGenerationTarget(targetId)) return;
    await tick();
    await generateCurrentRecipe?.();
  }

  function selectPickedSequence(
    sequence: Parameters<typeof creator.setLeadSequence>[0]
  ): void {
    if (creator.pickerTarget) {
      creator.setPerformerSequence(creator.pickerTarget, sequence, "picked");
    }
  }

  function changeProp(prop: PropType): void {
    void settingsService.updateSettings({
      bluePropType: prop,
      redPropType: prop,
    });
  }
</script>

{#snippet settingsPanel(isMobile: boolean, layout: "bottom" | "sidebar")}
  <div class="drawer-panel settings-panel">
    <PanelHeader
      title="Tunnel settings"
      subtitle="Formation, playback, and props"
      {isMobile}
      onClose={creator.closeWorkspacePanel}
    />
    <div class="drawer-scroll themed-scrollbar">
      <TunnelArtSettings
        {controller}
        {layout}
        onExport={() => {}}
        showExport={false}
        showTitle={false}
        {bpm}
        {playbackMode}
        isPlaying={playing}
        onBpmChange={(value) => (bpm = value)}
        onPlaybackModeChange={(mode) => (playbackMode = mode)}
        onPlaybackToggle={() => (playing = !playing)}
        bluePropType={propType}
        onPropChange={changeProp}
        propChirality={createGlobalChiralitySeam()}
        exporting={false}
        {reduceMotion}
      />
    </div>
  </div>
{/snippet}

{#snippet pairingPanel(isMobile: boolean)}
  <div class="drawer-panel pairing-panel">
    <PanelHeader
      title="Pairing"
      subtitle="How Performer 2 follows Performer 1"
      {isMobile}
      onClose={creator.closeWorkspacePanel}
    />
    <TunnelRelationshipEditor />
  </div>
{/snippet}

{#snippet generationPanel(isMobile: boolean)}
  <div class="drawer-panel generation-panel">
    <PanelHeader
      title={`Generate ${generationTargetLabel}`}
      subtitle="Choose the complete two-prop recipe"
      {isMobile}
      onClose={creator.closeWorkspacePanel}
    />
    <div class="generation-recipe">
      <GeneratePanel
        sequenceState={generationSequenceState}
        isDesktop={!isMobile}
        {generationAnimationTarget}
        bind:generateCurrent={generateCurrentRecipe}
      />
    </div>
  </div>
{/snippet}

<div
  class="tunnel-container"
  bind:clientWidth={rootWidth}
  bind:clientHeight={rootHeight}
>
  <div
    class="tunnel-workspace themed-scrollbar"
    class:inline-inspector={activeInlineInspector !== null}
  >
    <header class="workspace-header">
      <!-- Editing arrives here by a tab switch, which wipes every trace of the
           tunnel that was on screen a second ago. So the header stops being a
           title and becomes the tunnel's identity: its own poster, its own name
           in the alphabet it was written in. -->
      {#if creator.editingTunnel}
        <div class="title-block editing">
          {#if creator.editingTunnel.poster}
            <img
              class="editing-poster"
              src={creator.editingTunnel.poster}
              alt=""
            />
          {/if}
          <div class="editing-identity">
            <span class="editing-eyebrow">Editing saved tunnel</span>
            <h2 class="editing-name">
              <TkaLabel
                text={creator.editingTunnel.name}
                darkMode
                fitToParent={false}
              />
            </h2>
          </div>
        </div>
      {:else}
        <div class="title-block">
          <h2>Build a tunnel</h2>
          <p>Pair two complete sequences in one formation.</p>
        </div>
      {/if}

      <div class="mode-switch">
        <SegmentedControl
          options={[...modeOptions]}
          value={creator.mode}
          onchange={setMode}
          semantics="radiogroup"
          ariaLabel="Tunnel source mode"
          color="accent"
          size="md"
        />
      </div>

      <div class="settings-trigger">
        <PanelButton
          variant="secondary"
          onclick={toggleSettings}
          ariaExpanded={settingsOpen}
          ariaLabel={settingsOpen
            ? "Close tunnel settings"
            : "Open tunnel settings"}
        >
          <i class="fas fa-sliders" aria-hidden="true"></i>
          <span>Tunnel settings</span>
          <i class="fas fa-chevron-right" aria-hidden="true"></i>
        </PanelButton>
      </div>
    </header>

    <div class="source-column">
      <TunnelPerformerCard
        bind:this={performerOneCard}
        performer={creator.lead}
        label="Performer 1"
        sourceOrigin={performerOneId
          ? creator.sourceOrigin(performerOneId)
          : null}
        previousCount={performerOneId
          ? creator.previousCount(performerOneId)
          : 0}
        {bluePropType}
        {redPropType}
        onChoose={() => performerOneId && creator.openPicker(performerOneId)}
        onGenerateNow={() =>
          performerOneId && void generatePerformer(performerOneId)}
        onEditGeneration={() =>
          performerOneId && openGeneration(performerOneId)}
        onPrevious={() =>
          performerOneId && creator.restorePreviousSequence(performerOneId)}
      />

      <TunnelPerformerCard
        bind:this={performerTwoCard}
        performer={creator.partner}
        displaySequence={performerTwoDisplaySequence}
        stageTransformLabel={creator.mode === "linked"
          ? performerTwoStageTransform
          : null}
        label="Performer 2"
        linked={creator.mode === "linked"}
        disabled={!creator.leadSequence}
        sourceOrigin={performerTwoId
          ? creator.sourceOrigin(performerTwoId)
          : null}
        previousCount={performerTwoId
          ? creator.previousCount(performerTwoId)
          : 0}
        {bluePropType}
        {redPropType}
        onChoose={() => performerTwoId && creator.openPicker(performerTwoId)}
        onGenerateNow={() =>
          performerTwoId && void generatePerformer(performerTwoId)}
        onEditGeneration={() =>
          performerTwoId && openGeneration(performerTwoId)}
        onPrevious={() =>
          performerTwoId && creator.restorePreviousSequence(performerTwoId)}
        onEditPairing={openPairing}
      />
    </div>

    <section class="preview-stage" aria-label="Tunnel preview">
      <header class="preview-heading">
        <div>
          <span>Result</span>
          <h3>Tunnel preview</h3>
        </div>
        <p>
          {controller.performerCount} performers · {controller.propCount} props
        </p>
      </header>

      <div class="frame-wrap" class:empty={!creator.leadSequence}>
        {#if creator.leadSequence}
          <TunnelArtView
            sequence={creator.leadSequence}
            {controller}
            {bpm}
            bluePropType={propType}
            redPropType={propType}
            bind:playing
            stageFit="contain"
          />
          {#if !creator.ready}
            <div class="preview-guidance" role="status">
              <i class="fas fa-person-circle-plus" aria-hidden="true"></i>
              <span>
                <strong>Previewing Performer 1</strong>
                Choose Performer 2 to complete the tunnel.
              </span>
            </div>
          {/if}
        {:else}
          <PanelState
            type="empty"
            title="Your tunnel will appear here"
            message="Choose a sequence in the Performer 1 panel to start the preview."
            icon="fa-people-arrows-left-right"
          />
        {/if}
      </div>

      <footer class="stage-controls">
        <div class="result-meta">
          <strong>{bpm}</strong>
          <span>BPM</span>
        </div>
        <div class="result-actions">
          <PanelButton variant="secondary" onclick={openSettings}>
            <i class="fas fa-sliders" aria-hidden="true"></i>
            Settings
          </PanelButton>
          <PanelButton
            variant="primary"
            disabled={!creator.ready || creator.opening}
            ariaBusy={creator.opening}
            onclick={() => void creator.openInViewer(controller.config)}
          >
            <i class="fas fa-expand" aria-hidden="true"></i>
            {creator.editingTunnel ? "Preview changes" : "Open viewer"}
          </PanelButton>
        </div>
      </footer>
    </section>

    {#if canInlineInspector}
      <aside
        class="inspector-column"
        class:open={activeInlineInspector !== null}
        aria-label={inspectorColumn
          ? inspectorColumn === "settings"
            ? "Tunnel settings"
            : inspectorColumn === "pairing"
              ? "Tunnel pairing"
              : `${generationTargetLabel} generation recipe`
          : undefined}
        aria-hidden={activeInlineInspector === null}
        inert={activeInlineInspector === null}
      >
        <div
          class="inspector-layer generation-layer"
          class:active={inspectorColumn === "generation"}
          aria-hidden={inspectorColumn !== "generation"}
          inert={inspectorColumn !== "generation"}
        >
          {@render generationPanel(false)}
        </div>
        {#if inspectorColumn === "settings"}
          <div class="inspector-layer active">
            {@render settingsPanel(false, "sidebar")}
          </div>
        {:else if inspectorColumn === "pairing"}
          <div class="inspector-layer active">
            {@render pairingPanel(false)}
          </div>
        {/if}
      </aside>
    {/if}
  </div>
</div>

{#if !canInlineInspector}
  <CreatePanelDrawer
    isOpen={settingsOpen}
    panelName="tunnel-settings"
    fullHeightOnMobile={true}
    closeOnBackdrop={false}
    ariaLabel="Tunnel settings"
    onClose={creator.closeWorkspacePanel}
  >
    {@render settingsPanel(compact, compact ? "bottom" : "sidebar")}
  </CreatePanelDrawer>

  <CreatePanelDrawer
    isOpen={pairingOpen}
    panelName="tunnel-pairing"
    fullHeightOnMobile={true}
    closeOnBackdrop={false}
    ariaLabel="Tunnel pairing"
    onClose={creator.closeWorkspacePanel}
  >
    {@render pairingPanel(compact)}
  </CreatePanelDrawer>

  <CreatePanelDrawer
    isOpen={generationOpen}
    panelName="tunnel-generation"
    fullHeightOnMobile={true}
    keepMounted={true}
    closeOnBackdrop={false}
    ariaLabel={`${generationTargetLabel} generation recipe`}
    onClose={creator.closeWorkspacePanel}
  >
    {@render generationPanel(compact)}
  </CreatePanelDrawer>
{/if}

<SequencePickerModal
  open={creator.pickerTarget !== null}
  onClose={creator.closePicker}
  onSelect={selectPickedSequence}
  title={`Choose ${creator.performerSlots.find((slot) => slot.id === creator.pickerTarget)?.label ?? "Performer 1"} Sequence`}
/>

<style>
  .tunnel-container {
    --min-touch-target: 48px;
    container: tunnel / size;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--theme-page-bg, transparent);
  }

  .tunnel-workspace {
    --tunnel-gap: var(--settings-spacing-md, 12px);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: repeat(3, max-content);
    grid-template-areas:
      "header"
      "sources"
      "preview";
    align-content: start;
    gap: var(--tunnel-gap);
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    padding: clamp(10px, 2.5cqw, 20px);
    overflow-x: hidden;
    overflow-y: auto;
  }

  .workspace-header {
    grid-area: header;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--settings-spacing-md, 14px);
    min-height: var(--min-touch-target, 48px);
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 14px);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--settings-radius-lg, 20px);
    background: var(--theme-panel-bg);
  }

  .title-block {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  /* The identity keeps its natural width and the mode switch yields instead —
     it can shrink to its 12rem floor, and a squeezed title block wrapped the
     eyebrow onto two lines around 820px. */
  .title-block.editing {
    flex: 0 0 auto;
    grid-auto-flow: column;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
  }

  .editing-poster {
    width: 48px;
    height: 48px;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--settings-radius-sm, 10px);
    background: var(--theme-surface-2, rgb(0 0 0 / 0.25));
    object-fit: cover;
  }

  .editing-identity {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .editing-eyebrow {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* The glyph renderer is inline content inside the h2, so the line box has to
     stop reserving descender room or the name sits low against its poster. */
  .editing-name {
    display: flex;
    align-items: center;
    line-height: 1;
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    overflow: hidden;
    color: var(--theme-text);
    font-size: clamp(1.05rem, 2.2cqw, 1.35rem);
    font-weight: 750;
    letter-spacing: -0.02em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title-block p {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
  }

  .mode-switch {
    display: flex;
    flex: 0 1 22rem;
    min-width: 12rem;
    margin-right: auto;
  }

  .mode-switch :global(.segmented-control) {
    width: 100%;
  }

  .settings-trigger {
    flex: 0 1 auto;
    min-width: 0;
  }

  .settings-trigger :global(.panel-btn) {
    min-width: 13rem;
    justify-content: flex-start;
  }

  .settings-trigger :global(.panel-btn span) {
    flex: 1;
    text-align: left;
  }

  .source-column {
    grid-area: sources;
    display: grid;
    grid-template-rows: repeat(2, minmax(0, 1fr));
    gap: var(--tunnel-gap);
    min-width: 0;
    min-height: 0;
  }

  .preview-stage {
    grid-area: preview;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 31rem;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--settings-radius-lg, 20px);
    background: var(--theme-panel-bg);
  }

  .preview-heading,
  .stage-controls,
  .result-actions {
    display: flex;
    align-items: center;
  }

  .preview-heading {
    justify-content: space-between;
    gap: var(--settings-spacing-md, 14px);
    min-height: 4rem;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 14px);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .preview-heading > div {
    display: grid;
    gap: 2px;
  }

  .preview-heading span,
  .preview-heading p,
  .result-meta span {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
  }

  .preview-heading span {
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .preview-heading h3 {
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
  }

  .frame-wrap {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: color-mix(in srgb, var(--theme-card-bg) 76%, black);
  }

  .frame-wrap.empty {
    display: grid;
    place-items: center;
  }

  .frame-wrap :global(.panel-state__message) {
    max-width: 28rem;
  }

  .preview-guidance {
    position: absolute;
    top: var(--settings-spacing-md, 14px);
    left: var(--settings-spacing-md, 14px);
    z-index: 2;
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    max-width: calc(100% - 2 * var(--settings-spacing-md, 14px));
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 14px);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--settings-radius-md, 12px);
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    line-height: 1.35;
    background: color-mix(in srgb, var(--theme-panel-bg) 94%, black);
    pointer-events: none;
  }

  .preview-guidance i {
    flex: 0 0 auto;
    color: var(--theme-accent);
    font-size: var(--font-size-min, 14px);
  }

  .preview-guidance span {
    display: grid;
    gap: 1px;
  }

  .preview-guidance strong {
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
  }

  .stage-controls {
    justify-content: space-between;
    gap: var(--settings-spacing-md, 14px);
    min-height: 4.5rem;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 14px);
    border-top: 1px solid var(--theme-stroke);
  }

  .result-meta {
    display: flex;
    align-items: baseline;
    gap: 5px;
    min-width: 5rem;
  }

  .result-meta strong {
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
  }

  .result-actions {
    justify-content: flex-end;
    gap: var(--settings-spacing-sm, 8px);
  }

  .drawer-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: var(--theme-panel-bg);
  }

  .inspector-column {
    grid-area: inspector;
    position: relative;
    display: flex;
    justify-content: flex-end;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    opacity: 0;
    transform: translateX(2rem);
    pointer-events: none;
    transition:
      opacity var(--duration-emphasis, 280ms)
        var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
      transform var(--duration-emphasis, 280ms)
        var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
  }

  .inspector-column.open {
    opacity: 1;
    transform: translateX(0);
    pointer-events: auto;
  }

  .inspector-layer {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: flex-end;
    min-width: 0;
    min-height: 0;
    visibility: hidden;
    opacity: 0;
    transform: translateX(1rem);
    pointer-events: none;
    transition:
      opacity var(--duration-normal, 180ms) ease,
      transform var(--duration-emphasis, 280ms)
        var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
      visibility 0s linear var(--duration-emphasis, 280ms);
  }

  .inspector-layer.active {
    visibility: visible;
    opacity: 1;
    transform: translateX(0);
    pointer-events: auto;
    transition-delay: 0s;
  }

  .inspector-column .drawer-panel {
    flex: 0 0 auto;
    width: var(--inspector-open-width, 30rem);
    min-width: 0;
  }

  .pairing-panel :global(.relationship) {
    flex: 1;
    min-height: 0;
  }

  .generation-recipe {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .drawer-scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .drawer-scroll :global(.art-settings-panel) {
    width: 100%;
    min-height: 100%;
    border: 0;
    border-radius: 0;
  }

  :global(.drawer-content.tunnel-settings-panel-container),
  :global(.drawer-content.tunnel-pairing-panel-container),
  :global(.drawer-content.tunnel-generation-panel-container) {
    --sheet-bg: var(--theme-panel-bg);
    --sheet-filter: none;
    background: var(--theme-panel-bg);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  :global(
    .drawer-content.tunnel-settings-panel-container.side-by-side-layout[data-placement="right"]
  ),
  :global(
    .drawer-content.tunnel-pairing-panel-container.side-by-side-layout[data-placement="right"]
  ),
  :global(
    .drawer-content.tunnel-generation-panel-container.side-by-side-layout[data-placement="right"]
  ) {
    width: clamp(30rem, 34vw, 44rem);
    max-width: calc(100vw - var(--desktop-sidebar-width, 64px));
    border-radius: 0;
  }

  @container tunnel (min-width: 720px) {
    .tunnel-workspace {
      grid-template-columns: minmax(20rem, 0.92fr) minmax(0, 1.08fr);
      grid-template-rows: max-content minmax(0, 1fr);
      grid-template-areas:
        "header header"
        "sources preview";
      align-content: stretch;
      overflow: hidden;
    }

    .preview-stage {
      min-height: 0;
    }
  }

  @container tunnel (max-width: 719px) {
    .workspace-header {
      flex-wrap: wrap;
    }

    .mode-switch {
      flex: 1 0 100%;
      order: 3;
    }

    .settings-trigger {
      margin-left: auto;
    }

    .source-column {
      grid-template-rows: repeat(2, minmax(16rem, auto));
    }
  }

  @container tunnel (max-width: 460px) {
    .tunnel-workspace {
      --tunnel-gap: var(--settings-spacing-sm, 8px);
      padding: var(--settings-spacing-sm, 8px);
    }

    .workspace-header {
      padding: 7px 8px;
    }

    .title-block p,
    .settings-trigger :global(.panel-btn span),
    .settings-trigger :global(.panel-btn .fa-chevron-right) {
      display: none;
    }

    .editing-poster {
      width: 32px;
      height: 32px;
    }

    .settings-trigger :global(.panel-btn) {
      width: var(--min-touch-target, 48px);
      min-width: var(--min-touch-target, 48px);
      padding: 0;
    }

    .stage-controls {
      align-items: stretch;
      flex-direction: column;
    }

    .result-actions,
    .result-actions :global(.panel-btn) {
      width: 100%;
    }

    .result-actions :global(.panel-btn) {
      flex: 1;
    }
  }

  /* On a large workspace the active inspector becomes a third track, matching
     Fuse: notation and animation concede space together instead of settings
     covering the result they change. The track always exists at zero width so
     opening and closing can interpolate without a grid pop. */
  @container tunnel (min-width: 1000px) and (min-height: 700px) {
    .tunnel-workspace {
      --inspector-open-width: clamp(24rem, 26cqw, 36rem);
      --inspector-seam: 0px;
      --inspector-width: 0px;
      grid-template-columns:
        minmax(17rem, 0.95fr) var(--tunnel-gap) minmax(18rem, 1.1fr)
        var(--inspector-seam) var(--inspector-width);
      grid-template-rows: max-content minmax(0, 1fr);
      grid-template-areas:
        "header header header header header"
        "sources . preview . inspector";
      column-gap: 0;
      row-gap: var(--tunnel-gap);
      transition: grid-template-columns var(--duration-emphasis, 280ms)
        var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
    }

    .tunnel-workspace.inline-inspector {
      --inspector-seam: var(--tunnel-gap);
      --inspector-width: var(--inspector-open-width);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tunnel-workspace,
    .inspector-column,
    .inspector-layer {
      transition: none;
    }
  }

  @container tunnel (min-width: 720px) and (max-height: 500px) {
    .tunnel-workspace {
      --tunnel-gap: var(--settings-spacing-sm, 8px);
      padding: var(--settings-spacing-sm, 8px);
    }

    .workspace-header {
      padding-block: 6px;
    }

    .title-block p,
    .source-column :global(.workbench-stage) {
      display: none;
    }

    .editing-poster {
      width: 32px;
      height: 32px;
    }

    .source-column :global(.source-empty) {
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      justify-items: start;
      min-height: 0;
      padding: var(--settings-spacing-sm, 8px);
      text-align: left;
    }

    .source-column :global(.source-empty > i) {
      font-size: var(--font-size-min, 14px);
    }

    .source-column :global(.source-empty span) {
      display: none;
    }
  }

  @container tunnel (min-width: 1680px) and (min-height: 900px) {
    .tunnel-workspace {
      --font-size-min: 16px;
      --font-size-compact: 14px;
      --font-size-sm: 17px;
      --min-touch-target: 48px;
      --tunnel-gap: var(--settings-spacing-lg, 18px);
      padding: 24px;
    }

    .workspace-header {
      min-height: 5.25rem;
      padding-inline: 18px;
    }
  }

  @container tunnel (min-width: 2600px) and (min-height: 1400px) {
    .tunnel-workspace {
      --font-size-min: 18px;
      --font-size-compact: 16px;
      --font-size-sm: 19px;
      --min-touch-target: 64px;
      --tunnel-gap: 24px;
      padding: 32px;
    }

    .workspace-header {
      min-height: 6.5rem;
      padding-inline: 24px;
    }

    h2 {
      font-size: 1.65rem;
    }

    .preview-heading,
    .stage-controls {
      min-height: 5.5rem;
      padding-inline: 1.25rem;
    }
  }
</style>
