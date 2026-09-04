<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import WorkerEnvironmentRenderer from "$lib/shared/3d/worker-renderer/components/WorkerEnvironmentRenderer.svelte";
  import type { WorkerEnvironmentKey } from "$lib/shared/3d/worker-renderer/domain/worker-renderer-protocol";
  import type { WorkerSceneSwitchSnapshot } from "$lib/shared/3d/worker-renderer/services/worker-environment-renderer";

  interface WorkerSceneSwitchBenchmarkApi {
    snapshot: WorkerSceneSwitchSnapshot | null;
    switchTo(environment: WorkerEnvironmentKey): void;
    runAlternating(
      count?: number
    ): Promise<readonly WorkerSceneSwitchSnapshot[]>;
  }

  declare global {
    interface Window {
      __workerSceneSwitchBenchmark?: WorkerSceneSwitchBenchmarkApi;
    }
  }

  let environment = $state<WorkerEnvironmentKey>("rainbow");
  let snapshot = $state<WorkerSceneSwitchSnapshot | null>(null);
  let heartbeat: HTMLDivElement;
  let heartbeatRequest = 0;
  let heartbeatCount = 0;

  function select(next: WorkerEnvironmentKey): void {
    environment = next;
  }

  function onSnapshot(next: WorkerSceneSwitchSnapshot): void {
    snapshot = next;
    if (window.__workerSceneSwitchBenchmark) {
      window.__workerSceneSwitchBenchmark.snapshot = next;
    }
  }

  function waitForEnvironment(
    target: WorkerEnvironmentKey,
    timeoutMs = 90_000
  ): Promise<WorkerSceneSwitchSnapshot> {
    const startedAt = performance.now();
    return new Promise((resolve, reject) => {
      const poll = () => {
        if (snapshot?.active === target && snapshot.phase === "idle") {
          resolve(snapshot);
          return;
        }
        if (snapshot?.phase === "error") {
          reject(new Error(snapshot.lastError ?? "Worker renderer failed"));
          return;
        }
        if (performance.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${target}`));
          return;
        }
        setTimeout(poll, 25);
      };
      poll();
    });
  }

  async function runAlternating(
    count = 4
  ): Promise<readonly WorkerSceneSwitchSnapshot[]> {
    const results: WorkerSceneSwitchSnapshot[] = [];
    for (let index = 0; index < count; index += 1) {
      const target: WorkerEnvironmentKey =
        index % 2 === 0 ? "ocean" : "rainbow";
      select(target);
      results.push(await waitForEnvironment(target));
    }
    return results;
  }

  onMount(() => {
    window.__workerSceneSwitchBenchmark = {
      snapshot,
      switchTo: select,
      runAlternating,
    };

    const moveHeartbeat = (time: number) => {
      const x = ((time / 8) % 200) - 100;
      heartbeat.style.transform = `translate3d(${x}px, 0, 0)`;
      heartbeat.dataset.frame = String(heartbeatCount++);
      heartbeatRequest = requestAnimationFrame(moveHeartbeat);
    };
    heartbeatRequest = requestAnimationFrame(moveHeartbeat);
  });

  onDestroy(() => {
    cancelAnimationFrame(heartbeatRequest);
    delete window.__workerSceneSwitchBenchmark;
  });

  const last = $derived(snapshot?.lastMeasurement ?? null);
  const gateLabel = $derived(
    snapshot?.phase === "error"
      ? "Worker handoff failed"
      : !last
        ? "Awaiting first handoff"
        : last.passedInputGate && last.passedFrameGate && last.passedWorkerBound
          ? "All measured gates passed"
          : "At least one measured gate failed"
  );
</script>

<svelte:head>
  <title>Worker Scene Switch Benchmark</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="benchmark-shell">
  <section class="stage" aria-label="Worker-rendered environment">
    <WorkerEnvironmentRenderer {environment} {onSnapshot} />
    <div class="stage-vignette"></div>
    <div class="heartbeat-track" aria-label="Application-thread heartbeat">
      <div class="heartbeat" bind:this={heartbeat}></div>
    </div>
  </section>

  <aside class="console-panel">
    <header>
      <p class="eyebrow">OffscreenCanvas worker proof</p>
      <h1>Atomic world handoff</h1>
      <p>
        The visible worker keeps drawing while a second worker prepares the
        requested world. The canvas flips only after the replacement reports a
        rendered frame.
      </p>
    </header>

    <div class="scene-choices" aria-label="Prototype worlds">
      <button
        class:active={environment === "rainbow"}
        onclick={() => select("rainbow")}>Rainbow</button
      >
      <button
        class:active={environment === "ocean"}
        onclick={() => select("ocean")}>Ocean</button
      >
    </div>

    <div class="status-card" aria-live="polite">
      <div>
        <span>Visible</span><strong>{snapshot?.active ?? "none"}</strong>
      </div>
      <div>
        <span>Preparing</span><strong>{snapshot?.staging ?? "none"}</strong>
      </div>
      <div>
        <span>Phase</span><strong>{snapshot?.phase ?? "starting"}</strong>
      </div>
      <div>
        <span>Workers</span><strong>{snapshot?.liveWorkers ?? 0}</strong>
      </div>
      <div>
        <span>Progress</span>
        <strong
          >{snapshot?.progressPhase ?? "idle"}
          {Math.round((snapshot?.progress ?? 0) * 100)}%</strong
        >
      </div>
    </div>

    <div class="gate" class:pass={gateLabel === "All measured gates passed"}>
      {gateLabel}
    </div>

    {#if last}
      <dl class="metrics">
        <div>
          <dt>Click to swap</dt>
          <dd>{last.clickToSwapMs.toFixed(0)} ms</dd>
        </div>
        <div>
          <dt>Worker boot</dt>
          <dd>{last.workerBoot.firstFrameMs.toFixed(0)} ms</dd>
        </div>
        <div>
          <dt>Main-thread max gap</dt>
          <dd>{last.mainThreadMaxGapMs.toFixed(1)} ms</dd>
        </div>
        <div>
          <dt>Outgoing frame max gap</dt>
          <dd>{last.outgoingWorkerMaxFrameGapMs.toFixed(1)} ms</dd>
        </div>
        <div>
          <dt>Handoff delay</dt>
          <dd>{last.handoffDelayMs.toFixed(1)} ms</dd>
        </div>
        <div>
          <dt>Contexts at swap / after</dt>
          <dd>
            {last.liveWorkersAtSwap} / {last.liveWorkersAfterCleanup ?? "…"}
          </dd>
        </div>
        <div>
          <dt>GPU programs</dt>
          <dd>{last.workerBoot.programs}</dd>
        </div>
        <div>
          <dt>GPU textures</dt>
          <dd>{last.workerBoot.textures}</dd>
        </div>
      </dl>
    {/if}

    {#if snapshot?.lastError}
      <p class="error">{snapshot.lastError}</p>
    {/if}
  </aside>
</main>

<style>
  :global(body) {
    margin: 0;
    overflow: hidden;
    background: #08090d;
    color: #f5f2ea;
  }

  .benchmark-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(19rem, 25rem);
    min-height: 100dvh;
    background: #08090d;
  }

  .stage {
    position: relative;
    min-height: 100dvh;
    overflow: hidden;
  }

  .stage-vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
      circle at center,
      transparent 52%,
      rgb(0 0 0 / 0.42)
    );
  }

  .heartbeat-track {
    position: absolute;
    bottom: 1.5rem;
    left: 50%;
    width: 14rem;
    height: 0.35rem;
    transform: translateX(-50%);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.15);
  }

  .heartbeat {
    position: absolute;
    left: 50%;
    top: -0.28rem;
    width: 0.9rem;
    height: 0.9rem;
    border-radius: 50%;
    background: #fff4a8;
    box-shadow: 0 0 1.2rem #fff4a8;
    will-change: transform;
  }

  .console-panel {
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: clamp(1.25rem, 2.5vw, 2.5rem);
    overflow: auto;
    border-left: 1px solid rgb(255 255 255 / 0.12);
    background: rgb(10 11 16 / 0.94);
    backdrop-filter: blur(1.25rem);
  }

  header p {
    margin: 0.65rem 0 0;
    color: #b8b5ad;
    line-height: 1.5;
  }

  .eyebrow {
    color: #d4c8ff;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0.35rem 0 0;
    font-size: clamp(1.7rem, 3vw, 2.6rem);
    line-height: 1;
  }

  .scene-choices {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
  }

  button {
    min-height: 2.9rem;
    border: 1px solid rgb(255 255 255 / 0.17);
    border-radius: 0.75rem;
    background: rgb(255 255 255 / 0.07);
    color: inherit;
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }

  button:hover,
  button:focus-visible,
  button.active {
    border-color: #b99aff;
    background: rgb(185 154 255 / 0.18);
  }

  .status-card,
  .metrics {
    display: grid;
    gap: 0.55rem;
    margin: 0;
    padding: 1rem;
    border: 1px solid rgb(255 255 255 / 0.1);
    border-radius: 0.85rem;
    background: rgb(255 255 255 / 0.045);
  }

  .status-card div,
  .metrics div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }

  .status-card span,
  dt {
    color: #9e9b95;
  }

  .status-card strong,
  dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .gate {
    padding: 0.8rem 1rem;
    border-radius: 0.7rem;
    background: rgb(255 178 71 / 0.14);
    color: #ffd69c;
    font-weight: 700;
  }

  .gate.pass {
    background: rgb(83 215 139 / 0.14);
    color: #aef1c9;
  }

  .metrics {
    font-size: 0.9rem;
  }

  .error {
    margin: 0;
    color: #ffaaa5;
  }

  @media (max-width: 50rem) {
    .benchmark-shell {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(20rem, 56dvh) minmax(0, 44dvh);
    }

    .stage {
      min-height: 0;
    }

    .console-panel {
      border-top: 1px solid rgb(255 255 255 / 0.12);
      border-left: 0;
    }
  }
</style>
