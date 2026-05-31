import type { SubDrawerType } from "../services/sub-drawer-state-persister";
import type { ExtensionAnalysis, CircularizationOption } from "../services/sequence-extender";
import type { ActionHelpId } from "../domain/transforms/transform-help-content";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

type HelpMode = "inactive" | "selecting" | "viewing";

export function createSequenceActionsSubdrawerState() {
  let showTurnPatternDrawer = $state(false);
  let showRotationDirectionDrawer = $state(false);
  let showDurationDrawer = $state(false);
  let showExtendDrawer = $state(false);

  let helpMode = $state<HelpMode>("inactive");
  let selectedTransform = $state<ActionHelpId | null>(null);

  let extensionAnalysis = $state<ExtensionAnalysis | null>(null);
  let circularizationOptions = $state<CircularizationOption[]>([]);
  let directUnavailableReason = $state<string | null>(null);
  let isExtending = $state(false);

  let spotlightOpen = $state(false);
  let spotlightSequence = $state<SequenceData | null>(null);

  let showConfirmDialog = $state(false);
  let pendingSequenceTransfer = $state<unknown>(null);
  let showShiftConfirmDialog = $state(false);
  let pendingShiftStepNumber = $state<number | null>(null);

  let restorationComplete = $state(false);
  let hasRestoredSubDrawer = false;

  function getActiveSubDrawerType(): SubDrawerType {
    if (showTurnPatternDrawer) return "turnPattern";
    if (showRotationDirectionDrawer) return "rotationDirection";
    if (showDurationDrawer) return "duration";
    if (showExtendDrawer) return "extend";
    if (helpMode !== "inactive") return "help";
    return null;
  }

  function restoreSubDrawer(restored: SubDrawerType) {
    if (!restored) return;
    if (restored === "help") helpMode = "selecting";
    else if (restored === "turnPattern") showTurnPatternDrawer = true;
    else if (restored === "rotationDirection") showRotationDirectionDrawer = true;
    else if (restored === "duration") showDurationDrawer = true;
    else if (restored === "extend") showExtendDrawer = true;
    restorationComplete = true;
  }

  function closeExtendDrawer() {
    showExtendDrawer = false;
    extensionAnalysis = null;
    circularizationOptions = [];
    directUnavailableReason = null;
  }

  function resetOnClose() {
    hasRestoredSubDrawer = false;
  }

  return {
    get showTurnPatternDrawer() { return showTurnPatternDrawer; },
    set showTurnPatternDrawer(v: boolean) { showTurnPatternDrawer = v; },
    get showRotationDirectionDrawer() { return showRotationDirectionDrawer; },
    set showRotationDirectionDrawer(v: boolean) { showRotationDirectionDrawer = v; },
    get showDurationDrawer() { return showDurationDrawer; },
    set showDurationDrawer(v: boolean) { showDurationDrawer = v; },
    get showExtendDrawer() { return showExtendDrawer; },
    set showExtendDrawer(v: boolean) { showExtendDrawer = v; },
    get helpMode() { return helpMode; },
    set helpMode(v: HelpMode) { helpMode = v; },
    get selectedTransform() { return selectedTransform; },
    set selectedTransform(v: ActionHelpId | null) { selectedTransform = v; },
    get extensionAnalysis() { return extensionAnalysis; },
    set extensionAnalysis(v: ExtensionAnalysis | null) { extensionAnalysis = v; },
    get circularizationOptions() { return circularizationOptions; },
    set circularizationOptions(v: CircularizationOption[]) { circularizationOptions = v; },
    get directUnavailableReason() { return directUnavailableReason; },
    set directUnavailableReason(v: string | null) { directUnavailableReason = v; },
    get isExtending() { return isExtending; },
    set isExtending(v: boolean) { isExtending = v; },
    get spotlightOpen() { return spotlightOpen; },
    set spotlightOpen(v: boolean) { spotlightOpen = v; },
    get spotlightSequence() { return spotlightSequence; },
    set spotlightSequence(v: SequenceData | null) { spotlightSequence = v; },
    get showConfirmDialog() { return showConfirmDialog; },
    set showConfirmDialog(v: boolean) { showConfirmDialog = v; },
    get pendingSequenceTransfer() { return pendingSequenceTransfer; },
    set pendingSequenceTransfer(v: unknown) { pendingSequenceTransfer = v; },
    get showShiftConfirmDialog() { return showShiftConfirmDialog; },
    set showShiftConfirmDialog(v: boolean) { showShiftConfirmDialog = v; },
    get pendingShiftStepNumber() { return pendingShiftStepNumber; },
    set pendingShiftStepNumber(v: number | null) { pendingShiftStepNumber = v; },
    get restorationComplete() { return restorationComplete; },
    get hasRestoredSubDrawer() { return hasRestoredSubDrawer; },
    set hasRestoredSubDrawer(v: boolean) { hasRestoredSubDrawer = v; },
    getActiveSubDrawerType,
    restoreSubDrawer,
    closeExtendDrawer,
    resetOnClose,
  };
}

export type SequenceActionsSubdrawerState = ReturnType<typeof createSequenceActionsSubdrawerState>;
