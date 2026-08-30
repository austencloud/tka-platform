<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount, tick } from "svelte";
  import { loopDetector } from "$lib/features/create/generate/circular/services/loop-detector";
  import { resolveLoopDisplay } from "$lib/features/loop-labeler/services/loop-display-resolver";
  import { initializeAppServices } from "$lib/shared/application/state/services.svelte";
  import { registerLibraryRepository } from "$lib/shared/composition-root/register-library-repository";
  import { registerLoopDetector } from "$lib/shared/create/get-loop-detector";
  import { registerLoopDisplayResolver } from "$lib/shared/loop-labeler/get-loop-display-resolver";
  import SequenceViewerOrchestrator from "$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte";
  import SequenceViewerShell from "$lib/shared/sequence-viewer/components/SequenceViewerShell.svelte";
  import {
    motionDuration,
    reducedMotion,
  } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import {
    VIEWER_MODE_DISSOLVE_CLASS,
    VIEWER_MODE_DISSOLVE_DURATION,
  } from "$lib/shared/transitions/viewer-mode-dissolve";
  import { TRANSITION_REVIEW_SEQUENCE } from "../transition-review-fixture";
  import type {
    TransitionGeometrySample,
    TransitionGeometryTrace,
    TransitionTraceCommand,
    TransitionTracePhase,
  } from "../transition-geometry-trace";

  type ReplayCommand = TransitionTraceCommand;

  interface ReplayMessage {
    source: "sequence-viewer-transition-review";
    action: "replay";
    command: ReplayCommand;
  }

  interface MotionMessage {
    source: "sequence-viewer-transition-review";
    action: "motion";
    preference: "full" | "reduce";
  }

  type ReviewMessage = ReplayMessage | MotionMessage;

  if (browser) {
    registerLibraryRepository();
    registerLoopDetector(loopDetector);
    registerLoopDisplayResolver(resolveLoopDisplay);
  }

  let isMobile = $state(browser && window.innerWidth < 768);
  let replayVersion = 0;
  let metricsFrame = 0;
  let traceFrame = 0;
  let activeTrace: TransitionGeometryTrace | null = null;
  let traceStartedAt = 0;
  let tracePhase: TransitionTracePhase = "focus-2d";

  function report(
    status: "ready" | "running" | "complete" | "error",
    command?: ReplayCommand,
    detail?: string
  ): void {
    if (window.parent === window) return;
    window.parent.postMessage(
      {
        source: "sequence-viewer-transition-frame",
        status,
        command,
        detail,
      },
      window.location.origin
    );
  }

  function wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function reportMetrics(): void {
    if (window.parent === window) return;
    const scrollingElement =
      document.scrollingElement ?? document.documentElement;
    const splitView = document.querySelector<HTMLElement>(".split-view");

    window.parent.postMessage(
      {
        source: "sequence-viewer-transition-frame",
        status: "metrics",
        metrics: {
          viewportWidth: document.documentElement.clientWidth,
          viewportHeight: document.documentElement.clientHeight,
          overflowX:
            scrollingElement.scrollWidth >
            document.documentElement.clientWidth + 1,
          overflowY:
            scrollingElement.scrollHeight >
            document.documentElement.clientHeight + 1,
          panelDirection: splitView?.dataset.panelDirection ?? null,
          outerPanelCount: document.querySelectorAll(
            ".viewer-and-export > .panel-group > .panel-wrapper"
          ).length,
          reducedMotion: reducedMotion(),
        },
      },
      window.location.origin
    );
  }

  function scheduleMetrics(): void {
    cancelAnimationFrame(metricsFrame);
    metricsFrame = requestAnimationFrame(() => {
      metricsFrame = requestAnimationFrame(reportMetrics);
    });
  }

  function elementSize(
    selector: string,
    direction: "horizontal" | "vertical"
  ): number {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return 0;
    const bounds = element.getBoundingClientRect();
    return direction === "horizontal" ? bounds.width : bounds.height;
  }

  function elementOpacity(selector: string): number {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return 0;
    return Number.parseFloat(getComputedStyle(element).opacity) || 0;
  }

  function elementBounds(selector: string): {
    width: number;
    height: number;
    left: number;
    top: number;
  } {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return { width: 0, height: 0, left: 0, top: 0 };
    const bounds = element.getBoundingClientRect();
    return {
      width: bounds.width,
      height: bounds.height,
      left: bounds.left,
      top: bounds.top,
    };
  }

  function elementFlexGrow(selector: string): number {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return 0;
    return Number.parseFloat(getComputedStyle(element).flexGrow) || 0;
  }

  function transformedElementCount(selector: string): number {
    let count = 0;
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const transform = getComputedStyle(element).transform;
      if (transform === "none") continue;
      try {
        const matrix = new DOMMatrixReadOnly(transform);
        const visuallyMoved =
          Math.abs(matrix.m41) > 0.5 ||
          Math.abs(matrix.m42) > 0.5 ||
          Math.abs(matrix.m11 - 1) > 0.005 ||
          Math.abs(matrix.m12) > 0.005 ||
          Math.abs(matrix.m21) > 0.005 ||
          Math.abs(matrix.m22 - 1) > 0.005;
        if (visuallyMoved) count += 1;
      } catch {
        count += 1;
      }
    }
    return count;
  }

  function elementDataFlag(selector: string, name: string): boolean {
    const element = document.querySelector<HTMLElement>(selector);
    return element?.dataset[name] === "true";
  }

  function elementDataNumber(selector: string, name: string): number {
    const element = document.querySelector<HTMLElement>(selector);
    const value = Number(element?.dataset[name]);
    return Number.isFinite(value) ? value : 0;
  }

  function selectedViewerMode(): "split" | "animation" | "card" | null {
    const labels = {
      "Side by Side": "split",
      "2D Animation": "animation",
      Card: "card",
    } as const;
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      "button[aria-label]"
    )) {
      const label = button.getAttribute("aria-label");
      const selected =
        button.getAttribute("aria-pressed") === "true" ||
        button.classList.contains("active");
      if (selected && label && label in labels) {
        return labels[label as keyof typeof labels];
      }
    }
    return null;
  }

  function expectedViewerMode(
    label: "Side by Side" | "2D Animation" | "Card"
  ): "split" | "animation" | "card" {
    if (label === "Side by Side") return "split";
    if (label === "2D Animation") return "animation";
    return "card";
  }

  async function waitForModeCommit(
    label: "Side by Side" | "2D Animation" | "Card",
    version: number
  ): Promise<number> {
    const expected = expectedViewerMode(label);
    const startedAt = performance.now();
    while (version === replayVersion && selectedViewerMode() !== expected) {
      if (performance.now() - startedAt > DURATION.dramatic * 3) {
        throw new Error(`${label} did not commit within the motion gate.`);
      }
      await wait(16);
    }
    return Math.round((performance.now() - startedAt) * 10) / 10;
  }

  function captureGeometrySample(): void {
    if (!activeTrace) return;
    const splitView = document.querySelector<HTMLElement>(".split-view");
    const direction =
      splitView?.dataset.panelDirection === "vertical"
        ? "vertical"
        : "horizontal";
    const outerPanelGroup = document.querySelector<HTMLElement>(
      ".viewer-and-export > .panel-group"
    );

    const cardPanel = elementBounds(".preview-column");
    const cardRoot = elementBounds(".preview-column .choreo-card-root");
    const cardContent = elementBounds(".preview-column .preview-stack");
    const cardSettings = elementBounds(
      ".export-panel:not(.inline) .panel-center-inner"
    );
    const mandalaCanvas = document.querySelector<HTMLCanvasElement>(
      '.animation-column canvas[data-animation-layer="mandala"]'
    );
    const mandalaBounds = mandalaCanvas?.getBoundingClientRect();
    const mandalaBackingSize = mandalaCanvas
      ? Math.min(mandalaCanvas.width, mandalaCanvas.height) /
        Math.max(1, window.devicePixelRatio || 1)
      : 0;
    const mandalaDisplaySize = mandalaBounds
      ? Math.min(mandalaBounds.width, mandalaBounds.height)
      : 0;
    const sample: TransitionGeometrySample = {
      time: Math.round((performance.now() - traceStartedAt) * 10) / 10,
      phase: tracePhase,
      direction,
      focusedPane: splitView?.dataset.focused || null,
      selectedMode: selectedViewerMode(),
      outerDirection: outerPanelGroup?.classList.contains("vertical")
        ? "vertical"
        : "horizontal",
      stageSize: elementSize('[data-panel-id="viewer-stage"]', direction),
      stageFlexGrow: elementFlexGrow('[data-panel-id="viewer-stage"]'),
      animationSize: elementSize('[data-panel-id="animation"]', direction),
      animationFlexGrow: elementFlexGrow('[data-panel-id="animation"]'),
      animationHidden: elementDataFlag(
        ".split-column.animation-column",
        "hidden"
      ),
      animationReadable: elementDataFlag(
        ".split-column.animation-column",
        "readable"
      ),
      mandalaBackingSize,
      mandalaDisplaySize,
      mandalaRasterScale:
        mandalaBackingSize > 0 ? mandalaDisplaySize / mandalaBackingSize : 0,
      cardSize: elementSize('[data-panel-id="preview"]', direction),
      cardFlexGrow: elementFlexGrow('[data-panel-id="preview"]'),
      cardHidden: elementDataFlag(".split-column.preview-column", "hidden"),
      cardReadable: elementDataFlag(".split-column.preview-column", "readable"),
      cardPanelWidth: cardPanel.width,
      cardPanelHeight: cardPanel.height,
      cardPanelCenterX: cardPanel.left + cardPanel.width / 2,
      cardPanelCenterY: cardPanel.top + cardPanel.height / 2,
      cardRootWidth: cardRoot.width,
      cardRootHeight: cardRoot.height,
      cardRootCenterY: cardRoot.top + cardRoot.height / 2,
      cardContentWidth: cardContent.width,
      cardContentHeight: cardContent.height,
      cardContentCenterX: cardContent.left + cardContent.width / 2,
      cardContentCenterY: cardContent.top + cardContent.height / 2,
      cardTransformedCellCount: transformedElementCount(
        ".preview-column .cell-flip-wrapper"
      ),
      cardColumns: elementDataNumber(
        ".preview-column .choreo-card-root",
        "layoutColumns"
      ),
      cardRows: elementDataNumber(
        ".preview-column .choreo-card-root",
        "layoutRows"
      ),
      cardAutoLayoutLocked: elementDataFlag(
        ".preview-column .choreo-card-root",
        "autoLayoutLocked"
      ),
      cardAutoLayoutLockColumns: elementDataNumber(
        ".preview-column .choreo-card-root",
        "autoLayoutLockColumns"
      ),
      cardAutoLayoutLockRows: elementDataNumber(
        ".preview-column .choreo-card-root",
        "autoLayoutLockRows"
      ),
      inspectorSize: elementSize(
        '[data-panel-id="export-inspector"]',
        direction
      ),
      inspectorFlexGrow: elementFlexGrow('[data-panel-id="export-inspector"]'),
      cardSettingsWidth: cardSettings.width,
      cardSettingsHeight: cardSettings.height,
      cardSettingsCenterY: cardSettings.top + cardSettings.height / 2,
      cardSettingsOpacity: elementOpacity(".export-panel:not(.inline)"),
      dissolveActive: document.documentElement.classList.contains(
        VIEWER_MODE_DISSOLVE_CLASS
      ),
      animationOpacity: elementOpacity(".split-column.animation-column"),
      cardOpacity: elementOpacity(".split-column.preview-column"),
    };
    activeTrace.samples.push(sample);
    traceFrame = requestAnimationFrame(captureGeometrySample);
  }

  function beginGeometryTrace(
    command: ReplayCommand,
    phase: TransitionTracePhase
  ): void {
    cancelAnimationFrame(traceFrame);
    tracePhase = phase;
    traceStartedAt = performance.now();
    activeTrace = { command, duration: 0, samples: [], modeCommits: [] };
    captureGeometrySample();
  }

  function setTracePhase(phase: TransitionTracePhase): void {
    tracePhase = phase;
  }

  function finishGeometryTrace(): void {
    if (!activeTrace) return;
    cancelAnimationFrame(traceFrame);
    captureGeometrySample();
    cancelAnimationFrame(traceFrame);
    activeTrace.duration =
      Math.round((performance.now() - traceStartedAt) * 10) / 10;
    window.parent.postMessage(
      {
        source: "sequence-viewer-transition-frame",
        status: "trace",
        trace: activeTrace,
      },
      window.location.origin
    );
    activeTrace = null;
  }

  function applyMotionPreference(preference: "full" | "reduce"): void {
    if (preference === "reduce") {
      document.documentElement.dataset.motionPreference = "reduce";
    } else {
      delete document.documentElement.dataset.motionPreference;
    }
    scheduleMetrics();
  }

  function modeButton(label: string): HTMLButtonElement | undefined {
    return Array.from(
      document.querySelectorAll<HTMLButtonElement>("button[aria-label]")
    ).find((button) => button.getAttribute("aria-label") === label);
  }

  async function chooseMode(
    label: "Side by Side" | "2D Animation" | "Card",
    version: number,
    settle = true
  ): Promise<boolean> {
    if (version !== replayVersion) return false;
    const button = modeButton(label);
    if (!button) throw new Error(`${label} is not available in this viewport.`);

    button.click();
    await tick();
    const commitLatency = await waitForModeCommit(label, version);
    activeTrace?.modeCommits.push({
      mode: expectedViewerMode(label),
      latency: commitLatency,
    });
    await wait(
      settle
        ? reducedMotion()
          ? VIEWER_MODE_DISSOLVE_DURATION + 90
          : motionDuration(DURATION.emphasis) + 90
        : motionDuration(DURATION.emphasis * 0.38) + 30
    );
    scheduleMetrics();
    return version === replayVersion;
  }

  async function runReplay(command: ReplayCommand): Promise<void> {
    const version = ++replayVersion;
    const startedAt = performance.now();
    report("running", command);

    try {
      if (!(await chooseMode("Side by Side", version))) return;

      if (command === "2d") {
        beginGeometryTrace(command, "focus-2d");
        if (!(await chooseMode("2D Animation", version))) return;
        setTracePhase("return-split");
        if (!(await chooseMode("Side by Side", version))) return;
      } else if (command === "card") {
        beginGeometryTrace(command, "focus-card");
        if (!(await chooseMode("Card", version))) return;
        setTracePhase("return-split");
        if (!(await chooseMode("Side by Side", version))) return;
      } else {
        beginGeometryTrace(command, "interrupt-2d");
        if (!(await chooseMode("2D Animation", version, false))) return;
        setTracePhase("interrupt-split");
        if (!(await chooseMode("Side by Side", version, false))) return;
        setTracePhase("interrupt-card");
        if (!(await chooseMode("Card", version, false))) return;
        setTracePhase("interrupt-return");
        if (!(await chooseMode("Side by Side", version))) return;
      }

      const elapsed = Math.round(performance.now() - startedAt);
      report(
        "complete",
        command,
        `Round trip complete in ${elapsed} ms${reducedMotion() ? " · reduced motion" : ""}.`
      );
      scheduleMetrics();
    } catch (error) {
      report(
        "error",
        command,
        error instanceof Error ? error.message : "Replay failed."
      );
    } finally {
      finishGeometryTrace();
    }
  }

  function isReviewMessage(value: unknown): value is ReviewMessage {
    if (!value || typeof value !== "object") return false;
    const message = value as Partial<ReviewMessage>;
    return (
      message.source === "sequence-viewer-transition-review" &&
      ((message.action === "replay" &&
        (message.command === "2d" ||
          message.command === "card" ||
          message.command === "interrupt")) ||
        (message.action === "motion" &&
          (message.preference === "full" || message.preference === "reduce")))
    );
  }

  onMount(() => {
    document.getElementById("app-loading")?.remove();
    void initializeAppServices();

    const updateMobile = () => (isMobile = window.innerWidth < 768);
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        event.source !== window.parent ||
        event.origin !== window.location.origin ||
        !isReviewMessage(event.data)
      ) {
        return;
      }
      if (event.data.action === "replay") {
        void runReplay(event.data.command);
      } else {
        applyMotionPreference(event.data.preference);
      }
    };

    updateMobile();
    applyMotionPreference("full");
    window.addEventListener("resize", updateMobile);
    window.addEventListener("message", handleMessage);
    const resizeObserver = new ResizeObserver(scheduleMetrics);
    resizeObserver.observe(document.documentElement);
    report("ready");
    scheduleMetrics();

    return () => {
      replayVersion += 1;
      cancelAnimationFrame(metricsFrame);
      cancelAnimationFrame(traceFrame);
      resizeObserver.disconnect();
      delete document.documentElement.dataset.motionPreference;
      window.removeEventListener("resize", updateMobile);
      window.removeEventListener("message", handleMessage);
    };
  });
</script>

<main class="transition-review-frame">
  <SequenceViewerOrchestrator
    sequence={TRANSITION_REVIEW_SEQUENCE}
    {isMobile}
    forceGuest
    initialViewMode="split"
    initialViewerMode="split"
    initialBpm={84}
    onClose={() => {}}
  >
    {#snippet children(ctx)}
      <SequenceViewerShell
        {ctx}
        sequence={TRANSITION_REVIEW_SEQUENCE}
        {isMobile}
        onClose={() => {}}
        startInSplit
        embedded
      />
    {/snippet}
  </SequenceViewerOrchestrator>
</main>

<style>
  :global(html),
  :global(body) {
    margin: 0;
    min-height: 100%;
    overflow: hidden;
    background: var(--theme-bg, #090b11);
  }

  .transition-review-frame {
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background: var(--theme-bg, #090b11);
    color: var(--theme-text, #f7f8fb);
  }
</style>
