<script lang="ts">
  import { onMount } from "svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { getErrorHandler } from "$lib/shared/application/get-error-handler";
  import {
    FLOW_FEST_IMAGE,
    type ImagePoint,
  } from "../flow-fest-path-tracer/_lib/flow-fest-trace";
  import {
    FLOW_FEST_MARKER_GROUPS,
    FLOW_FEST_MARKER_PRESETS,
    cloneFlowFestSiteMarkerDraft,
    createFlowFestSiteMarkerSubmission,
    createSiteMarker,
    emptyFlowFestSiteMarkerDraft,
    getMarkerPreset,
    markerReadiness,
    parseStoredFlowFestSiteMarkerDraft,
    toMarkerRecord,
    type FlowFestSiteMarker,
    type FlowFestSiteMarkerDraft,
  } from "./_lib/flow-fest-site-markers";

  type InteractionMode = "place" | "pan";
  type NoticeKind = "quiet" | "success" | "error";

  const STORAGE_KEY = "flow-fest-site-markers-v1";
  /**
   * The window is stored as its top-left corner plus a width. Its HEIGHT comes
   * from the rendered element's aspect ratio, so the viewBox always matches the
   * box it is drawn in. That is not cosmetic: `pointFromEvent` maps a screen
   * position into image space linearly, which is only true when the SVG is not
   * letterboxing to preserve a mismatched ratio. Get it wrong and every marker
   * lands somewhere other than where it was pressed.
   */
  const FULL_VIEW = { x: 0, y: 0, width: FLOW_FEST_IMAGE.width } as const;
  /** Middle Earth sits near image (1224, 794); this frames it and the ground east of it. */
  const MIDDLE_EARTH_VIEW = { x: 940, y: 620, width: 900 } as const;
  const HIT_RADIUS_PIXELS = 14;

  const MODE_OPTIONS = [
    { value: "place", label: "Place", tone: "accent" as const },
    { value: "pan", label: "Pan", tone: "accent" as const },
  ];

  let draft = $state<FlowFestSiteMarkerDraft>(emptyFlowFestSiteMarkerDraft());
  let activePresetId = $state<string>("fire-circle");
  let selectedMarkerId = $state<string | null>(null);
  let interactionMode = $state<InteractionMode>("place");
  let view = $state({ ...MIDDLE_EARTH_VIEW });
  let svgElement = $state<SVGSVGElement | null>(null);
  let mapWidth = $state(1);
  let mapHeight = $state(1);
  let notice = $state(
    "Pick what you are placing, then press on the map and drag the way it faces."
  );
  let noticeKind = $state<NoticeKind>("quiet");
  let saving = $state(false);

  let pointerId: number | null = null;
  let draggingHandleFor: string | null = null;
  let panOrigin: { x: number; y: number; viewX: number; viewY: number } | null =
    null;
  let history: FlowFestSiteMarkerDraft[] = [];

  const viewHeight = $derived((view.width * mapHeight) / Math.max(mapWidth, 1));
  /** Screen pixels to viewBox units, so strokes and dots keep a constant size. */
  const pixelScale = $derived(view.width / Math.max(mapWidth, 1));
  const activePreset = $derived(getMarkerPreset(activePresetId));
  const selectedMarker = $derived(
    draft.markers.find((marker) => marker.id === selectedMarkerId) ?? null
  );
  const incompleteCount = $derived(
    draft.markers.filter((marker) => !markerReadiness(marker)).length
  );
  const presetsByGroup = $derived(
    FLOW_FEST_MARKER_GROUPS.map((group) => ({
      ...group,
      presets: FLOW_FEST_MARKER_PRESETS.filter(
        (preset) => preset.group === group.id
      ),
    }))
  );

  onMount(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed = parseStoredFlowFestSiteMarkerDraft(stored);
    if (parsed) {
      draft = parsed;
      report(
        `Restored ${parsed.markers.length} marker${parsed.markers.length === 1 ? "" : "s"} from this browser.`,
        "quiet"
      );
    }
  });

  function report(message: string, kind: NoticeKind): void {
    notice = message;
    noticeKind = kind;
  }

  function reportFailure(message: string, cause: unknown, action: string): void {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    report(message, "error");
    getErrorHandler().showUserError({
      message,
      technicalDetails: error.message,
      error,
      severity: "error",
      context: {
        module: "flow-fest-site-markers",
        tab: "terrain-authoring",
        action,
      },
    });
  }

  function persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch (cause) {
      reportFailure(
        "This browser refused to keep a local draft. Save to disk before you close the tab.",
        cause,
        "persist"
      );
    }
  }

  function remember(): void {
    history = [...history.slice(-49), cloneFlowFestSiteMarkerDraft(draft)];
  }

  function undo(): void {
    const previous = history.pop();
    if (!previous) {
      report("Nothing to undo.", "quiet");
      return;
    }
    draft = previous;
    persist();
    report("Undid the last change.", "quiet");
  }

  function pointFromEvent(event: PointerEvent): ImagePoint | null {
    if (!svgElement) return null;
    const bounds = svgElement.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return null;
    return {
      x: view.x + ((event.clientX - bounds.left) / bounds.width) * view.width,
      y: view.y + ((event.clientY - bounds.top) / bounds.height) * viewHeight,
    };
  }

  function markerNear(point: ImagePoint): FlowFestSiteMarker | null {
    const reach = HIT_RADIUS_PIXELS * pixelScale;
    let closest: FlowFestSiteMarker | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const marker of draft.markers) {
      const distance = Math.hypot(
        marker.anchor.x - point.x,
        marker.anchor.y - point.y
      );
      if (distance <= reach && distance < closestDistance) {
        closest = marker;
        closestDistance = distance;
      }
    }
    return closest;
  }

  /**
   * Capture keeps the drag alive when the pointer leaves the map, which matters
   * when a circle's radius runs past the edge. It throws for a pointer the
   * element never owned, and losing capture is not a reason to lose the drag.
   */
  function capturePointer(event: PointerEvent, capture: boolean): void {
    const target = event.currentTarget as Element | null;
    if (!target) return;
    try {
      if (capture) target.setPointerCapture(event.pointerId);
      else target.releasePointerCapture(event.pointerId);
    } catch {
      /* The drag continues on the document-level move and up handlers. */
    }
  }

  function handlePointerDown(event: PointerEvent): void {
    const point = pointFromEvent(event);
    if (!point) return;
    capturePointer(event, true);
    pointerId = event.pointerId;

    if (interactionMode === "pan") {
      panOrigin = {
        x: event.clientX,
        y: event.clientY,
        viewX: view.x,
        viewY: view.y,
      };
      return;
    }

    const existing = markerNear(point);
    if (existing) {
      selectedMarkerId = existing.id;
      draggingHandleFor = existing.id;
      report(
        `${existing.label}. Drag to set its direction, or release to leave it.`,
        "quiet"
      );
      return;
    }

    remember();
    const marker = createSiteMarker(activePresetId, point, draft.markers);
    draft.markers = [...draft.markers, marker];
    selectedMarkerId = marker.id;
    draggingHandleFor = marker.shape === "point" ? null : marker.id;
    persist();
    report(
      marker.shape === "point"
        ? `Placed ${marker.label}.`
        : `Placed ${marker.label}. Keep dragging to set its ${handleNoun(marker.shape)}.`,
      "success"
    );
  }

  function handlePointerMove(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return;

    if (interactionMode === "pan" && panOrigin && svgElement) {
      const bounds = svgElement.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;
      view.x =
        panOrigin.viewX -
        ((event.clientX - panOrigin.x) / bounds.width) * view.width;
      view.y =
        panOrigin.viewY -
        ((event.clientY - panOrigin.y) / bounds.height) * viewHeight;
      clampView();
      return;
    }

    if (!draggingHandleFor) return;
    const point = pointFromEvent(event);
    if (!point) return;
    draft.markers = draft.markers.map((marker) =>
      marker.id === draggingHandleFor ? { ...marker, handle: point } : marker
    );
  }

  function finishPointer(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return;
    capturePointer(event, false);
    pointerId = null;
    panOrigin = null;
    if (draggingHandleFor) {
      draggingHandleFor = null;
      persist();
    }
  }

  function handleNoun(shape: FlowFestSiteMarker["shape"]): string {
    if (shape === "circle") return "radius";
    if (shape === "run") return "run";
    return "facing";
  }

  function clampView(): void {
    view.width = Math.min(Math.max(view.width, 120), FLOW_FEST_IMAGE.width);
    /** A window taller than the picture just shows the void; keep it inside. */
    if (viewHeight > FLOW_FEST_IMAGE.height) {
      view.width =
        (FLOW_FEST_IMAGE.height * Math.max(mapWidth, 1)) / Math.max(mapHeight, 1);
    }
    view.x = Math.min(Math.max(view.x, 0), FLOW_FEST_IMAGE.width - view.width);
    view.y = Math.min(
      Math.max(view.y, 0),
      Math.max(FLOW_FEST_IMAGE.height - viewHeight, 0)
    );
  }

  function zoom(factor: number): void {
    const centreX = view.x + view.width / 2;
    const centreY = view.y + viewHeight / 2;
    view.width *= factor;
    view.x = centreX - view.width / 2;
    clampView();
    view.y = centreY - viewHeight / 2;
    clampView();
  }

  function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    zoom(event.deltaY > 0 ? 1.12 : 1 / 1.12);
  }

  function renameSelected(value: string): void {
    if (!selectedMarkerId) return;
    draft.markers = draft.markers.map((marker) =>
      marker.id === selectedMarkerId
        ? { ...marker, label: value.slice(0, 80) }
        : marker
    );
    persist();
  }

  function annotateSelected(value: string): void {
    if (!selectedMarkerId) return;
    draft.markers = draft.markers.map((marker) =>
      marker.id === selectedMarkerId
        ? { ...marker, note: value.slice(0, 500) }
        : marker
    );
    persist();
  }

  function deleteMarker(id: string): void {
    remember();
    const removed = draft.markers.find((marker) => marker.id === id);
    draft.markers = draft.markers.filter((marker) => marker.id !== id);
    if (selectedMarkerId === id) selectedMarkerId = null;
    persist();
    report(`Removed ${removed?.label ?? "the marker"}.`, "quiet");
  }

  function clearHandle(id: string): void {
    remember();
    draft.markers = draft.markers.map((marker) =>
      marker.id === id ? { ...marker, handle: null } : marker
    );
    persist();
    report("Cleared its direction. Drag from the marker to set a new one.", "quiet");
  }

  function focusMarker(marker: FlowFestSiteMarker): void {
    selectedMarkerId = marker.id;
    view.x = marker.anchor.x - view.width / 2;
    view.y = marker.anchor.y - viewHeight / 2;
    clampView();
  }

  async function copyMarkers(): Promise<void> {
    const payload = createFlowFestSiteMarkerSubmission(draft);
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      report(
        `Copied ${payload.markers.length} marker${payload.markers.length === 1 ? "" : "s"} to the clipboard.`,
        "success"
      );
    } catch (cause) {
      reportFailure(
        "The clipboard refused. Use Save to disk instead.",
        cause,
        "copyMarkers"
      );
    }
  }

  async function saveMarkers(): Promise<void> {
    if (draft.markers.length === 0) {
      report("Place at least one marker before saving.", "error");
      return;
    }
    saving = true;
    try {
      const response = await fetch("/test/flow-fest-site-markers/save-markers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createFlowFestSiteMarkerSubmission(draft)),
      });
      const result = (await response.json()) as {
        ok: boolean;
        path?: string;
        markerCount?: number;
        error?: string;
      };
      if (!response.ok || !result.ok) {
        report(result.error ?? "The save was refused.", "error");
        return;
      }
      report(
        `Saved ${result.markerCount} marker${result.markerCount === 1 ? "" : "s"} to ${result.path}.`,
        "success"
      );
    } catch (cause) {
      reportFailure(
        "The markers could not be written to the Flow Fest spec folder.",
        cause,
        "saveMarkers"
      );
    } finally {
      saving = false;
    }
  }

  function describe(marker: FlowFestSiteMarker): string {
    const record = toMarkerRecord(marker);
    const parts: string[] = [
      `${record.position.x.toFixed(1)}, ${record.position.z.toFixed(1)}`,
    ];
    if (record.facingDegrees !== null) {
      parts.push(`${record.facingDegrees.toFixed(0)}° ${compass(record.facingDegrees)}`);
    }
    if (record.radiusMeters !== null) parts.push(`r ${record.radiusMeters} m`);
    if (record.runLengthMeters !== null)
      parts.push(`${record.runLengthMeters} m long`);
    return parts.join(" · ");
  }

  function compass(degrees: number): string {
    const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return names[Math.round(degrees / 45) % 8]!;
  }

  function arrowTip(marker: FlowFestSiteMarker): ImagePoint | null {
    if (!marker.handle) return null;
    return marker.handle;
  }
</script>

<svelte:head>
  <title>Flow Fest site markers</title>
</svelte:head>

<main class="marker-page">
  <header class="page-head">
    <div>
      <h1>Flow Fest site markers</h1>
      <p class="lede">
        Place what is actually there and say which way it faces. Everything lands
        in world metres on the registered orthophoto, in the same frame as the
        road traces, so an agent can build from it directly.
      </p>
    </div>
    <div class="head-actions">
      <div class="mode-switch">
        <SegmentedControl
          options={MODE_OPTIONS}
          value={interactionMode}
          onchange={(next) => (interactionMode = next as InteractionMode)}
          ariaLabel="Map interaction"
          size="sm"
        />
      </div>
      <PanelButton variant="secondary" onclick={() => zoom(1 / 1.35)}>
        Zoom in
      </PanelButton>
      <PanelButton variant="secondary" onclick={() => zoom(1.35)}>
        Zoom out
      </PanelButton>
      <PanelButton
        variant="secondary"
        onclick={() => {
          view = { ...MIDDLE_EARTH_VIEW };
        }}
      >
        Middle Earth
      </PanelButton>
      <PanelButton
        variant="secondary"
        onclick={() => {
          view = { ...FULL_VIEW };
        }}
      >
        Whole site
      </PanelButton>
    </div>
  </header>

  <p class="notice notice--{noticeKind}" role="status">{notice}</p>

  <div class="workspace">
    <section class="rail rail--left" aria-label="What to place">
      {#each presetsByGroup as group (group.id)}
        <h2 class="rail-heading">{group.label}</h2>
        <ul class="preset-list">
          {#each group.presets as preset (preset.id)}
            {@const count = draft.markers.filter(
              (marker) => marker.presetId === preset.id
            ).length}
            <li>
              <button
                type="button"
                class="preset"
                class:preset--active={activePresetId === preset.id}
                aria-pressed={activePresetId === preset.id}
                onclick={() => {
                  activePresetId = preset.id;
                  report(preset.instruction, "quiet");
                }}
              >
                <span class="preset-label">{preset.label}</span>
                <span class="preset-shape">{preset.shape}</span>
                {#if count > 0}
                  <span class="preset-count">{count}</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {/each}
    </section>

    <section class="map-shell" aria-label="Site map">
      <p class="instruction">{activePreset.instruction}</p>
      <svg
        bind:this={svgElement}
        bind:clientWidth={mapWidth}
        bind:clientHeight={mapHeight}
        class="map"
        class:map--pan={interactionMode === "pan"}
        viewBox="{view.x} {view.y} {view.width} {viewHeight}"
        role="application"
        aria-label="Registered Flow Fest orthophoto with placed site markers"
        onpointerdown={handlePointerDown}
        onpointermove={handlePointerMove}
        onpointerup={finishPointer}
        onpointercancel={finishPointer}
        onwheel={handleWheel}
      >
        <image
          href="/data/flow-fest-sim/ortho.webp"
          x="0"
          y="0"
          width={FLOW_FEST_IMAGE.width}
          height={FLOW_FEST_IMAGE.height}
        />

        {#each draft.markers as marker (marker.id)}
          {@const selected = marker.id === selectedMarkerId}
          {@const tip = arrowTip(marker)}
          <g
            class="marker"
            class:marker--selected={selected}
            class:marker--incomplete={!markerReadiness(marker)}
          >
            {#if marker.shape === "circle" && tip}
              <circle
                class="marker-circle"
                cx={marker.anchor.x}
                cy={marker.anchor.y}
                r={Math.hypot(
                  tip.x - marker.anchor.x,
                  tip.y - marker.anchor.y
                )}
              />
            {/if}
            {#if tip && marker.shape !== "circle"}
              <line
                class="marker-arrow"
                x1={marker.anchor.x}
                y1={marker.anchor.y}
                x2={tip.x}
                y2={tip.y}
                stroke-width={3 * pixelScale}
              />
              <circle
                class="marker-tip"
                cx={tip.x}
                cy={tip.y}
                r={4 * pixelScale}
              />
            {/if}
            <circle
              class="marker-dot"
              cx={marker.anchor.x}
              cy={marker.anchor.y}
              r={(selected ? 7 : 5) * pixelScale}
              stroke-width={2 * pixelScale}
            />
            {#if selected}
              <text
                class="marker-text"
                x={marker.anchor.x + 10 * pixelScale}
                y={marker.anchor.y - 8 * pixelScale}
                font-size={13 * pixelScale}
              >
                {marker.label}
              </text>
            {/if}
          </g>
        {/each}
      </svg>
    </section>

    <section class="rail rail--right" aria-label="Placed markers">
      <h2 class="rail-heading">
        Placed
        <span class="rail-count">{draft.markers.length}</span>
      </h2>
      {#if incompleteCount > 0}
        <p class="warn">
          {incompleteCount}
          {incompleteCount === 1 ? "marker still needs" : "markers still need"} a
          direction. Press one on the map and drag.
        </p>
      {/if}

      {#if draft.markers.length === 0}
        <p class="empty">
          Nothing placed yet. Choose something on the left, then press on the map
          and drag.
        </p>
      {:else}
        <ul class="marker-list">
          {#each draft.markers as marker (marker.id)}
            <li>
              <button
                type="button"
                class="marker-row"
                class:marker-row--active={marker.id === selectedMarkerId}
                aria-pressed={marker.id === selectedMarkerId}
                onclick={() => focusMarker(marker)}
              >
                <span class="marker-row-label">{marker.label}</span>
                <span class="marker-row-detail">{describe(marker)}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      {#if selectedMarker}
        {@const editing = selectedMarker}
        <div class="editor">
          <label class="field">
            <span>Name</span>
            <input
              type="text"
              value={editing.label}
              oninput={(event) => renameSelected(event.currentTarget.value)}
            />
          </label>
          <label class="field">
            <span>Note</span>
            <textarea
              rows="3"
              value={editing.note}
              placeholder="Anything I would not guess from the picture."
              oninput={(event) => annotateSelected(event.currentTarget.value)}
            ></textarea>
          </label>
          <div class="editor-actions">
            {#if editing.shape !== "point"}
              <PanelButton
                variant="secondary"
                onclick={() => clearHandle(editing.id)}
              >
                Clear direction
              </PanelButton>
            {/if}
            <PanelButton
              variant="secondary"
              onclick={() => deleteMarker(editing.id)}
            >
              Delete
            </PanelButton>
          </div>
        </div>
      {/if}

      <label class="field">
        <span>Anything about the site as a whole</span>
        <textarea
          rows="3"
          value={draft.overallNote}
          placeholder="How the parts relate, what the picture gets wrong, what changes year to year."
          oninput={(event) => {
            draft.overallNote = event.currentTarget.value.slice(0, 2000);
            persist();
          }}
        ></textarea>
      </label>

      <div class="rail-actions">
        <PanelButton
          variant="primary"
          onclick={saveMarkers}
          disabled={saving}
          ariaBusy={saving}
        >
          {saving ? "Saving…" : "Save to disk"}
        </PanelButton>
        <PanelButton variant="secondary" onclick={copyMarkers}>
          Copy JSON
        </PanelButton>
        <PanelButton variant="secondary" onclick={undo}>Undo</PanelButton>
      </div>
    </section>
  </div>
</main>

<style>
  .marker-page {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    min-height: 100vh;
    background: var(--theme-background, #0d1117);
    color: var(--theme-text, #e6edf3);
  }

  .page-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 650;
  }

  .lede {
    margin: 4px 0 0;
    max-width: 68ch;
    color: var(--theme-text-secondary, #9aa7b4);
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .head-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .notice {
    margin: 0;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.875rem;
    background: var(--theme-surface, #161b22);
    border: 1px solid var(--theme-border, #30363d);
  }

  .notice--success {
    border-color: var(--semantic-success, #3fb950);
  }

  .notice--error {
    border-color: var(--semantic-error, #f85149);
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(200px, 240px) minmax(0, 1fr) minmax(
        260px,
        340px
      );
    gap: 12px;
    align-items: start;
    flex: 1;
    min-height: 0;
  }

  .rail {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 10px;
    background: var(--theme-surface, #161b22);
    border: 1px solid var(--theme-border, #30363d);
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }

  .rail-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 8px 0 0;
    font-size: 0.75rem;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--theme-text-secondary, #9aa7b4);
  }

  .rail-heading:first-child {
    margin-top: 0;
  }

  .rail-count {
    font-variant-numeric: tabular-nums;
  }

  .preset-list,
  .marker-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .preset,
  .marker-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      background-color var(--duration-fast, 120ms) ease,
      border-color var(--duration-fast, 120ms) ease;
  }

  .preset:hover,
  .marker-row:hover {
    background: var(--theme-surface-hover, rgba(255, 255, 255, 0.06));
  }

  .preset--active,
  .marker-row--active {
    background: color-mix(in srgb, var(--theme-accent, #4493f8) 18%, transparent);
    border-color: var(--theme-accent, #4493f8);
  }

  .preset-label {
    flex: 1;
    font-size: 0.875rem;
  }

  .preset-shape {
    font-size: 0.6875rem;
    color: var(--theme-text-secondary, #9aa7b4);
  }

  .preset-count {
    min-width: 20px;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--theme-accent, #4493f8);
    color: var(--theme-text-on-accent, #fff);
    font-size: 0.6875rem;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .marker-row {
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
  }

  .marker-row-label {
    font-size: 0.875rem;
  }

  .marker-row-detail {
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-secondary, #9aa7b4);
  }

  .map-shell {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  .instruction {
    margin: 0;
    font-size: 0.875rem;
    color: var(--theme-text-secondary, #9aa7b4);
  }

  /**
   * SegmentedControl stretches to its container by default, so two five-letter
   * labels would each take a third of a 4K header. `flex-basis: auto` resolves
   * to `width`, so the width has to be capped, not just the basis.
   */
  .mode-switch {
    flex: 0 0 auto;
    width: max-content;
    max-width: 220px;
  }

  .map {
    display: block;
    width: 100%;
    height: clamp(320px, calc(100vh - 210px), 2100px);
    border-radius: 10px;
    border: 1px solid var(--theme-border, #30363d);
    background: #000;
    touch-action: none;
    cursor: crosshair;
  }

  .map--pan {
    cursor: grab;
  }

  .marker-dot {
    fill: var(--theme-accent, #4493f8);
    stroke: #fff;
  }

  .marker--incomplete .marker-dot {
    fill: var(--semantic-warning, #d29922);
  }

  .marker--selected .marker-dot {
    fill: #fff;
    stroke: var(--theme-accent, #4493f8);
  }

  .marker-arrow {
    stroke: var(--theme-accent, #4493f8);
  }

  .marker-tip {
    fill: var(--theme-accent, #4493f8);
  }

  .marker-circle {
    fill: color-mix(in srgb, var(--theme-accent, #4493f8) 14%, transparent);
    stroke: var(--theme-accent, #4493f8);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }

  .marker-text {
    fill: #fff;
    paint-order: stroke;
    stroke: rgba(0, 0, 0, 0.85);
    stroke-width: 3;
    vector-effect: non-scaling-stroke;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.75rem;
    color: var(--theme-text-secondary, #9aa7b4);
  }

  .field input,
  .field textarea {
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid var(--theme-border, #30363d);
    background: var(--theme-background, #0d1117);
    color: var(--theme-text, #e6edf3);
    font: inherit;
    font-size: 0.875rem;
    resize: vertical;
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-radius: 8px;
    border: 1px solid var(--theme-border, #30363d);
  }

  .editor-actions,
  .rail-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .empty,
  .warn {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--theme-text-secondary, #9aa7b4);
  }

  .warn {
    color: var(--semantic-warning, #d29922);
  }

  /**
   * Wide canvas buys a second preset column, not larger controls: seventeen
   * presets stop scrolling and the roads group becomes visible without a hunt.
   */
  @media (min-width: 2200px) {
    .workspace {
      grid-template-columns: minmax(0, 420px) minmax(0, 1fr) minmax(0, 400px);
    }

    .preset-list {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
    }
  }

  /**
   * Stacked, the picker must not push the map off screen — that is hiding the
   * workspace, not recomposing for it. The presets flow into as many columns as
   * fit and the rail keeps a short capped height, so the map stays in view.
   */
  @media (max-width: 1200px) {
    .workspace {
      grid-template-columns: minmax(0, 1fr);
    }

    .rail--left {
      max-height: 30vh;
    }

    .rail--right {
      max-height: none;
    }

    .preset-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 4px;
    }

    .map {
      height: 58vh;
    }
  }

  /**
   * On a phone the map is the workspace, so it leads and the picker follows it.
   * The lede folds away because the instruction line above the map already says
   * what the current preset wants.
   */
  @media (max-width: 700px) {
    .lede {
      display: none;
    }

    .map-shell {
      order: -1;
    }

    .rail--left {
      max-height: 34vh;
    }

    .map {
      height: 46vh;
    }
  }

  /**
   * Short and wide (a folded phone in landscape) is a height problem, not a
   * width problem. Stacking there buries the map under the picker, so the
   * columns come back, the lede folds away, and the placed-marker rail moves
   * under the map where it can scroll without stealing map height.
   */
  @media (max-height: 620px) {
    .marker-page {
      gap: 8px;
      padding: 10px;
    }

    .lede {
      display: none;
    }

    .workspace {
      grid-template-columns: minmax(0, 210px) minmax(0, 1fr);
    }

    .rail--left {
      max-height: none;
    }

    .rail--right {
      grid-column: 1 / -1;
      max-height: 40vh;
    }

    .preset-list {
      display: flex;
      grid-template-columns: none;
    }

    .map {
      height: calc(100vh - 150px);
    }
  }
</style>
