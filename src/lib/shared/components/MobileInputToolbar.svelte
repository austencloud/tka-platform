<!--
  MobileInputToolbar - Keyboard-aware toolbar for mobile text input

  Shows above the virtual keyboard when a textarea is focused on mobile.
  Provides a Done button to dismiss the keyboard, and a snippet slot for
  consumer-specific left-side content (e.g. submit button, voice input).

  Uses:
  - VirtualKeyboard API (Chrome Android) for keyboard-inset-height
  - visualViewport API (iOS Safari) as fallback
  - CSS env() variables for positioning
-->
<script lang="ts">
  import { onMount, onDestroy, type Snippet } from "svelte";
  import { browser } from "$app/environment";

  let {
    visible = false,
    disabled = false,
    doneLabel = "Done",
    onDone,
    onKeyboardHeightChange,
    leftContent,
  } = $props<{
    visible: boolean;
    disabled?: boolean;
    doneLabel?: string;
    onDone: () => void;
    onKeyboardHeightChange?: (height: number) => void;
    leftContent?: Snippet;
  }>();

  let keyboardHeight = $state(0);
  let isKeyboardVisible = $state(false);

  // Track if VirtualKeyboard API is available (Chrome Android)
  let hasVirtualKeyboardAPI = $state(false);

  // Track if we're in a simulated mobile environment (Chrome DevTools)
  // In this case, touch is detected but no actual keyboard exists
  let isSimulatedMobile = $state(false);

  // Debounce timer for keyboard height updates (prevents jank during keyboard animation)
  let keyboardDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  // Track last stable height to avoid micro-fluctuations
  let lastStableHeight = 0;
  // Pending height to apply after debounce
  let pendingHeight = 0;

  onMount(() => {
    if (!browser) return;

    // Detect Chrome DevTools mobile simulation:
    // - Touch is indicated (maxTouchPoints > 0 or ontouchstart exists)
    // - But no VirtualKeyboard API AND visualViewport matches window.innerHeight
    //   (meaning no keyboard can push the viewport)
    const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const hasVKApi = "virtualKeyboard" in navigator;
    const viewportMatchesWindow =
      window.visualViewport &&
      Math.abs(window.visualViewport.height - window.innerHeight) < 10;

    // If touch is detected but neither keyboard API is available/working,
    // we're likely in Chrome DevTools simulation
    if (hasTouch && !hasVKApi && viewportMatchesWindow) {
      // Check if this is likely a desktop browser simulating mobile
      // Real mobile devices would have VirtualKeyboard API (Chrome) or
      // visualViewport that differs from innerHeight when keyboard is up
      const userAgent = navigator.userAgent.toLowerCase();
      const isLikelyDesktopBrowser =
        !userAgent.includes("mobile") &&
        !userAgent.includes("android") &&
        !userAgent.includes("iphone") &&
        !userAgent.includes("ipad");

      if (isLikelyDesktopBrowser) {
        isSimulatedMobile = true;
        // In simulated mode, we won't show the toolbar since there's no keyboard
        return;
      }
    }

    // Try VirtualKeyboard API first (Chrome Android 94+)
    if ("virtualKeyboard" in navigator) {
      hasVirtualKeyboardAPI = true;
      const vk = (navigator as any).virtualKeyboard;

      // Opt-in to manual keyboard handling
      vk.overlaysContent = true;

      // Listen for geometry changes
      vk.addEventListener("geometrychange", handleVirtualKeyboardChange);
    } else if (window.visualViewport) {
      // Fallback: visualViewport API (iOS Safari, older Chrome)
      // Only use this if VirtualKeyboard API is NOT available
      window.visualViewport.addEventListener("resize", handleVisualViewportResize);
      window.visualViewport.addEventListener("scroll", handleVisualViewportResize);
    }
  });

  onDestroy(() => {
    if (!browser) return;

    if (keyboardDebounceTimer) {
      clearTimeout(keyboardDebounceTimer);
    }

    if (hasVirtualKeyboardAPI && "virtualKeyboard" in navigator) {
      const vk = (navigator as any).virtualKeyboard;
      vk.removeEventListener("geometrychange", handleVirtualKeyboardChange);
    }

    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", handleVisualViewportResize);
      window.visualViewport.removeEventListener("scroll", handleVisualViewportResize);
    }
  });

  function handleVirtualKeyboardChange(event: Event) {
    const vk = event.target as any;
    const rect = vk.boundingRect;
    const newHeight = rect.height;
    // Debounce to prevent jank during keyboard animation
    if (keyboardDebounceTimer) {
      clearTimeout(keyboardDebounceTimer);
    }

    pendingHeight = newHeight;

    keyboardDebounceTimer = setTimeout(() => {
      // Only update if height changed significantly (> 20px)
      const heightDiff = Math.abs(pendingHeight - lastStableHeight);

      if (pendingHeight > 100) {
        // Keyboard is visible
        if (heightDiff > 20 || !isKeyboardVisible) {
          keyboardHeight = pendingHeight;
          isKeyboardVisible = true;
          lastStableHeight = pendingHeight;
        }
      } else {
        // Keyboard is hidden
        if (isKeyboardVisible) {
          keyboardHeight = 0;
          isKeyboardVisible = false;
          lastStableHeight = 0;
        }
      }
    }, 50); // 50ms debounce - matches visualViewport handler
  }

  function handleVisualViewportResize() {
    if (!window.visualViewport) return;

    // Calculate keyboard height from viewport difference
    const viewportHeight = window.visualViewport.height;
    const windowHeight = window.innerHeight;
    const calculatedHeight = windowHeight - viewportHeight - window.visualViewport.offsetTop;

    // Debounce rapid updates during keyboard animation
    if (keyboardDebounceTimer) {
      clearTimeout(keyboardDebounceTimer);
    }

    keyboardDebounceTimer = setTimeout(() => {
      // Only update if height changed significantly (> 20px difference)
      // This prevents micro-fluctuations during animation
      const heightDiff = Math.abs(calculatedHeight - lastStableHeight);

      if (calculatedHeight > 100) {
        // Keyboard is visible
        if (heightDiff > 20 || !isKeyboardVisible) {
          keyboardHeight = calculatedHeight;
          isKeyboardVisible = true;
          lastStableHeight = calculatedHeight;
        }
      } else {
        // Keyboard is hidden
        if (isKeyboardVisible) {
          keyboardHeight = 0;
          isKeyboardVisible = false;
          lastStableHeight = 0;
        }
      }
    }, 50); // 50ms debounce
  }

  // Notify parent when keyboard height changes
  $effect(() => {
    // Add toolbar height (~60px) to keyboard height for total bottom inset
    const totalHeight = keyboardHeight > 0 ? keyboardHeight + 60 : 0;
    onKeyboardHeightChange?.(totalHeight);
  });

  // Compute bottom position using CSS env() with JS fallback
  const toolbarStyle = $derived.by(() => {
    // If VirtualKeyboard API is active, CSS env() will handle it
    if (hasVirtualKeyboardAPI) {
      return "";
    }
    // For iOS Safari, use calculated keyboard height
    if (keyboardHeight > 0) {
      return `bottom: ${keyboardHeight}px`;
    }
    return "";
  });

  // Don't show toolbar in simulated mobile mode (Chrome DevTools) - there's no keyboard
  const shouldShow = $derived(visible && isKeyboardVisible && !isSimulatedMobile);
</script>

{#if shouldShow}
  <div
    class="mobile-input-toolbar"
    class:has-virtual-keyboard-api={hasVirtualKeyboardAPI}
    style={toolbarStyle}
    role="toolbar"
    aria-label="Input actions"
  >
    <div class="toolbar-content">
      {#if leftContent}
        <div class="toolbar-left">
          {@render leftContent()}
        </div>
      {/if}

      <div class="toolbar-right">
        <button
          type="button"
          class="done-button"
          onclick={onDone}
          {disabled}
          aria-label={doneLabel}
        >
          <span class="done-text">{doneLabel}</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .mobile-input-toolbar {
    position: fixed;
    left: 0;
    right: 0;
    z-index: var(--z-tooltip);

    /* Default: use CSS env() for VirtualKeyboard API browsers */
    bottom: calc(env(keyboard-inset-height, 0px));

    /* Visual design */
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);

    /* Safe area for notched devices */
    padding-bottom: env(safe-area-inset-bottom, 0px);

    /* Animation */
    animation: slideUp 150ms ease-out;
  }

  /* When VirtualKeyboard API is available, trust CSS env() completely */
  .mobile-input-toolbar.has-virtual-keyboard-api {
    bottom: env(keyboard-inset-height, 0px);
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .toolbar-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    gap: 12px;
    max-width: 100%;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .done-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    min-height: 44px;

    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;

    color: var(--theme-text, white);
    font-size: 15px;
    font-weight: 600;

    cursor: pointer;
    transition: all 150ms ease;

    /* Ensure touch target */
    touch-action: manipulation;
  }

  .done-button:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .done-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .done-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .done-text {
    font-weight: 600;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .mobile-input-toolbar {
      animation: none;
    }

    .done-button {
      transition: none;
    }
  }
</style>
