<script lang="ts">
  import { onMount } from "svelte";
  import {
    BURST_AND_COAST,
    ESCAPE_KINEMATICS,
    OceanBackgroundOrchestrator,
    fishDebugConfig,
    setOceanFishSimulationSeed,
    type FishEscapePhase,
    type FishMarineLife,
  } from "@austencloud/backgrounds";

  type TrialKind = "escape" | "burst";
  type TrialPhase = FishEscapePhase | "complete";

  interface TrialSample {
    elapsed: number;
    x: number;
    y: number;
    speed: number;
    acceleration: number;
    jerk: number;
    heading: number;
    curvature: number;
    clearance: number | null;
    phase: TrialPhase;
  }

  interface TrialResult {
    kind: TrialKind;
    fishId: number | null;
    duration: number;
    displacement: number;
    peakSpeed: number;
    peakAcceleration: number;
    peakJerk: number;
    headingChange: number;
    minimumClearance: number | null;
    phases: TrialPhase[];
    eventEntries: number;
    sourceLocked: boolean | null;
    recoveryMonotonic: boolean;
    causeStayedDistinct: boolean;
    didNotCrossSource: boolean | null;
  }

  interface ActiveTrial {
    kind: TrialKind;
    elapsed: number;
    startX: number;
    startY: number;
    startHeading: number;
    startEvents: number;
    previousSpeed: number;
    previousAcceleration: number;
    source: { x: number; y: number } | null;
    sourceLocked: boolean;
    causeStayedDistinct: boolean;
    samples: TrialSample[];
    phases: TrialPhase[];
  }

  interface BenchmarkApi {
    runEscape: () => void;
    runBurst: () => void;
    runPair: () => void;
    getReport: () => {
      escape: TrialResult | null;
      burst: TrialResult | null;
      sameFish: boolean | null;
    };
    getState: () => {
      trackedPresent: boolean;
      behavior: string | null;
      behaviorTimer: number | null;
      speed: number | null;
      fishCount: number;
      activeTrial: TrialKind | null;
    };
  }

  declare global {
    interface Window {
      __oceanMotionBenchmark?: BenchmarkApi;
    }
  }

  const SEED = "phase-two-motion-benchmark";
  const ESCAPE_PHASES: Array<{ phase: FishEscapePhase; duration: number }> = [
    { phase: "coil", duration: ESCAPE_KINEMATICS.coilDuration },
    { phase: "propulsion", duration: ESCAPE_KINEMATICS.propulsionDuration },
    { phase: "coast", duration: ESCAPE_KINEMATICS.coastDuration },
    { phase: "stabilize", duration: ESCAPE_KINEMATICS.stabilizeDuration },
  ];
  const EXPECTED_ESCAPE_ORDER: TrialPhase[] = [
    "coil",
    "propulsion",
    "coast",
    "stabilize",
  ];

  let canvas: HTMLCanvasElement | undefined = $state();
  let stage: HTMLDivElement | undefined = $state();
  let ready = $state(false);
  let status = $state("Preparing the production fish simulation");
  let selectedFish = $state.raw<FishMarineLife | null>(null);
  let activeKind = $state<TrialKind | null>(null);
  let liveSample = $state<TrialSample | null>(null);
  let escapeTrace = $state<TrialSample[]>([]);
  let burstTrace = $state<TrialSample[]>([]);
  let escapeResult = $state<TrialResult | null>(null);
  let burstResult = $state<TrialResult | null>(null);
  let fps = $state(0);

  let system: OceanBackgroundOrchestrator | null = null;
  let activeTrial: ActiveTrial | null = null;
  let dimensions = { width: 1, height: 1 };
  let animationTime = 0;
  let followWithBurst = false;
  let disposed = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const sameFish = $derived(
    escapeResult && burstResult
      ? escapeResult.fishId === burstResult.fishId
      : null
  );

  function format(value: number | null | undefined, digits = 2): string {
    return value === null || value === undefined || !Number.isFinite(value)
      ? "—"
      : value.toFixed(digits);
  }

  function labelPhase(phase: TrialPhase | undefined): string {
    return phase ? phase.charAt(0).toUpperCase() + phase.slice(1) : "Idle";
  }

  function phaseSequenceMatches(result: TrialResult | null): boolean {
    if (!result) return false;
    const expected =
      result.kind === "escape"
        ? EXPECTED_ESCAPE_ORDER
        : (["propulsion", "coast"] satisfies TrialPhase[]);
    return expected.every((phase, index) => result.phases[index] === phase);
  }

  function trialPassed(result: TrialResult | null): boolean {
    if (!result) return false;
    if (!phaseSequenceMatches(result) || !result.recoveryMonotonic)
      return false;
    if (result.kind === "escape") {
      return (
        result.eventEntries === 1 &&
        result.sourceLocked === true &&
        result.didNotCrossSource === true
      );
    }
    return result.eventEntries === 0 && result.causeStayedDistinct;
  }

  function speedPoints(trace: TrialSample[]): string {
    const width = 420;
    const height = 116;
    const maxTime = Math.max(
      ESCAPE_KINEMATICS.totalDuration,
      BURST_AND_COAST.duration
    );
    const maxSpeed = Math.max(
      5.5,
      ...escapeTrace.map((sample) => sample.speed),
      ...burstTrace.map((sample) => sample.speed)
    );
    return trace
      .map((sample) => {
        const x = (sample.elapsed / maxTime) * width;
        const y = height - (sample.speed / maxSpeed) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  function queue(callback: () => void, delay: number): void {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!disposed) callback();
    }, delay);
    timers.add(timer);
  }

  function chooseTrackedFish(fish: FishMarineLife[]): FishMarineLife | null {
    const centerX = dimensions.width * 0.42;
    const centerY = dimensions.height * 0.52;
    const unschooledResidents = fish.filter(
      (candidate) => candidate.resident && candidate.schoolId === undefined
    );
    const candidates =
      unschooledResidents.length > 0
        ? unschooledResidents
        : fish.filter((candidate) => candidate.schoolId === undefined);
    return (
      candidates.sort(
        (first, second) =>
          Math.hypot(first.x - centerX, first.baseY - centerY) -
          Math.hypot(second.x - centerX, second.baseY - centerY)
      )[0] ??
      fish[0] ??
      null
    );
  }

  function resetTrackedFish(): FishMarineLife | null {
    if (!system) return null;
    const population = system.getFish();
    if (!selectedFish || !population.includes(selectedFish)) {
      selectedFish = chooseTrackedFish(population);
    }
    const fish = selectedFish;
    if (!fish) return null;

    system.setPointer(0, 0, false);
    const targetX = dimensions.width * 0.42;
    const targetY = dimensions.height * 0.53;
    const animator = system.getFishAnimator();
    const spineHead = animator.getSpineChain(fish)?.head;
    const dx = targetX - (spineHead?.x ?? fish.x);
    const dy = targetY - (spineHead?.y ?? fish.baseY);

    fish.x = targetX;
    fish.y = targetY;
    fish.baseY = targetY;
    animator.repositionFish(fish, dx, dy);
    fish.direction = 1;
    fish.headingFactor = 1;
    fish.rotation = 0;
    fish.speed = fish.baseSpeed;
    fish.targetSpeed = fish.baseSpeed;
    fish.verticalDrift = 0;
    fish.behavior = "cruising";
    fish.behaviorTimer = 20;
    fish.intent = "cruise";
    fish.intentTimer = 0;
    fish.escapeManeuver = undefined;
    fish.burstStartSpeed = undefined;
    fish.burstPeakSpeed = undefined;
    fish.fleeTimer = 0;
    fish.fleeIntensity = 0;
    fish.mood = "calm";
    fish.moodTimer = 0;
    fish.bodyFlexAmount = 0.15;
    fish.depthBand = {
      min: Math.max(0, targetY - dimensions.height * 0.32),
      max: Math.min(dimensions.height, targetY + dimensions.height * 0.32),
    };
    fish.schoolId = undefined;
    fish.perception.cursorThreat = 0;
    fish.perception.cursorSpeed = 0;
    fish.perception.threatStimulus = false;
    fish.perception.threatSource = undefined;
    fish.memory.cursorThreatLatched = false;
    fish.memory.cursorAlarm = 0;
    return fish;
  }

  function beginTrial(kind: TrialKind): void {
    if (!ready || !system || activeTrial) return;
    const fish = resetTrackedFish();
    if (!fish) return;

    if (kind === "escape") {
      escapeTrace = [];
      escapeResult = null;
    } else {
      burstTrace = [];
      burstResult = null;
    }

    const startingHeading = Math.atan2(0, fish.direction);
    activeTrial = {
      kind,
      elapsed: 0,
      startX: fish.x,
      startY: fish.baseY,
      startHeading: startingHeading,
      startEvents: fish.escapeEventCount,
      previousSpeed: fish.speed,
      previousAcceleration: 0,
      source: null,
      sourceLocked: true,
      causeStayedDistinct: true,
      samples: [],
      phases: [],
    };
    activeKind = kind;
    liveSample = null;

    if (kind === "escape") {
      const farX = fish.x + fish.bodyLength * 4;
      system.setPointer(farX, fish.baseY, true);
      system.update(dimensions, 1);
      animationTime += 0.016;
      activeTrial.startX = fish.x;
      activeTrial.startY = fish.baseY;
      activeTrial.previousSpeed = fish.speed;
      const source = {
        x: fish.x + fish.bodyLength * 0.16,
        y: fish.baseY,
      };
      activeTrial.source = source;
      system.setPointer(source.x, source.y, true);
      status = "Holding one threat source in place through the full escape";
    } else {
      const speedRange = BURST_AND_COAST.speedMultiplier[fish.species];
      const fixedMultiplier = (speedRange[0] + speedRange[1]) / 2;
      system.getFishAnimator().beginPurposefulBurst(fish, fixedMultiplier);
      status = "Running a voluntary pulse with no threat or alarm";
    }
  }

  function runEscape(): void {
    followWithBurst = false;
    beginTrial("escape");
  }

  function runBurst(): void {
    followWithBurst = false;
    beginTrial("burst");
  }

  function runPair(): void {
    if (activeTrial) return;
    escapeTrace = [];
    burstTrace = [];
    escapeResult = null;
    burstResult = null;
    followWithBurst = true;
    beginTrial("escape");
  }

  function recordTrial(deltaSeconds: number): void {
    const trial = activeTrial;
    const fish = selectedFish;
    if (!trial || !fish) return;

    trial.elapsed += deltaSeconds;
    const bodyLength = Math.max(1, fish.bodyLength);
    const acceleration =
      (fish.speed - trial.previousSpeed) /
      Math.max(deltaSeconds, 1e-6) /
      bodyLength;
    const jerk =
      (acceleration - trial.previousAcceleration) /
      Math.max(deltaSeconds, 1e-6);
    const maneuver = fish.escapeManeuver;

    if (trial.kind === "escape" && maneuver) {
      if (!trial.source) {
        trial.source = { x: maneuver.source.x, y: maneuver.source.y };
      }
      if (
        Math.abs(maneuver.source.x - trial.source.x) > 1e-6 ||
        Math.abs(maneuver.source.y - trial.source.y) > 1e-6
      ) {
        trial.sourceLocked = false;
      }
    }

    if (trial.kind === "burst") {
      trial.causeStayedDistinct &&=
        fish.intent !== "flee" && fish.mood !== "alert" && !fish.escapeManeuver;
    }

    const phase: TrialPhase =
      trial.kind === "escape"
        ? (maneuver?.phase ?? "complete")
        : trial.elapsed <= BURST_AND_COAST.propulsionDuration
          ? "propulsion"
          : trial.elapsed <= BURST_AND_COAST.duration
            ? "coast"
            : "complete";
    if (phase !== "complete" && trial.phases.at(-1) !== phase) {
      trial.phases.push(phase);
    }

    const heading = maneuver?.headingAngle ?? Math.atan2(0, fish.headingFactor);
    const sample: TrialSample = {
      elapsed: trial.elapsed,
      x: fish.x,
      y: fish.baseY,
      speed: fish.speed / bodyLength,
      acceleration: maneuver?.accelerationBodyLengths ?? acceleration,
      jerk: maneuver?.jerkBodyLengths ?? jerk,
      heading: ((heading - trial.startHeading) * 180) / Math.PI,
      curvature: maneuver?.curvature ?? fish.bodyFlexAmount,
      clearance: trial.source
        ? Math.hypot(fish.x - trial.source.x, fish.baseY - trial.source.y) /
          bodyLength
        : null,
      phase,
    };
    trial.samples.push(sample);
    liveSample = sample;
    if (trial.kind === "escape") escapeTrace = [...trial.samples];
    else burstTrace = [...trial.samples];

    trial.previousSpeed = fish.speed;
    trial.previousAcceleration = acceleration;

    const expectedDuration =
      trial.kind === "escape"
        ? ESCAPE_KINEMATICS.totalDuration
        : BURST_AND_COAST.duration;
    if (trial.elapsed >= expectedDuration) finishTrial();
  }

  function finishTrial(): void {
    const trial = activeTrial;
    const fish = selectedFish;
    if (!trial || !fish || trial.samples.length === 0) return;

    const recovery = trial.samples.filter(
      (sample) => sample.phase === "coast" || sample.phase === "stabilize"
    );
    const recoveryMonotonic = recovery.every(
      (sample, index) =>
        index === 0 || sample.speed <= recovery[index - 1]!.speed + 0.015
    );
    const finalSample = trial.samples.at(-1)!;
    const sourceToStart = trial.source
      ? {
          x: trial.startX - trial.source.x,
          y: trial.startY - trial.source.y,
        }
      : null;
    const sourceToEnd = trial.source
      ? {
          x: fish.x - trial.source.x,
          y: fish.baseY - trial.source.y,
        }
      : null;
    const didNotCrossSource =
      sourceToStart && sourceToEnd
        ? sourceToStart.x * sourceToEnd.x + sourceToStart.y * sourceToEnd.y > 0
        : null;
    const result: TrialResult = {
      kind: trial.kind,
      fishId: fish.fishId ?? null,
      duration: trial.elapsed,
      displacement:
        Math.hypot(fish.x - trial.startX, fish.baseY - trial.startY) /
        Math.max(1, fish.bodyLength),
      peakSpeed: Math.max(...trial.samples.map((sample) => sample.speed)),
      peakAcceleration: Math.max(
        ...trial.samples.map((sample) => Math.abs(sample.acceleration))
      ),
      peakJerk: Math.max(
        ...trial.samples.map((sample) => Math.abs(sample.jerk))
      ),
      headingChange: Math.max(
        ...trial.samples.map((sample) => Math.abs(sample.heading))
      ),
      minimumClearance:
        trial.kind === "escape"
          ? Math.min(
              ...trial.samples
                .map((sample) => sample.clearance)
                .filter((value): value is number => value !== null)
            )
          : null,
      phases: [...trial.phases],
      eventEntries: fish.escapeEventCount - trial.startEvents,
      sourceLocked: trial.kind === "escape" ? trial.sourceLocked : null,
      recoveryMonotonic,
      causeStayedDistinct: trial.causeStayedDistinct,
      didNotCrossSource: trial.kind === "escape" ? didNotCrossSource : null,
    };

    if (trial.kind === "escape") {
      escapeResult = result;
      system?.setPointer(0, 0, false);
      status = trialPassed(result)
        ? "Escape captured. One event, locked source, ordered recovery."
        : "Escape captured with a failed gate. Inspect the trace.";
    } else {
      burstResult = result;
      status = trialPassed(result)
        ? "Burst captured. Heading and non-threat state stayed intact."
        : "Burst captured with a failed gate. Inspect the trace.";
    }

    activeTrial = null;
    activeKind = null;
    liveSample = { ...finalSample, phase: "complete" };

    if (result.kind === "escape" && followWithBurst) {
      followWithBurst = false;
      queue(() => beginTrial("burst"), 220);
    }
  }

  function drawTrace(
    context: CanvasRenderingContext2D,
    trace: TrialSample[],
    color: string
  ): void {
    if (trace.length < 2) return;
    context.save();
    context.beginPath();
    context.moveTo(trace[0]!.x, trace[0]!.y);
    for (const sample of trace.slice(1)) context.lineTo(sample.x, sample.y);
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.setLineDash([6, 5]);
    context.globalAlpha = 0.9;
    context.stroke();
    context.restore();
  }

  function drawDiagnostics(context: CanvasRenderingContext2D): void {
    drawTrace(context, escapeTrace, "#ffb86b");
    drawTrace(context, burstTrace, "#66e3ff");
    const fish = selectedFish;
    if (!fish) return;

    context.save();
    const ringRadius = Math.max(22, fish.bodyLength * 0.58);
    context.beginPath();
    context.arc(fish.x, fish.baseY, ringRadius, 0, Math.PI * 2);
    context.strokeStyle = activeKind === "escape" ? "#ffb86b" : "#66e3ff";
    context.lineWidth = 1.5;
    context.setLineDash([4, 5]);
    context.stroke();

    const source =
      activeTrial?.source ??
      (escapeTrace.length > 0 && escapeResult
        ? {
            x:
              escapeTrace[0]!.x -
              Math.max(1, selectedFish.bodyLength) *
                (escapeTrace[0]!.clearance ?? 0),
            y: escapeTrace[0]!.y,
          }
        : null);
    if (source && activeKind === "escape") {
      context.beginPath();
      context.arc(source.x, source.y, 7, 0, Math.PI * 2);
      context.fillStyle = "#ffb86b";
      context.fill();
      context.beginPath();
      context.arc(source.x, source.y, 14, 0, Math.PI * 2);
      context.strokeStyle = "rgba(255, 184, 107, 0.65)";
      context.stroke();
    }
    context.restore();
  }

  onMount(() => {
    if (!canvas || !stage) return;
    const context = canvas.getContext("2d");
    if (!context) {
      status = "Canvas context unavailable";
      return;
    }

    const previousDebug = { ...fishDebugConfig };
    Object.assign(fishDebugConfig, {
      enableFlocking: false,
      enableInteractions: false,
      enableRareBehaviors: false,
      enableHomeZones: false,
      enableHunting: false,
      showHomeZones: false,
      showInteractions: false,
      showHunts: false,
    });

    system = OceanBackgroundOrchestrator.create();
    system.setLayerVisibility({ jellyfish: false, bubbles: false });
    let previousFrame = performance.now();
    let simulationRemainder = 0;
    let fpsAccumulator = 0;
    let fpsFrames = 0;
    let raf = 0;

    function resize(): void {
      if (!canvas || !stage) return;
      const rect = stage.getBoundingClientRect();
      dimensions = {
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
      };
      if (
        canvas.width !== dimensions.width ||
        canvas.height !== dimensions.height
      ) {
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
      }
    }

    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();

    async function boot(): Promise<void> {
      setOceanFishSimulationSeed(SEED);
      await system!.initialize(dimensions, "high", { spawnFishOnScreen: true });
      if (disposed) return;
      selectedFish = chooseTrackedFish(system!.getFish());
      resetTrackedFish();
      ready = selectedFish !== null;
      status = ready
        ? "Same fish selected for both trials"
        : "No fish available for the benchmark";
      if (ready) queue(runPair, 280);
    }

    function animate(now: number): void {
      if (disposed || !system) return;
      const elapsedSeconds = Math.min(
        0.25,
        Math.max(0.001, (now - previousFrame) / 1000)
      );
      previousFrame = now;
      simulationRemainder += elapsedSeconds;
      while (simulationRemainder >= 0.016) {
        animationTime += 0.016;
        system.update(dimensions, 1);
        if (activeTrial) recordTrial(0.016);
        simulationRemainder -= 0.016;
      }
      system.draw(context!, dimensions);
      drawDiagnostics(context!);

      fpsAccumulator += elapsedSeconds;
      fpsFrames += 1;
      if (fpsAccumulator >= 0.5) {
        fps = fpsFrames / fpsAccumulator;
        fpsAccumulator = 0;
        fpsFrames = 0;
      }
      raf = requestAnimationFrame(animate);
    }

    window.__oceanMotionBenchmark = {
      runEscape,
      runBurst,
      runPair,
      getReport: () => ({
        escape: escapeResult,
        burst: burstResult,
        sameFish,
      }),
      getState: () => ({
        trackedPresent:
          selectedFish !== null &&
          (system?.getFish().includes(selectedFish) ?? false),
        behavior: selectedFish?.behavior ?? null,
        behaviorTimer: selectedFish?.behaviorTimer ?? null,
        speed: selectedFish?.speed ?? null,
        fishCount: system?.getFish().length ?? 0,
        activeTrial: activeTrial?.kind ?? null,
      }),
    };

    void boot();
    raf = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      Object.assign(fishDebugConfig, previousDebug);
      system?.cleanup();
      system = null;
      delete window.__oceanMotionBenchmark;
    };
  });
</script>

<svelte:head>
  <title>Ocean Motion Benchmark</title>
</svelte:head>

<main class="benchmark-shell">
  <header class="benchmark-header">
    <div>
      <p class="eyebrow">PHASE II / LOCOMOTION</p>
      <h1>One fish. Two causes.</h1>
      <p class="subtitle">
        Threat escape and voluntary burst, recorded from the production motion
        system.
      </p>
    </div>
    <div class="runtime-readout" aria-label="Benchmark runtime">
      <span class:live={activeKind !== null}></span>
      <strong>{fps.toFixed(0)} fps</strong>
      <small>{selectedFish?.species ?? "loading"}</small>
    </div>
  </header>

  <section class="benchmark-body">
    <div class="stage" bind:this={stage}>
      <canvas bind:this={canvas} aria-label="Tracked production fish motion"
      ></canvas>
      <div class="stage-legend" aria-hidden="true">
        <span class="escape-key">Escape path</span>
        <span class="burst-key">Voluntary path</span>
      </div>
      <div class="stage-caption">
        <span
          >{activeKind
            ? `${labelPhase(liveSample?.phase)} phase`
            : "Trial complete"}</span
        >
        <strong>{format(liveSample?.elapsed, 3)} s</strong>
      </div>
    </div>

    <aside class="instrument-panel">
      <section class="control-block">
        <div class="section-heading">
          <div>
            <p class="eyebrow">CONTROLLED TRIALS</p>
            <h2>Run the motion, not the render</h2>
          </div>
          <span class="fish-id">fish {selectedFish?.fishId ?? "—"}</span>
        </div>
        <div class="trial-actions">
          <button
            class="escape-action"
            type="button"
            onclick={runEscape}
            disabled={!ready || activeKind !== null}>Threat escape</button
          >
          <button
            class="burst-action"
            type="button"
            onclick={runBurst}
            disabled={!ready || activeKind !== null}>Voluntary burst</button
          >
          <button
            class="pair-action"
            type="button"
            onclick={runPair}
            disabled={!ready || activeKind !== null}>Run pair</button
          >
        </div>
        <p class="status" aria-live="polite">{status}</p>
      </section>

      <section class="phase-block">
        <div class="section-heading compact">
          <div>
            <p class="eyebrow">ESCAPE CLOCK</p>
            <h2>470 ms fast-start</h2>
          </div>
          <strong class="phase-now">{labelPhase(liveSample?.phase)}</strong>
        </div>
        <div class="phase-track">
          {#each ESCAPE_PHASES as phase}
            <div
              class:active={liveSample?.phase === phase.phase &&
                activeKind === "escape"}
              style={`flex-grow: ${phase.duration}`}
            >
              <span>{phase.phase}</span>
              <small>{Math.round(phase.duration * 1000)} ms</small>
            </div>
          {/each}
        </div>
      </section>

      <section class="plot-block">
        <div class="section-heading compact">
          <div>
            <p class="eyebrow">SPEED TRACE</p>
            <h2>Body lengths per second</h2>
          </div>
          <strong>{format(liveSample?.speed)}</strong>
        </div>
        <svg
          class="speed-plot"
          viewBox="0 0 420 132"
          role="img"
          aria-label="Escape and voluntary burst speed curves"
        >
          <line x1="0" y1="116" x2="420" y2="116"></line>
          <line x1="0" y1="58" x2="420" y2="58"></line>
          {#if escapeTrace.length > 1}
            <polyline class="escape-line" points={speedPoints(escapeTrace)}
            ></polyline>
          {/if}
          {#if burstTrace.length > 1}
            <polyline class="burst-line" points={speedPoints(burstTrace)}
            ></polyline>
          {/if}
          <text x="0" y="130">0 ms</text>
          <text x="380" y="130">470 ms</text>
        </svg>
      </section>

      <section class="metrics-block">
        <article class:passed={trialPassed(escapeResult)}>
          <div class="metric-title">
            <span class="escape-dot"></span>
            <strong>Threat escape</strong>
            <em
              >{escapeResult
                ? trialPassed(escapeResult)
                  ? "PASS"
                  : "CHECK"
                : "WAIT"}</em
            >
          </div>
          <dl>
            <div>
              <dt>Peak speed</dt>
              <dd>{format(escapeResult?.peakSpeed)} BL/s</dd>
            </div>
            <div>
              <dt>Displacement</dt>
              <dd>{format(escapeResult?.displacement)} BL</dd>
            </div>
            <div>
              <dt>Event entries</dt>
              <dd>{escapeResult?.eventEntries ?? "—"}</dd>
            </div>
            <div>
              <dt>Source locked</dt>
              <dd>
                {escapeResult
                  ? escapeResult.sourceLocked
                    ? "yes"
                    : "no"
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Recovery</dt>
              <dd>
                {escapeResult
                  ? escapeResult.recoveryMonotonic
                    ? "decelerates"
                    : "accelerates"
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Peak jerk</dt>
              <dd>{format(escapeResult?.peakJerk, 0)} BL/s³</dd>
            </div>
          </dl>
        </article>

        <article class:passed={trialPassed(burstResult)}>
          <div class="metric-title">
            <span class="burst-dot"></span>
            <strong>Voluntary burst</strong>
            <em
              >{burstResult
                ? trialPassed(burstResult)
                  ? "PASS"
                  : "CHECK"
                : "WAIT"}</em
            >
          </div>
          <dl>
            <div>
              <dt>Peak speed</dt>
              <dd>{format(burstResult?.peakSpeed)} BL/s</dd>
            </div>
            <div>
              <dt>Displacement</dt>
              <dd>{format(burstResult?.displacement)} BL</dd>
            </div>
            <div>
              <dt>Escape entries</dt>
              <dd>{burstResult?.eventEntries ?? "—"}</dd>
            </div>
            <div>
              <dt>Threat state</dt>
              <dd>
                {burstResult
                  ? burstResult.causeStayedDistinct
                    ? "none"
                    : "entered"
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Heading drift</dt>
              <dd>{format(burstResult?.headingChange)}°</dd>
            </div>
            <div>
              <dt>Peak acceleration</dt>
              <dd>{format(burstResult?.peakAcceleration)} BL/s²</dd>
            </div>
          </dl>
        </article>
      </section>

      <footer
        class="pair-verdict"
        class:passed={sameFish === true &&
          trialPassed(escapeResult) &&
          trialPassed(burstResult)}
      >
        <span
          >{sameFish === null
            ? "PAIR PENDING"
            : sameFish
              ? "SAME FISH CONFIRMED"
              : "FISH ID MISMATCH"}</span
        >
        <strong>Visual tuning untouched</strong>
      </footer>
    </aside>
  </section>
</main>

<style>
  :global(html) {
    background: #03101a;
  }

  :global(body) {
    margin: 0;
    min-width: 320px;
    overflow: hidden;
    background: #03101a;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .benchmark-shell {
    --surface-deep: #03101a;
    --surface-panel: rgba(6, 24, 36, 0.96);
    --surface-raised: rgba(10, 37, 53, 0.88);
    --line-subtle: rgba(135, 197, 221, 0.17);
    --line-strong: rgba(135, 197, 221, 0.34);
    --text-primary: #ecf9ff;
    --text-secondary: #91b8c8;
    --escape: #ffb86b;
    --burst: #66e3ff;
    --pass: #70e4b0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: 100vw;
    height: 100vh;
    color: var(--text-primary);
    background:
      radial-gradient(
        circle at 68% 6%,
        rgba(52, 149, 184, 0.14),
        transparent 32rem
      ),
      var(--surface-deep);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }

  .benchmark-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    padding: clamp(1rem, 1.5vw, 1.65rem) clamp(1rem, 2vw, 2.4rem);
    border-bottom: 1px solid var(--line-subtle);
    background: rgba(3, 16, 26, 0.92);
  }

  .eyebrow {
    margin: 0 0 0.35rem;
    color: #6f9eb2;
    font:
      700 0.68rem/1 ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
    letter-spacing: 0.16em;
  }

  h1,
  h2,
  p {
    margin-top: 0;
  }

  h1 {
    margin-bottom: 0.25rem;
    font-size: clamp(1.45rem, 2.2vw, 2.4rem);
    line-height: 1.05;
    letter-spacing: -0.035em;
  }

  h2 {
    margin-bottom: 0;
    font-size: clamp(0.98rem, 1.15vw, 1.2rem);
    line-height: 1.15;
    letter-spacing: -0.018em;
  }

  .subtitle {
    margin-bottom: 0;
    color: var(--text-secondary);
    font-size: clamp(0.78rem, 0.85vw, 0.95rem);
  }

  .runtime-readout {
    display: grid;
    grid-template-columns: auto auto;
    align-items: center;
    gap: 0.1rem 0.55rem;
    min-width: max-content;
    color: var(--text-secondary);
    text-align: right;
  }

  .runtime-readout span {
    grid-row: 1 / 3;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: #496978;
    box-shadow: 0 0 0 5px rgba(73, 105, 120, 0.12);
  }

  .runtime-readout span.live {
    background: var(--pass);
    box-shadow: 0 0 0 5px rgba(112, 228, 176, 0.12);
  }

  .runtime-readout strong {
    color: var(--text-primary);
    font-size: 0.88rem;
  }

  .runtime-readout small {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .benchmark-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) clamp(23rem, 29vw, 34rem);
    min-height: 0;
  }

  .stage {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border-right: 1px solid var(--line-subtle);
    background: #061a29;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .stage-legend,
  .stage-caption {
    position: absolute;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 1rem;
    border: 1px solid rgba(167, 219, 238, 0.18);
    border-radius: 999px;
    background: rgba(3, 16, 26, 0.78);
    box-shadow: 0 0.4rem 1.5rem rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(10px);
  }

  .stage-legend {
    top: 1rem;
    left: 1rem;
    padding: 0.55rem 0.8rem;
    color: var(--text-secondary);
    font:
      600 0.68rem/1 ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .stage-legend span::before {
    content: "";
    display: inline-block;
    width: 1rem;
    margin-right: 0.4rem;
    border-top: 2px dashed currentColor;
    vertical-align: middle;
  }

  .escape-key {
    color: var(--escape);
  }

  .burst-key {
    color: var(--burst);
  }

  .stage-caption {
    right: 1rem;
    bottom: 1rem;
    justify-content: space-between;
    min-width: 13rem;
    padding: 0.65rem 0.85rem;
    color: var(--text-secondary);
    font-size: 0.74rem;
  }

  .stage-caption strong {
    color: var(--text-primary);
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .instrument-panel {
    display: grid;
    grid-template-rows: auto auto minmax(11rem, 1fr) auto auto;
    min-height: 0;
    overflow-y: auto;
    background: var(--surface-panel);
    scrollbar-color: #1b536c transparent;
  }

  .instrument-panel > section,
  .pair-verdict {
    padding: clamp(0.9rem, 1.15vw, 1.35rem);
    border-bottom: 1px solid var(--line-subtle);
  }

  .section-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.9rem;
  }

  .section-heading.compact {
    align-items: end;
    margin-bottom: 0.75rem;
  }

  .fish-id,
  .phase-now {
    color: var(--text-secondary);
    font:
      700 0.66rem/1 ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .trial-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.55rem;
  }

  button {
    min-height: 2.85rem;
    border: 1px solid var(--line-strong);
    border-radius: 0.7rem;
    color: var(--text-primary);
    background: var(--surface-raised);
    font:
      700 0.78rem/1 ui-sans-serif,
      system-ui,
      sans-serif;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    border-color: rgba(210, 240, 251, 0.58);
    background: rgba(16, 54, 75, 0.96);
  }

  button:focus-visible {
    outline: 2px solid var(--burst);
    outline-offset: 2px;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.42;
  }

  .escape-action {
    border-color: rgba(255, 184, 107, 0.45);
  }

  .burst-action {
    border-color: rgba(102, 227, 255, 0.45);
  }

  .pair-action {
    grid-column: 1 / -1;
    min-height: 2.75rem;
    color: var(--text-secondary);
  }

  .status {
    min-height: 1.25rem;
    margin: 0.65rem 0 0;
    color: var(--text-secondary);
    font-size: 0.72rem;
  }

  .phase-track {
    display: flex;
    min-height: 3.6rem;
    overflow: hidden;
    border: 1px solid var(--line-subtle);
    border-radius: 0.65rem;
  }

  .phase-track div {
    display: flex;
    flex-basis: 0;
    flex-direction: column;
    justify-content: center;
    min-width: 2.2rem;
    padding: 0.45rem 0.35rem;
    border-right: 1px solid var(--line-subtle);
    color: #6f9eb2;
    background: rgba(5, 25, 38, 0.7);
    text-align: center;
  }

  .phase-track div:last-child {
    border-right: 0;
  }

  .phase-track div.active {
    color: #1d1308;
    background: var(--escape);
  }

  .phase-track span {
    overflow: hidden;
    font:
      700 0.59rem/1 ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
    text-overflow: ellipsis;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .phase-track small {
    margin-top: 0.3rem;
    font-size: 0.56rem;
    opacity: 0.74;
  }

  .speed-plot {
    display: block;
    flex: 1;
    width: 100%;
    height: clamp(6.2rem, 10vh, 8.25rem);
    max-height: 22rem;
    margin-block: auto;
    overflow: visible;
  }

  .plot-block {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .speed-plot line {
    stroke: rgba(135, 197, 221, 0.13);
    stroke-width: 1;
  }

  .speed-plot polyline {
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .escape-line {
    stroke: var(--escape);
  }

  .burst-line {
    stroke: var(--burst);
  }

  .speed-plot text {
    fill: #6f9eb2;
    font:
      9px ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
  }

  .metrics-block {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
  }

  .metrics-block article {
    min-width: 0;
    padding: 0.75rem;
    border: 1px solid var(--line-subtle);
    border-radius: 0.75rem;
    background: rgba(7, 29, 43, 0.72);
  }

  .metrics-block article.passed {
    border-color: rgba(112, 228, 176, 0.35);
  }

  .metric-title {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.45rem;
    padding-bottom: 0.6rem;
    border-bottom: 1px solid var(--line-subtle);
    font-size: 0.7rem;
  }

  .metric-title span {
    width: 0.48rem;
    height: 0.48rem;
    border-radius: 50%;
  }

  .escape-dot {
    background: var(--escape);
  }

  .burst-dot {
    background: var(--burst);
  }

  .metric-title em {
    color: #6f9eb2;
    font:
      700 0.57rem/1 ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
    font-style: normal;
    letter-spacing: 0.08em;
  }

  article.passed .metric-title em {
    color: var(--pass);
  }

  dl {
    margin: 0.55rem 0 0;
  }

  dl div {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.22rem 0;
    font-size: 0.64rem;
  }

  dt {
    color: var(--text-secondary);
  }

  dd {
    margin: 0;
    color: var(--text-primary);
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    text-align: right;
  }

  .pair-verdict {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    color: #6f9eb2;
    font:
      700 0.62rem/1 ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
    letter-spacing: 0.08em;
  }

  .pair-verdict.passed span {
    color: var(--pass);
  }

  .pair-verdict strong {
    color: var(--text-secondary);
    font-weight: 600;
  }

  @media (min-width: 2200px) {
    .benchmark-body {
      grid-template-columns: minmax(0, 1fr) clamp(32rem, 24vw, 52rem);
    }

    .instrument-panel > section,
    .pair-verdict {
      padding: 1.55rem;
    }

    button {
      min-height: 3.2rem;
      font-size: 0.86rem;
    }

    .status,
    dl div {
      font-size: 0.76rem;
    }

    .metric-title,
    .pair-verdict {
      font-size: 0.7rem;
    }
  }

  @media (min-width: 3000px) {
    h1 {
      font-size: 3.2rem;
    }

    h2 {
      font-size: 1.6rem;
    }

    .subtitle {
      font-size: 1.05rem;
    }

    .eyebrow {
      font-size: 0.76rem;
    }

    .instrument-panel > section,
    .pair-verdict {
      padding: 2.1rem;
    }

    button {
      min-height: 3.8rem;
      font-size: 1.05rem;
    }

    .status,
    dl div {
      font-size: 0.9rem;
    }

    .metric-title,
    .pair-verdict {
      font-size: 0.84rem;
    }

    .phase-track span {
      font-size: 0.68rem;
    }

    .speed-plot {
      max-height: 32rem;
    }
  }

  @media (max-width: 900px) and (min-height: 560px) {
    :global(body) {
      overflow: auto;
    }

    .benchmark-shell {
      height: auto;
      min-height: 100vh;
    }

    .benchmark-body {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(22rem, 52vh) auto;
    }

    .stage {
      border-right: 0;
      border-bottom: 1px solid var(--line-subtle);
    }

    .instrument-panel {
      display: block;
      overflow: visible;
    }
  }

  @media (max-height: 950px) and (min-width: 901px) {
    .instrument-panel {
      grid-template-rows: auto auto minmax(8rem, 1fr) auto auto;
    }

    .instrument-panel > section,
    .pair-verdict {
      padding: 0.72rem 1rem;
    }

    .speed-plot {
      min-height: 5.5rem;
    }
  }

  @media (max-width: 560px) {
    .benchmark-header {
      align-items: flex-end;
      padding: 0.85rem;
    }

    .subtitle {
      display: none;
    }

    .benchmark-body {
      grid-template-rows: minmax(18rem, 44vh) auto;
    }

    .stage-legend {
      top: 0.6rem;
      left: 0.6rem;
      gap: 0.65rem;
      padding: 0.45rem 0.55rem;
      font-size: 0.56rem;
    }

    .stage-caption {
      right: 0.6rem;
      bottom: 0.6rem;
      min-width: 10.5rem;
      padding: 0.55rem 0.65rem;
    }

    .metrics-block {
      grid-template-columns: 1fr;
    }

    .pair-verdict {
      flex-direction: column;
      gap: 0.35rem;
    }
  }

  @media (max-height: 520px) and (min-width: 700px) {
    .benchmark-header {
      padding: 0.65rem 1rem;
    }

    .benchmark-header .subtitle {
      display: none;
    }

    .benchmark-body {
      grid-template-columns: minmax(0, 1fr) minmax(18rem, 33vw);
      grid-template-rows: minmax(0, 1fr);
    }

    .instrument-panel > section,
    .pair-verdict {
      padding: 0.7rem;
    }

    .metrics-block {
      grid-template-columns: 1fr;
    }

    .speed-plot {
      height: 5.5rem;
    }
  }
</style>
