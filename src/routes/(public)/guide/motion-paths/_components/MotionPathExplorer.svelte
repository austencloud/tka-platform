<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import InlineAnimationPlayer from "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte";
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import PathShapePanel from "$lib/shared/animation-engine/components/settings-panels/PathShapePanel.svelte";
  import { setAnimationVisibilityContext } from "$lib/shared/animation-engine/state/animation-visibility-context";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import GuideStepStrip from "../../level-1/_components/GuideStepStrip.svelte";
  import { sequenceToStrip } from "../../level-1/_data/guide-sequence-adapter";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { createMotionPathExplorerState } from "../_data/motion-path-explorer-state.svelte";
  import { DEFAULT_TRAIL_SETTINGS } from "$lib/shared/animation-engine/domain/types/trail-types";
  import { loopDetector } from "$lib/features/create/generate/circular/services/loop-detector";
  import { registerLoopDetector } from "$lib/shared/create/get-loop-detector";

  const explorer = createMotionPathExplorerState();
  setAnimationVisibilityContext(explorer.scope.visibility);
  let pickerOpen = $state(false);
  let ready = $state(false);
  let playerFailed = $state(false);
  const strip = $derived(sequenceToStrip(explorer.sequence));
  const exampleOptions = $derived([
    { value: "pro", label: "Pro" },
    { value: "anti", label: "Anti" },
    { value: "mixed", label: "Pro + anti" },
    ...(explorer.example === "custom"
      ? [{ value: "custom", label: "Your sequence" }]
      : []),
  ]);
  onMount(() => {
    // Public guide routes do not mount the app composition root. The shared
    // picker's selection and hover prefetch both hydrate through this registry.
    registerLoopDetector(loopDetector);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    explorer.playing = !preference.matches;
    const pauseForReducedMotion = () => {
      if (preference.matches) explorer.playing = false;
    };
    preference.addEventListener("change", pauseForReducedMotion);
    return () =>
      preference.removeEventListener("change", pauseForReducedMotion);
  });
</script>

<section class="explorer" aria-label="Motion path comparison">
  <div class="example-controls">
    <div class="example-choice">
      <span class="control-label">Example</span>
      <SegmentedControl
        options={exampleOptions}
        value={explorer.example}
        onchange={explorer.chooseExample}
        ariaLabel="Sequence example"
      />
    </div>
    <PanelButton onclick={() => (pickerOpen = true)}
      >Choose a sequence</PanelButton
    >
  </div>

  <div class="comparison">
    <div class="motion-column">
      <div class="word">
        <TKAWordGlyph
          word={explorer.sequence.word}
          height={28}
          darkMode
          fitToParent
        />
      </div>
      <div class="animation" aria-label="Selected path animation">
        {#if browser}
          <InlineAnimationPlayer
            sequence={explorer.sequence}
            visibilityManagerOverride={explorer.scope.visibility}
            effectsConfigState={explorer.scope.effects}
            trailSettingsOverride={DEFAULT_TRAIL_SETTINGS}
            tipEffectMap={{}}
            tipEffortMap={{}}
            leftPropType={PropType.STAFF}
            rightPropType={PropType.STAFF}
            chrome="minimal"
            fill
            autoPlay={false}
            externalPlaying={explorer.playing}
            externalBpm={48}
            onExternalPlayingChange={(value) => (explorer.playing = value)}
            onStepChange={(value) => (explorer.liveStep = value)}
            onReady={() => {
              ready = true;
              playerFailed = false;
            }}
            onLoadError={() => {
              ready = true;
              playerFailed = true;
            }}
            showControls={false}
            showPositionGlyph
            beatIndicators={false}
            disableContextMenu
          />
        {/if}
        {#if !ready}<span class="loading" role="status">Loading animation…</span
          >{/if}
      </div>
      <div class="transport">
        <PanelButton
          disabled={!ready || playerFailed}
          onclick={() => (explorer.playing = !explorer.playing)}
        >
          {explorer.playing ? "Pause" : "Play"}
        </PanelButton>
        <PanelButton
          ariaPressed={explorer.guides}
          onclick={explorer.toggleGuides}>Path lines</PanelButton
        >
      </div>
    </div>

    <div class="path-column">
      <PathShapePanel
        showHelp={false}
        onSettingChange={() => explorer.syncPolicy()}
      >
        {#snippet preview(path, size)}
          <SequenceMandala
            sequence={explorer.variants[path]}
            pathShape={path}
            {size}
            mode="gallery"
            darkMode
            leftPropType={PropType.STAFF}
            rightPropType={PropType.STAFF}
            tipDx={explorer.trace === "hands" ? 0 : undefined}
            animate={false}
          />
        {/snippet}
      </PathShapePanel>
      <div class="trace-choice">
        <span class="control-label">Trace</span>
        <SegmentedControl
          options={[
            { value: "hands", label: "Hands" },
            { value: "tips", label: "Prop tips" },
          ]}
          value={explorer.trace}
          ariaLabel="Trace point"
          onchange={(value) => (explorer.trace = value)}
        />
      </div>
      <p class="comparison-note">
        Hands traces the hand centers. Prop tips includes the staff rotation.
      </p>
    </div>
  </div>

  <p class="scope-note">
    Changes here stay in this explorer. Your saved paths and defaults stay as
    they were.
  </p>
  <div class="notation" aria-label="Sequence notation">
    <GuideStepStrip
      items={strip}
      stepLabels={strip.map((_, index) =>
        index === 0 && explorer.sequence.startPosition
          ? "Start"
          : String(index + (explorer.sequence.startPosition ? 0 : 1))
      )}
      activeBeat={explorer.liveStep < 1 ? 0 : Math.floor(explorer.liveStep)}
      render={{ propType: PropType.STAFF, showTKA: true }}
      picTheme="dark"
    />
  </div>
</section>

{#if pickerOpen}
  {#await import("$lib/shared/components/sequence-picker/SequencePickerModal.svelte")}
    <p role="status">Loading sequence picker…</p>
  {:then { default: SequencePickerModal }}
    <SequencePickerModal
      open
      onClose={() => (pickerOpen = false)}
      onSelect={(sequence) => explorer.chooseSequence(sequence)}
      title="Compare a sequence’s motion paths"
    />
  {:catch}
    <p role="alert">The sequence picker could not load.</p>
    <PanelButton onclick={() => (pickerOpen = false)}>Close</PanelButton>
  {/await}
{/if}

<style>
  .explorer {
    container-type: inline-size;
    min-width: 0;
  }
  .example-controls,
  .transport {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--spacing-sm, 8px);
  }
  .example-controls {
    justify-content: space-between;
    margin-bottom: var(--spacing-lg, 24px);
  }
  .example-choice {
    min-width: 0;
    width: 320px;
    max-width: 100%;
  }
  .control-label {
    display: block;
    margin-bottom: var(--spacing-xs, 4px);
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-muted);
  }
  .comparison {
    display: grid;
    gap: var(--spacing-lg, 24px);
    align-items: center;
  }
  .motion-column,
  .path-column {
    min-width: 0;
  }
  .word {
    display: flex;
    justify-content: center;
    height: 32px;
    margin-bottom: var(--spacing-sm, 8px);
  }
  .animation {
    position: relative;
    aspect-ratio: 1;
    max-width: 540px;
    margin-inline: auto;
  }
  .loading {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
    color: var(--theme-text-muted);
  }
  .transport {
    justify-content: center;
    margin-top: var(--spacing-sm, 8px);
    min-height: 44px;
  }
  .trace-choice {
    max-width: 320px;
    margin-top: var(--spacing-md, 16px);
  }
  .comparison-note,
  .scope-note {
    font-size: var(--font-size-sm, 14px);
    line-height: 1.6;
    color: var(--theme-text-muted);
  }
  .comparison-note {
    min-height: 3.2em;
    margin-bottom: 0;
  }
  .scope-note {
    margin-block: var(--spacing-lg, 24px);
  }
  .notation {
    min-width: 0;
  }
  @container (min-width: 680px) {
    .comparison {
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    }
  }
</style>
