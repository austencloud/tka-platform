<script lang="ts">
  import { DropdownMenu, Portal } from "bits-ui";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import {
    getWorkspaceCardMenuAction,
    type WorkspaceSharePreparationPhase,
  } from "../../state/workspace-share-readiness.svelte";
  import { WORKSPACE_BUTTON_ICON } from "../../workspace-button-layout";

  type ShareActionId =
    | "send-sequence"
    | "share-card"
    | "copy-link"
    | "download-card";

  interface ShareAction {
    id: ShareActionId;
    label: string;
    icon: string;
    section: "share" | "save";
    disabled: boolean;
    busy: boolean;
    copied?: boolean;
  }

  interface Props {
    open?: boolean;
    useMobileSheet: boolean;
    hasFullAccount: boolean;
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
    onGuestShare: () => void;
    onShareCard: () => void;
    onSendSequence: () => void;
    onCopyLink: () => void;
    onDownloadCard: () => void;
  }

  let {
    open = $bindable(false),
    useMobileSheet,
    hasFullAccount,
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
    onGuestShare,
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
      copied: linkCopied,
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

  function asButtonAttributes(props: unknown): HTMLButtonAttributes {
    return props as HTMLButtonAttributes;
  }

  function handleTriggerClick(): void {
    onTriggerClick();
    if (!hasFullAccount) {
      onGuestShare();
      return;
    }
    open = true;
  }

  function handleMenuOpenChange(nextOpen: boolean): void {
    if (nextOpen && !hasFullAccount) {
      onGuestShare();
      open = false;
      return;
    }
    open = nextOpen;
  }

  function handleActionSelect(actionId: ShareActionId): void {
    if (actionId !== "copy-link") {
      open = false;
    }

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

<div class="workspace-share-control">
  {#if useMobileSheet || !hasFullAccount}
    <button
      type="button"
      class="workspace-share-trigger"
      title={tooltip}
      aria-label="Share sequence"
      aria-busy={triggerBusy}
      data-testid="workspace-share-button"
      disabled={disabled || isSharing || requestedCardBusy}
      onclick={handleTriggerClick}
    >
      <i
        class="fa-solid {triggerBusy
          ? 'fa-spinner fa-spin'
          : WORKSPACE_BUTTON_ICON.share.icon}"
        aria-hidden="true"
      ></i>
    </button>

    {#if useMobileSheet && hasFullAccount}
      <Portal>
        <Drawer
          bind:isOpen={open}
          placement="bottom"
          closeOnBackdrop={true}
          closeOnEscape={true}
          dismissible={true}
          showHandle={true}
          focusContainerOnOpen={true}
          labelledBy="workspace-share-sheet-title"
          class="workspace-share-sheet"
          backdropClass="workspace-share-backdrop"
        >
          <div class="workspace-share-sheet-content">
            <header class="workspace-share-sheet-header">
              <h2 id="workspace-share-sheet-title">Share sequence</h2>
              <button
                type="button"
                class="workspace-share-close"
                aria-label="Close share options"
                onclick={() => (open = false)}
              >
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </header>

            <div class="workspace-share-sheet-actions">
              {#each actions as action, index (action.id)}
                {#if index > 0 && actions[index - 1]?.section !== action.section}
                  <div class="workspace-share-separator" role="separator"></div>
                {/if}
                <button
                  type="button"
                  class:copied={action.copied}
                  class="workspace-share-sheet-action"
                  disabled={action.disabled}
                  aria-busy={action.busy}
                  onclick={() => handleActionSelect(action.id)}
                >
                  <i class="fa-solid {action.icon}" aria-hidden="true"></i>
                  <span>{action.label}</span>
                </button>
              {/each}
            </div>
          </div>
        </Drawer>
      </Portal>
    {/if}
  {:else}
    <DropdownMenu.Root {open} onOpenChange={handleMenuOpenChange}>
      <DropdownMenu.Trigger
        disabled={disabled || isSharing || requestedCardBusy}
        onclick={onTriggerClick}
      >
        {#snippet child({ props })}
          {@const triggerProps = asButtonAttributes(props)}
          <button
            {...triggerProps}
            type="button"
            class="workspace-share-trigger"
            title={tooltip}
            aria-label="Share sequence"
            aria-busy={triggerBusy}
            data-testid="workspace-share-button"
          >
            <i
              class="fa-solid {triggerBusy
                ? 'fa-spinner fa-spin'
                : WORKSPACE_BUTTON_ICON.share.icon}"
              aria-hidden="true"
            ></i>
          </button>
        {/snippet}
      </DropdownMenu.Trigger>

      {#if hasFullAccount}
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="top"
            align="end"
            sideOffset={10}
            collisionPadding={12}
            class="workspace-share-menu"
            aria-label="Share sequence"
          >
            {#each actions as action, index (action.id)}
              {#if index > 0 && actions[index - 1]?.section !== action.section}
                <DropdownMenu.Separator
                  class="workspace-share-menu-separator"
                />
              {/if}
              <DropdownMenu.Item
                class={action.copied
                  ? "workspace-share-item copied"
                  : "workspace-share-item"}
                disabled={action.disabled}
                closeOnSelect={action.id !== "copy-link"}
                textValue={action.label}
                onSelect={() => handleActionSelect(action.id)}
              >
                <i class="fa-solid {action.icon}" aria-hidden="true"></i>
                <span>{action.label}</span>
              </DropdownMenu.Item>
            {/each}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      {/if}
    </DropdownMenu.Root>
  {/if}

  <span
    class="workspace-share-status"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    {statusMessage}
  </span>
</div>

<style>
  .workspace-share-control {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  :global(.workspace-share-trigger) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 38%, transparent);
    border-radius: 50%;
    background: linear-gradient(
      135deg,
      var(--theme-accent) 0%,
      color-mix(in srgb, var(--theme-accent) 78%, var(--theme-panel-bg)) 100%
    );
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent) 35%, transparent);
    color: var(--theme-text-on-accent, white);
    cursor: pointer;
    font-size: var(--font-size-lg);
    transition:
      transform var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1),
      background var(--duration-fast) ease,
      box-shadow var(--duration-fast) ease;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) {
    :global(.workspace-share-trigger:hover:not(:disabled)) {
      transform: scale(1.05);
      background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--theme-accent) 88%, white) 0%,
        var(--theme-accent) 100%
      );
      box-shadow: 0 6px 16px
        color-mix(in srgb, var(--theme-accent) 55%, transparent);
    }
  }

  :global(.workspace-share-trigger:active:not(:disabled)) {
    transform: scale(0.95);
    transition-duration: var(--duration-instant);
  }

  :global(.workspace-share-trigger:focus-visible) {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  :global(.workspace-share-trigger:disabled) {
    cursor: not-allowed;
    opacity: 0.45;
  }

  :global(.workspace-share-trigger i) {
    width: 1em;
    font-size: var(--font-size-lg);
    text-align: center;
  }

  :global(.workspace-share-menu) {
    z-index: var(--z-dropdown);
    width: 15rem;
    max-width: calc(100vw - 24px);
    padding: 4px;
    border: 1px solid var(--theme-stroke-strong);
    border-radius: var(--radius-md, 12px);
    background: var(--theme-panel-bg);
    box-shadow:
      0 8px 24px var(--theme-shadow),
      0 2px 8px var(--theme-shadow);
    outline: none;
    transform-origin: var(--bits-dropdown-menu-content-transform-origin);
  }

  :global(.workspace-share-menu[data-state="open"]) {
    animation: workspace-share-menu-enter 150ms cubic-bezier(0.16, 1, 0.3, 1)
      both;
  }

  :global(.workspace-share-item),
  .workspace-share-sheet-action {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    gap: 10px;
    padding: 0 12px;
    border: none;
    border-radius: var(--radius-sm, 8px);
    background: transparent;
    color: var(--theme-text);
    cursor: pointer;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    outline: none;
    text-align: left;
    user-select: none;
  }

  :global(.workspace-share-item[data-highlighted]),
  .workspace-share-sheet-action:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
  }

  :global(.workspace-share-item[data-disabled]),
  .workspace-share-sheet-action:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }

  :global(.workspace-share-item.copied),
  .workspace-share-sheet-action.copied {
    color: var(--semantic-success);
  }

  :global(.workspace-share-item i),
  .workspace-share-sheet-action i {
    width: 20px;
    flex: 0 0 20px;
    color: var(--theme-accent);
    font-size: var(--font-size-sm);
    text-align: center;
  }

  :global(.workspace-share-item.copied i),
  .workspace-share-sheet-action.copied i {
    color: var(--semantic-success);
  }

  :global(.workspace-share-menu-separator),
  .workspace-share-separator {
    height: 1px;
    margin: 4px 8px;
    background: var(--theme-stroke);
  }

  :global(.workspace-share-backdrop) {
    background: var(--backdrop-medium, rgba(0, 0, 0, 0.48));
  }

  :global(
    dialog.drawer-content.workspace-share-sheet[data-placement="bottom"]:not(
        .side-by-side-layout
      )
  ) {
    --sheet-bg:
      linear-gradient(
        var(--theme-panel-bg, rgba(0, 0, 0, 0.88)),
        var(--theme-panel-bg, rgba(0, 0, 0, 0.88))
      ),
      #0a0a14;
    --sheet-border: 1px solid var(--theme-stroke-strong);
    --sheet-shadow: 0 -12px 36px var(--theme-shadow);
    --sheet-max-height: min(70dvh, 34rem);
    box-sizing: border-box;
    width: min(30rem, 100%);
    max-width: 30rem;
    min-height: 0;
    margin-inline: auto;
  }

  .workspace-share-sheet-content {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .workspace-share-sheet-header {
    display: grid;
    grid-template-columns:
      var(--min-touch-target, 44px)
      minmax(0, 1fr)
      var(--min-touch-target, 44px);
    align-items: center;
    padding: 0 12px 8px;
  }

  .workspace-share-sheet-header h2 {
    grid-column: 2;
    margin: 0;
    color: var(--theme-text);
    font-size: var(--font-size-lg);
    font-weight: 650;
    text-align: center;
  }

  .workspace-share-close {
    grid-column: 3;
    display: grid;
    place-items: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    border: 1px solid var(--theme-stroke);
    border-radius: 50%;
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: var(--font-size-base);
  }

  .workspace-share-close:hover {
    border-color: var(--theme-stroke-strong);
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .workspace-share-close:focus-visible,
  .workspace-share-sheet-action:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .workspace-share-sheet-actions {
    display: flex;
    flex-direction: column;
    padding: 0 12px calc(12px + env(safe-area-inset-bottom, 0px));
  }

  .workspace-share-sheet-action {
    min-height: 52px;
  }

  .workspace-share-status {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @keyframes workspace-share-menu-enter {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (min-aspect-ratio: 17/10) and (max-height: 500px) {
    :global(
      dialog.drawer-content.workspace-share-sheet[data-placement="bottom"]:not(
          .side-by-side-layout
        )
    ) {
      --sheet-max-height: 96dvh;
    }

    .workspace-share-sheet-action {
      min-height: 48px;
    }
  }

  @media (prefers-contrast: more) {
    :global(.workspace-share-trigger) {
      border: 2px solid var(--theme-text);
      background: var(--theme-card-hover-bg);
      color: var(--theme-text);
      box-shadow: none;
    }

    :global(.workspace-share-menu),
    :global(.workspace-share-sheet[data-placement="bottom"]) {
      border-width: 2px;
    }
  }

  @media (forced-colors: active) {
    :global(.workspace-share-trigger),
    .workspace-share-close {
      border: 2px solid ButtonText;
      background: Canvas;
      box-shadow: none;
      color: ButtonText;
      forced-color-adjust: auto;
    }

    :global(.workspace-share-item),
    .workspace-share-sheet-action {
      color: ButtonText;
    }

    :global(.workspace-share-item[data-highlighted]),
    .workspace-share-sheet-action:hover:not(:disabled) {
      background: Highlight;
      color: HighlightText;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.workspace-share-trigger) {
      transition: none;
    }

    :global(.workspace-share-trigger:hover:not(:disabled)),
    :global(.workspace-share-trigger:active:not(:disabled)) {
      transform: none;
    }

    :global(.workspace-share-trigger .fa-spin),
    :global(.workspace-share-menu .fa-spin),
    .workspace-share-sheet-content .fa-spin {
      animation: none;
    }

    :global(.workspace-share-menu[data-state="open"]) {
      animation: none;
    }
  }
</style>
