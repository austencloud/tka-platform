<!--
  ShapeMatrixDrill.svelte

  The elemental drill for a clicked shape-matrix cell: six element-styled VTG
  mode chips (water/earth/sun/fire/air/moon) over a hero stage where the cell's
  mandala renders big and still, then gets traced live by the selected props
  when an element is picked. One stable screen — no sub-navigation, no card
  thumbnails, no back button. Spec:
  docs/superpowers/specs/2026-07-19-shape-matrix-elemental-drill-design.md

  The still MandalaHeroLayer is a cold-load floor. Once ready, the canonical
  InlineAnimationPlayer is the only path rendering owner, including its
  disassembled view. Two complete realization layers stay alive during a swap:
  the old one keeps moving while the incoming one starts behind it, then the
  shared dual-source crossfader hands over the stage. Three props make the
  layering actually work — all three are load-bearing:
  - backgroundAlpha: 0 — the player's canvas is TRANSPARENT (alpha context +
    CanvasSurface data-transparent), so the host's atmosphere stays visible.
  - trailSettingsOverride: HERO_TRAIL_PRESET — vivid trail, per-instance,
    never by mutating the global animationSettings singleton.
  - tipEffectMap: HERO_TIP_EFFECT_MAP — the render loop's hasTrailTips gate
    draws ZERO trails without a "trails" tip assignment, whatever the trail
    settings say. Preset and map ship as a pair (see HomeHero).

  Element selection is sticky across cell changes. Once a cell is open, one
  realization always plays; re-clicking its chip does not elevate a still start
  position into a special state.

  InlineAnimationPlayer lives under features/browse/sequences/display/... .
  Importing a features/browse component from a shared component already has
  precedent: SequenceHeroDemo.svelte (src/lib/shared/landing/components/) does
  exactly this via the same LazyMount + dynamic-import idiom. Only a hidden
  source is keyed when assigned a different sequence. The visible player is
  never remounted before its replacement is moving.

  The drill owns its own empty state now (pair is nullable): chips disabled,
  "Pick a cell" hint in the hero, caption line reserved but empty — the panel
  structure is constant from load, so first selection causes no layout shift.
-->
<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import DualSourceCrossfade from "$lib/shared/components/DualSourceCrossfade.svelte";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import MandalaHeroLayer from "./MandalaHeroLayer.svelte";
  import ElementChipRow from "./ElementChipRow.svelte";
  import PropRelationshipChipRow from "./PropRelationshipChipRow.svelte";
  import {
    buildModeRealizationCandidates,
    type ModeRealization,
  } from "../services/build-mode-realizations";
  import {
    flowerKey,
    flowerLabel,
    type Flower,
  } from "../domain/flower-signature";
  import type { ShapeMatrixData } from "../services/shape-matrix-flowers";
  import {
    MODE_ORDER,
    type VtgMode,
  } from "../services/shape-matrix-realizations";
  import type { MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
  import {
    HERO_TRAIL_PRESET,
    HERO_TIP_EFFECT_MAP,
  } from "$lib/shared/landing/data/hero-trail-preset";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { getShapeMatrixTransitionRecorder } from "../debug/shape-matrix-transition-recorder";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { TrackingMode } from "$lib/shared/animation-engine/domain/types/trail-types";
  import type { ShapeMatrixRelationshipDriver } from "../app/state/shape-matrix-app-state.svelte";
  import { QualityTier } from "$lib/shared/animation-engine/domain/types/quality-types";
  import { resolveRealizationEntryStep } from "../services/realization-phase-handoff";

  interface Props {
    /** Nullable: the drill renders its own "Pick a cell" state before any click. */
    pair: { left: Flower; right: Flower } | null;
    data: ShapeMatrixData;
    /** Optional composing surface action. The public archive remains a viewer;
     *  pickers can receive the exact realization this drill already built. */
    onselectRealization?: (realization: ModeRealization) => void;
    selectLabel?: string;
    /** Optional externally-owned mode for URL-restored app state. */
    selectedMode?: VtgMode | null;
    selectedPropMode?: VtgMode | null;
    onmodechange?: (mode: VtgMode | null) => void;
    onpropmodechange?: (mode: VtgMode | null) => void;
    relationshipDriver?: ShapeMatrixRelationshipDriver;
    propType?: PropType;
  }
  let {
    pair,
    data,
    onselectRealization,
    selectLabel = "Use this realization",
    selectedMode = $bindable(null),
    selectedPropMode = $bindable(null),
    onmodechange,
    onpropmodechange,
    relationshipDriver = "hands",
    propType = PropType.STAFF,
  }: Props = $props();

  let animationPlayerModule: ReturnType<typeof importAnimationPlayer> | null =
    null;

  function importAnimationPlayer() {
    return import("$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte");
  }

  function loadAnimationPlayer() {
    animationPlayerModule ??= importAnimationPlayer();
    return animationPlayerModule;
  }

  const SHAPE_MATRIX_TRAIL_PRESET = {
    ...HERO_TRAIL_PRESET,
    trackingMode: TrackingMode.RIGHT_END,
    // The generic player precomputes a full path cache whenever a sequence
    // changes. That is useful for long-lived editors but creates a 150–230 ms
    // main-thread task during rapid matrix exploration. Live capture is the
    // correct owner here: the player is already running continuously.
    usePathCache: false,
  };

  // Sticky across pair changes by design (spec: "Selection persistence").
  // Realizations are immutable payloads replaced as a unit. Raw state keeps
  // Svelte from proxying every nested beat and motion merely to hand a new
  // sequence to the standby player.
  let realizations = $state.raw<ModeRealization[]>([]);
  let activeBuiltRealization = $state.raw<ModeRealization | null>(null);
  let activeBuildTransitionId = 0;
  let building = $state(false);
  let buildError = $state(false);

  type PlayerSource = "first" | "second";
  interface PlayerLayer {
    key: string;
    realization: ModeRealization;
    paths: MandalaPaths;
    clubTipDx: number;
    propType: PropType;
    transitionId: number;
    initialStep: number;
  }

  interface PlayerReadiness {
    key: string | null;
    canvasReady: boolean;
    sequenceReady: boolean;
    motionReady: boolean;
  }

  let firstLayer = $state.raw<PlayerLayer | null>(null);
  let secondLayer = $state.raw<PlayerLayer | null>(null);
  let firstStep = $state(0);
  let secondStep = $state(0);
  let visibleSource = $state<PlayerSource | null>(null);
  let waitingSource = $state<PlayerSource | null>(null);
  let visibleRealization = $state.raw<ModeRealization | null>(null);
  let railRealization = $state.raw<ModeRealization | null>(null);
  let queuedLayer: PlayerLayer | null = null;
  let crossfadeOutgoing = $state<PlayerSource | null>(null);
  let activeTransitionId: number | null = null;
  let stageScheduled = false;
  let railUpdateFrame: number | null = null;
  let railSequenceUpdateFrame: number | null = null;
  let readinessTimer: ReturnType<typeof setTimeout> | null = null;
  // These live at the drill level rather than inside a keyed player snippet.
  // A canvas may report initialization after its retiring snippet is gone; a
  // root-owned derived remains valid for that final callback.
  const firstPlaybackAllowed = $derived(
    visibleSource === "first" ||
      waitingSource === "first" ||
      crossfadeOutgoing === "first"
  );
  const secondPlaybackAllowed = $derived(
    visibleSource === "second" ||
      waitingSource === "second" ||
      crossfadeOutgoing === "second"
  );
  const transitionRecorder = getShapeMatrixTransitionRecorder();
  const playerReadiness: Record<PlayerSource, PlayerReadiness> = {
    first: {
      key: null,
      canvasReady: false,
      sequenceReady: false,
      motionReady: false,
    },
    second: {
      key: null,
      canvasReady: false,
      sequenceReady: false,
      motionReady: false,
    },
  };
  const playerCanvasInitialized: Record<PlayerSource, boolean> = {
    first: false,
    second: false,
  };

  const pairKey = $derived(
    pair ? `${propType}|${flowerKey(pair.left)}|${flowerKey(pair.right)}` : null
  );

  // The cell's mandala: left hand's flower merged with right hand's flower — the
  // exact merge renderCell uses for the grid tiles, so the hero IS the cell.
  const heroPaths = $derived.by<MandalaPaths | null>(() => {
    if (!pair) return null;
    return {
      left: data.left.get(flowerKey(pair.left))?.left ?? [],
      right: data.right.get(flowerKey(pair.right))?.right ?? [],
      purple: [],
    };
  });

  // Build the selected relationship first, then fill the remaining five one
  // frame at a time. Prop-first phase searches are cheap, but yielding between
  // hand paths keeps rapid selection from competing with the moving canvas.
  const realizationCache = new Map<string, ModeRealization[]>();
  let realizationChoicesKey: string | null = null;
  let pendingRealizationChoices: {
    cacheKey: string;
    layerKey: string;
    values: ModeRealization[];
  } | null = null;

  interface PlayerLoadFailure {
    key: string;
    source: PlayerSource;
    retry: () => void;
  }
  let playerLoadFailure = $state<PlayerLoadFailure | null>(null);

  function realizationKey(
    realization: ModeRealization,
    shapeKey: string
  ): string {
    return `${realization.mode}|${realization.propMode ?? "auto"}|${shapeKey}`;
  }

  function nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  function realizationForSelection(
    candidates: ModeRealization[],
    requestedMode: VtgMode,
    requestedPropMode: VtgMode | null,
    allowFallback: boolean
  ): ModeRealization | null {
    if (requestedPropMode) {
      const requested =
        candidates.find(
          (candidate) =>
            candidate.mode === requestedMode &&
            candidate.propMode === requestedPropMode
        ) ??
        candidates.find(
          (candidate) => candidate.propMode === requestedPropMode
        );
      if (requested) return requested;
      return allowFallback
        ? (candidates.find((candidate) => candidate.mode === requestedMode) ??
            candidates[0] ??
            null)
        : null;
    }
    return (
      candidates.find((candidate) => candidate.mode === requestedMode) ??
      (allowFallback ? candidates[0] : null) ??
      null
    );
  }

  function syncSelection(
    realization: ModeRealization,
    requestedMode: VtgMode,
    requestedPropMode: VtgMode | null
  ): void {
    if (realization.mode !== requestedMode) {
      selectedMode = realization.mode;
      onmodechange?.(realization.mode);
    }
    if (
      requestedPropMode !== null &&
      realization.propMode !== requestedPropMode
    ) {
      selectedPropMode = realization.propMode;
      onpropmodechange?.(realization.propMode);
    }
  }

  $effect(() => {
    const p = pair;
    const key = pairKey;
    const requestedMode = selectedMode;
    const requestedPropMode = selectedPropMode;
    if (!p || !key || !requestedMode) {
      realizations = [];
      activeBuiltRealization = null;
      return;
    }
    const cacheKey = key;
    const layerKey = `${requestedMode}|${requestedPropMode ?? "auto"}|${key}`;
    const transitionId = transitionRecorder.claimLatest(layerKey);
    transitionRecorder.buildStarted(transitionId);
    const cached = realizationCache.get(cacheKey);
    if (cached) {
      activeBuildTransitionId = transitionId;
      transitionRecorder.buildReady(transitionId);
      const selectedRealization = realizationForSelection(
        cached,
        requestedMode,
        requestedPropMode,
        true
      );
      activeBuiltRealization = selectedRealization;
      if (selectedRealization)
        syncSelection(selectedRealization, requestedMode, requestedPropMode);
      if (!selectedRealization) transitionRecorder.superseded(transitionId);
      if (realizationChoicesKey === cacheKey) {
        realizations = cached;
        pendingRealizationChoices = null;
        building = false;
      } else if (selectedRealization) {
        // The full picker payload does not affect the selected frame. Keep it
        // out of the canvas sequence-swap window and publish it only after the
        // canonical crossfade reports that the new source has settled.
        pendingRealizationChoices = {
          cacheKey,
          layerKey,
          values: cached,
        };
        building = true;
      } else {
        pendingRealizationChoices = null;
        building = false;
      }
      buildError = false;
      return;
    }
    building = true;
    buildError = false;
    activeBuiltRealization = null;
    const overlay = {
      left: data.left.get(flowerKey(p.left))?.left ?? [],
      right: data.right.get(flowerKey(p.right))?.right ?? [],
      tipPoint: data.tipPoint,
      clubTipDx: data.clubTipDx,
    };
    let cancelled = false;
    (async () => {
      try {
        const primaryCandidates = await buildModeRealizationCandidates(
          p,
          overlay,
          requestedMode
        );
        const primary = realizationForSelection(
          primaryCandidates,
          requestedMode,
          requestedPropMode,
          false
        );
        if (cancelled) return;
        activeBuildTransitionId = transitionId;
        activeBuiltRealization = primary;
        if (primary) transitionRecorder.buildReady(transitionId);

        const built = [...primaryCandidates];
        // Once a realization is already visible, the selected relationship gets
        // the frame budget until its replacement has finished fading in. The
        // other five relationships only populate picker choices, so building
        // them inside the handoff steals frames without changing what is shown.
        if (visibleSource !== null) {
          await nextFrame();
          while (
            !cancelled &&
            (stageScheduled ||
              waitingSource !== null ||
              activeTransitionId !== null)
          ) {
            await nextFrame();
          }
        }
        for (const mode of MODE_ORDER) {
          if (mode === requestedMode) continue;
          await nextFrame();
          if (cancelled) return;
          const candidates = await buildModeRealizationCandidates(
            p,
            overlay,
            mode
          );
          if (cancelled) return;
          built.push(...candidates);
        }
        built.sort(
          (left, right) =>
            MODE_ORDER.indexOf(left.mode) - MODE_ORDER.indexOf(right.mode)
        );
        if (!cancelled) {
          realizationCache.set(cacheKey, built);
          realizations = built;
          realizationChoicesKey = cacheKey;
          pendingRealizationChoices = null;
          const selectedRealization = realizationForSelection(
            built,
            requestedMode,
            requestedPropMode,
            true
          );
          activeBuiltRealization = selectedRealization;
          if (!primary && selectedRealization) {
            transitionRecorder.buildReady(transitionId);
          }
          if (selectedRealization)
            syncSelection(
              selectedRealization,
              requestedMode,
              requestedPropMode
            );
          if (!selectedRealization) transitionRecorder.superseded(transitionId);
          building = false;
        }
      } catch (err) {
        // Without this, a rejected build leaves the chips pointing at nothing
        // with no signal — surface it on the caption line, keep chips usable.
        console.error("shape-matrix elemental drill build failed", err);
        if (!cancelled) {
          transitionRecorder.superseded(transitionId);
          buildError = true;
          building = false;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  });

  const activeReal = $derived(activeBuiltRealization);
  const availableHandModes = $derived(
    MODE_ORDER.filter((mode) =>
      realizations.some((realization) => realization.mode === mode)
    )
  );
  // Mode picked but absent from a completed build (a dropped mode is never
  // substituted) → same caption-line error as a failed build.
  const modeMissing = $derived(
    selectedMode !== null &&
      pair !== null &&
      !building &&
      !buildError &&
      !activeReal
  );
  const captionRealization = $derived(visibleRealization ?? activeReal);
  const captionKey = $derived.by(() => {
    const visibleLayer = visibleSource ? getLayer(visibleSource) : null;
    if (visibleLayer) return visibleLayer.key;
    if (activeReal && pairKey) return realizationKey(activeReal, pairKey);
    if (buildError || modeMissing) return "error";
    return pair ? "pending" : "empty";
  });
  const visibleStep = $derived(
    visibleSource === "first"
      ? firstStep
      : visibleSource === "second"
        ? secondStep
        : 0
  );
  function pictographArrowsApproved(flower: Flower): boolean {
    return flower.turns === "fl" || Number.isInteger(flower.turns * 2);
  }
  const pictographRailReady = $derived(
    pair !== null &&
      pictographArrowsApproved(pair.left) &&
      pictographArrowsApproved(pair.right)
  );

  function getLayer(source: PlayerSource | null): PlayerLayer | null {
    if (source === "first") return firstLayer;
    if (source === "second") return secondLayer;
    return null;
  }

  function clearReadinessTimer(): void {
    if (readinessTimer !== null) clearTimeout(readinessTimer);
    readinessTimer = null;
  }

  function armReadinessTimer(
    callback: () => void,
    delay = DURATION.dramatic * 4
  ): void {
    clearReadinessTimer();
    readinessTimer = setTimeout(callback, delay);
  }

  function setLayer(source: PlayerSource, layer: PlayerLayer | null): void {
    clearReadinessTimer();
    if (playerLoadFailure?.source === source) playerLoadFailure = null;
    playerReadiness[source] = {
      key: layer?.key ?? null,
      canvasReady: playerCanvasInitialized[source],
      sequenceReady: false,
      motionReady: false,
    };
    if (source === "first") {
      firstLayer = layer;
      firstStep = 0;
    } else {
      secondLayer = layer;
      secondStep = 0;
    }
  }

  function setSourceStep(source: PlayerSource, step: number): void {
    if (source === "first") firstStep = step;
    else secondStep = step;
  }

  function stageLayer(layer: PlayerLayer): void {
    if (getLayer(visibleSource)?.key === layer.key) {
      transitionRecorder.superseded(layer.transitionId);
      if (queuedLayer) transitionRecorder.superseded(queuedLayer.transitionId);
      queuedLayer = null;
      if (waitingSource) {
        const waitingLayer = getLayer(waitingSource);
        if (waitingLayer)
          transitionRecorder.superseded(waitingLayer.transitionId);
        setLayer(waitingSource, null);
        waitingSource = null;
      }
      commitPendingRealizationChoices(layer.key);
      return;
    }

    if (activeTransitionId !== null) {
      if (queuedLayer) transitionRecorder.superseded(queuedLayer.transitionId);
      queuedLayer = layer;
      return;
    }

    const incoming = visibleSource === "first" ? "second" : "first";
    const replacedLayer = getLayer(incoming);
    if (replacedLayer)
      transitionRecorder.superseded(replacedLayer.transitionId);
    setLayer(incoming, layer);
    waitingSource = incoming;
    const expectedKey = layer.key;
    let coldStartExtensionUsed = false;
    const expireWaitingLayer = () => {
      readinessTimer = null;
      if (waitingSource !== incoming || getLayer(incoming)?.key !== expectedKey)
        return;
      // A first visit may still be parsing the animation engine when the
      // ordinary handoff deadline arrives. There is no outgoing player to
      // protect, so keep the mandala floor visible and give the cold module one
      // extended window instead of permanently deleting the canvas.
      if (visibleSource === null && !coldStartExtensionUsed) {
        coldStartExtensionUsed = true;
        armReadinessTimer(expireWaitingLayer, DURATION.dramatic * 16);
        return;
      }
      transitionRecorder.superseded(layer.transitionId);
      commitPendingRealizationChoices(expectedKey);
      setLayer(incoming, null);
      waitingSource = null;
      const queued = queuedLayer;
      queuedLayer = null;
      if (queued) stageLayer(queued);
    };
    // Retargeting owns exactly one readiness deadline. Arming the replacement
    // always cancels the superseded layer's pending timeout first.
    armReadinessTimer(expireWaitingLayer);
  }

  function finishCrossfade(active: PlayerSource): void {
    if (visibleSource !== active || activeTransitionId === null) return;

    const settledLayer = getLayer(active);
    transitionRecorder.settled(activeTransitionId);
    activeTransitionId = null;
    crossfadeOutgoing = null;
    if (railUpdateFrame !== null) cancelAnimationFrame(railUpdateFrame);
    if (railSequenceUpdateFrame !== null)
      cancelAnimationFrame(railSequenceUpdateFrame);
    if (settledLayer) {
      commitPendingRealizationChoices(settledLayer.key);
      const settledKey = settledLayer.key;
      railUpdateFrame = requestAnimationFrame(() => {
        railUpdateFrame = null;
        if (visibleSource !== active || getLayer(active)?.key !== settledKey)
          return;
        visibleRealization = settledLayer.realization;
        railSequenceUpdateFrame = requestAnimationFrame(() => {
          railSequenceUpdateFrame = null;
          if (visibleSource !== active || getLayer(active)?.key !== settledKey)
            return;
          railRealization = settledLayer.realization;
        });
      });
    }
    const queued = queuedLayer;
    queuedLayer = null;
    if (queued) {
      stageLayer(queued);
      return;
    }

    // The first cell initially needs only one player, but the first subsequent
    // shape change must not pay to construct a second animation engine inside
    // the handoff. Mount its hidden twin after the opening fade has settled.
    // Sequence loading still happens while playbackAllowed is false, so later
    // swaps reuse an initialized canvas and only replace its sequence.
    const standby: PlayerSource = active === "first" ? "second" : "first";
    if (!getLayer(standby) && settledLayer) {
      setLayer(standby, {
        ...settledLayer,
        transitionId: 0,
      });
    }
  }

  function revealReadyPlayer(source: PlayerSource, key: string): void {
    if (waitingSource !== source) return;
    const layer = getLayer(source);
    const readiness = playerReadiness[source];
    if (
      !layer ||
      layer.key !== key ||
      readiness.key !== key ||
      !readiness.canvasReady ||
      !readiness.sequenceReady ||
      !readiness.motionReady
    )
      return;

    waitingSource = null;
    clearReadinessTimer();
    crossfadeOutgoing = visibleSource;
    activeTransitionId = layer.transitionId;
    visibleSource = source;
    transitionRecorder.fadeStarted(layer.transitionId);
  }

  function commitPendingRealizationChoices(layerKey: string): void {
    const pending = pendingRealizationChoices;
    if (!pending || pending.layerKey !== layerKey) return;
    realizations = pending.values;
    realizationChoicesKey = pending.cacheKey;
    pendingRealizationChoices = null;
    building = false;
  }

  function registerPlayerRetry(
    _node: HTMLElement,
    initial: PlayerLoadFailure
  ): { update: (failure: PlayerLoadFailure) => void; destroy: () => void } {
    let current = initial;
    const register = (failure: PlayerLoadFailure) => {
      current = failure;
      playerLoadFailure = failure;
      commitPendingRealizationChoices(failure.key);
      if (waitingSource === failure.source) clearReadinessTimer();
    };
    register(initial);
    return {
      update: register,
      destroy: () => {
        if (playerLoadFailure?.retry === current.retry) {
          playerLoadFailure = null;
        }
      },
    };
  }

  function retryPlayerLoad(failure: PlayerLoadFailure): void {
    playerLoadFailure = null;
    const layer = getLayer(failure.source);
    if (layer?.key === failure.key && waitingSource === failure.source) {
      armReadinessTimer(() => {
        if (
          waitingSource !== failure.source ||
          getLayer(failure.source)?.key !== failure.key
        )
          return;
        transitionRecorder.superseded(layer.transitionId);
        commitPendingRealizationChoices(failure.key);
        setLayer(failure.source, null);
        waitingSource = null;
        const queued = queuedLayer;
        queuedLayer = null;
        if (queued) stageLayer(queued);
      });
    }
    failure.retry();
  }

  function handlePlayerCanvasInitialized(
    source: PlayerSource,
    key: string
  ): void {
    playerCanvasInitialized[source] = true;
    const layer = getLayer(source);
    const readiness = playerReadiness[source];
    if (!layer || layer.key !== key || readiness.key !== key) return;
    readiness.canvasReady = true;
    transitionRecorder.canvasReady(layer.transitionId);
    revealReadyPlayer(source, key);
  }

  function handlePlayerSequenceReady(
    source: PlayerSource,
    key: string,
    sequenceId: string
  ): void {
    const layer = getLayer(source);
    const readiness = playerReadiness[source];
    if (
      !layer ||
      layer.key !== key ||
      layer.realization.seq.id !== sequenceId ||
      readiness.key !== key
    )
      return;
    readiness.sequenceReady = true;
    revealReadyPlayer(source, key);
  }

  function handlePlayerMotion(
    source: PlayerSource,
    key: string,
    expectedSequenceId: string,
    currentStep: number,
    sequenceId: string | null
  ): void {
    if (getLayer(source)?.key !== key || sequenceId !== expectedSequenceId)
      return;
    const readiness = playerReadiness[source];
    // Reused players do not emit their mount-only ready callback again. A
    // matching playback event is stronger evidence that the replacement
    // sequence is loaded, and prevents a rapid axis change waiting forever.
    readiness.sequenceReady = true;
    setSourceStep(source, currentStep);
    if (waitingSource !== source || currentStep <= 1.001) return;

    const layer = getLayer(source);
    if (!layer || readiness.key !== key) return;
    if (!readiness.motionReady) {
      readiness.motionReady = true;
      transitionRecorder.motionReady(layer.transitionId);
    }
    revealReadyPlayer(source, key);
  }

  function createPlayerCallbacks(source: PlayerSource) {
    return {
      onReady: () => {
        const layer = getLayer(source);
        if (!layer) return;
        handlePlayerSequenceReady(source, layer.key, layer.realization.seq.id);
      },
      onCanvasInitialized: () => {
        const layer = getLayer(source);
        if (!layer) return;
        handlePlayerCanvasInitialized(source, layer.key);
      },
      onStepChange: (step: number, sequenceId: string | null) => {
        const layer = getLayer(source);
        if (!layer) return;
        handlePlayerMotion(
          source,
          layer.key,
          layer.realization.seq.id,
          step,
          sequenceId
        );
      },
    };
  }

  // CanvasSurface treats callback changes as engine-configuration changes.
  // These wrappers stay stable while reading each source's current layer, so a
  // cell change reloads the existing player instead of rebuilding its engine.
  const playerCallbacks = {
    first: createPlayerCallbacks("first"),
    second: createPlayerCallbacks("second"),
  } satisfies Record<PlayerSource, ReturnType<typeof createPlayerCallbacks>>;

  function clearPlayers(): void {
    transitionRecorder.clearOpen();
    firstLayer = null;
    secondLayer = null;
    firstStep = 0;
    secondStep = 0;
    visibleSource = null;
    waitingSource = null;
    visibleRealization = null;
    railRealization = null;
    realizationChoicesKey = null;
    pendingRealizationChoices = null;
    queuedLayer = null;
    crossfadeOutgoing = null;
    activeTransitionId = null;
    clearReadinessTimer();
    playerReadiness.first = {
      key: null,
      canvasReady: false,
      sequenceReady: false,
      motionReady: false,
    };
    playerReadiness.second = {
      key: null,
      canvasReady: false,
      sequenceReady: false,
      motionReady: false,
    };
    playerCanvasInitialized.first = false;
    playerCanvasInitialized.second = false;
  }

  $effect(() => {
    if (!pair) return;
    // Start the one heavy module request while the matrix realization is being
    // built. When the player layer mounts, LazyMount receives the same promise
    // and does not begin a second request on the critical path.
    void loadAnimationPlayer().catch(() => {
      animationPlayerModule = null;
    });
  });

  $effect(() => {
    const realization = activeReal;
    const paths = heroPaths;
    const key = pairKey;

    if (!pair) {
      untrack(clearPlayers);
      return;
    }
    if (!realization || !paths || !key) return;

    stageScheduled = true;
    const frame = requestAnimationFrame(() => {
      stageScheduled = false;
      untrack(() => {
        const layerKey = realizationKey(realization, key);
        stageLayer({
          key: layerKey,
          realization,
          paths,
          clubTipDx: data.clubTipDx,
          propType,
          transitionId:
            activeBuildTransitionId || transitionRecorder.claimLatest(layerKey),
          initialStep: entryStepFor(realization, layerKey),
        });
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      stageScheduled = false;
    };
  });

  onDestroy(() => {
    if (railUpdateFrame !== null) cancelAnimationFrame(railUpdateFrame);
    if (railSequenceUpdateFrame !== null)
      cancelAnimationFrame(railSequenceUpdateFrame);
    clearPlayers();
    transitionRecorder.destroy();
  });

  function elementName(raw: string): string {
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function entryStepFor(realization: ModeRealization, key: string): number {
    const outgoingLayer = visibleSource ? getLayer(visibleSource) : null;
    return resolveRealizationEntryStep({
      outgoingStep: outgoingLayer ? visibleStep : 0,
      outgoingStepCount: outgoingLayer?.realization.seq.steps.length ?? 0,
      incomingStepCount: realization.seq.steps.length,
      fallbackKey: key,
    });
  }

  function selectMode(mode: VtgMode | null): void {
    if (pair && mode === null) return;
    if (pair && mode && mode !== selectedMode) {
      transitionRecorder.requested(
        `mode:${mode}:props:${selectedPropMode ?? "auto"}:${pairKey ?? "unknown"}`
      );
    }
    selectedMode = mode;
    onmodechange?.(mode);
  }

  function selectHandMode(mode: VtgMode | null): void {
    if (selectedPropMode !== null) {
      selectedPropMode = null;
      onpropmodechange?.(null);
    }
    selectMode(mode);
  }

  function selectPropMode(mode: VtgMode): void {
    if (!pair || mode === selectedPropMode) return;
    transitionRecorder.requested(
      `props:${mode}:hand:${selectedMode ?? "none"}:${pairKey ?? "unknown"}`
    );
    selectedPropMode = mode;
    onpropmodechange?.(mode);
  }
</script>

{#snippet playerPlaceholder()}
  <div class="lazy-region-state player-placeholder" role="status">
    <span>Loading animation…</span>
  </div>
{/snippet}

{#snippet playerLoadError(
  _loadError: unknown,
  retry: () => void,
  source: PlayerSource,
  key: string
)}
  <div
    class="lazy-region-state player-load-error"
    use:registerPlayerRetry={{ source, key, retry }}
  >
    <p>Animation didn’t load.</p>
  </div>
{/snippet}

{#snippet firstPlayerLoadError(loadError: unknown, retry: () => void)}
  {#if firstLayer}
    {@render playerLoadError(loadError, retry, "first", firstLayer.key)}
  {/if}
{/snippet}

{#snippet secondPlayerLoadError(loadError: unknown, retry: () => void)}
  {#if secondLayer}
    {@render playerLoadError(loadError, retry, "second", secondLayer.key)}
  {/if}
{/snippet}

{#snippet railPlaceholder()}
  <div class="lazy-region-state rail-placeholder" role="status">
    <span>Loading pictographs…</span>
  </div>
{/snippet}

{#snippet railLoadError(_loadError: unknown, retry: () => void)}
  <div class="lazy-region-state rail-load-error" role="alert">
    <p>Pictographs didn’t load.</p>
    <PanelButton onclick={retry}>Try again</PanelButton>
  </div>
{/snippet}

{#snippet player(layer: PlayerLayer | null, source: PlayerSource)}
  {#if layer}
    <div class="realization-layer">
      <div
        class="realization-atmosphere"
        style={`--atmosphere-hand: ${layer.realization.element.accentColor}; --atmosphere-prop: ${layer.realization.propRelationship.element?.accentColor ?? layer.realization.element.accentColor}`}
        aria-hidden="true"
      ></div>
      <div class="player-layer">
        <LazyMount
          loader={loadAnimationPlayer}
          active={true}
          debugName="shape matrix animation player"
          placeholder={playerPlaceholder}
          error={source === "first"
            ? firstPlayerLoadError
            : secondPlayerLoadError}
          props={{
            sequence: layer.realization.seq,
            autoPlay: true,
            autoPlayDelay: 0,
            chrome: "minimal",
            fill: true,
            disassemblyLayout: "sidecar",
            showWordHeader: true,
            beatIndicators: false,
            leftPropType: layer.propType,
            rightPropType: layer.propType,
            trailSettingsOverride: SHAPE_MATRIX_TRAIL_PRESET,
            tipEffectMap: HERO_TIP_EFFECT_MAP,
            backgroundAlpha: 0,
            interactive: false,
            hoverHint: "none",
            // This is a full TKA animation surface. Its canonical canvas menu
            // supplies Disassemble/Reassemble and the shared display controls.
            disableContextMenu: false,
            playbackAllowed:
              source === "first" ? firstPlaybackAllowed : secondPlaybackAllowed,
            resumeWhenPlaybackAllowed: true,
            initialStep: layer.initialStep,
            onReady: playerCallbacks[source].onReady,
            onCanvasInitialized: playerCallbacks[source].onCanvasInitialized,
            onStepChange: playerCallbacks[source].onStepChange,
            // A handoff briefly runs two canvases. Start both at the existing
            // low tier so glow and dense subdivision work cannot block input.
            initialQualityTier: QualityTier.LOW,
          }}
        />
      </div>
    </div>
  {/if}
{/snippet}

{#snippet firstPlayer()}
  {@render player(firstLayer, "first")}
{/snippet}

{#snippet secondPlayer()}
  {@render player(secondLayer, "second")}
{/snippet}

<section
  class="drill"
  aria-label="Shape matrix realizations"
  style={captionRealization
    ? `--hand-el: ${captionRealization.element.accentColor}; --hand-dark: ${captionRealization.element.darkComplement}; --prop-el: ${captionRealization.propRelationship.element?.accentColor ?? captionRealization.element.accentColor}`
    : undefined}
>
  <div class="mode-picker">
    {#if relationshipDriver === "hands"}
      <ElementChipRow
        selected={selectedMode}
        available={availableHandModes}
        availabilityReady={!building}
        disabled={!pair}
        onpick={selectHandMode}
      />
    {:else}
      <PropRelationshipChipRow
        {realizations}
        {selectedMode}
        {selectedPropMode}
        activePropMode={activeReal?.propMode ?? null}
        equalRotatingTurns={pair !== null &&
          pair.left.turns !== "fl" &&
          pair.right.turns !== "fl" &&
          pair.left.turns === pair.right.turns}
        disabled={!pair}
        {building}
        ontarget={selectPropMode}
        onhandpick={(mode) => selectMode(mode)}
      />
    {/if}
  </div>

  <div class="media-stage">
    <div class="hero-stage">
      <div class="hero-square">
        {#if pair && heroPaths}
          <!-- The still mandala is a cold-load floor only. Once the canonical
               animation canvas has painted, its own trail is the sole path
               rendering owner, including while that canvas is disassembled. -->
          <MandalaHeroLayer
            paths={heroPaths}
            clubTipDx={data.clubTipDx}
            opacity={visibleSource ? 0 : 1}
            glowColor={captionRealization?.element.accentColor}
          />
          <DualSourceCrossfade
            active={visibleSource}
            duration={DURATION.emphasis}
            profile="soft-dissolve"
            first={firstPlayer}
            second={secondPlayer}
            onsettled={finishCrossfade}
          />
          {#if playerLoadFailure}
            <div class="player-load-notice" role="alert">
              <p>Animation didn’t load.</p>
              <PanelButton onclick={() => retryPlayerLoad(playerLoadFailure)}
                >Try again</PanelButton
              >
            </div>
          {/if}
        {:else}
          <div class="hero-hint">
            <p class="hint-lead">Pick a cell</p>
            <p class="hint-sub">
              Its shape opens here. Each element traces it live.
            </p>
          </div>
        {/if}
      </div>
    </div>

    <div class="strip-zone" role="group" aria-label="Pictograph timeline">
      {#if railRealization && pictographRailReady}
        <LazyMount
          loader={() => import("$lib/shared/timeline/StepStrip.svelte")}
          active={true}
          keepAlive={false}
          debugName="shape matrix pictograph carousel"
          placeholder={railPlaceholder}
          error={railLoadError}
          props={{
            sequence: railRealization.seq,
            includeStartPosition: false,
            currentStep: visibleStep,
            bpm: 60,
            density: "compact",
            fillHeight: true,
            anchor: "center",
            orientation: "horizontal",
            loop: true,
            leftPropType: propType,
            rightPropType: propType,
            stepPulse: false,
            staggerCellUpdates: true,
          }}
        />
      {:else if railRealization}
        <p class="quarter-status">
          Quarter-turn pictograph arrows are in visual calibration.
        </p>
      {/if}
    </div>
  </div>

  <!-- The reserved box never changes size. Only the relationship inside it
       dissolves after the new realization has taken ownership of the stage. -->
  <div class="caption-stage">
    <Crossfade key={captionKey} fill duration={DURATION.fast}>
      <p
        class="caption"
        style={captionRealization
          ? `--el: ${captionRealization.element.accentColor}`
          : undefined}
      >
        {#if buildError || modeMissing}
          <span class="cap-err"
            >Could not build this realization. Reload and try again.</span
          >
        {:else if captionRealization}
          <span class="relationship-badge hand-relationship">
            <img src={captionRealization.element.iconPath} alt="" />
            <span class="badge-copy">
              <span class="relationship-label">Hands</span>
              <strong>{elementName(captionRealization.element.element)}</strong>
              <small>{captionRealization.element.name}</small>
            </span>
          </span>
          <i class="fas fa-arrow-right derivation-arrow" aria-hidden="true"></i>
          <span class="sr-only">produces</span>
          <span class="relationship-badge prop-relationship">
            {#if captionRealization.propRelationship.kind === "full"}
              <img
                src={captionRealization.propRelationship.element.iconPath}
                alt=""
              />
              <span class="badge-copy">
                <span class="relationship-label">Props</span>
                <strong
                  >{elementName(
                    captionRealization.propRelationship.element.element
                  )}</strong
                >
                <small>{captionRealization.propRelationship.element.name}</small
                >
              </span>
            {:else if captionRealization.propRelationship.kind === "direction-only"}
              <span class="relationship-dot" aria-hidden="true"></span>
              <span class="badge-copy">
                <span class="relationship-label">Props</span>
                <strong
                  >{captionRealization.propRelationship.direction === "same"
                    ? "Same"
                    : "Opposite"}</strong
                >
                <small>Direction only · different rates</small>
              </span>
            {:else}
              <span class="relationship-dot float-dot" aria-hidden="true"
              ></span>
              <span class="badge-copy">
                <span class="relationship-label">Props</span>
                <strong>Float</strong>
                <small>No prop rotation</small>
              </span>
            {/if}
          </span>
        {:else if pair}
          <span>
            Blue <span class="cap-blue">{flowerLabel(pair.left)}</span> over red
            <span class="cap-red">{flowerLabel(pair.right)}</span>
          </span>
        {/if}
      </p>
    </Crossfade>
  </div>

  {#if onselectRealization}
    <div class="select-action" class:available={visibleRealization !== null}>
      <PanelButton
        variant="primary"
        disabled={!visibleRealization}
        onclick={() =>
          visibleRealization && onselectRealization(visibleRealization)}
      >
        <i class="fas fa-person-running" aria-hidden="true"></i>
        {selectLabel}
      </PanelButton>
    </div>
  {/if}
</section>

<style>
  /* Fills whatever height its host gives it: the route's .drill-pane is a
     fixed-height flex box (matched to the matrix stage on wide screens). */
  .drill {
    height: 100%;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    grid-template-areas:
      "modes"
      "media"
      "caption"
      "action";
    min-height: 0;
    gap: 0.8rem;
    background:
      radial-gradient(
        circle at 10% 8%,
        color-mix(in srgb, var(--hand-el, transparent) 5%, transparent),
        transparent 34%
      ),
      radial-gradient(
        circle at 92% 92%,
        color-mix(in srgb, var(--prop-el, transparent) 5%, transparent),
        transparent 38%
      );
  }

  .mode-picker {
    grid-area: modes;
    min-width: 0;
    min-height: 0;
  }

  .media-stage {
    grid-area: media;
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    border-radius: 16px;
    background: var(--theme-card-bg, #0a0f14);
  }

  /* container-type: size makes cqw/cqh resolve against the animation region,
     so the square can take min(height, width) without measuring in JS. */
  .hero-stage {
    position: relative;
    min-height: 0;
    display: grid;
    place-items: center;
    container-type: size;
    overflow: hidden;
    background:
      radial-gradient(
        circle at 32% 42%,
        color-mix(in srgb, var(--hand-el, transparent) 9%, transparent),
        transparent 54%
      ),
      radial-gradient(
        circle at 68% 58%,
        color-mix(in srgb, var(--prop-el, transparent) 9%, transparent),
        transparent 54%
      ),
      var(--theme-card-bg, #0a0f14);
  }

  .strip-zone {
    height: clamp(4.25rem, 13cqh, 6.5rem);
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border-top: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #101721) 74%,
      var(--theme-card-bg, #0a0f14)
    );
  }
  .quarter-status {
    display: grid;
    place-content: center;
    height: 100%;
    margin: 0;
    padding: 0.75rem;
    color: var(--theme-text-dim, oklch(0.68 0.02 270));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.4;
    text-align: center;
  }

  /* The cold-load floor and live player fill the same square, so their
     coordinate frames coincide during the readiness handoff. */
  .hero-square {
    position: relative;
    aspect-ratio: 1 / 1;
    height: min(100cqh, 100cqw, 72rem);
  }

  .player-layer {
    position: absolute;
    inset: 0;
  }

  .lazy-region-state {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 0.55rem;
    padding: 0.75rem;
    text-align: center;
    color: var(--theme-text-dim, oklch(0.68 0.02 270));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.4;
  }

  .lazy-region-state p,
  .player-load-notice p {
    margin: 0;
  }

  .player-placeholder {
    background: color-mix(
      in srgb,
      var(--theme-card-bg, #0a0f14) 88%,
      transparent
    );
  }

  .player-load-error,
  .rail-load-error {
    color: var(--semantic-error, #fb8a8a);
  }

  .player-load-notice {
    position: absolute;
    z-index: 3;
    left: 50%;
    bottom: 1rem;
    translate: -50% 0;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    max-width: calc(100% - 2rem);
    padding: 0.55rem 0.7rem 0.55rem 0.9rem;
    border: 1px solid
      color-mix(in srgb, var(--semantic-error, #fb8a8a) 45%, transparent);
    border-radius: 999px;
    background: var(--theme-panel-bg, #101721);
    color: var(--semantic-error, #fb8a8a);
    box-shadow: 0 0.5rem 1.5rem var(--theme-shadow, rgb(0 0 0 / 0.4));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.4;
  }

  .realization-layer {
    position: absolute;
    inset: 0;
    isolation: isolate;
  }

  .realization-atmosphere {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(
        circle at 36% 42%,
        color-mix(in srgb, var(--atmosphere-hand) 13%, transparent),
        transparent 58%
      ),
      radial-gradient(
        circle at 64% 58%,
        color-mix(in srgb, var(--atmosphere-prop) 13%, transparent),
        transparent 58%
      );
  }

  .hero-hint {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    text-align: center;
    gap: 0.3rem;
    padding: 1.5rem;
  }
  .hint-lead {
    margin: 0;
    font-size: clamp(1.05rem, 1rem + 0.2vw, 1.3rem);
    font-weight: 700;
    color: var(--theme-text, oklch(0.92 0.02 270));
  }
  .hint-sub {
    margin: 0;
    font-size: clamp(var(--font-size-min, 0.875rem), 0.82rem + 0.12vw, 0.95rem);
    line-height: 1.55;
    color: var(--theme-text-dim, oklch(0.68 0.02 270));
  }

  .caption-stage {
    grid-area: caption;
    height: 3rem;
    min-width: 0;
  }
  .caption {
    width: 100%;
    height: 100%;
    margin: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 0.45rem;
    font-size: clamp(var(--font-size-min, 0.875rem), 0.82rem + 0.1vw, 0.98rem);
    line-height: 1.5;
    text-align: center;
    color: var(--theme-text, oklch(0.85 0.02 270));
  }
  .relationship-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    min-height: 3rem;
    justify-content: center;
    padding: 0.35rem 0.6rem;
    border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
    border-radius: 12px;
    background: color-mix(in srgb, currentColor 8%, transparent);
  }
  .relationship-badge img {
    width: 1.65rem;
    height: 1.65rem;
    object-fit: contain;
  }
  .badge-copy {
    display: grid;
    line-height: 1.05;
    text-align: left;
  }
  .badge-copy small {
    color: var(--theme-text-dim, oklch(0.68 0.015 270));
    font-size: var(--font-size-compact, 0.75rem);
    white-space: nowrap;
  }
  .relationship-label {
    color: var(--theme-text-dim, oklch(0.62 0.015 270));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    letter-spacing: 0.015em;
  }
  .hand-relationship strong {
    color: var(--hand-el, var(--theme-text, oklch(0.85 0.02 270)));
  }
  .hand-relationship {
    color: var(--hand-el, var(--theme-text, oklch(0.85 0.02 270)));
  }
  .prop-relationship strong {
    color: var(--prop-el, var(--theme-text, oklch(0.85 0.02 270)));
  }
  .prop-relationship {
    color: var(--prop-el, var(--theme-text, oklch(0.85 0.02 270)));
  }
  .relationship-dot {
    width: 1rem;
    height: 1rem;
    flex: 0 0 auto;
    border-radius: 999px;
    background: var(--prop-el, var(--theme-accent, #f4b54c));
    box-shadow: 0 0 10px
      color-mix(
        in srgb,
        var(--prop-el, var(--theme-accent, #f4b54c)) 45%,
        transparent
      );
  }
  .float-dot {
    background: var(--theme-text-dim, #b7c0cc);
  }
  .derivation-arrow {
    color: var(--theme-accent, oklch(0.64 0.03 80));
    font-size: 0.75rem;
  }
  .select-action {
    grid-area: action;
    min-height: var(--min-touch-target, 44px);
    visibility: hidden;
  }
  .select-action.available {
    visibility: visible;
  }
  .select-action :global(.panel-btn) {
    width: 100%;
  }
  .cap-err {
    color: var(--semantic-error, #fb8a8a);
    font-size: var(--font-size-min, 0.875rem);
  }
  .cap-blue {
    color: var(--prop-blue, oklch(0.68 0.14 255));
  }
  .cap-red {
    color: var(--prop-red, oklch(0.68 0.16 25));
  }

  @container shape-matrix-drill (max-width: 30rem) {
    .badge-copy small {
      display: none;
    }

    .caption {
      gap: 0.3rem;
    }

    .relationship-badge {
      gap: 0.3rem;
      padding-inline: 0.35rem;
    }

    .relationship-badge img {
      width: 1.35rem;
      height: 1.35rem;
    }
  }

  /* Phone-height realizations keep the live animation legible. The dedicated
     rail returns as soon as the host has enough width to show it without
     reducing the hero to a thumbnail. */
  @container shape-matrix-drill (max-width: 25rem) {
    .drill {
      grid-template-rows: auto minmax(0, 1fr) auto auto;
      grid-template-areas:
        "modes"
        "media"
        "caption"
        "action";
    }

    .strip-zone {
      display: none;
    }
  }

  /* A short-wide host is height-bound, not width-bound. Put the element picker
     beside the hero and let the animation take the full available height. The
     carousel is deliberately omitted in this one composition because even a
     compact rail would make the primary visual smaller. */
  @container shape-matrix-drill (min-width: 42rem) and (max-height: 24rem) {
    .drill {
      display: grid;
      grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) auto;
      grid-template-areas:
        "modes media"
        "action media";
      column-gap: 0.8rem;
      row-gap: 0.55rem;
    }

    .mode-picker {
      grid-area: modes;
      align-self: center;
    }

    .strip-zone {
      display: none;
    }

    .caption-stage {
      display: none;
    }

    .select-action {
      grid-area: action;
    }
  }
</style>
