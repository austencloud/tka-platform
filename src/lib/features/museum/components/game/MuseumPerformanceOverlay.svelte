<script lang="ts">
  import { onMount } from "svelte";
  import { getMuseumPerformanceRecorder } from "../../get-museum-performance-recorder";
  import type { MuseumPerformanceSnapshot } from "../../services/contracts/IMuseumPerformanceRecorder";

  const recorder = getMuseumPerformanceRecorder();
  let snapshot = $state<MuseumPerformanceSnapshot>(recorder.getSnapshot());
  let copyLabel = $state("Copy JSON");

  const latestHitch = $derived(snapshot.hitches.at(-1) ?? null);
  const topPhases = $derived(snapshot.phases.slice(0, 5));

  onMount(() => {
    const interval = setInterval(() => {
      snapshot = recorder.getSnapshot();
    }, 500);
    return () => clearInterval(interval);
  });

  function clearSamples(): void {
    recorder.clear();
    snapshot = recorder.getSnapshot();
  }

  async function copySnapshot(): Promise<void> {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(recorder.getSnapshot(), null, 2)
      );
      copyLabel = "Copied";
    } catch {
      copyLabel = "Copy failed";
    }
    setTimeout(() => {
      copyLabel = "Copy JSON";
    }, 1_500);
  }
</script>

<details class="diagnostics" open>
  <summary>
    <span>Museum performance</span>
    <strong class:warning={snapshot.frames.p95Ms >= 33.4}>
      {snapshot.frames.p95Ms.toFixed(1)} ms p95
    </strong>
  </summary>

  <div class="content">
    <div class="metrics">
      <div>
        <span>Frame max</span><strong
          >{snapshot.frames.maxMs.toFixed(1)} ms</strong
        >
      </div>
      <div>
        <span>Over 50 ms</span><strong>{snapshot.frames.over50Ms}</strong>
      </div>
      <div>
        <span>Draw calls</span><strong
          >{snapshot.renderer?.drawCalls ?? 0}</strong
        >
      </div>
      <div>
        <span>Triangles</span><strong
          >{((snapshot.renderer?.triangles ?? 0) / 1_000).toFixed(0)}k</strong
        >
      </div>
    </div>

    <section>
      <h3>Slowest phases</h3>
      {#if topPhases.length === 0}
        <p class="empty">Waiting for samples</p>
      {:else}
        <ol>
          {#each topPhases as phase}
            <li>
              <span>{phase.name}</span>
              <strong>{phase.p95Ms.toFixed(1)} ms</strong>
            </li>
          {/each}
        </ol>
      {/if}
    </section>

    <section>
      <h3>Latest hitch</h3>
      {#if latestHitch}
        <p class="hitch">
          <strong>{latestHitch.frameMs.toFixed(1)} ms</strong>
          <span>{latestHitch.source}</span>
        </p>
        <p class="detail">
          {latestHitch.worstPhase?.name ?? "Browser rendering"}
          {#if latestHitch.context?.roomId}
            in {latestHitch.context.roomId}
          {/if}
        </p>
      {:else}
        <p class="empty">No 50 ms hitch captured</p>
      {/if}
    </section>

    <div class="actions">
      <button type="button" onclick={clearSamples}>Clear</button>
      <button type="button" onclick={copySnapshot}>{copyLabel}</button>
    </div>
  </div>
</details>

<style>
  .diagnostics {
    position: absolute;
    top: clamp(4.5rem, 4rem + 1vw, 6rem);
    right: clamp(0.75rem, 0.5rem + 0.5vw, 1.5rem);
    z-index: var(--z-debug, 1000);
    width: min(22rem, calc(100% - 1.5rem));
    max-height: calc(100% - 6rem);
    overflow: auto;
    border: 1px solid rgba(200, 180, 140, 0.38);
    border-radius: 0.65rem;
    background: rgba(10, 10, 14, 0.94);
    color: rgba(255, 255, 255, 0.9);
    font:
      12px/1.4 "JetBrains Mono",
      monospace;
    box-shadow: 0 0.75rem 2rem rgba(0, 0, 0, 0.35);
  }

  summary {
    min-height: 2.75rem;
    padding: 0.7rem 0.8rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    user-select: none;
  }

  summary strong,
  li strong,
  .metrics strong {
    color: #a8e6ff;
    font-variant-numeric: tabular-nums;
  }

  summary strong.warning {
    color: #ffad66;
  }

  .content {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.75rem;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem;
  }

  .metrics div {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.5rem;
    border-radius: 0.4rem;
    background: rgba(255, 255, 255, 0.05);
  }

  .metrics span,
  .empty,
  .detail,
  .hitch span {
    color: rgba(255, 255, 255, 0.6);
  }

  section {
    margin-top: 0.8rem;
  }

  h3 {
    margin: 0 0 0.35rem;
    color: rgba(255, 255, 255, 0.72);
    font: inherit;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li,
  .hitch {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    margin: 0;
    padding: 0.2rem 0;
  }

  li span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    margin: 0;
  }

  .detail {
    margin-top: 0.2rem;
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.85rem;
  }

  button {
    min-height: 2.5rem;
    padding: 0 0.8rem;
    border: 1px solid rgba(200, 180, 140, 0.35);
    border-radius: 0.4rem;
    background: rgba(200, 180, 140, 0.1);
    color: rgba(255, 255, 255, 0.88);
    font: inherit;
    cursor: pointer;
  }

  button:hover,
  button:focus-visible {
    border-color: rgba(200, 180, 140, 0.75);
    background: rgba(200, 180, 140, 0.18);
    outline: none;
  }

  @media (max-width: 40rem) {
    .diagnostics {
      top: auto;
      right: 0.5rem;
      bottom: 3.5rem;
      width: min(20rem, calc(100% - 1rem));
      max-height: min(62%, 30rem);
    }
  }
</style>
