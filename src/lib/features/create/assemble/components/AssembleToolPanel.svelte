<!--
  AssembleToolPanel - Tool panel content for the Assemble tab.

  Idle: side-by-side guidance panel + grid, centered together.
  Building: panel disappears, grid recenters via flex layout.
-->
<script lang="ts">
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import type { AssembleTabState } from "../../shared/state/assemble-tab-state.svelte";
  import BuilderInstructionHeader from "$lib/features/assemble-lab/components/BuilderInstructionHeader.svelte";
  import BuilderControls from "$lib/features/assemble-lab/components/BuilderControls.svelte";
  import InteractiveGrid from "$lib/features/assemble-lab/components/InteractiveGrid.svelte";
  import BuilderTurnBar from "$lib/features/assemble-lab/components/BuilderTurnBar.svelte";
  import AssembleIdlePanel from "$lib/features/assemble-lab/components/AssembleIdlePanel.svelte";
  import KeyboardHintStrip from "$lib/features/assemble-lab/components/KeyboardHintStrip.svelte";
  import { attachAssembleKeyboard } from "$lib/features/assemble-lab/services/assemble-keyboard-dispatcher";
  import type { SettingsState } from "$lib/shared/settings/state/settings-state.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
  import { resolveAccessTier, getMaxBeats } from "$lib/shared/auth/domain/access-tier";
  import { isPremiumOrAbove } from "$lib/shared/auth/domain/models/user-role";
  import AuthNudge from "$lib/shared/auth/components/AuthNudge.svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import type { AuthNudgeTrigger } from "$lib/shared/auth/domain/auth-nudge-trigger";

  const props: { tabState: AssembleTabState } = $props();

  const builderState = $derived(props.tabState.assembleBuilderState);

  // Auth/tier state for beat cap enforcement
  const accessTier = $derived(
    resolveAccessTier(authState.isAuthenticated, authState.isAnonymous, isPremiumOrAbove(authState.role))
  );
  let showBeatCapNudge = $state(false);
  const beatCapNudgeTrigger: AuthNudgeTrigger = "beat-cap-guest";
  // Only guests get a beat-cap nudge now — a free-account pitch for the full
  // 64-beat cap. Logged-in users are hard-capped at 64 with no upsell, so the
  // cap applies silently. (The paid Scribe tier is shelved until there's a plan.)
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
      showBeatCapNudge = true;
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

  let isIdle = $state(true);
  let prevPhaseIdle = true;

  // Track idle→building transitions.
  $effect.pre(() => {
    const currentlyIdle = builderState.phase === "idle" && builderState.stepCount === 0;

    if (prevPhaseIdle && !currentlyIdle) {
      isIdle = false;
    } else if (!prevPhaseIdle && currentlyIdle) {
      isIdle = true;
    }

    prevPhaseIdle = currentlyIdle;
  });

  // Load last-used grid preferences from settings.
  // Wrapped in $effect.pre so tabState is read reactively (avoids state_referenced_locally).
  let settingsState: SettingsState | null = null;
  $effect.pre(() => {
    try {
      settingsState = settingsService as SettingsState;
      const saved = settingsState.currentSettings;
      if (saved.preferredGridMode) {
        props.tabState.assembleBuilderState.setGridMode(saved.preferredGridMode);
      }
      if (saved.preferredShowCenter) {
        props.tabState.assembleBuilderState.setShowCenter(saved.preferredShowCenter);
      }
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
  <div class="header-section" class:hidden={isIdle}>
    <BuilderInstructionHeader {builderState} />
  </div>

  <div class="main-area">
    {#if isIdle}
      <div class="panel-slot">
        <AssembleIdlePanel {builderState} />
      </div>
    {/if}

    <div class="grid-slot">
      <InteractiveGrid {builderState} onStepCapExceeded={checkBeatCap} />
      <BuilderControls {builderState} />
    </div>
  </div>

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
    onclose={() => { showBeatCapNudge = false; }}
  >
    <AuthNudge
      trigger={beatCapNudgeTrigger}
      onCreateAccount={() => { showBeatCapNudge = false; authDrawerState.show("signup"); }}
      onLogin={() => { showBeatCapNudge = false; authDrawerState.show("signin"); }}
      onDismiss={() => { showBeatCapNudge = false; }}
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
    padding: 0 12px 12px;
    gap: 8px;
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
    gap: 32px;
  }

  .panel-slot {
    flex: 0 0 auto;
  }

  .grid-slot {
    flex: 0 0 auto;
    width: 65vh;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    view-transition-name: assemble-grid;
  }

  /* ── Mobile ── */
  @media (max-width: 768px) {
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
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      z-index: 5;
      pointer-events: none;
    }

    .turn-bar-section {
      display: none;
    }
  }

  /* View transition timing (used by tab-switching view transitions) */
  :global(::view-transition-old(assemble-grid)),
  :global(::view-transition-new(assemble-grid)) {
    animation-duration: 0.4s;
    animation-timing-function: ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .grid-slot {
      view-transition-name: none;
    }
  }
</style>
