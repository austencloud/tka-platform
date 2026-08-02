<!--
  AssembleToolPanel - Tool panel content for the Assemble tab.

  The grid stays anchored while phase-specific controls update in reserved slots.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import type { AssembleTabState } from "../../shared/state/assemble-tab-state.svelte";
  import BuilderInstructionHeader from "$lib/features/assemble-lab/components/BuilderInstructionHeader.svelte";
  import BuilderControls from "$lib/features/assemble-lab/components/BuilderControls.svelte";
  import GridModePicker from "$lib/features/assemble-lab/components/GridModePicker.svelte";
  import InteractiveGrid from "$lib/features/assemble-lab/components/InteractiveGrid.svelte";
  import BuildStartPosition from "../../construct/start-position-picker/components/BuildStartPosition.svelte";
  import { attachAssembleKeyboard } from "$lib/features/assemble-lab/services/assemble-keyboard-dispatcher";
  import type { StartPositionPlacement } from "$lib/shared/create/services/start-position-manager";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    MotionColor,
    Orientation,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { SettingsState } from "$lib/shared/settings/state/settings-state.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
  import {
    resolveAccessTier,
    getMaxSteps,
  } from "$lib/shared/auth/domain/access-tier";
  import { isPremiumOrAbove } from "$lib/shared/auth/domain/models/user-role";
  import AuthNudge from "$lib/shared/auth/components/AuthNudge.svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import type { AuthNudgeTrigger } from "$lib/shared/auth/domain/auth-nudge-trigger";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  const props: { tabState: AssembleTabState } = $props();

  const builderState = $derived(props.tabState.assembleBuilderState);
  const isStartPositionSetup = $derived(
    builderState.blueSteps.length === 0 &&
      builderState.redSteps.length === 0 &&
      (!builderState.startPoses[MotionColor.BLUE] ||
        !builderState.startPoses[MotionColor.RED])
  );
  const initialBlueLocation = $derived(
    builderState.startPoses[MotionColor.BLUE]?.location ?? null
  );
  const initialRedLocation = $derived(
    builderState.startPoses[MotionColor.RED]?.location ?? null
  );
  const setupKey = $derived(
    `${builderState.gridMode}:${builderState.showCenter}:${initialBlueLocation ?? ""}:${initialRedLocation ?? ""}`
  );
  const bluePropType = $derived(
    settingsService.settings.bluePropType ?? PropType.STAFF
  );
  const redPropType = $derived(
    settingsService.settings.redPropType ?? PropType.STAFF
  );
  let setupBlueOrientation = $state<Orientation>(Orientation.IN);
  let setupRedOrientation = $state<Orientation>(Orientation.IN);

  // A partially restored start pose seeds the shared builder. Orientation
  // changes made inside the builder stay local until both props are applied.
  $effect(() => {
    if (!isStartPositionSetup) return;
    const bluePose = builderState.startPoses[MotionColor.BLUE];
    const redPose = builderState.startPoses[MotionColor.RED];
    untrack(() => {
      setupBlueOrientation = bluePose?.orientation ?? Orientation.IN;
      setupRedOrientation = redPose?.orientation ?? Orientation.IN;
    });
  });

  function handleStartPositionApply(placement: StartPositionPlacement): void {
    builderState.setStartPoses({
      [MotionColor.BLUE]: {
        location: placement.blueLocation,
        orientation: placement.blueOrientation ?? setupBlueOrientation,
      },
      [MotionColor.RED]: {
        location: placement.redLocation,
        orientation: placement.redOrientation ?? setupRedOrientation,
      },
    });
  }

  // Auth/tier state for step cap enforcement
  const accessTier = $derived(
    resolveAccessTier(
      authState.isAuthenticated,
      authState.isAnonymous,
      isPremiumOrAbove(authState.role)
    )
  );
  let showStepCapNudge = $state(false);
  const stepCapNudgeTrigger: AuthNudgeTrigger = "step-cap-guest";
  // Guests get the account nudge. Signed-in users get direct feedback instead
  // of a modal that advertises an unavailable upgrade.
  const stepCapNudgeAllowed = $derived(accessTier === "guest");

  /**
   * Called by InteractiveGrid before adding a motion.
   * Returns true to block the action and show the nudge.
   *
   * A completed step = one paired step (one on each hand).
   * We cap when the current paired step count would reach the tier limit.
   */
  function checkStepCap(): boolean {
    const maxSteps = getMaxSteps(accessTier);
    // Completed steps = min of both hands' step counts (each pair = one step)
    const pairedSteps = Math.min(
      builderState.blueSteps.length,
      builderState.redSteps.length
    );
    if (pairedSteps >= maxSteps) {
      if (stepCapNudgeAllowed) {
        showStepCapNudge = true;
      } else {
        toast.info(`Assemble supports up to ${maxSteps} steps.`, 4000);
      }
      return true;
    }
    return false;
  }

  // Numpad building: while keyboard mode is on, route numpad input through the
  // shared dispatcher. Mounting is scoped to the active Assemble tab (the
  // {#key activeToolPanel} in CreationToolPanelSlot unmounts this on tab switch),
  // so the window listener never leaks into other Create tabs. Position adds go
  // through checkStepCap so the numpad respects the tier cap like mouse clicks.
  $effect(() => {
    if (!builderState.keyboardMode) return;
    return attachAssembleKeyboard(builderState, {
      onStepCapExceeded: checkStepCap,
      isModalOpen: () => showStepCapNudge && stepCapNudgeAllowed,
    });
  });

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
          props.tabState.assembleBuilderState.setShowCenter(
            preferredShowCenter
          );
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

  <div class="header-section">
    <BuilderInstructionHeader
      {builderState}
      startPositionSetup={isStartPositionSetup}
    />
  </div>

  <div class="main-area">
    <div class="grid-slot" class:start-position-setup={isStartPositionSetup}>
      {#if isStartPositionSetup}
        <div class="mobile-start-settings">
          <GridModePicker
            gridMode={builderState.gridMode}
            showCenter={builderState.showCenter}
            onGridModeChange={(mode) => builderState.setGridMode(mode)}
            onCenterChange={(show) => builderState.setShowCenter(show)}
          />
        </div>
      {/if}
      <div class="stage-slot">
        {#if isStartPositionSetup}
          {#key setupKey}
            <BuildStartPosition
              gridMode={builderState.gridMode}
              showCenter={builderState.showCenter}
              {bluePropType}
              {redPropType}
              blueOrientation={setupBlueOrientation}
              redOrientation={setupRedOrientation}
              {initialBlueLocation}
              {initialRedLocation}
              onBlueOrientationChange={(orientation) => {
                setupBlueOrientation = orientation;
              }}
              onRedOrientationChange={(orientation) => {
                setupRedOrientation = orientation;
              }}
              onApplyPlacement={handleStartPositionApply}
            />
          {/key}
        {:else}
          <InteractiveGrid {builderState} onStepCapExceeded={checkStepCap} />
        {/if}
      </div>
      {#if !isStartPositionSetup}
        <BuilderControls {builderState} />
      {/if}
    </div>
  </div>

  <!-- Step cap nudge - shown when user tries to exceed their tier's step limit.
       Backdrop click / Escape dismiss via BaseModal. -->
  <BaseModal
    open={showStepCapNudge && stepCapNudgeAllowed}
    size="fit"
    class="chromeless"
    onclose={() => {
      showStepCapNudge = false;
    }}
  >
    <AuthNudge
      trigger={stepCapNudgeTrigger}
      onCreateAccount={() => {
        showStepCapNudge = false;
        authDrawerState.show("signup", stepCapNudgeTrigger);
      }}
      onLogin={() => {
        showStepCapNudge = false;
        authDrawerState.show("signin", stepCapNudgeTrigger);
      }}
      onDismiss={() => {
        showStepCapNudge = false;
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

  .header-section {
    width: min(100%, 1040px);
    margin-inline: auto;
    flex-shrink: 0;
  }

  .main-area {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: stretch;
    justify-content: center;
    gap: 0;
    min-width: 0;
  }

  .grid-slot {
    position: relative;
    flex: 0 1 1040px;
    min-width: 0;
    width: 100%;
    max-width: 1040px;
    height: 100%;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    justify-items: center;
  }

  .stage-slot {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    display: grid;
    place-items: start center;
    container-type: size;
    container-name: assemble-stage;
  }

  .mobile-start-settings {
    display: none;
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

    .grid-slot.start-position-setup {
      grid-template-rows: auto minmax(0, 1fr);
    }

    .mobile-start-settings {
      display: block;
      width: 100%;
      padding: 6px 8px;
    }

    .stage-slot {
      place-items: center;
    }

    .header-section {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .main-area {
      transition: none;
    }
  }
</style>
