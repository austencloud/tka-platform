<!--
  Copy As Image Button

  Captures an HTML element as a PNG image and copies it to clipboard.
  Uses dom-to-image-more for the capture.
-->
<script lang="ts">
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import domtoimage from "dom-to-image-more";

  interface Props {
    /** The HTML element to capture */
    targetElement: HTMLElement | null;
    /** Required for WCAG compliance */
    ariaLabel?: string;
    /** Size preset */
    size?: "sm" | "md" | "lg";
    /** Called immediately when clicked (for haptic feedback) */
    onActivate?: () => void;
    /** Called on successful copy */
    onSuccess?: () => void;
    /** Called on error */
    onError?: (error: Error) => void;
    /** Disabled state */
    disabled?: boolean;
    /** Additional CSS classes */
    class?: string;
  }

  let {
    targetElement,
    ariaLabel = "Copy conversation as image",
    size = "md",
    onActivate,
    onSuccess,
    onError,
    disabled = false,
    class: className = "",
  }: Props = $props();

  type CaptureState = "idle" | "capturing" | "success" | "error";
  let state = $state<CaptureState>("idle");
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  const isCapturing = $derived(state === "capturing");
  const isSuccess = $derived(state === "success");
  const isError = $derived(state === "error");

  const currentIcon = $derived(
    isCapturing
      ? "fa-spinner fa-spin"
      : isSuccess
        ? "fa-check"
        : isError
          ? "fa-exclamation-triangle"
          : "fa-camera"
  );

  const tooltipText = $derived(
    isCapturing
      ? "Capturing..."
      : isSuccess
        ? "Image copied!"
        : isError
          ? "Capture failed. Click to retry."
          : ariaLabel
  );

  const computedAriaLabel = $derived.by(() => {
    if (isSuccess) return `${ariaLabel} - copied`;
    if (isError) return `${ariaLabel} - failed, click to retry`;
    if (isCapturing) return `${ariaLabel} - capturing`;
    return ariaLabel;
  });

  async function handleClick() {
    if (isCapturing || disabled || !targetElement) return;
    if (resetTimer) clearTimeout(resetTimer);

    onActivate?.();
    state = "capturing";

    try {
      // Capture the element as a PNG blob
      const blob = await domtoimage.toBlob(targetElement, {
        bgcolor: "#12121c", // Dark background for transparent areas
        quality: 1.0,
        style: {
          // Ensure we capture the full scroll content
          overflow: "visible",
        },
      });

      // Copy to clipboard using Clipboard API
      if (!navigator.clipboard?.write) {
        throw new Error("Clipboard API not supported");
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);

      // Create a temporary URL for the preview toast
      const previewUrl = URL.createObjectURL(blob);

      state = "success";
      toast.image("Image copied!", previewUrl, 4000);

      // Clean up the object URL after toast dismisses
      setTimeout(() => URL.revokeObjectURL(previewUrl), 5000);

      onSuccess?.();

      resetTimer = setTimeout(() => {
        state = "idle";
      }, 2000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("[CopyAsImageButton] Capture failed:", error);
      state = "error";
      toast.error("Failed to capture image");
      onError?.(error);

      resetTimer = setTimeout(() => {
        state = "idle";
      }, 3000);
    }
  }

  $effect(() => {
    return () => {
      if (resetTimer) clearTimeout(resetTimer);
    };
  });
</script>

<button
  type="button"
  class="capture-btn size-{size} {className}"
  class:success={isSuccess}
  class:error={isError}
  aria-label={computedAriaLabel}
  aria-busy={isCapturing}
  title={tooltipText}
  disabled={disabled || isCapturing || !targetElement}
  onclick={handleClick}
>
  <i class="fas {currentIcon}" aria-hidden="true"></i>
  <span class="sr-only" role="status" aria-live="polite">
    {isSuccess ? "Image copied to clipboard" : isError ? "Capture failed" : ""}
  </span>
</button>

<style>
  .capture-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 48px);
    height: var(--min-touch-target, 48px);
    padding: 0;
    border-radius: 50%;
    color: #ffffff;
    font-size: 16px;
    cursor: pointer;
    transition: all var(--duration-normal, 0.3s) ease;
    flex-shrink: 0;

    /* Amber/orange gradient for image/camera action */
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.9), rgba(217, 119, 6, 0.9));
    border: 1px solid rgba(245, 158, 11, 0.3);
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.25);
  }

  .capture-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(245, 158, 11, 1), rgba(217, 119, 6, 1));
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
    transform: scale(1.05);
  }

  .capture-btn:active:not(:disabled) {
    transform: scale(0.95);
    transition: transform 0.1s ease;
  }

  .capture-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Success state */
  .capture-btn.success {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.9));
    border-color: rgba(34, 197, 94, 0.3);
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.25);
    animation: success-pulse var(--duration-normal, 0.3s) ease-out;
  }

  @keyframes success-pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }

  /* Error state */
  .capture-btn.error {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.9), rgba(220, 38, 38, 0.9));
    border-color: rgba(239, 68, 68, 0.3);
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.25);
  }

  .capture-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* Size variants */
  .size-sm {
    width: 36px;
    height: 36px;
    font-size: 14px;
  }

  .size-lg {
    width: 56px;
    height: 56px;
    font-size: 18px;
  }

  /* Screen reader only */
  .sr-only {
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

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .capture-btn {
      transition: none;
    }

    .capture-btn.success {
      animation: none;
    }

    .capture-btn :global(.fa-spin) {
      animation: none;
    }
  }
</style>
