<!--
  SpellInputToolbar - Keyboard-aware toolbar for word input on touch devices

  Shows above the virtual keyboard when input is focused.
  Provides Done button to dismiss keyboard and Generate button for quick action.

  Uses:
  - VirtualKeyboard API (Chrome Android 94+) for keyboard-inset-height
  - visualViewport API (iOS Safari) as fallback
  - CSS env() variables for positioning
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";

  let {
    visible = false,
    disabled = false,
    canGenerate = false,
    isGenerating = false,
    word = "",
    onDone,
    onGenerate,
    onKeyboardHeightChange,
    onKeyboardVisibilityChange,
  } = $props<{
    visible: boolean;
    disabled?: boolean;
    canGenerate?: boolean;
    isGenerating?: boolean;
    word?: string;
    onDone: () => void;
    onGenerate?: () => void;
    onKeyboardHeightChange?: (height: number) => void;
    /** Called when keyboard visibility changes with the raw keyboard height */
    onKeyboardVisibilityChange?: (visible: boolean, height: number) => void;
  }>();

  let keyboardHeight = $state(0);
  let isKeyboardVisible = $state(false);

  // Track if VirtualKeyboard API is available (Chrome Android)
  let hasVirtualKeyboardAPI = $state(false);

  // Debounce timer for keyboard height updates
  let keyboardDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastStableHeight = 0;
  let pendingHeight = 0;

  onMount(() => {
    if (!browser) return;

    // Try VirtualKeyboard API first (Chrome Android 94+)
    if ("virtualKeyboard" in navigator) {
      hasVirtualKeyboardAPI = true;
      const vk = (navigator as any).virtualKeyboard;

      // Opt-in to manual keyboard handling
      vk.overlaysContent = true;

      vk.addEventListener("geometrychange", handleVirtualKeyboardChange);
    } else if (window.visualViewport) {
      // Fallback: visualViewport API (iOS Safari, older Chrome)
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

    if (keyboardDebounceTimer) {
      clearTimeout(keyboardDebounceTimer);
    }

    pendingHeight = newHeight;

    keyboardDebounceTimer = setTimeout(() => {
      const heightDiff = Math.abs(pendingHeight - lastStableHeight);

      if (pendingHeight > 100) {
        if (heightDiff > 20 || !isKeyboardVisible) {
          keyboardHeight = pendingHeight;
          isKeyboardVisible = true;
          lastStableHeight = pendingHeight;
        }
      } else {
        if (isKeyboardVisible) {
          keyboardHeight = 0;
          isKeyboardVisible = false;
          lastStableHeight = 0;
        }
      }
    }, 50);
  }

  function handleVisualViewportResize() {
    if (!window.visualViewport) return;

    const viewportHeight = window.visualViewport.height;
    const windowHeight = window.innerHeight;
    const calculatedHeight = windowHeight - viewportHeight - window.visualViewport.offsetTop;

    if (keyboardDebounceTimer) {
      clearTimeout(keyboardDebounceTimer);
    }

    keyboardDebounceTimer = setTimeout(() => {
      const heightDiff = Math.abs(calculatedHeight - lastStableHeight);

      if (calculatedHeight > 100) {
        if (heightDiff > 20 || !isKeyboardVisible) {
          keyboardHeight = calculatedHeight;
          isKeyboardVisible = true;
          lastStableHeight = calculatedHeight;
        }
      } else {
        if (isKeyboardVisible) {
          keyboardHeight = 0;
          isKeyboardVisible = false;
          lastStableHeight = 0;
        }
      }
    }, 50);
  }

  // Notify parent when keyboard height changes
  $effect(() => {
    const toolbarHeight = 60;
    const totalHeight = keyboardHeight > 0 ? keyboardHeight + toolbarHeight : 0;
    onKeyboardHeightChange?.(totalHeight);
    onKeyboardVisibilityChange?.(isKeyboardVisible, keyboardHeight);
  });

  // Compute bottom position using CSS env() with JS fallback
  const toolbarStyle = $derived.by(() => {
    if (hasVirtualKeyboardAPI) {
      return "";
    }
    if (keyboardHeight > 0) {
      return `bottom: ${keyboardHeight}px`;
    }
    return "";
  });

  const shouldShow = $derived(visible && isKeyboardVisible);
</script>

{#if shouldShow}
  <div
    class="spell-input-toolbar"
    class:has-virtual-keyboard-api={hasVirtualKeyboardAPI}
    style={toolbarStyle}
    role="toolbar"
    aria-label="Word input actions"
  >
    <div class="toolbar-content">
      <div class="toolbar-left">
        {#if word}
          <span class="word-preview">{word}</span>
        {:else}
          <span class="word-hint">Enter a word...</span>
        {/if}
      </div>

      <div class="toolbar-right">
        {#if onGenerate}
          <button
            type="button"
            class="generate-button"
            onmousedown={(e) => {
              e.preventDefault();
              onGenerate();
            }}
            ontouchstart={(e) => {
              e.preventDefault();
              onGenerate();
            }}
            disabled={disabled || !canGenerate || isGenerating}
            aria-label="Generate sequence"
          >
            {#if isGenerating}
              <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
            {:else}
              <i class="fas fa-magic" aria-hidden="true"></i>
            {/if}
            <span>Generate</span>
          </button>
        {/if}

        <button
          type="button"
          class="done-button"
          onclick={onDone}
          {disabled}
          aria-label="Done - dismiss keyboard"
        >
          <span class="done-text">Done</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .spell-input-toolbar {
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

  .spell-input-toolbar.has-virtual-keyboard-api {
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
    min-width: 0;
    flex: 1;
  }

  .word-preview {
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .word-hint {
    font-size: 14px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-style: italic;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .generate-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    min-height: 48px;

    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 8px;

    color: white;
    font-size: 15px;
    font-weight: 600;

    cursor: pointer;
    transition: all 150ms ease;
    touch-action: manipulation;
  }

  .generate-button:hover:not(:disabled) {
    background: var(--theme-accent-hover, #4f46e5);
    transform: translateY(-1px);
  }

  .generate-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .generate-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .generate-button i {
    font-size: 14px;
  }

  .done-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    min-height: 48px;

    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;

    color: var(--theme-text, white);
    font-size: 15px;
    font-weight: 600;

    cursor: pointer;
    transition: all 150ms ease;
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
    .spell-input-toolbar {
      animation: none;
    }

    .done-button,
    .generate-button {
      transition: none;
    }
  }
</style>
