<!--
  ChoreoCardQR.svelte

  Displays a styled QR code for a sequence on choreo cards.
  The QR code links to the animation spotlight (/p/{code}).

  Features:
  - Modern styled QR code (rounded dots, custom corners)
  - Sized appropriately for print (~20-25mm physical size)
  - High contrast for reliable scanning
  - Lazy generation (only when visible)
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { QRStylePreset } from "$lib/shared/qr/services/contracts/IQRCodeGenerator";

  interface Props {
    sequence: SequenceData;
    /** Size in pixels for the QR code display */
    size?: number;
    /** Style preset: 'modern', 'classic', or 'minimal' */
    style?: QRStylePreset;
  }

  let { sequence, size = 80, style = "modern" }: Props = $props();

  // State
  let qrSvg = $state<string | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let containerRef = $state<HTMLDivElement | null>(null);
  let hasGenerated = $state(false);

  // Lazy loading via IntersectionObserver
  let observer: IntersectionObserver | null = null;

  async function generateQRCode() {
    if (hasGenerated || isLoading) return;

    isLoading = true;
    error = null;

    try {
      const qrGenerator = container.items.qrCodeGenerator;

      const result = await qrGenerator.generateForSequence(sequence, {
        size,
        margin: 1,
        style,
      });

      qrSvg = result.svg;
      hasGenerated = true;
    } catch (err) {
      console.error("Failed to generate QR code:", err);
      error = "QR failed";
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    if (containerRef) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting && !hasGenerated && !isLoading) {
            generateQRCode();
          }
        },
        { rootMargin: "100px", threshold: 0.01 }
      );
      observer.observe(containerRef);
    }

    return () => {
      observer?.disconnect();
    };
  });
</script>

<div
  class="qr-container"
  style:width="{size}px"
  style:height="{size}px"
  bind:this={containerRef}
  aria-label="QR code to view animation"
>
  {#if qrSvg}
    <div class="qr-code">
      {@html qrSvg}
    </div>
  {:else if isLoading}
    <div class="loading">
      <div class="spinner"></div>
    </div>
  {:else if error}
    <div class="error" title={error}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
      </svg>
    </div>
  {:else}
    <!-- Placeholder before generation -->
    <div class="placeholder">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
      </svg>
    </div>
  {/if}
</div>

<style>
  .qr-container {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .qr-code {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qr-code :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }

  .loading,
  .error,
  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: #999999;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #e0e0e0;
    border-top-color: #666666;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error {
    color: #cc0000;
  }

  .placeholder {
    opacity: 0.3;
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }

  /* Print styles - ensure QR code is crisp */
  @media print {
    .qr-container {
      background: #ffffff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .qr-code :global(svg) {
      /* Vector output for crisp printing */
      image-rendering: crisp-edges;
    }
  }
</style>
