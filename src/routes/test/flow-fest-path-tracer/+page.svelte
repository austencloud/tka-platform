<script lang="ts">
  import { onMount } from "svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import {
    FLOW_FEST_TRACE_VIEW,
    createTraceSubmission,
    emptyFlowFestTraces,
    normalizeTraceDirection,
    parseStoredTraces,
    simplifyTrace,
    traceLengthMeters,
    validateTraceSubmission,
    type FlowFestImageTraces,
    type FlowFestPathId,
    type ImagePoint,
  } from "./_lib/flow-fest-trace";

  type InteractionMode = "draw" | "pan";
  type NoticeKind = "quiet" | "success" | "error";

  const STORAGE_KEY = "flow-fest-path-tracer-v1";
  const PATH_OPTIONS: Array<{
    value: FlowFestPathId;
    label: string;
    shortLabel: string;
    tone: "blue" | "accent";
  }> = [
    {
      value: "upper-to-middle",
      label: "Upper clearing to Middle Earth",
      shortLabel: "Upper → Middle",
      tone: "blue",
    },
    {
      value: "middle-to-lower",
      label: "Middle Earth to lower clearing",
      shortLabel: "Middle → Lower",
      tone: "accent",
    },
  ];
  const MODE_OPTIONS: Array<{
    value: InteractionMode;
    label: string;
    tone: "accent";
  }> = [
    { value: "draw", label: "Draw", tone: "accent" },
    { value: "pan", label: "Pan", tone: "accent" },
  ];

  let activePath = $state<FlowFestPathId>("upper-to-middle");
  let interactionMode = $state<InteractionMode>("draw");
  let traces = $state<FlowFestImageTraces>(emptyFlowFestTraces());
  let draft = $state<ImagePoint[]>([]);
  let draftPath = $state<FlowFestPathId | null>(null);
  let notice = $state(
    "Draw one path at a time. Switching paths keeps both lines."
  );
  let noticeKind = $state<NoticeKind>("quiet");
  let saving = $state(false);
  let svgElement = $state<SVGSVGElement | null>(null);
  let view = $state({ ...FLOW_FEST_TRACE_VIEW });

  const history: Record<FlowFestPathId, ImagePoint[][]> = {
    "upper-to-middle": [],
    "middle-to-lower": [],
  };
  let pointerId: number | null = null;
  let panOrigin: {
    clientX: number;
    clientY: number;
    viewX: number;
    viewY: number;
  } | null = null;

  const upperReady = $derived(traces["upper-to-middle"].length >= 2);
  const lowerReady = $derived(traces["middle-to-lower"].length >= 2);
  const bothReady = $derived(upperReady && lowerReady);

  onMount(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const restored = parseStoredTraces(stored);
    if (restored) {
      traces = restored;
      notice = "Restored both paths from this browser.";
      noticeKind = "success";
      return;
    }
    notice = "The saved browser draft was invalid, so the map started clean.";
    noticeKind = "error";
  });

  function reportFailure(
    message: string,
    cause: unknown,
    action: string
  ): void {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    notice = message;
    noticeKind = "error";
    getErrorHandler().showUserError({
      message,
      technicalDetails: error.message,
      error,
      severity: "error",
      context: {
        module: "flow-fest-path-tracer",
        tab: "terrain-authoring",
        action,
      },
    });
  }

  function cloneTrace(points: readonly ImagePoint[]): ImagePoint[] {
    return points.map((point) => ({ ...point }));
  }

  function persistTraces(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(traces));
    } catch (cause) {
      reportFailure(
        "The paths are still on screen, but this browser could not preserve them across a refresh.",
        cause,
        "persistDraft"
      );
    }
  }

  function remember(pathId: FlowFestPathId): void {
    history[pathId].push(cloneTrace(traces[pathId]));
    if (history[pathId].length > 20) history[pathId].shift();
  }

  function pointsAttribute(points: readonly ImagePoint[]): string {
    return points
      .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(" ");
  }

  function pointFromEvent(event: PointerEvent): ImagePoint | null {
    if (!svgElement) return null;
    const transform = svgElement.getScreenCTM();
    if (!transform) return null;
    const point = svgElement.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const imagePoint = point.matrixTransform(transform.inverse());
    return { x: imagePoint.x, y: imagePoint.y };
  }

  function distance(left: ImagePoint, right: ImagePoint): number {
    return Math.hypot(left.x - right.x, left.y - right.y);
  }

  function handlePointerDown(event: PointerEvent): void {
    if (!svgElement || pointerId !== null) return;
    const point = pointFromEvent(event);
    if (!point) return;
    pointerId = event.pointerId;
    svgElement.setPointerCapture(event.pointerId);
    if (interactionMode === "draw") {
      draftPath = activePath;
      draft = [point];
      notice = `Drawing ${activePath === "upper-to-middle" ? "upper to middle" : "middle to lower"}. Release to keep it.`;
      noticeKind = "quiet";
    } else {
      panOrigin = {
        clientX: event.clientX,
        clientY: event.clientY,
        viewX: view.x,
        viewY: view.y,
      };
    }
    event.preventDefault();
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!svgElement || event.pointerId !== pointerId) return;
    if (interactionMode === "draw" && draftPath) {
      const rect = svgElement.getBoundingClientRect();
      const raw =
        typeof event.getCoalescedEvents === "function"
          ? event.getCoalescedEvents()
          : [];
      const events = raw.length > 0 ? raw : [event];
      const added: ImagePoint[] = [];
      let last = draft[draft.length - 1];
      for (const sample of events) {
        const next = pointFromEvent(sample);
        if (!next) continue;
        const threshold = Math.max(0.6, view.width / Math.max(1, rect.width));
        if (!last || distance(last, next) >= threshold) {
          added.push(next);
          last = next;
        }
      }
      if (added.length > 0) draft = [...draft, ...added];
      return;
    }
    if (interactionMode === "pan" && panOrigin) {
      const rect = svgElement.getBoundingClientRect();
      view.x =
        panOrigin.viewX -
        ((event.clientX - panOrigin.clientX) / Math.max(1, rect.width)) *
          view.width;
      view.y =
        panOrigin.viewY -
        ((event.clientY - panOrigin.clientY) / Math.max(1, rect.height)) *
          view.height;
      clampView();
    }
  }

  function finishPointer(event: PointerEvent): void {
    if (!svgElement || event.pointerId !== pointerId) return;
    if (interactionMode === "draw" && draftPath) {
      if (draft.length >= 2 && traceLengthMeters(draft) >= 2) {
        const pathId = draftPath;
        remember(pathId);
        traces[pathId] = normalizeTraceDirection(pathId, simplifyTrace(draft));
        persistTraces();
        notice = `${pathId === "upper-to-middle" ? "Upper-to-middle" : "Middle-to-lower"} path kept. The other path was not changed.`;
        noticeKind = "success";
      } else {
        notice =
          "That was only a click, so the previous path was left untouched.";
        noticeKind = "quiet";
      }
    }
    const releasedPointerId = pointerId;
    pointerId = null;
    if (svgElement.hasPointerCapture(releasedPointerId)) {
      svgElement.releasePointerCapture(releasedPointerId);
    }
    draft = [];
    draftPath = null;
    panOrigin = null;
  }

  function handlePointerCancel(event: PointerEvent): void {
    if (!svgElement || event.pointerId !== pointerId) return;
    const releasedPointerId = pointerId;
    pointerId = null;
    if (svgElement.hasPointerCapture(releasedPointerId)) {
      svgElement.releasePointerCapture(releasedPointerId);
    }
    draft = [];
    draftPath = null;
    panOrigin = null;
    notice =
      "The interrupted stroke was discarded. Both saved paths are unchanged.";
    noticeKind = "quiet";
  }

  function handleMapKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape" || !draftPath) return;
    draft = [];
    draftPath = null;
    notice = "The current stroke was discarded.";
    noticeKind = "quiet";
  }

  function clampView(): void {
    const bounds = FLOW_FEST_TRACE_VIEW;
    view.width = Math.max(216, Math.min(bounds.width, view.width));
    view.height = view.width * (bounds.height / bounds.width);
    view.x = Math.max(
      bounds.x,
      Math.min(bounds.x + bounds.width - view.width, view.x)
    );
    view.y = Math.max(
      bounds.y,
      Math.min(bounds.y + bounds.height - view.height, view.y)
    );
  }

  function zoom(factor: number): void {
    const centerX = view.x + view.width / 2;
    const centerY = view.y + view.height / 2;
    view.width *= factor;
    view.height *= factor;
    view.x = centerX - view.width / 2;
    view.y = centerY - view.height / 2;
    clampView();
  }

  function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    zoom(event.deltaY > 0 ? 1.15 : 0.85);
  }

  function resetView(): void {
    view = { ...FLOW_FEST_TRACE_VIEW };
  }

  function undoActiveTrace(): void {
    const entry = history[activePath].pop();
    if (!entry) {
      notice =
        "There is no earlier version of this path in the current session.";
      noticeKind = "quiet";
      return;
    }
    traces[activePath] = cloneTrace(entry);
    persistTraces();
    notice = "Restored the previous version of the active path.";
    noticeKind = "success";
  }

  function clearActiveTrace(): void {
    remember(activePath);
    traces[activePath] = [];
    persistTraces();
    notice = "Cleared only the active path. Undo Trace will restore it.";
    noticeKind = "quiet";
  }

  function currentSubmission() {
    const submission = createTraceSubmission(traces);
    const validation = validateTraceSubmission(submission);
    if (!validation.valid) {
      notice = validation.error;
      noticeKind = "error";
      return null;
    }
    return validation.value;
  }

  async function saveForCodex(): Promise<void> {
    const submission = currentSubmission();
    if (!submission) return;
    saving = true;
    notice = "Saving both paths for Codex…";
    noticeKind = "quiet";
    try {
      const response = await fetch("/test/flow-fest-path-tracer/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submission),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        path?: string;
        error?: string;
      };
      if (!response.ok || !result.ok) {
        throw new Error(
          result.error ?? `Save failed with HTTP ${response.status}`
        );
      }
      notice = `Saved for Codex at ${result.path}.`;
      noticeKind = "success";
    } catch (cause) {
      reportFailure(
        "The paths could not be written to the Flow Fest spec folder.",
        cause,
        "saveTraces"
      );
    } finally {
      saving = false;
    }
  }

  async function copyCoordinates(): Promise<void> {
    const submission = currentSubmission();
    if (!submission) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(submission, null, 2));
      notice = "Copied both registered paths as JSON.";
      noticeKind = "success";
    } catch (cause) {
      reportFailure(
        "The browser could not copy the path coordinates.",
        cause,
        "copyTraces"
      );
    }
  }
</script>

<svelte:head>
  <title>Flow Fest Path Tracer | TKA</title>
  <meta
    name="description"
    content="Trace the real upper-to-middle and middle-to-lower paths over the registered Flow Fest terrain."
  />
</svelte:head>

<main class="trace-page">
  <header class="page-header">
    <div class="title-block">
      <p class="eyebrow">Flow Fest Sim · Gate 1 correction</p>
      <h1>Draw the paths that the trees hide</h1>
      <p class="lede">
        Each stroke replaces only its selected route. Your other route remains
        on the map, and both survive a refresh.
      </p>
    </div>
    <div class="completion" aria-label="Path completion">
      <span class:ready={upperReady}>
        <span class="route-dot upper" aria-hidden="true"></span>
        Upper → Middle {upperReady ? "ready" : "not drawn"}
      </span>
      <span class:ready={lowerReady}>
        <span class="route-dot lower" aria-hidden="true"></span>
        Middle → Lower {lowerReady ? "ready" : "not drawn"}
      </span>
    </div>
  </header>

  <section class="workspace" aria-label="Flow Fest path authoring workspace">
    <aside class="control-panel">
      <div class="control-group">
        <h2 id="path-picker-label">Path to edit</h2>
        <SegmentedControl
          options={PATH_OPTIONS}
          value={activePath}
          onchange={(value) => (activePath = value)}
          color="accent"
          semantics="radiogroup"
          ariaLabelledby="path-picker-label"
        />
      </div>

      <div class="control-group">
        <h2 id="mode-picker-label">Map gesture</h2>
        <SegmentedControl
          options={MODE_OPTIONS}
          value={interactionMode}
          onchange={(value) => (interactionMode = value)}
          color="accent"
          semantics="radiogroup"
          ariaLabelledby="mode-picker-label"
        />
      </div>

      <div class="instructions">
        <p>
          <strong>Draw:</strong> drag across the real trail and release to keep it.
        </p>
        <p>
          <strong>Pan:</strong> move around after zooming. The mouse wheel also zooms.
        </p>
        <p>
          A click without a drag is discarded, so it cannot erase a finished
          route.
        </p>
      </div>

      <div class="action-grid" aria-label="Map and trace actions">
        <PanelButton onclick={() => zoom(0.75)}>Zoom in</PanelButton>
        <PanelButton onclick={() => zoom(1.25)}>Zoom out</PanelButton>
        <PanelButton onclick={resetView}>Reset view</PanelButton>
        <PanelButton onclick={undoActiveTrace}>Undo trace</PanelButton>
        <PanelButton onclick={clearActiveTrace}>Clear active</PanelButton>
        <PanelButton onclick={copyCoordinates}>Copy JSON</PanelButton>
      </div>

      <div class="path-readout">
        <div>
          <span
            ><span class="route-dot upper" aria-hidden="true"></span>Upper →
            Middle</span
          >
          <strong
            >{traces["upper-to-middle"].length} points · {traceLengthMeters(
              traces["upper-to-middle"]
            ).toFixed(1)} m</strong
          >
        </div>
        <div>
          <span
            ><span class="route-dot lower" aria-hidden="true"></span>Middle →
            Lower</span
          >
          <strong
            >{traces["middle-to-lower"].length} points · {traceLengthMeters(
              traces["middle-to-lower"]
            ).toFixed(1)} m</strong
          >
        </div>
      </div>

      <div class="save-block">
        <PanelButton
          variant="primary"
          fullWidth={true}
          onclick={saveForCodex}
          disabled={saving}
          ariaBusy={saving}
        >
          {saving ? "Saving…" : "Save both paths for Codex"}
        </PanelButton>
        <p class="save-hint">
          This button stays available. If a path is missing, it says which one
          instead of silently disabling itself.
        </p>
      </div>
    </aside>

    <div class="map-panel">
      <div class="map-heading">
        <div>
          <span class="active-label">
            Editing {activePath === "upper-to-middle"
              ? "Upper → Middle"
              : "Middle → Lower"}
          </span>
          <span class="source-label"
            >2023 NAIP · north up · 0.5 m per source pixel</span
          >
        </div>
        <span class="mode-label"
          >{interactionMode === "draw" ? "Drag to draw" : "Drag to pan"}</span
        >
      </div>

      <svg
        class:panning={interactionMode === "pan"}
        class="terrain-map"
        bind:this={svgElement}
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        role="application"
        tabindex="0"
        aria-label="Flow Fest terrain drawing map"
        onpointerdown={handlePointerDown}
        onpointermove={handlePointerMove}
        onpointerup={finishPointer}
        onpointercancel={handlePointerCancel}
        onlostpointercapture={handlePointerCancel}
        onkeydown={handleMapKeydown}
        onwheel={handleWheel}
      >
        <image
          href="/data/flow-fest-sim/ortho.webp"
          x="0"
          y="0"
          width="2048"
          height="2048"
          preserveAspectRatio="none"
        />

        <polyline
          class="stored-path upper"
          class:active={activePath === "upper-to-middle"}
          points={pointsAttribute(traces["upper-to-middle"])}
        />
        <polyline
          class="stored-path lower"
          class:active={activePath === "middle-to-lower"}
          points={pointsAttribute(traces["middle-to-lower"])}
        />
        {#if draftPath}
          <polyline
            class="draft-path"
            class:upper={draftPath === "upper-to-middle"}
            class:lower={draftPath === "middle-to-lower"}
            points={pointsAttribute(draft)}
          />
        {/if}

        <g class="clearing-marker" transform="translate(900 876)">
          <circle r="9" />
          <text x="14" y="-14">Upper clearing</text>
        </g>
        <g class="clearing-marker" transform="translate(1224 794)">
          <circle r="9" />
          <text x="14" y="-14">Middle Earth</text>
        </g>
        <g class="clearing-marker" transform="translate(1596 764)">
          <circle r="9" />
          <text x="-14" y="-14" text-anchor="end">Lower clearing</text>
        </g>
        <g
          class="north-arrow"
          transform="translate(1718 622)"
          aria-label="North"
        >
          <text x="0" y="0" text-anchor="middle">N</text>
          <path d="M 0 10 L -8 34 L 0 29 L 8 34 Z" />
        </g>
      </svg>
    </div>
  </section>

  <footer
    class="notice"
    class:success={noticeKind === "success"}
    class:error={noticeKind === "error"}
    aria-live="polite"
  >
    <span class="notice-dot" aria-hidden="true"></span>
    {notice}
    {#if bothReady && noticeKind === "quiet"}
      <span class="ready-copy">Both paths can be saved.</span>
    {/if}
  </footer>
</main>

<style>
  .trace-page {
    --upper-trace: var(--prop-blue, #67a7ff);
    --lower-trace: var(--semantic-success, #5ee6a8);
    box-sizing: border-box;
    width: min(var(--shell-w, 92vw), calc(100% - 2rem));
    min-height: 100dvh;
    margin: 0 auto;
    padding: clamp(1rem, 2vw, 2.5rem) 0;
    color: var(--theme-text, #f5f2eb);
    container-type: inline-size;
  }

  .page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 2rem;
    margin-bottom: 1.25rem;
  }

  .title-block {
    min-width: 0;
  }

  .eyebrow {
    margin: 0 0 0.4rem;
    color: var(--theme-accent, #d6a84e);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: clamp(2rem, 4cqw, 4.5rem);
    line-height: 0.98;
  }

  .lede {
    margin: 0.75rem 0 0;
    color: var(--theme-text-dim, rgba(245, 242, 235, 0.75));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.5;
  }

  .completion {
    display: grid;
    flex: 0 0 auto;
    gap: 0.45rem;
    padding: 0.85rem 1rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text-dim, rgba(245, 242, 235, 0.75));
    font-size: var(--font-size-sm, 0.875rem);
  }

  .completion span {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .completion span.ready {
    color: var(--theme-text, #f5f2eb);
  }

  .route-dot {
    display: inline-block;
    width: 0.75rem;
    height: 0.75rem;
    flex: 0 0 auto;
    border-radius: 999px;
  }

  .route-dot.upper {
    background: var(--upper-trace);
  }

  .route-dot.lower {
    background: var(--lower-trace);
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(18rem, 24rem) minmax(0, 1fr);
    gap: 1rem;
    min-height: 0;
    padding: 1rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: var(--radius-xl, 1rem);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .control-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
  }

  .control-group h2 {
    margin: 0 0 0.45rem;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 500;
  }

  .instructions {
    padding: 0.85rem;
    border-radius: var(--radius-md, 0.5rem);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text-dim, rgba(245, 242, 235, 0.75));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.45;
  }

  .instructions p {
    margin: 0;
  }

  .instructions p + p {
    margin-top: 0.45rem;
  }

  .instructions strong {
    color: var(--theme-text, #f5f2eb);
  }

  .action-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .path-readout {
    display: grid;
    gap: 0.6rem;
    padding-top: 0.25rem;
  }

  .path-readout > div {
    display: grid;
    gap: 0.2rem;
  }

  .path-readout span {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--theme-text-dim, rgba(245, 242, 235, 0.75));
    font-size: var(--font-size-sm, 0.875rem);
  }

  .path-readout strong {
    font-size: var(--font-size-min, 0.875rem);
    font-variant-numeric: tabular-nums;
  }

  .save-block {
    margin-top: auto;
  }

  .save-hint {
    margin: 0.5rem 0 0;
    color: var(--theme-text-dim, rgba(245, 242, 235, 0.72));
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.4;
  }

  .map-panel {
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: var(--radius-lg, 0.75rem);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
  }

  .map-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.65rem 0.9rem;
    color: var(--theme-text-dim, rgba(245, 242, 235, 0.75));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .map-heading > div {
    display: flex;
    align-items: baseline;
    gap: 0.7rem;
    min-width: 0;
  }

  .active-label {
    color: var(--theme-text, #f5f2eb);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 500;
  }

  .source-label,
  .mode-label {
    white-space: nowrap;
  }

  .terrain-map {
    display: block;
    width: 100%;
    aspect-ratio: 1080 / 560;
    background: var(--theme-panel-bg, #12121c);
    cursor: crosshair;
    touch-action: none;
    user-select: none;
  }

  .terrain-map.panning {
    cursor: grab;
  }

  .terrain-map:focus-visible {
    outline: 3px solid var(--theme-accent, #d6a84e);
    outline-offset: -3px;
  }

  .stored-path,
  .draft-path {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .stored-path {
    stroke-width: 6;
    opacity: 0.78;
  }

  .stored-path.active {
    stroke-width: 9;
    opacity: 1;
    filter: drop-shadow(0 0 3px var(--theme-panel-bg, #12121c));
  }

  .stored-path.upper,
  .draft-path.upper {
    stroke: var(--upper-trace);
  }

  .stored-path.lower,
  .draft-path.lower {
    stroke: var(--lower-trace);
  }

  .draft-path {
    stroke-width: 8;
    stroke-dasharray: 12 8;
  }

  .clearing-marker circle {
    fill: var(--theme-accent, #d6a84e);
    stroke: var(--theme-text-on-accent, #111);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }

  .clearing-marker text,
  .north-arrow text {
    fill: var(--theme-text, #f5f2eb);
    stroke: var(--theme-panel-bg, #12121c);
    stroke-width: 5;
    paint-order: stroke;
    font-size: 1.125rem;
    font-weight: 500;
    pointer-events: none;
  }

  .north-arrow path {
    fill: var(--theme-text, #f5f2eb);
    stroke: var(--theme-panel-bg, #12121c);
    stroke-width: 2;
    paint-order: stroke;
  }

  .notice {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-height: var(--min-touch-target, 44px);
    margin-top: 0.75rem;
    padding: 0 0.25rem;
    color: var(--theme-text-dim, rgba(245, 242, 235, 0.75));
    font-size: var(--font-size-sm, 0.875rem);
  }

  .notice-dot {
    width: 0.55rem;
    height: 0.55rem;
    flex: 0 0 auto;
    border-radius: 999px;
    background: var(--theme-text-dim, rgba(245, 242, 235, 0.5));
  }

  .notice.success {
    color: var(--semantic-success, #5ee6a8);
  }

  .notice.success .notice-dot {
    background: var(--semantic-success, #5ee6a8);
  }

  .notice.error {
    color: var(--semantic-error, #ff6b6b);
  }

  .notice.error .notice-dot {
    background: var(--semantic-error, #ff6b6b);
  }

  .ready-copy {
    margin-left: auto;
    color: var(--semantic-success, #5ee6a8);
  }

  @media (max-width: 1679px) {
    .workspace {
      grid-template-columns: 1fr;
    }

    .control-panel {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
    }

    .instructions,
    .path-readout {
      grid-row: span 2;
    }

    .save-block {
      margin-top: 0;
    }
  }

  @media (max-width: 820px) {
    .trace-page {
      width: min(100% - 1rem, var(--shell-w, 100%));
      padding: 0.75rem 0 1.25rem;
    }

    .page-header {
      align-items: stretch;
      flex-direction: column;
      gap: 0.8rem;
    }

    .completion {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .workspace {
      padding: 0.65rem;
    }

    .control-panel {
      display: flex;
    }

    .map-heading,
    .map-heading > div {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.25rem;
    }

    .source-label,
    .mode-label {
      white-space: normal;
    }

    .ready-copy {
      display: none;
    }
  }

  @media (max-width: 430px) {
    .completion,
    .action-grid {
      grid-template-columns: 1fr;
    }

    .terrain-map {
      min-height: 15rem;
      aspect-ratio: auto;
    }
  }

  @media (max-height: 32rem) and (min-width: 50rem) {
    .trace-page {
      width: calc(100% - 1rem);
      padding: 0.5rem 0;
    }

    .page-header {
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .lede,
    .completion,
    .instructions,
    .save-hint,
    .path-readout {
      display: none;
    }

    h1 {
      font-size: 1.75rem;
    }

    .workspace {
      grid-template-columns: 18rem minmax(0, 1fr);
      gap: 0.65rem;
      padding: 0.65rem;
    }

    .control-panel {
      display: flex;
      gap: 0.5rem;
    }

    .map-heading {
      padding: 0.35rem 0.7rem;
    }

    .notice {
      margin-top: 0.25rem;
    }
  }
</style>
