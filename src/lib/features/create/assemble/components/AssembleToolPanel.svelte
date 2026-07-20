<!--
  AssembleToolPanel - Tool panel content for the Assemble tab.

  Idle: side-by-side guidance panel + grid, centered together.
  Building: panel disappears, grid recenters via flex layout.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import type { AssembleTabState } from "../../shared/state/assemble-tab-state.svelte";
  import BuilderInstructionHeader from "$lib/features/assemble-lab/components/BuilderInstructionHeader.svelte";
  import BuilderControls from "$lib/features/assemble-lab/components/BuilderControls.svelte";
  import InteractiveGrid from "$lib/features/assemble-lab/components/InteractiveGrid.svelte";
  import BuilderTurnBar from "$lib/features/assemble-lab/components/BuilderTurnBar.svelte";
  import AssembleIdlePanel from "$lib/features/assemble-lab/components/AssembleIdlePanel.svelte";
  import StepStrip from "$lib/features/assemble-lab/components/StepStrip.svelte";
  import KeyboardHintStrip from "$lib/features/assemble-lab/components/KeyboardHintStrip.svelte";
  import { attachAssembleKeyboard } from "$lib/features/assemble-lab/services/assemble-keyboard-dispatcher";
  import type { SettingsState } from "$lib/shared/settings/state/settings-state.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
  import {
    resolveAccessTier,
    getMaxBeats,
  } from "$lib/shared/auth/domain/access-tier";
  import { isPremiumOrAbove } from "$lib/shared/auth/domain/models/user-role";
  import AuthNudge from "$lib/shared/auth/components/AuthNudge.svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import type { AuthNudgeTrigger } from "$lib/shared/auth/domain/auth-nudge-trigger";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  const props: { tabState: AssembleTabState } = $props();

  const builderState = $derived(props.tabState.assembleBuilderState);

  // Auth/tier state for beat cap enforcement
  const accessTier = $derived(
    resolveAccessTier(
      authState.isAuthenticated,
      authState.isAnonymous,
      isPremiumOrAbove(authState.role)
    )
  );
  let showBeatCapNudge = $state(false);
  const beatCapNudgeTrigger: AuthNudgeTrigger = "beat-cap-guest";
  // Guests get the account nudge. Signed-in users get direct feedback instead
  // of a modal that advertises an unavailable upgrade.
  const beatCapNudgeAllowed = $derived(accessTier === "guest");

  /**
   * Called by InteractiveGrid before adding a motion.
   * Returns true to block the action and show the nudge.
   *
   * A completed beat = one paired step (one on each hand).
   * We cap when the current paired step count would reach the tier limit.
   */
  function checkBeatCap(): boolean {
    const maxSteps = getMaxBeats(accessTier);
    // Completed beats = min of both hands' step counts (each pair = one beat)
    const pairedBeats = Math.min(
      builderState.blueSteps.length,
      builderState.redSteps.length
    );
    if (pairedBeats >= maxSteps) {
      if (beatCapNudgeAllowed) {
        showBeatCapNudge = true;
      } else {
        toast.info(`Assemble supports up to ${maxSteps} beats.`, 4000);
      }
      return true;
    }
    return false;
  }

  // Numpad building: while keyboard mode is on, route numpad input through the
  // shared dispatcher. Mounting is scoped to the active Assemble tab (the
  // {#key activeToolPanel} in CreationToolPanelSlot unmounts this on tab switch),
  // so the window listener never leaks into other Create tabs. Position adds go
  // through checkBeatCap so the numpad respects the tier cap like mouse clicks.
  $effect(() => {
    if (!builderState.keyboardMode) return;
    return attachAssembleKeyboard(builderState, {
      onStepCapExceeded: checkBeatCap,
      isModalOpen: () => showBeatCapNudge && beatCapNudgeAllowed,
    });
  });

  const isIdle = $derived(
    builderState.phase === "idle" && builderState.stepCount === 0
  );

  // Load last-used grid preferences from settings.
  // Wrapped in $effect.pre so tabState is read reactively (avoids state_referenced_locally).
  //
  // The setGridMode/setShowCenter calls MUST be untracked. They read builder state
  // (steps, currentPosition, showCenter) and end in notifyDocumentChange(), which
  // reads AND writes sequenceState.currentSequence with a fresh object every call.
  // Left tracked, this effect invalidates itself the moment a start position exists,
  // which is exactly what the first grid click creates -> effect_update_depth_exceeded.
  let settingsState: SettingsState | null = null;
  $effect.pre(() => {
    try {
      settingsState = settingsService as SettingsState;
      const saved = settingsState.currentSettings;
      const preferredGridMode = saved.preferredGridMode;
      const preferredShowCenter = saved.preferredShowCenter;
      untrack(() => {
        if (preferredGridMode) {
          props.tabState.assembleBuilderState.setGridMode(preferredGridMode);
        }
        if (preferredShowCenter) {
          props.tabState.assembleBuilderState.setShowCenter(preferredShowCenter);
        }
      });
    } catch {
      // Settings unavailable - use defaults
    }
  });

  // Persist grid mode changes for next session
  $effect(() => {
    const mode = builderState.gridMode;
    const center = builderState.showCenter;
    if (settingsState) {
      void settingsState.updateSetting("preferredGridMode", mode);
      void settingsState.updateSetting("preferredShowCenter", center);
    }
  });
</script>

<div class="assemble-tool-panel">
  {#if props.tabState.hasError}
    <div class="restore-error" role="alert">
      Couldn't restore your saved Assemble work. You can keep building, but this
      session may not save.
    </div>
  {/if}

  <div class="header-section" class:hidden={isIdle}>
    <BuilderInstructionHeader {builderState} />
  </div>

  <div class="main-area" class:idle-layout={isIdle}>
    <div
      class="panel-slot"
      class:collapsed={!isIdle}
      aria-hidden={!isIdle}
      inert={!isIdle}
    >
      <AssembleIdlePanel {builderState} />
    </div>

    <div class="grid-slot">
      <InteractiveGrid {builderState} onStepCapExceeded={checkBeatCap} />
      <BuilderControls {builderState} />
    </div>
  </div>

  <StepStrip {builderState} />

  <div class="turn-bar-section" class:hidden={isIdle}>
    {#if builderState.keyboardMode}
      <KeyboardHintStrip {builderState} />
    {/if}
    <BuilderTurnBar {builderState} />
  </div>

  <!-- Beat cap nudge - shown when user tries to exceed their tier's beat limit.
       Backdrop click / Escape dismiss via BaseModal. -->
  <BaseModal
    open={showBeatCapNudge && beatCapNudgeAllowed}
    size="fit"
    class="chromeless"
    onclose={() => {
      showBeatCapNudge = false;
    }}
  >
    <AuthNudge
      trigger={beatCapNudgeTrigger}
      onCreateAccount={() => {
        showBeatCapNudge = false;
        authDrawerState.show("signup");
      }}
      onLogin={() => {
        showBeatCapNudge = false;
        authDrawerState.show("signin");
      }}
      onDismiss={() => {
        showBeatCapNudge = false;
      }}
    />
  </BaseModal>
</div>

<style>
  .assemble-tool-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    position: relative;
    padding: 0 var(--settings-spacing-md, 12px) var(--settings-spacing-md, 12px);
    gap: var(--settings-spacing-sm, 8px);
  }

  .header-section,
  .turn-bar-section {
    flex-shrink: 0;
  }

  .header-section.hidden,
  .turn-bar-section.hidden {
    display: none;
  }

  .main-area {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    min-width: 0;
    transition: gap var(--duration-normal, 200ms) ease;
  }

  .main-area.idle-layout {
    gap: var(--settings-spacing-xl, 32px);
  }

  .panel-slot {
    flex: 0 1 320px;
    min-width: 260px;
    max-width: 340px;
    opacity: 1;
    overflow: hidden;
    transition:
      flex-basis var(--duration-normal, 200ms) ease,
      min-width var(--duration-normal, 200ms) ease,
      max-width var(--duration-normal, 200ms) ease,
      opacity var(--duration-fast, 150ms) ease;
  }

  .panel-slot.collapsed {
    flex-basis: 0;
    min-width: 0;
    max-width: 0;
    opacity: 0;
    pointer-events: none;
  }

  .grid-slot {
    position: relative;
    flex: 1 1 640px;
    min-width: 0;
    width: 100%;
    max-width: 760px;
    height: 100%;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto auto;
    justify-items: center;
  }

  .restore-error {
    flex: 0 0 auto;
    margin: 0 auto;
    width: min(100%, 720px);
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 12px);
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-error, var(--prop-red)) 45%,
        transparent
      );
    border-radius: var(--settings-radius-md, 12px);
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--prop-red)) 10%,
      transparent
    );
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
    text-align: center;
  }

  /* A portrait desktop has enough height for the full builder, but not enough
     width for the setup card and square grid side by side. Stack and scroll the
     idle composition inside the tool panel instead of clipping it. */
  @container tool-panel (max-width: 950px) {
    .main-area.idle-layout {
      flex-direction: column;
      justify-content: flex-start;
      overflow-y: auto;
      overflow-x: hidden;
      gap: var(--settings-spacing-md, 12px);
    }

    .panel-slot:not(.collapsed) {
      flex: 0 0 auto;
      min-width: 0;
      max-width: 100%;
      width: 100%;
    }

    .main-area.idle-layout .grid-slot {
      flex: 0 0 min(620px, calc(100cqw - 24px));
      width: min(100%, 620px);
      height: auto;
      aspect-ratio: 1;
    }
  }

  /* ── Mobile ── */
  @container tool-panel (max-width: 768px) {
    .assemble-tool-panel {
      padding: 0;
      gap: 0;
    }

    .main-area {
      flex-direction: column;
      gap: 0;
    }

    .grid-slot {
      width: 100%;
    }

    .header-section:not(.hidden) {
      display: none;
    }

    .turn-bar-section {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .main-area,
    .panel-slot {
      transition: none;
    }
  }
</style>
