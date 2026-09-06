<script lang="ts">
  import { tick } from "svelte";
  import AnimationPanel from "$lib/shared/animation-panel/components/AnimationPanel.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
  import { getShapeMatrixAnimationContext } from "../context/shape-matrix-animation-context";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import { CANVAS2D_HOSTED_EFFECTS } from "$lib/shared/effects/services/canvas2d-effect-host";
  import { flyFade } from "$lib/shared/transitions/motion";
  import { getEscapeLayerManager } from "$lib/shared/keyboard/get-escape-layer-manager";

  interface Props {
    surface: "matrix" | "theory";
  }

  let { surface }: Props = $props();
  const appState = getShapeMatrixAppContext();
  const animationState = getShapeMatrixAnimationContext();
  const open = $derived(
    !appState.compact &&
      !appState.propPickerOpen &&
      appState.surface === surface &&
      animationState.activeSection !== null
  );

  const labels = {
    effects: "Effects",
    effort: "Effort",
    playback: "Playback",
    display: "Display",
  } as const;
  const title = $derived(
    animationState.activeSection
      ? (labels[animationState.activeSection as keyof typeof labels] ??
          "Settings")
      : "Settings"
  );
  const theoryEffects = ["trails", ...CANVAS2D_HOSTED_EFFECTS] as const;
  let overlayElement = $state<HTMLElement | null>(null);

  function close(): void {
    animationState.showRelationships();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }

  $effect(() => {
    if (!open) return;
    const restoreTo = document.activeElement;
    const unregister = getEscapeLayerManager().register({
      id: `shape-matrix:${surface}-settings`,
      canDismiss: () => true,
      dismiss: close,
    });
    void tick().then(() =>
      overlayElement
        ?.querySelector<HTMLButtonElement>("header button")
        ?.focus({ preventScroll: true })
    );

    return () => {
      unregister();
      if (restoreTo instanceof HTMLElement && restoreTo.isConnected) {
        restoreTo.focus({ preventScroll: true });
      }
    };
  });
</script>

{#if open}
  <div
    class="settings-overlay"
    role="dialog"
    aria-label={`${title} settings`}
    tabindex="-1"
    bind:this={overlayElement}
    onkeydown={onKeydown}
    transition:flyFade={{ y: 8 }}
  >
    <DrawerHeader
      {title}
      subtitle="Adjust the live animation while keeping its relationships in view."
      closeLabel="Close settings"
      onClose={close}
    />
    <div class="settings-body">
      <AnimationPanel
        isExporting={false}
        layout="bottom"
        presentation="content"
        controlledSection={animationState.activeSection}
        isPlaying={animationState.playing}
        bpm={animationState.bpm}
        playbackMode={animationState.playbackMode}
        onPlaybackToggle={animationState.togglePlaying}
        onPlaybackModeChange={animationState.setPlaybackMode}
        onBpmChange={animationState.setBpm}
        showEffectsPlayback={false}
        selectedPropType={appState.propType}
        onPropChange={(propType) => void appState.setPropType(propType)}
        showPathShape={false}
        showMotionVisibility={true}
        showSequenceMarks={surface !== "theory"}
        availableEffects={surface === "theory" ? theoryEffects : undefined}
        regionLabel={`${title} settings`}
      />
    </div>
  </div>
{/if}

<style>
  .settings-overlay {
    position: absolute;
    inset: 0;
    z-index: 19;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background:
      linear-gradient(
        var(--theme-panel-bg, rgb(16 23 33 / 0.96)),
        var(--theme-panel-bg, rgb(16 23 33 / 0.96))
      ),
      var(--theme-bg-deep, #0a0f14);
    color: var(--theme-text, #fff);
  }

  .settings-body {
    min-width: 0;
    min-height: 0;
    padding: 0.75rem;
    overflow: hidden;
  }
</style>
