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
  type ReviewModeLabel =
    "Side by Side" | "2D Animation" | "3D Animation" | "Card" | "Tunnel";
  type ReviewMode = "split" | "animation" | "animation-3d" | "card" | "tunnel";

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
  let nextElementIdentity = 1;
  const elementIdentities = new WeakMap<Element, number>();

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

  function elementIdentity(selector: string): number {
    const element = document.querySelector(selector);
    if (!element) return 0;
    const existing = elementIdentities.get(element);
    if (existing) return existing;
    const identity = nextElementIdentity++;
    elementIdentities.set(element, identity);
    return identity;
  }

  function selectedViewerMode(): ReviewMode | null {
    const labels = {
      "Side by Side": "split",
      "2D Animation": "animation",
      "3D Animation": "animation-3d",
      Card: "card",
      Tunnel: "tunnel",
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

  function expectedViewerMode(label: ReviewModeLabel): ReviewMode {
    if (label === "Side by Side") return "split";
    if (label === "2D Animation") return "animation";
    if (label === "3D Animation") return "animation-3d";
    if (label === "Tunnel") return "tunnel";
    return "card";
  }

  async function waitForModeCommit(
    label: ReviewModeLabel,
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

  async function waitForMotionPresentation(
    surface: "2d" | "3d",
    version: number
  ): Promise<boolean> {
    const startedAt = performance.now();
    const selector = `[data-motion-surface="${surface}"][data-presented="true"]`;
    while (
      version === replayVersion &&
      !document.querySelector<HTMLElement>(selector)
    ) {
      if (performance.now() - startedAt > 20_000) {
        throw new Error(
          `${surface.toUpperCase()} did not present a ready frame.`
        );
      }
      await wait(16);
    }
    return version === replayVersion;
  }

  function tunnelSurface(): HTMLElement | null {
    return document.querySelector<HTMLElement>(
      '[data-persistent-animator][data-renderer-mode="tunnel"]'
    );
  }

  function tunnelCanvas(): HTMLCanvasElement | null {
    return document.querySelector<HTMLCanvasElement>(
      '[data-persistent-animator] canvas[data-animation-layer="mandala"]'
    );
  }

  async function waitForTunnelPresentation(version: number): Promise<boolean> {
    const startedAt = performance.now();
    while (version === replayVersion) {
      const surface = tunnelSurface();
      const canvas = tunnelCanvas();
      const ready = canvas !== null && canvas.width > 0 && canvas.height > 0;
      if (surface && ready && Number(surface.dataset.tunnelBlend) >= 0.95) {
        return true;
      }
      if (performance.now() - startedAt > 20_000) {
        throw new Error("Tunnel did not present a ready canvas.");
      }
      await wait(16);
    }
    return false;
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
    const activeTunnelSurface = tunnelSurface();
    const activeTunnelCanvas = tunnelCanvas();
    const persistentAnimator = document.querySelector<HTMLElement>(
      "[data-persistent-animator]"
    );
    const tunnelBlend = Number(persistentAnimator?.dataset.tunnelBlend) || 0;
    const tunnelBounds = activeTunnelCanvas?.getBoundingClientRect();
    const tunnelCanvasReady = Boolean(
      activeTunnelCanvas &&
      activeTunnelCanvas.width > 0 &&
      activeTunnelCanvas.height > 0
    );
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
      inspectorIdentity: elementIdentity('[data-panel-id="export-inspector"]'),
      desktopInspectorExpected: Boolean(
        document.querySelector(".viewer-and-export.desktop")
      ),
      cardSettingsWidth: cardSettings.width,
      cardSettingsHeight: cardSettings.height,
      cardSettingsCenterY: cardSettings.top + cardSettings.height / 2,
      cardSettingsOpacity: elementOpacity(".export-panel:not(.inline)"),
      dissolveActive: document.documentElement.classList.contains(
        VIEWER_MODE_DISSOLVE_CLASS
      ),
      animationOpacity: elementOpacity(".split-column.animation-column"),
      cardOpacity: elementOpacity(".split-column.preview-column"),
      motion2DOpacity: elementOpacity('[data-motion-surface="2d"]'),
      motion3DOpacity: elementOpacity('[data-motion-surface="3d"]'),
      motion2DPresented: elementDataFlag(
        '[data-motion-surface="2d"]',
        "presented"
      ),
      motion3DPresented: elementDataFlag(
        '[data-motion-surface="3d"]',
        "presented"
      ),
      motion3DReady: elementDataFlag(
        '[data-motion-surface="3d"]',
        "sceneReady"
      ),
      motion3DPreparing: Boolean(
        document.querySelector(".viewer-3d-handoff-status")
      ),
      sceneCurtainVisible: Boolean(
        document.querySelector(
          '[data-motion-surface="3d"][data-presented="true"] .curtain'
        )
      ),
      tunnelOpacity: tunnelBlend,
      tunnelPresented: Boolean(activeTunnelSurface) || tunnelBlend > 0,
      tunnelCanvasReady,
      animatorIdentity: elementIdentity("[data-persistent-animator]"),
      animatorCanvasCount: document.querySelectorAll(
        '[data-persistent-animator] canvas[data-animation-layer="mandala"]'
      ).length,
      activeArtSettingsCount: document.querySelectorAll(
        '[data-viewer-art-inspector-target] [data-active="true"][data-art-settings]'
      ).length,
      tunnelBackingWidth: activeTunnelCanvas
        ? activeTunnelCanvas.width / Math.max(1, window.devicePixelRatio || 1)
        : 0,
      tunnelBackingHeight: activeTunnelCanvas
        ? activeTunnelCanvas.height / Math.max(1, window.devicePixelRatio || 1)
        : 0,
      tunnelDisplayWidth: tunnelBounds?.width ?? 0,
      tunnelDisplayHeight: tunnelBounds?.height ?? 0,
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
    label: ReviewModeLabel,
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
      if (command === "2d" || command === "card" || command === "interrupt") {
        if (!(await chooseMode("Side by Side", version))) return;
      } else if (!(await chooseMode("2D Animation", version))) {
        return;
      }

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
      } else if (command === "interrupt") {
        beginGeometryTrace(command, "interrupt-2d");
        if (!(await chooseMode("2D Animation", version, false))) return;
        setTracePhase("interrupt-split");
        if (!(await chooseMode("Side by Side", version, false))) return;
        setTracePhase("interrupt-card");
        if (!(await chooseMode("Card", version, false))) return;
        setTracePhase("interrupt-return");
        if (!(await chooseMode("Side by Side", version))) return;
      } else if (command === "3d-first") {
        beginGeometryTrace(command, "prepare-3d");
        if (!(await chooseMode("3D Animation", version, false))) return;
        if (!(await waitForMotionPresentation("3d", version))) return;
        setTracePhase("show-3d");
        await wait(DURATION.emphasis + 90);
        setTracePhase("return-2d");
        if (!(await chooseMode("2D Animation", version))) return;
      } else if (command === "3d-repeat") {
        if (!(await chooseMode("3D Animation", version, false))) return;
        if (!(await waitForMotionPresentation("3d", version))) return;
        await wait(DURATION.emphasis + 90);
        if (!(await chooseMode("2D Animation", version))) return;

        beginGeometryTrace(command, "repeat-3d");
        if (!(await chooseMode("3D Animation", version, false))) return;
        if (!(await waitForMotionPresentation("3d", version))) return;
        await wait(DURATION.emphasis + 90);
        setTracePhase("return-2d");
        if (!(await chooseMode("2D Animation", version))) return;
      } else if (command === "3d-interrupt") {
        beginGeometryTrace(command, "interrupt-3d");
        if (!(await chooseMode("3D Animation", version, false))) return;
        await wait(motionDuration(DURATION.instant));
        setTracePhase("interrupt-2d-return");
        if (!(await chooseMode("2D Animation", version, false))) return;
        setTracePhase("interrupt-3d");
        if (!(await chooseMode("3D Animation", version, false))) return;
        await wait(motionDuration(DURATION.instant));
        setTracePhase("interrupt-2d-return");
        if (!(await chooseMode("2D Animation", version))) return;
      } else if (command === "tunnel-first") {
        beginGeometryTrace(command, "prepare-tunnel");
        if (!(await chooseMode("Tunnel", version, false))) return;
        if (!(await waitForTunnelPresentation(version))) return;
        setTracePhase("show-tunnel");
        await wait(motionDuration(DURATION.emphasis) + 90);
        setTracePhase("return-stage");
        if (!(await chooseMode("2D Animation", version))) return;
      } else if (command === "tunnel-3d") {
        if (!(await chooseMode("3D Animation", version, false))) return;
        if (!(await waitForMotionPresentation("3d", version))) return;
        await wait(motionDuration(DURATION.emphasis) + 90);

        beginGeometryTrace(command, "prepare-tunnel-from-3d");
        if (!(await chooseMode("Tunnel", version, false))) return;
        if (!(await waitForTunnelPresentation(version))) return;
        setTracePhase("show-tunnel");
        await wait(motionDuration(DURATION.emphasis) + 90);
        setTracePhase("return-3d");
        if (!(await chooseMode("3D Animation", version, false))) return;
        if (!(await waitForMotionPresentation("3d", version))) return;
        await wait(motionDuration(DURATION.emphasis) + 90);
      } else {
        beginGeometryTrace(command, "interrupt-tunnel");
        if (!(await chooseMode("Tunnel", version, false))) return;
        await wait(motionDuration(DURATION.instant));
        setTracePhase("interrupt-stage");
        if (!(await chooseMode("2D Animation", version, false))) return;
        setTracePhase("interrupt-tunnel");
        if (!(await chooseMode("Tunnel", version, false))) return;
        await wait(motionDuration(DURATION.instant));
        setTracePhase("interrupt-stage");
        if (!(await chooseMode("2D Animation", version))) return;
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
          message.command === "interrupt" ||
          message.command === "3d-first" ||
          message.command === "3d-repeat" ||
          message.command === "3d-interrupt" ||
          message.command === "tunnel-first" ||
          message.command === "tunnel-3d" ||
          message.command === "tunnel-interrupt")) ||
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
