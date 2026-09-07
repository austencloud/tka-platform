<script lang="ts">
  import ShareActionMenu from "$lib/shared/share/components/ShareActionMenu.svelte";
  import type { ShareActionMenuItem } from "$lib/shared/share/domain/models/share-action-menu";
  import { WORKSPACE_BUTTON_ICON } from "../../workspace-button-layout";
  import {
    getWorkspaceCardMenuAction,
    type WorkspaceSharePreparationPhase,
  } from "../../state/workspace-share-readiness.svelte";

  type ShareActionId =
    | "send-sequence"
    | "share-card"
    | "copy-link"
    | "download-card";

  interface ShareAction extends ShareActionMenuItem {
    id: ShareActionId;
    section: "share" | "save";
  }

  interface Props {
    open?: boolean;
    useMobileSheet: boolean;
    disabled: boolean;
    tooltip: string;
    cardPhase: WorkspaceSharePreparationPhase;
    linkPhase: WorkspaceSharePreparationPhase;
    isSharing: boolean;
    isCopyingLink: boolean;
    linkCopied: boolean;
    awaitingFreshGesture: boolean;
    canShareCard: boolean;
    onTriggerClick: () => void;
    /**
     * Press opens the share sheet instead of this menu. The menu's own items
     * all exist inside that sheet now, so leaving both is the second context
     * menu Austen asked to be rid of. The menu remains as the reusable fallback
     * for hosts that do not provide a direct sheet.
     */
    onDirectOpen?: (() => void) | null;
    onShareCard: () => void;
    onSendSequence: () => void;
    onCopyLink: () => void;
    onDownloadCard: () => void;
  }

  let {
    open = $bindable(false),
    useMobileSheet,
    disabled,
    tooltip,
    cardPhase,
    linkPhase,
    isSharing,
    isCopyingLink,
    linkCopied,
    awaitingFreshGesture,
    canShareCard,
    onTriggerClick,
    onDirectOpen = null,
    onShareCard,
    onSendSequence,
    onCopyLink,
    onDownloadCard,
  }: Props = $props();

  const requestedCardBusy = $derived(
    cardPhase === "preparing" && awaitingFreshGesture
  );
  const triggerBusy = $derived(requestedCardBusy || isSharing);
  const cardMenuAction = $derived(
    getWorkspaceCardMenuAction(cardPhase, canShareCard)
  );
  const linkLabel = $derived.by(() => {
    if (isCopyingLink) return "Copying Link…";
    if (linkCopied) return "Copied";
    if (linkPhase === "preparing" || linkPhase === "idle") {
      return "Preparing Link…";
    }
    if (linkPhase === "failed") return "Try Creating Link Again";
    return "Copy Link";
  });
  const cardAction = $derived.by((): ShareAction => {
    if (cardMenuAction === "share") {
      return {
        id: "share-card",
        label: "Share Card…",
        icon: "fa-share-nodes",
        section: "share",
        disabled: isSharing,
        busy: isSharing,
      };
    }
    if (cardMenuAction === "unavailable") {
      return {
        id: "share-card",
        label: "Share Card Unavailable",
        icon: "fa-circle-info",
        section: "share",
        disabled: true,
        busy: false,
      };
    }
    if (cardMenuAction === "retry") {
      return {
        id: "share-card",
        label: "Try Preparing Card Again",
        icon: "fa-rotate-right",
        section: "share",
        disabled: false,
        busy: false,
      };
    }
    return {
      id: "share-card",
      label: "Preparing Card…",
      icon: "fa-spinner fa-spin",
      section: "share",
      disabled: true,
      busy: true,
    };
  });
  const actions = $derived.by((): ShareAction[] => [
    {
      id: "send-sequence",
      label: "Send Sequence",
      icon: "fa-paper-plane",
      section: "share",
      disabled: false,
      busy: false,
    },
    cardAction,
    {
      id: "copy-link",
      label: linkLabel,
      icon:
        isCopyingLink || linkPhase === "preparing" || linkPhase === "idle"
          ? "fa-spinner fa-spin"
          : linkCopied
            ? "fa-check"
            : linkPhase === "failed"
              ? "fa-rotate-right"
              : "fa-link",
      section: "share",
      disabled:
        isCopyingLink || linkPhase === "preparing" || linkPhase === "idle",
      busy: isCopyingLink || linkPhase === "preparing" || linkPhase === "idle",
      tone: linkCopied ? "success" : "default",
      closeOnSelect: false,
    },
    {
      id: "download-card",
      label: "Download Card",
      icon: cardPhase === "preparing" ? "fa-spinner fa-spin" : "fa-download",
      section: "save",
      disabled: cardPhase === "preparing" || isSharing,
      busy: cardPhase === "preparing",
    },
  ]);
  const statusMessage = $derived.by(() => {
    if (isSharing) return "Opening device share options.";
    if (cardPhase === "preparing" && (awaitingFreshGesture || open)) {
      return "Preparing card.";
    }
    if (cardPhase === "failed" && (awaitingFreshGesture || open)) {
      return "The card could not be prepared.";
    }
    if (cardPhase === "ready" && awaitingFreshGesture) {
      return "Card ready. Choose Share Card again.";
    }
    if (open && linkPhase === "preparing") {
      return "Preparing link.";
    }
    if (open && linkPhase === "failed") {
      return "The link could not be prepared.";
    }
    return "";
  });

  function handleActionSelect(actionId: ShareActionId): void {
    switch (actionId) {
      case "send-sequence":
        onSendSequence();
        break;
      case "share-card":
        onShareCard();
        break;
      case "copy-link":
        onCopyLink();
        break;
      case "download-card":
        onDownloadCard();
        break;
    }
  }
</script>

<ShareActionMenu
  bind:open
  {actions}
  {useMobileSheet}
  {disabled}
  busy={triggerBusy}
  canOpen={true}
  ariaLabel="Share sequence"
  sheetTitle="Share sequence"
  triggerLabel={WORKSPACE_BUTTON_ICON.share.visibleLabel}
  {tooltip}
  testId="workspace-share-button"
  idBase="workspace-share"
  menuSide="top"
  {statusMessage}
  {onTriggerClick}
  {onDirectOpen}
  onActionSelect={(actionId) => handleActionSelect(actionId as ShareActionId)}
/>
