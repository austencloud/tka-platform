<script lang="ts">
  import { onMount } from "svelte";
  import type { PreparedScanCard } from "$lib/shared/qr/domain/prepared-scan-card";
  import {
    markScan,
    markScanAfterPaint,
    reportScanToStable,
  } from "$lib/shared/analytics/scan-perf";

  interface Props {
    card: PreparedScanCard;
    displayWord: string;
    onStable: () => void;
  }

  const { card, displayWord, onStable }: Props = $props();
  let root: HTMLElement;
  let settled = $state(false);

  const cellCount = card.cells.length;
  const rowsFor = (columns: number) => Math.ceil(cellCount / columns);
  const layoutVars = [
    `--rows-2:${rowsFor(2)}`,
    `--rows-3:${rowsFor(3)}`,
    `--rows-5:${rowsFor(5)}`,
    `--rows-6:${rowsFor(6)}`,
  ].join(";");

  async function waitForImage(image: HTMLImageElement): Promise<boolean> {
    if (!image.complete) {
      await new Promise<void>((resolve) => {
        const finish = () => resolve();
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
      });
    }

    if (image.naturalWidth === 0) return false;
    try {
      await image.decode();
    } catch {
      // A loaded image can reject decode() during a lifecycle race. The DOM
      // image remains authoritative, so treat its natural dimensions as ready.
    }
    return image.naturalWidth > 0;
  }

  onMount(() => {
    let canceled = false;

    void (async () => {
      // This is the first client code on the scan route. The shortcode and
      // sequence were resolved before the HTML response, so those boundaries
      // are intentionally adjacent instead of hiding server work behind a
      // later viewer-module mark.
      markScan("start");
      markScan("shortcode-resolve-start");
      markScan("shortcode-resolved");
      markScan("hydrated");
      markScan("card-mount");
      markScan("card-component-mounted");
      markScan("cell-dom-committed");

      const images = Array.from(
        root.querySelectorAll<HTMLImageElement>("[data-scan-cell-image]")
      );
      markScan("cell-decode-start");
      let firstReady = false;

      await Promise.all(
        images.map(async (image) => {
          const ready = await waitForImage(image);
          if (ready && !firstReady) {
            firstReady = true;
            void markScanAfterPaint("first-cell-painted");
          }
        })
      );

      if (canceled) return;
      markScan("cell-decode-end");
      if (!firstReady) {
        // A broken canonical object still produces a settled error cell. Mark
        // the first visible state so telemetry never hangs indefinitely.
        await markScanAfterPaint("first-cell-painted");
      }
      await markScanAfterPaint("all-cells-stable");
      reportScanToStable();
      if (canceled) return;

      settled = true;
      onStable();
    })();

    return () => {
      canceled = true;
    };
  });
</script>

<section
  bind:this={root}
  class="bootstrap-surface"
  class:settled
  aria-label="Scanned choreography"
  data-scan-bootstrap
>
  <article class="scan-card" style={layoutVars}>
    <header class="scan-card-header">
      <h1>{displayWord || card.word}</h1>
    </header>

    <div class="scan-card-grid" class:mixed-durations={card.hasMixedDurations}>
      {#each card.cells as cell, position (cell.index)}
        <div
          class="scan-cell"
          class:start-cell={cell.index < 0}
          class:first-step={cell.index === 0}
          style:--cell-ratio={cell.widthMultiplier}
        >
          <img
            src={cell.imageUrl}
            alt={cell.index < 0 ? "Start position" : `Step ${cell.label}`}
            width={Math.round(480 * cell.widthMultiplier)}
            height="480"
            loading="eager"
            decoding="async"
            fetchpriority={position === 0 ? "high" : "auto"}
            data-scan-cell-image
          />
          <span class="step-label" aria-hidden="true">{cell.label}</span>
          {#if card.hasMixedDurations && cell.duration !== 1}
            <span class="duration-label">{cell.duration}×</span>
          {/if}
        </div>
      {/each}
    </div>

    <footer class="scan-card-footer">
      <span>The Kinetic Alphabet</span>
      <span class="loading-controls">
        {settled ? "Opening controls" : "Loading card"}
      </span>
    </footer>
  </article>
</section>

<style>
  .bootstrap-surface {
    --scan-columns: 3;
    --scan-rows: var(--rows-3);
    position: absolute;
    inset: 0;
    z-index: 1;
    display: grid;
    min-width: 0;
    min-height: 0;
    place-items: center;
    overflow: hidden;
    padding: max(12px, env(safe-area-inset-top))
      max(12px, env(safe-area-inset-right))
      max(12px, env(safe-area-inset-bottom))
      max(12px, env(safe-area-inset-left));
    box-sizing: border-box;
    background:
      radial-gradient(
        circle at 50% 28%,
        rgba(26, 96, 122, 0.2),
        transparent 42%
      ),
      #0f0f1a;
    color: #fff;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }

  .scan-card {
    display: flex;
    width: min(
      94vw,
      1180px,
      calc((100dvh - 112px) * var(--scan-columns) / var(--scan-rows))
    );
    max-width: 100%;
    max-height: calc(100dvh - 24px);
    flex-direction: column;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: clamp(10px, 2vw, 18px);
    background: #000;
    box-shadow:
      0 24px 80px rgba(0, 0, 0, 0.45),
      0 0 0 1px rgba(255, 255, 255, 0.03);
  }

  .scan-card-header,
  .scan-card-footer {
    display: flex;
    min-height: 38px;
    flex: 0 0 38px;
    align-items: center;
    box-sizing: border-box;
    background: rgba(10, 10, 15, 0.98);
  }

  .scan-card-header {
    justify-content: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    padding: 0 44px;
  }

  .scan-card-header h1 {
    overflow: hidden;
    margin: 0;
    color: rgba(255, 255, 255, 0.94);
    font-size: clamp(0.88rem, 2.8cqw, 1.35rem);
    font-weight: 650;
    letter-spacing: 0.02em;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .scan-card-grid {
    display: grid;
    min-width: 0;
    min-height: 0;
    grid-template-columns: repeat(var(--scan-columns), minmax(0, 1fr));
    grid-auto-flow: row;
    grid-auto-rows: minmax(0, 1fr);
    background: #000;
  }

  .scan-cell {
    --cell-ratio: 1;
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    container-type: inline-size;
    aspect-ratio: var(--cell-ratio) / 1;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-sizing: border-box;
    background: #050508;
  }

  .scan-card-grid.mixed-durations .scan-cell {
    grid-column: span min(2, max(1, round(var(--cell-ratio))));
  }

  .scan-cell img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    animation: cell-arrive 150ms ease forwards;
  }

  .step-label,
  .duration-label {
    position: absolute;
    z-index: 1;
    display: grid;
    place-items: center;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 700;
    line-height: 1;
    text-shadow: 0 1px 3px #000;
    pointer-events: none;
  }

  .step-label {
    top: 5cqw;
    left: 5cqw;
    min-width: 16cqw;
    min-height: 16cqw;
    font-size: clamp(0.66rem, 9cqw, 1.2rem);
  }

  .duration-label {
    right: 5cqw;
    bottom: 5cqw;
    padding: 3cqw 4cqw;
    border-radius: 999px;
    background: rgba(7, 7, 12, 0.72);
    font-size: clamp(0.58rem, 7cqw, 0.84rem);
  }

  .scan-card-footer {
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    padding: 0 14px;
    color: rgba(255, 255, 255, 0.72);
    font-family: Georgia, serif;
    font-size: clamp(0.66rem, 1.4vw, 0.82rem);
  }

  .loading-controls {
    color: rgba(255, 255, 255, 0.48);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: 0.7rem;
    letter-spacing: 0.02em;
  }

  @keyframes cell-arrive {
    to {
      opacity: 1;
    }
  }

  @media (max-width: 430px) and (min-height: 760px) {
    .bootstrap-surface {
      --scan-columns: 2;
      --scan-rows: var(--rows-2);
    }
  }

  @media (min-aspect-ratio: 7 / 5) {
    .bootstrap-surface {
      --scan-columns: 5;
      --scan-rows: var(--rows-5);
    }
  }

  @media (min-aspect-ratio: 2 / 1) {
    .bootstrap-surface {
      --scan-columns: 6;
      --scan-rows: var(--rows-6);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scan-cell img {
      animation: none;
      opacity: 1;
    }
  }
</style>
