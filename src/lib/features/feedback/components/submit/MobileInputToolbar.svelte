<!--
  MobileInputToolbar - Keyboard-aware toolbar for mobile feedback input

  Shows above the virtual keyboard when textarea is focused on mobile.
  Provides Done button to dismiss keyboard without closing the form.

  Uses:
  - VirtualKeyboard API (Chrome Android) for keyboard-inset-height
  - visualViewport API (iOS Safari) as fallback
  - CSS env() variables for positioning
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import VoiceInputButton from "./VoiceInputButton.svelte";

  let {
    visible = false,
    disabled = false,
    onDone,
    onVoiceTranscript,
    onInterimTranscript,
    onRecordingEnd,
    onVoiceTimeout,
  } = $props<{
    visible: boolean;
    disabled?: boolean;
    onDone: () => void;
    onVoiceTranscript: (transcript: string, isFinal: boolean) => void;
    onInterimTranscript: (transcript: string) => void;
    onRecordingEnd: () => void;
    onVoiceTimeout: () => void;
  }>();

  let keyboardHeight = $state(0);
  let isKeyboardVisible = $state(false);

  // Track if VirtualKeyboard API is available (Chrome Android)
  let hasVirtualKeyboardAPI = $state(false);

  onMount(() => {
    if (!browser) return;

    // Try VirtualKeyboard API first (Chrome Android 94+)
    if ("virtualKeyboard" in navigator) {
      hasVirtualKeyboardAPI = true;
      const vk = (navigator as any).virtualKeyboard;

      // Opt-in to manual keyboard handling
      vk.overlaysContent = true;

      // Listen for geometry changes
      vk.addEventListener("geometrychange", handleVirtualKeyboardChange);
    }

    // Fallback: visualViewport API (iOS Safari, older Chrome)
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleVisualViewportResize);
      window.visualViewport.addEventListener("scroll", handleVisualViewportResize);
    }
  });

  onDestroy(() => {
    if (!browser) return;

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
    const vk = (event.target as any);
    const rect = vk.boundingRect;
    keyboardHeight = rect.height;
    isKeyboardVisible = rect.height > 0;
  }

  function handleVisualViewportResize() {
    if (!window.visualViewport) return;

    // Calculate keyboard height from viewport difference
    const viewportHeight = window.visualViewport.height;
    const windowHeight = window.innerHeight;
    const calculatedHeight = windowHeight - viewportHeight - window.visualViewport.offsetTop;

    // Only consider it a keyboard if height is significant (> 100px)
    if (calculatedHeight > 100) {
      keyboardHeight = calculatedHeight;
      isKeyboardVisible = true;
    } else {
      keyboardHeight = 0;
      isKeyboardVisible = false;
    }
  }

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

  const shouldShow = $derived(visible && isKeyboardVisible);
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
      <div class="toolbar-left">
        <VoiceInputButton
          onTranscript={onVoiceTranscript}
          {onInterimTranscript}
          {onRecordingEnd}
          onTimeout={onVoiceTimeout}
          {disabled}
          size="small"
        />
      </div>

      <button
        type="button"
        class="done-button"
        onclick={onDone}
        {disabled}
        aria-label="Done - dismiss keyboard"
      >
        <span class="done-text">Done</span>
        <i class="fas fa-keyboard" aria-hidden="true"></i>
      </button>
    </div>
  </div>
{/if}

<style>
  .mobile-input-toolbar {
    position: fixed;
    left: 0;
    right: 0;
    z-index: 9999;

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

  .done-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    min-height: 44px;
    min-width: 80px;

    background: var(--theme-accent, #4a9eff);
    border: none;
    border-radius: 8px;

    color: white;
    font-size: 15px;
    font-weight: 600;

    cursor: pointer;
    transition: all 150ms ease;

    /* Ensure touch target */
    touch-action: manipulation;
  }

  .done-button:hover:not(:disabled) {
    background: var(--theme-accent-strong, #5aafff);
    transform: translateY(-1px);
  }

  .done-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .done-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .done-button i {
    font-size: 14px;
    opacity: 0.9;
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
