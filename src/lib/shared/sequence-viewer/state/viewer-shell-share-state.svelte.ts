import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { OrchestratorContext } from "../domain/viewer-orchestrator-context";
import { buildViewerShareActions } from "../services/viewer-shell-model";

type ViewerShareActionId = "share-sequence" | "send-sequence" | "copy-link";

interface ViewerShellShareInputs {
  getContext: () => OrchestratorContext;
  getSequence: () => SequenceData;
  getDefaultBluePropType: () => unknown;
}

interface ViewerShellShareDependencies {
  copyForClaude: (sequence: SequenceData) => Promise<{ success: boolean }>;
  openSendSequenceSheet: typeof import("$lib/shared/inbox/state/send-sequence-state.svelte").openSendSequenceSheet;
  buildSequenceSharePayload: typeof import("$lib/shared/inbox/state/send-sequence-state.svelte").buildSequenceSharePayload;
  buildThumbnailUrl: typeof import("$lib/shared/inbox/state/send-sequence-state.svelte").buildThumbnailUrl;
  sendToStickerLab: typeof import("../services/send-to-sticker-lab").sendToStickerLab;
  captureScanAction: typeof import("$lib/shared/analytics/scan-analytics").captureScanAction;
}

export function createViewerShellShareState(
  inputs: ViewerShellShareInputs,
  dependencies: ViewerShellShareDependencies
) {
  let copyClaudeFeedback = $state(false);
  let shareLinkCopied = $state(false);
  let copyClaudeFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  let shareLinkFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  const actions = $derived(buildViewerShareActions(shareLinkCopied));
  const statusMessage = $derived(shareLinkCopied ? "Link copied." : "");

  function destroy(): void {
    if (copyClaudeFeedbackTimer) clearTimeout(copyClaudeFeedbackTimer);
    if (shareLinkFeedbackTimer) clearTimeout(shareLinkFeedbackTimer);
  }

  async function copyForClaude(): Promise<void> {
    const sequence = inputs.getSequence();
    try {
      const result = await dependencies.copyForClaude(sequence);
      if (!result.success) {
        dependencies.captureScanAction("copy_for_claude", {
          outcome: "failed",
        });
        return;
      }
      dependencies.captureScanAction("copy_for_claude", {
        outcome: "completed",
      });
      copyClaudeFeedback = true;
      if (copyClaudeFeedbackTimer) clearTimeout(copyClaudeFeedbackTimer);
      copyClaudeFeedbackTimer = setTimeout(() => {
        copyClaudeFeedback = false;
        copyClaudeFeedbackTimer = null;
      }, 1500);
    } catch (error) {
      dependencies.captureScanAction("copy_for_claude", {
        outcome: "failed",
      });
      console.error("[SequenceViewerShell] Copy for Claude failed:", error);
    }
  }

  function sendToInbox(): void {
    const sequence = inputs.getSequence();
    dependencies.captureScanAction("send");
    const propType =
      sequence.intendedProp?.bluePropType ??
      inputs.getDefaultBluePropType() ??
      "staff";
    const thumbnailUrl = dependencies.buildThumbnailUrl(
      sequence.word || sequence.name,
      String(propType),
      false
    );
    dependencies.openSendSequenceSheet(
      dependencies.buildSequenceSharePayload({ ...sequence, thumbnailUrl })
    );
  }

  function shareSequence(): void {
    dependencies.captureScanAction("share");
    inputs.getContext().handleShare();
  }

  async function copyShareLink(): Promise<void> {
    dependencies.captureScanAction("copy_link");
    const copied = await inputs.getContext().handleCopyLink();
    if (!copied) return;

    shareLinkCopied = true;
    if (shareLinkFeedbackTimer) clearTimeout(shareLinkFeedbackTimer);
    shareLinkFeedbackTimer = setTimeout(() => {
      shareLinkCopied = false;
      shareLinkFeedbackTimer = null;
    }, 1800);
  }

  function selectAction(actionId: string): void {
    switch (actionId as ViewerShareActionId) {
      case "share-sequence":
        shareSequence();
        break;
      case "send-sequence":
        sendToInbox();
        break;
      case "copy-link":
        void copyShareLink();
        break;
    }
  }

  function sendToStickerLab(): void {
    dependencies.captureScanAction("send_to_sticker_lab");
    dependencies.sendToStickerLab(inputs.getSequence());
  }

  return {
    get actions() {
      return actions;
    },
    get statusMessage() {
      return statusMessage;
    },
    get copyClaudeFeedback() {
      return copyClaudeFeedback;
    },
    copyForClaude,
    sendToInbox,
    selectAction,
    sendToStickerLab,
    destroy,
  };
}
