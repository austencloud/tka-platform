<script lang="ts">
  /**
   * The anti turn through negative space, as a filmstrip.
   *
   * Austen, reviewing the previous two-notation comparison page: "I don't
   * comprehend this page." He asked for four frozen frames of ONE motion —
   * the right hand's North-thumb-in to East-thumb-out reach on the anti
   * route — with no second prop, no running clock, and no prose: "don't put
   * all this text on my screen that's not that useful to me unless you're
   * using it." This page is that filmstrip. The pro route from the old
   * comparison is still reachable through `?route=`, but it is not what
   * opens.
   *
   * It is an INSTRUMENT, not a solver. Nothing here touches the collision
   * owner, the arm solve, the grip, or the pose — the blue prop is hidden
   * through the scene package's own visibility context in `ReachStage.svelte`,
   * not by moving it or faking the pose. If the rig does not carry the thumb
   * end through the pocket he described, the frames are supposed to show
   * that plainly. See `docs/reference/negative-space-and-wall-plane-reach.md`
   * §8 for his own description of the pocket, quoted frame by frame.
   */
  import { Canvas, T } from "@threlte/core";
  import { onMount } from "svelte";
  import type CameraControls from "camera-controls";
  import type {
    AvatarGripDiagnostics,
    AvatarPoseDiagnostics,
    CollisionEvent,
  } from "@austencloud/scene-3d";

  import { page } from "$app/state";

  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import type { CharacterId } from "$lib/shared/3d/domain/character-model";
  import ChipPopoverOption from "$lib/shared/browse/components/filter-chips/ChipPopoverOption.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { reducedMotion } from "$lib/shared/transitions/motion";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";

  import { INSPECTION_FOV_DEG } from "../_lab-kit/inspection-shot";
  import {
    isLocalOnlyCharacter,
    labCharacterName,
    labCharacters,
  } from "../_lab-kit/lab-characters";

  import {
    MAX_FILMSTRIP_FRAMES,
    MIN_FILMSTRIP_FRAMES,
    formatFilmstripPercent,
    halveFrames,
    insertMidpoints,
    percentToPhase,
  } from "./filmstrip-frames";
  import ReachReadouts from "./ReachReadouts.svelte";
  import ReachStage from "./ReachStage.svelte";
  import {
    REACH_VIEWS,
    reachGridCenter,
    reachShotForView,
    reachViewById,
    shoulderHeight,
    type InspectionShot,
  } from "./reach-framing";
  import { REACH_ROUTES, SHORT_SWEEP_ROUTE } from "./reach-routes";
  import { ReachLabState } from "./reach-state.svelte";
  import {
    formatSettleLabel,
    observeFrameSettle,
    PaneSettleTracker,
    SETTLE_LABEL_SIZER_TEXT,
    type SettleReading,
  } from "./reach-settle";
  import {
    EMPTY_REACH_FRAME,
    measureReachFrame,
    type ReachFrame,
    type Vec3,
  } from "./reach-telemetry";

  const lab = new ReachLabState();

  const route = $derived(
    REACH_ROUTES.find((candidate) => candidate.id === lab.routeId) ??
      SHORT_SWEEP_ROUTE
  );
  const view = $derived(reachViewById(lab.viewId));
  const frames = $derived(lab.frames);

  /**
   * One diagnostics entry per frame, keyed by the frame's own formatted
   * percent rather than array index. Finer/Coarser insert and remove frames
   * mid-array; an index would silently reattach a reading to the wrong pane
   * the moment the array reshuffles.
   */
  let poses = $state<Record<string, AvatarPoseDiagnostics | null>>({});
  let grips = $state<Record<string, AvatarGripDiagnostics | null>>({});
  let shoulders = $state<Record<string, Vec3 | null>>({});

  /**
   * One tracker per pane, keyed the same way as `poses`/`grips` above. Plain
   * (non-reactive) bookkeeping — `settleReadings` below is what the template
   * reads, so a tracker mutating in place does not need to be a `$state`
   * itself.
   */
  const settleTrackers = new Map<string, PaneSettleTracker>();
  let settleReadings = $state<Record<string, SettleReading>>({});

  interface MeasuredFrame {
    percent: number;
    key: string;
    frame: ReachFrame;
  }

  const measured = $derived.by((): MeasuredFrame[] =>
    frames.map((percent) => {
      const key = formatFilmstripPercent(percent);
      const diagnostics = poses[key];
      const gripDiagnostics = grips[key];
      const frame =
        !diagnostics || !gripDiagnostics
          ? EMPTY_REACH_FRAME
          : measureReachFrame({
              diagnostics,
              gripDiagnostics,
              shoulderWorld: shoulders[key] ?? null,
              shoulderHeight: shoulderHeight(),
              gridCenter: reachGridCenter(),
            });
      return { percent, key, frame };
    })
  );

  /**
   * Every measured value, in world units, on the console.
   *
   * Live-scrub readouts on this page were unreliable — values could sign-flip
   * mid-motion. Each entry here is a frozen phase rather than a moving clock,
   * which is what makes this reading trustworthy where the old scrubbing
   * readout was not. `settle` says whether THIS particular reading has
   * actually finished arriving yet — see `reach-settle.ts`; a frozen phase and
   * a settled one are not the same thing; a pane can sit at a fixed phase for
   * seconds while its own rig is still converging on it. Read-only, and only
   * in dev.
   */
  $effect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    (window as unknown as { __reachFrames?: unknown }).__reachFrames = {
      route: route.id,
      shoulderHeight: shoulderHeight(),
      gridCenter: reachGridCenter(),
      frames: measured.map(({ percent, key, frame }) => ({
        percent,
        phase: percentToPhase(percent),
        frame,
        settle: settleReadings[key] ?? { settled: false, ticks: 0, ms: 0 },
      })),
    };
  });

  function receivePose(key: string) {
    return (
      _events: CollisionEvent[],
      diagnostics: AvatarPoseDiagnostics,
      gripDiagnostics: AvatarGripDiagnostics
    ) => {
      poses[key] = diagnostics;
      grips[key] = gripDiagnostics;

      // This callback fires once per rendered frame for THIS pane (Threlte's
      // own per-frame task), which is exactly what "ticks" needs to count —
      // unlike the shared `measured` derived below, which can recompute for
      // reasons that have nothing to do with this pane's own next tick.
      let tracker = settleTrackers.get(key);
      if (!tracker) {
        tracker = new PaneSettleTracker();
        tracker.reset(performance.now());
        settleTrackers.set(key, tracker);
      }
      const frame = measureReachFrame({
        diagnostics,
        gripDiagnostics,
        shoulderWorld: shoulders[key] ?? null,
        shoulderHeight: shoulderHeight(),
        gridCenter: reachGridCenter(),
      });
      settleReadings[key] = observeFrameSettle(tracker, frame, performance.now());
    };
  }

  function receiveShoulder(key: string) {
    return (point: Vec3 | null) => {
      shoulders[key] = point;
    };
  }

  // Each pane solves its own shot against its own aspect ratio, so a pane
  // that wraps onto a narrower row still frames the subject instead of
  // cropping it.
  let paneWidths = $state<Record<string, number>>({});
  let paneHeights = $state<Record<string, number>>({});

  const shots = $derived.by((): Record<string, InspectionShot> => {
    const map: Record<string, InspectionShot> = {};
    for (const { key } of measured) {
      const width = paneWidths[key] ?? 0;
      const height = paneHeights[key] ?? 0;
      map[key] = reachShotForView(
        view,
        width > 0 && height > 0 ? width / height : 1
      );
    }
    return map;
  });

  /**
   * The angle picker has to move the eye, not just the pivot.
   *
   * `camera-controls` takes ownership of the camera transform as soon as it
   * is live, so a reactive `position` on the camera is overwritten on its
   * next update. The shot is applied through `setLookAt` instead; the camera
   * still belongs to the controls afterwards, and a manual orbit is
   * preserved until the next deliberate angle change.
   */
  let cameraControls = $state<Record<string, CameraControls | null>>({});

  // `OrbitControls.ref` is a `$bindable` with a fallback, so `bind:ref` may
  // never see `undefined` for a key — only `null` or a real instance. A new
  // frame percent (typed frame count, Finer/Coarser, or a pasted link) can
  // reach the `{#each}` below before this record has that key, and `pre`
  // runs before that block re-renders, so every current key exists first.
  $effect.pre(() => {
    for (const percent of frames) {
      const key = formatFilmstripPercent(percent);
      if (!(key in cameraControls)) cameraControls[key] = null;
    }
  });

  $effect(() => {
    const eased = !reducedMotion();
    for (const { key } of measured) {
      const controls = cameraControls[key];
      const shot = shots[key];
      if (!controls || !shot) continue;
      void controls.setLookAt(
        shot.position[0],
        shot.position[1],
        shot.position[2],
        shot.target[0],
        shot.target[1],
        shot.target[2],
        eased
      );
    }
  });

  const viewOptions = $derived(
    REACH_VIEWS.map((option) => ({
      value: option.id,
      label: option.label,
      shortLabel: option.pickerLabel,
      ariaLabel: `${option.label}: ${option.hint}`,
    }))
  );

  const routeOptions = $derived(
    REACH_ROUTES.map((option) => ({
      value: option.id,
      label: option.label,
    }))
  );

  const characterOptions = $derived(
    labCharacters().map((definition) => ({
      value: definition.id,
      label: definition.name,
      local: isLocalOnlyCharacter(definition.id),
    }))
  );

  function handleFiner(): void {
    lab.setFrames(insertMidpoints(lab.frames));
  }

  function handleCoarser(): void {
    lab.setFrames(halveFrames(lab.frames));
  }

  const atMaxFrames = $derived(frames.length >= MAX_FILMSTRIP_FRAMES);
  const atMinFrames = $derived(frames.length <= MIN_FILMSTRIP_FRAMES);

  /**
   * The lab's pickers run at the compact density, which the primitive defines
   * as a 32px option — deliberate for a dense desktop instrument, and under
   * the 44px touch floor. On a touch pointer they go back to standard rather
   * than shipping a target a finger cannot hit.
   */
  let coarsePointer = $state(false);
  let characterMenuOpen = $state(false);
  const pickerDensity = $derived(coarsePointer ? "standard" : "compact");

  $effect(() => {
    if (!characterMenuOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest(".character-chip")) {
        characterMenuOpen = false;
      }
    };
    document.addEventListener("pointerdown", closeOnOutside, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutside, true);
  });

  onMount(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const syncPointer = () => (coarsePointer = coarse.matches);
    syncPointer();
    coarse.addEventListener("change", syncPointer);
    return () => coarse.removeEventListener("change", syncPointer);
  });

  onMount(() => {
    // This route breaks out of the app layout, so nothing has set the theme
    // variables the shared pickers and chips paint with. Reading the
    // device's own saved background keeps the lab in the app's palette
    // instead of every primitive falling back to its hardcoded default.
    void import("$lib/shared/settings/utils/background-theme-calculator").then(
      ({ ensureThemeApplied }) => ensureThemeApplied()
    );
  });

  // A pasted link or a reload arrives as a real navigation, which is the one
  // URL change SvelteKit still reports through `page.url`.
  $effect(() => {
    void page.url.href;
    lab.syncFromNavigation();
  });

  // Back and Forward move the address bar with no framework signal at all,
  // because every write here is shallow routing.
  $effect(() => lab.attachUrlSync());

  // A character or route swap changes the skeleton or the sequence every
  // measurement was taken from, so the probes start again rather than
  // reporting a reading that belonged to the previous body or path.
  $effect(() => {
    void lab.character;
    void lab.routeId;
    poses = {};
    grips = {};
    shoulders = {};
    settleTrackers.clear();
    settleReadings = {};
  });
</script>

<svelte:head>
  <title>Negative space reach · TKA lab</title>
</svelte:head>

<main class="lab">
  <h1 class="sr-only">
    Negative space reach — anti route filmstrip, {frames.length} frames
  </h1>

  <div class="controls">
    <div class="control">
      <span class="control-label" id="reach-view-label">Angle</span>
      <div class="control-row">
        <SegmentedControl
          options={viewOptions}
          value={lab.viewId}
          onchange={(next) => lab.setView(next)}
          size="sm"
          density={pickerDensity}
          ariaLabelledby="reach-view-label"
        />
        <FilterChipBase
          label="Measurement overlay"
          icon="fa-solid fa-ruler-combined"
          mode="toggle"
          size="sm"
          active={lab.overlay}
          onclick={() => lab.setOverlay(!lab.overlay)}
        />
      </div>
      <span class="control-hint">{view.hint}</span>
    </div>

    <div class="control">
      <span class="control-label" id="reach-character-label">Body</span>
      <div class="character-chip">
        <FilterChipBase
          label={labCharacterName(lab.character)}
          icon="fa-solid fa-person"
          mode="dropdown"
          size="sm"
          labelScale="readable"
          active={true}
          expanded={characterMenuOpen}
          ariaLabel="Body: {labCharacterName(lab.character)}"
          onclick={() => (characterMenuOpen = !characterMenuOpen)}
        >
          {#snippet children()}
            {#each characterOptions as option (option.value)}
              <ChipPopoverOption
                label={option.local
                  ? `${option.label} · only on this machine`
                  : option.label}
                selected={option.value === lab.character}
                onclick={() => {
                  lab.setCharacter(option.value as CharacterId);
                  characterMenuOpen = false;
                }}
              />
            {/each}
          {/snippet}
        </FilterChipBase>
      </div>
    </div>

    <div class="control">
      <span class="control-label" id="reach-frames-label">Frames</span>
      <div class="control-row">
        <FilterChipBase
          label="Finer"
          icon="fa-solid fa-plus"
          mode="action"
          size="sm"
          disabled={atMaxFrames}
          ariaLabel="Finer: add a frame between every pair shown"
          onclick={handleFiner}
        />
        <FilterChipBase
          label="Coarser"
          icon="fa-solid fa-minus"
          mode="action"
          size="sm"
          disabled={atMinFrames}
          ariaLabel="Coarser: remove every other frame"
          onclick={handleCoarser}
        />
      </div>
    </div>

    <!--
      Reachable, not prominent — the anti route is what this page is for, and
      the pro route from the old comparison page is one deliberate pick away
      rather than a second thing being shown by default.
    -->
    <div class="control route-control">
      <span class="control-label" id="reach-route-label">Route</span>
      <SegmentedControl
        options={routeOptions}
        value={lab.routeId}
        onchange={(next) => lab.setRoute(next)}
        size="sm"
        density={pickerDensity}
        ariaLabelledby="reach-route-label"
      />
    </div>
  </div>

  <div class="filmstrip">
    {#each measured as { percent, key, frame } (key)}
      <section
        class="pane"
        aria-label={`Frame at ${formatFilmstripPercent(percent)} percent through the reach`}
      >
        <p class="phase-label">{formatFilmstripPercent(percent)}%</p>
        <p class="settle-label" class:settled={settleReadings[key]?.settled}>
          <span class="settle-label-sizer" aria-hidden="true"
            >{SETTLE_LABEL_SIZER_TEXT}</span
          >
          <span class="settle-label-live">{formatSettleLabel(settleReadings[key])}</span>
        </p>

        <div
          class="viewport"
          bind:clientWidth={paneWidths[key]}
          bind:clientHeight={paneHeights[key]}
        >
          <!--
            No scene clear colour. An alpha buffer lets the page's own surface
            show through, so the canvas sits on the product's ground rather
            than on a rectangle that appears nowhere else.
          -->
          <Canvas shadows rendererParameters={{ alpha: true }}>
            <T.PerspectiveCamera
              makeDefault
              position={shots[key]?.position ?? [0, 1.5, 3]}
              fov={INSPECTION_FOV_DEG}
            >
              <OrbitControls
                enableDamping
                enablePan={false}
                rightDragAction="rotate"
                bind:ref={cameraControls[key]}
                target={shots[key]?.target ?? [0, 1.5, 0]}
                minDistance={0.3}
                maxDistance={12}
                maxPolarAngle={Math.PI}
              />
            </T.PerspectiveCamera>

            <ReachStage
              id={`reach-${route.id}-${key}`}
              phase={percentToPhase(percent)}
              sequence={route.sequence}
              characterId={lab.character}
              gridEmphasis={view.grid}
              overlayFrame={lab.overlay ? frame : null}
              onCollisionEvents={receivePose(key)}
              onShoulder={receiveShoulder(key)}
            />
          </Canvas>
        </div>

        <ReachReadouts
          {frame}
          routeLabel={route.label}
          compact
          provisional={!(settleReadings[key]?.settled ?? false)}
        />
      </section>
    {/each}
  </div>

  <div class="readouts-disclosure">
    <FilterChipBase
      label={lab.readoutsOpen ? "Hide readouts" : "Readouts"}
      icon="fa-solid fa-ruler"
      mode="toggle"
      size="sm"
      active={lab.readoutsOpen}
      onclick={() => lab.toggleReadouts()}
    />
    <Crossfade key={lab.readoutsOpen} animateHeight>
      {#snippet children()}
        {#if lab.readoutsOpen}
          <div class="full-readouts">
            {#each measured as { percent, key, frame } (key)}
              <ReachReadouts
                {frame}
                routeLabel={`${route.label} · ${formatFilmstripPercent(percent)}%`}
              />
            {/each}
          </div>
        {/if}
      {/snippet}
    </Crossfade>
  </div>
</main>

<style>
  .lab {
    display: grid;
    grid-template-rows: auto auto auto;
    gap: 0.85rem;
    min-height: 100dvh;
    padding: 1rem clamp(0.75rem, 2vw, 2rem) 1.5rem;
    color: var(--theme-text, #fff);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0.75rem 1.25rem;
  }

  .control {
    display: grid;
    gap: 0.3rem;
    justify-items: start;
  }

  .control-label {
    font-size: var(--font-size-xs, 0.75rem);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  .control-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }

  .control-hint {
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    max-width: 46ch;
  }

  /* Deprioritized: smaller and set apart from the primary controls, so the
     anti-route default reads as the page rather than one of two choices. */
  .route-control {
    opacity: 0.75;
    margin-left: auto;
  }

  .character-chip {
    /* The popover is a DOM child of this wrapper and paints above the page. */
    position: relative;
    --chip-option-color: var(--theme-accent);
  }

  .character-chip :global(.chip-popover) {
    max-height: min(60vh, 22rem);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .filmstrip {
    display: grid;
    /* One row when there is room, wrapping into a grid as panes stop
       fitting — the default four fit one row from ~900px up; narrower
       viewports wrap automatically with no separate breakpoint to maintain. */
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.9rem;
    align-items: start;
  }

  .pane {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 0;
  }

  .phase-label {
    margin: 0;
    font-size: var(--font-size-xs, 0.75rem);
    font-weight: 650;
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  /*
    Ghost-sizer (no-layout-shift.md, technique 1): the hidden sizer holds the
    widest realistic label ("settled · 9999 ticks · 99.9 s") in the same grid
    cell as the live text, so the row's reserved height already accounts for
    the longer "settled" text while "settling…" is still showing. Neither
    span is forced to one line — a narrow pane may wrap both, but since the
    sizer is always the longer string, its own wrapped height already covers
    whatever the live text needs, so switching between the two never moves
    the viewport below it.
  */
  .settle-label {
    display: grid;
    /* Matches `.pane`'s own `min-width: 0` above: a grid item's default
       `min-width: auto` sizes to its unwrapped content, which would let a
       long label push this pane wider than its track instead of wrapping. */
    min-width: 0;
    margin: 0;
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  .settle-label-sizer,
  .settle-label-live {
    grid-area: 1 / 1;
    min-width: 0;
  }

  .settle-label-sizer {
    visibility: hidden;
  }

  .settle-label-live {
    font-variant-numeric: tabular-nums;
  }

  .settle-label.settled .settle-label-live {
    color: var(--theme-text, #fff);
  }

  .viewport {
    position: relative;
    /* A reserved box before the canvas exists, so nothing below it moves
       when the renderer mounts. */
    width: 100%;
    aspect-ratio: 4 / 3;
    min-height: 220px;
    border: var(--glass-border, 1px solid rgba(255, 255, 255, 0.08));
    border-radius: 0.75rem;
    overflow: hidden;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .readouts-disclosure {
    display: grid;
    gap: 0.6rem;
    justify-items: start;
  }

  .full-readouts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 0.9rem;
    width: 100%;
  }
</style>
