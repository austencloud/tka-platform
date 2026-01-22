<!--
  BaseModal.svelte - 2026 Native Dialog Modal System

  Uses native <dialog> element with cutting-edge CSS features:
  - @starting-style for entry animations
  - transition-behavior: allow-discrete for exit animations
  - ::backdrop pseudo-element for native backdrop

  Architecture follows Drawer.svelte patterns:
  - Separate animation state from open state
  - Lazy handler initialization
  - Pure CSS animations with data attributes
-->
<script lang="ts">
  import { onMount, untrack, type Snippet } from "svelte";
  import {
    registerModal,
    unregisterModal,
    isTopModal,
    generateModalId,
  } from "./ModalStack";
  import {
    FocusRestore,
    focusFirstOrContainer,
  } from "./helpers/FocusRestore";
  import "./modal-tokens.css";

  // ===== Types =====
  type CloseReason = "backdrop" | "escape" | "programmatic" | "button";
  type ModalSize = "sm" | "md" | "lg" | "full" | "fit";
  type ModalPosition = "center" | "top";
  type ModalAnimation = "pop" | "slide" | "none";

  // ===== Props =====
  interface Props {
    // Control
    open: boolean;
    onclose?: (reason: CloseReason) => void;

    // Behavior
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    restoreFocus?: boolean;

    // Appearance
    size?: ModalSize;
    position?: ModalPosition;
    animation?: ModalAnimation;

    // Customization
    class?: string;
    labelledBy?: string;
    describedBy?: string;

    // Slots
    children: Snippet;
    header?: Snippet;
    footer?: Snippet;
  }

  let {
    open = $bindable(false),
    onclose,
    closeOnBackdrop = true,
    closeOnEscape = true,
    restoreFocus = true,
    size = "md",
    position = "center",
    animation = "pop",
    class: className = "",
    labelledBy,
    describedBy,
    children,
    header,
    footer,
  }: Props = $props();

  // ===== State =====
  let dialogElement = $state<HTMLDialogElement | null>(null);
  let shouldRender = $state(false);
  let hasEntered = $state(false);
  let isClosing = $state(false);
  let wasOpen = $state(false);
  let modalId = $state(generateModalId());

  // ===== Helpers =====
  let focusRestore: FocusRestore | null = null;
  let handlersInitialized = false;

  function initializeHandlers() {
    if (handlersInitialized) return;
    handlersInitialized = true;
    focusRestore = new FocusRestore({ enabled: restoreFocus });
  }

  // ===== Close Handler =====
  function closeModal(reason: CloseReason) {
    if (!open) return;

    // Only respond if we're the top modal (for nested modals)
    if (!isTopModal(modalId) && reason !== "programmatic") return;

    open = false;
    onclose?.(reason);
  }

  // ===== Native Dialog Event Handlers =====
  function handleDialogClose(event: Event) {
    // Native dialog was closed (e.g., via form[method="dialog"])
    closeModal("programmatic");
  }

  function handleDialogCancel(event: Event) {
    // User pressed Escape - native dialog fires this
    if (!closeOnEscape) {
      event.preventDefault();
      return;
    }

    // Only close if we're the top modal
    if (!isTopModal(modalId)) {
      event.preventDefault();
      return;
    }

    closeModal("escape");
  }

  function handleBackdropClick(event: MouseEvent) {
    if (!closeOnBackdrop) return;

    // Check if click was on the backdrop (the dialog element itself, not its content)
    if (event.target === dialogElement) {
      closeModal("backdrop");
    }
  }

  // ===== State Change Effect =====
  $effect(() => {
    const currentOpen = open;
    const previouslyOpen = untrack(() => wasOpen);

    if (currentOpen === previouslyOpen) return;

    untrack(() => {
      wasOpen = currentOpen;
    });

    if (currentOpen) {
      // Opening
      initializeHandlers();
      focusRestore?.capture();
      shouldRender = true;

      // Register with stack
      registerModal(modalId, () => closeModal("programmatic"));

      // Wait for DOM, then show modal
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (dialogElement && !dialogElement.open) {
            dialogElement.showModal();

            // Mark as entered for content animations
            requestAnimationFrame(() => {
              hasEntered = true;
            });
          }
        });
      });
    } else {
      // Closing - trigger exit animation first, then close dialog
      hasEntered = false;
      isClosing = true;

      // Unregister from stack immediately (so escape key goes to next modal)
      unregisterModal(modalId);

      // Wait for exit animation to complete, then actually close the dialog
      const exitDuration = animation === "none" ? 0 : 200;
      setTimeout(() => {
        if (dialogElement?.open) {
          dialogElement.close();
        }
        isClosing = false;
        shouldRender = false;
        focusRestore?.restore();
      }, exitDuration);
    }
  });

  // ===== Update focus restore when prop changes =====
  $effect(() => {
    focusRestore?.setEnabled(restoreFocus);
  });

  // ===== Cleanup on unmount =====
  onMount(() => {
    return () => {
      unregisterModal(modalId);
      focusRestore?.restore();
    };
  });
</script>

{#if shouldRender}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <dialog
    bind:this={dialogElement}
    class="base-modal {className}"
    data-size={size}
    data-position={position}
    data-animation={animation}
    data-entered={hasEntered}
    data-closing={isClosing}
    aria-labelledby={labelledBy}
    aria-describedby={describedBy}
    onclick={handleBackdropClick}
    onclose={handleDialogClose}
    oncancel={handleDialogCancel}
  >
    <!-- Click barrier to prevent backdrop clicks from triggering on content -->
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="modal-content-wrapper" onclick={(e) => e.stopPropagation()}>
      {#if header}
        <div class="modal-header-slot" data-animate="1">
          {@render header()}
        </div>
      {/if}

      <div class="modal-body">
        {@render children()}
      </div>

      {#if footer}
        <div class="modal-footer-slot">
          {@render footer()}
        </div>
      {/if}
    </div>
  </dialog>
{/if}

<style>
  /* Content wrapper - adapts to size variant */
  .modal-content-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 0;
  }

  /* Fixed-size modals: fill the dialog height */
  :global(dialog[data-size="sm"]) .modal-content-wrapper,
  :global(dialog[data-size="md"]) .modal-content-wrapper,
  :global(dialog[data-size="lg"]) .modal-content-wrapper,
  :global(dialog[data-size="full"]) .modal-content-wrapper {
    height: 100%;
  }

  /* Fit-size modals: content-driven height */
  :global(dialog[data-size="fit"]) .modal-content-wrapper {
    height: fit-content;
    flex: 0 0 auto;
  }

  /* Header slot */
  .modal-header-slot {
    flex-shrink: 0;
  }

  /* Body - scrollable content area */
  .modal-body {
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .modal-body {
    @apply themed-scrollbar;
  }

  /* Fixed-size modals: body expands to fill space */
  :global(dialog[data-size="sm"]) .modal-body,
  :global(dialog[data-size="md"]) .modal-body,
  :global(dialog[data-size="lg"]) .modal-body,
  :global(dialog[data-size="full"]) .modal-body {
    flex: 1;
  }

  /* Fit-size modals: body sizes to content */
  :global(dialog[data-size="fit"]) .modal-body {
    flex: 0 0 auto;
  }

  /* Footer slot */
  .modal-footer-slot {
    flex-shrink: 0;
  }
</style>
