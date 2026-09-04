<script lang="ts">
  /**
   * Negative space, measured.
   *
   * `docs/reference/negative-space-and-wall-plane-reach.md` is a spoken
   * description of ONE motion of ONE hand taken two ways: the right hand goes
   * from North thumb-end-in to East thumb-end-out, and the thumb end either
   * travels "through the pocket above my shoulder and behind my forearm" or
   * "pushes downstage of the forearm". The two routes end in opposite palm
   * facings, and §6 names palm facing as the state variable that distinguishes
   * them.
   *
   * This page puts the two notations that satisfy that reach side by side on
   * one phase axis, points several cameras at them including the plan view the
   * document describes its endpoint from, and reports every phrase in §4 and §5
   * that can be turned into a number.
   *
   * It is an INSTRUMENT, not a solver. Nothing here touches the collision
   * owner, the arm solve, the grip, or the pose. If the rig cannot do what the
   * document describes, the page is supposed to say so plainly rather than be
   * adjusted until it agrees.
   *
   * Composition only: the transport, the phase grid, the camera solve and the
   * character roster all come from `../_lab-kit`, the pickers are the app's own
   * primitives, and this file arranges them and owns one clock for both panes.
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
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import ChipPopoverOption from "$lib/shared/browse/components/filter-chips/ChipPopoverOption.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { reducedMotion } from "$lib/shared/transitions/motion";

  import LabTransport from "../_lab-kit/LabTransport.svelte";
  import { INSPECTION_FOV_DEG } from "../_lab-kit/inspection-shot";
  import {
    isLocalOnlyCharacter,
    labCharacterName,
    labCharacters,
  } from "../_lab-kit/lab-characters";

  import ReachReadouts from "./ReachReadouts.svelte";
  import ReachStage from "./ReachStage.svelte";
  import {
    REACH_VIEWS,
    reachGridCenter,
    reachShotForView,
    reachViewById,
    shoulderHeight,
  } from "./reach-framing";
  import {
    REACH_PREMISE,
    REACH_ROUTES,
    REACH_STEP_COUNT,
  } from "./reach-routes";
  import { ReachLabState } from "./reach-state.svelte";
  import {
    EMPTY_REACH_FRAME,
    ROUTE_DEADBAND_MM,
    measureReachFrame,
    type ReachFrame,
    type Vec3,
  } from "./reach-telemetry";

  /** Motion steps per second. Slow enough to watch a wrist roll happen. */
  const PLAYBACK_STEPS_PER_SECOND = 0.6;

  const lab = new ReachLabState({ stepCount: () => REACH_STEP_COUNT });

  const view = $derived(reachViewById(lab.viewId));

  /**
   * One entry per route, in route order. Each pane's performer publishes its
   * own diagnostics and its own shoulder bone, and the measurement is derived
   * from whichever of those has arrived — a pane whose probe has not found a
   * rig yet still reports everything that does not need the shoulder.
   */
  let poses = $state<(AvatarPoseDiagnostics | null)[]>(
    REACH_ROUTES.map(() => null)
  );
  let grips = $state<(AvatarGripDiagnostics | null)[]>(
    REACH_ROUTES.map(() => null)
  );
  let shoulders = $state<(Vec3 | null)[]>(REACH_ROUTES.map(() => null));

  const frames = $derived(
    REACH_ROUTES.map((_, index): ReachFrame => {
      const diagnostics = poses[index];
      const gripDiagnostics = grips[index];
      if (!diagnostics || !gripDiagnostics) return EMPTY_REACH_FRAME;
      return measureReachFrame({
        diagnostics,
        gripDiagnostics,
        shoulderWorld: shoulders[index] ?? null,
        shoulderHeight: shoulderHeight(),
        gridCenter: reachGridCenter(),
      });
    })
  );

  /**
   * Every measured value, in world units, on the console.
   *
   * The panel rounds to whole millimetres and names directions in the source
   * document's words, which is what makes it readable and also what makes it
   * hard to check. This publishes the raw frames so a reading can be argued
   * with rather than taken on faith — the point of a diagnostic instrument is
   * that its own arithmetic is inspectable. Read-only, and only in dev.
   */
  $effect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    (window as unknown as { __reachFrames?: unknown }).__reachFrames = {
      phase: lab.phase,
      shoulderHeight: shoulderHeight(),
      gridCenter: reachGridCenter(),
      routes: REACH_ROUTES.map((route, index) => ({
        id: route.id,
        frame: frames[index],
      })),
    };
  });

  function receivePose(index: number) {
    return (
      _events: CollisionEvent[],
      diagnostics: AvatarPoseDiagnostics,
      gripDiagnostics: AvatarGripDiagnostics
    ) => {
      poses[index] = diagnostics;
      grips[index] = gripDiagnostics;
    };
  }

  function receiveShoulder(index: number) {
    return (point: Vec3 | null) => {
      shoulders[index] = point;
    };
  }

  // Each pane solves its own shot against its own aspect ratio, so a tall
  // stacked pane and a squat side-by-side one both frame the subject instead
  // of one of them cropping it.
  let paneWidths = $state<number[]>(REACH_ROUTES.map(() => 0));
  let paneHeights = $state<number[]>(REACH_ROUTES.map(() => 0));

  const shots = $derived(
    REACH_ROUTES.map((_, index) => {
      const width = paneWidths[index] ?? 0;
      const height = paneHeights[index] ?? 0;
      return reachShotForView(view, width > 0 && height > 0 ? width / height : 1);
    })
  );

  /**
   * The angle picker has to move the eye, not just the pivot.
   *
   * `camera-controls` takes ownership of the camera transform as soon as it is
   * live, so a reactive `position` on the camera is overwritten on its next
   * update: switching angles would ease the target and leave the eye where it
   * was, which reads as the picker being broken. The wrapper documents its
   * imperative API for exactly this ("snap-to-view can skip hand-rolled rAF
   * interpolation"), so the shot is applied through `setLookAt`. The camera
   * still belongs to the controls afterwards, and a manual orbit is preserved
   * until the next deliberate angle change.
   */
  let cameraControls = $state<(CameraControls | null)[]>(
    REACH_ROUTES.map(() => null)
  );

  $effect(() => {
    const eased = !reducedMotion();
    shots.forEach((shot, index) => {
      const controls = cameraControls[index];
      if (!controls) return;
      void controls.setLookAt(
        shot.position[0],
        shot.position[1],
        shot.position[2],
        shot.target[0],
        shot.target[1],
        shot.target[2],
        eased
      );
    });
  });

  const viewOptions = $derived(
    REACH_VIEWS.map((option) => ({
      value: option.id,
      label: option.label,
      shortLabel: option.pickerLabel,
      ariaLabel: `${option.label}: ${option.hint}`,
    }))
  );

  const characterOptions = $derived(
    labCharacters().map((definition) => ({
      value: definition.id,
      label: definition.name,
      // Said in the row itself rather than only to a screen reader: a rig that
      // exists on one machine is a caveat on any finding taken from it.
      local: isLocalOnlyCharacter(definition.id),
    }))
  );

  /**
   * Whether the two panes are currently reading the same side of the forearm.
   *
   * This is the page's own headline and it is deliberately blunt. If two
   * different prop notations produce the same arm routing, then the rig does
   * not represent the choice §4 and §5 describe, and no amount of scrubbing
   * will make it appear.
   */
  /**
   * Whether the depth predicate — the document's actual §4 / §5 question —
   * separates the two notations at this phase. A reading inside the deadband
   * counts as no answer rather than as an answer of zero.
   */
  const depthSeparation = $derived.by(():
    | "opposite"
    | "same"
    | "undecided" => {
    const readings = frames.map((frame) => frame.thumbEndVsForearmMm);
    if (readings.some((mm) => mm === null)) return "undecided";
    const sides = readings.map((mm) =>
      Math.abs(mm!) <= ROUTE_DEADBAND_MM ? 0 : Math.sign(mm!)
    );
    // A route sitting inside the deadband has not chosen a side, so it cannot
    // be the opposite of anything. Reading that as separation was this page
    // claiming the document's distinction where the rig had not made one.
    if (sides.some((side) => side === 0)) return "undecided";
    return new Set(sides).size > 1 ? "opposite" : "same";
  });

  /** Whether the in-plane offset separates them, which on this rig it does. */
  const planeSeparates = $derived.by(() => {
    const readings = frames.map((frame) => frame.thumbEndAboveForearmMm);
    if (readings.some((mm) => mm === null)) return false;
    return new Set(readings.map((mm) => Math.sign(mm!))).size > 1;
  });

  const bothMeasured = $derived(frames.every((frame) => frame.hasData));

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
    return () => document.removeEventListener("pointerdown", closeOnOutside, true);
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
    // variables the shared pickers and chips paint with. Reading the device's
    // own saved background keeps the lab in the app's palette instead of every
    // primitive falling back to its hardcoded default.
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

  // Someone reaching for the address bar blurs the window first, which is the
  // moment a still-moving phase has to be pinned exactly.
  $effect(() => lab.attachFlushOnBlur());

  // A character swap changes the skeleton every measurement was taken from, so
  // the probes start again rather than reporting the previous body's joint.
  $effect(() => {
    void lab.character;
    shoulders = REACH_ROUTES.map(() => null);
  });

  /**
   * One clock for both panes. Each pane holds its own performer, so letting
   * them run their own playback would drift them apart within seconds. The
   * tick reads and writes phase outside the effect's tracking scope, so
   * advancing it cannot restart the loop.
   */
  $effect(() => {
    if (!lab.playing) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(0.1, (now - previous) / 1000);
      previous = now;
      const next = lab.phase + elapsed * PLAYBACK_STEPS_PER_SECOND;
      lab.setPhase(
        next >= REACH_STEP_COUNT - 0.01 ? next - REACH_STEP_COUNT : next
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });
</script>

<svelte:head>
  <title>Negative space reach · TKA lab</title>
</svelte:head>

<main class="lab">
  <header class="masthead">
    <div class="titles">
      <h1>Negative space and the wall-plane reach</h1>
      <p class="premise">
        {REACH_PREMISE.hand} · {REACH_PREMISE.from} → {REACH_PREMISE.to}. Two
        notations satisfy that, and the source describes two different arm
        routes through it. This measures which one the rig produces.
      </p>
      <p class="source">
        Source: <code>docs/reference/negative-space-and-wall-plane-reach.md</code
        > — a spoken description, not derived from this code. Telemetry only:
        nothing on this page writes pose, grip, or the solve.
      </p>
    </div>

    <div class="controls">
      <div class="control">
        <span class="control-label" id="reach-view-label">Angle</span>
        <!--
          The overlay toggle rides with the angle picker: both change how the
          stage is looked at, and parked on its own at the end of the row it
          read as an afterthought with a gap in front of it.
        -->
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
        <span class="control-hint">{view.hint} · {view.depthNote}</span>
      </div>

      <div class="control">
        <span class="control-label" id="reach-character-label">Body</span>
        <!--
          Twenty-seven rigs. As an always-open grid this was five rows tall and
          the largest thing on the page, which put the rig list above the
          comparison in the visual order and pushed both stages off a 412px-tall
          viewport entirely. It is a choice made once per session, so it reads
          as a chip and opens a list.
        -->
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
    </div>
  </header>

  <div
    class="verdict"
    data-state={bothMeasured
      ? depthSeparation
      : "waiting"}
  >
    <!--
      One element holds the whole sentence. A flex container makes every inline
      child its own flex item, so putting the prose directly in here broke each
      <b> onto its own baseline and shredded the line.
    -->
    <p class="verdict-text">
      {#if !bothMeasured}
        Waiting for both panes to report a frame.
      {:else if depthSeparation === "opposite"}
        In stage depth the two notations put the thumb end on
        <b>opposite sides</b> of the forearm — the §4 / §5 choice, expressed.
      {:else}
        {#if depthSeparation === "same"}
          In stage depth both notations keep the thumb end on the
          <b>same side</b> of the forearm, so the §4 / §5 choice is not
          expressed here.
        {:else}
          In stage depth at least one notation is holding the thumb end
          <b>level with the forearm</b>, within {ROUTE_DEADBAND_MM} mm, so the
          §4 / §5 choice is not being made here.
        {/if}
        {#if planeSeparates}
          They do separate <b>within the wall plane</b>, above the forearm
          against below it, which is a different distinction from the one §4
          draws.
        {/if}
      {/if}
    </p>
  </div>

  <div class="routes">
    {#each REACH_ROUTES as route, index (route.id)}
      <section class="route" aria-label={route.label}>
        <header class="route-head">
          <h2>{route.label}</h2>
          <p class="encoding">{route.encoding}</p>
          <p class="sweep">
            Staff sweeps {route.propSweepDeg > 0 ? "+" : ""}{route.propSweepDeg}°
            across the reach
          </p>
        </header>

        <div
          class="viewport"
          bind:clientWidth={paneWidths[index]}
          bind:clientHeight={paneHeights[index]}
        >
          <!--
            No scene clear colour. An alpha buffer lets the page's own surface
            show through, so the canvases sit on the product's ground rather
            than on a rectangle that appears nowhere else.
          -->
          <Canvas shadows rendererParameters={{ alpha: true }}>
            <T.PerspectiveCamera
              makeDefault
              position={shots[index].position}
              fov={INSPECTION_FOV_DEG}
            >
              <OrbitControls
                enableDamping
                enablePan={false}
                rightDragAction="rotate"
                bind:ref={cameraControls[index]}
                target={shots[index].target}
                minDistance={0.3}
                maxDistance={12}
                maxPolarAngle={Math.PI}
              />
            </T.PerspectiveCamera>

            <ReachStage
              id={`reach-${route.id}`}
              phase={lab.phase}
              sequence={route.sequence}
              characterId={lab.character}
              gridEmphasis={view.grid}
              overlayFrame={lab.overlay ? frames[index] : null}
              onCollisionEvents={receivePose(index)}
              onShoulder={receiveShoulder(index)}
            />
          </Canvas>
        </div>

        <ReachReadouts frame={frames[index]!} routeLabel={route.label} />
      </section>
    {/each}
  </div>

  <LabTransport
    {lab}
    stepCount={REACH_STEP_COUNT}
    markerNote="Step 1 is the reach; step 2 holds the endpoint so it can be turned around."
    markerLaneLabel="Marked moments in this reach"
  />
</main>

<style>
  .lab {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    gap: 0.85rem;
    min-height: 100dvh;
    padding: 1rem clamp(0.75rem, 2vw, 2rem) 1rem;
    color: var(--theme-text, #fff);
  }

  .masthead {
    display: grid;
    gap: 0.85rem;
  }

  .titles {
    display: grid;
    gap: 0.3rem;
    /* Prose keeps a reading measure even when the shell is 4K wide. */
    max-width: 78ch;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.2rem, 0.95rem + 0.8vw, 1.7rem);
    line-height: 1.2;
  }

  .premise {
    margin: 0;
    font-size: var(--font-size-sm, 0.875rem);
  }

  .source {
    margin: 0;
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  code {
    font-size: 0.95em;
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0.75rem 1.25rem;
  }

  .character-chip {
    /* The popover is a DOM child of this wrapper and paints above the page. */
    position: relative;
    --chip-option-color: var(--theme-accent);
  }

  /*
    The chip popover has no height of its own: its other callers list lengths
    and levels, which are short. Twenty-seven rigs made it 1241px tall, and at
    960x412 everything past the sixth rig was off the bottom of the screen with
    no way to reach it. Clamped here rather than in the primitive because this
    is the only list long enough to need it — worth lifting into
    FilterChipBase if a second long list ever appears.
  */
  .character-chip :global(.chip-popover) {
    max-height: min(60vh, 22rem);
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .control-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
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

  .control-hint {
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    /*
      Two lines held, so switching to an angle with a longer hint cannot push
      the stage down (`.claude/rules/no-layout-shift.md`).
    */
    min-height: 2.4em;
    max-width: 46ch;
  }

  .verdict {
    margin: 0;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--verdict-edge, var(--theme-stroke, rgba(255, 255, 255, 0.08)));
    border-radius: 0.6rem;
    background: var(--verdict-wash, transparent);
    font-size: var(--font-size-sm, 0.875rem);
    /* Height held across every state so a verdict change never moves the
       panes below it (`.claude/rules/no-layout-shift.md`). */
    min-height: 3.1em;
    display: flex;
    align-items: center;
  }

  .verdict-text {
    margin: 0;
  }

  .verdict[data-state="same"] {
    --verdict-edge: color-mix(in srgb, var(--semantic-warning) 55%, transparent);
    --verdict-wash: color-mix(in srgb, var(--semantic-warning) 12%, transparent);
  }

  .verdict[data-state="opposite"] {
    --verdict-edge: color-mix(in srgb, var(--semantic-success) 55%, transparent);
    --verdict-wash: color-mix(in srgb, var(--semantic-success) 12%, transparent);
  }

  .routes {
    display: grid;
    gap: 0.9rem;
    grid-template-columns: 1fr;
    min-height: 0;
  }

  /*
    Two columns as soon as there is room for them. The whole point is a
    side-by-side comparison, so the panes go wide before they go tall.
  */
  @media (min-width: 900px) {
    .routes {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .route {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-height: 0;
    min-width: 0;
  }

  .route-head {
    display: grid;
    gap: 0.15rem;
  }

  h2 {
    margin: 0;
    font-size: var(--font-size-base, 1rem);
    line-height: 1.25;
  }

  .encoding {
    margin: 0;
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  .sweep {
    margin: 0;
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    font-variant-numeric: tabular-nums;
  }

  .viewport {
    position: relative;
    /*
      A reserved box before the canvas exists, so nothing below it moves when
      the renderer mounts. Grows into whatever the row gives it.
    */
    flex: 1 1 auto;
    min-height: 300px;
    aspect-ratio: 4 / 3;
    /*
      On a tall screen 4:3 across half of 1920px is a 667px-tall stage, which
      put every number below the fold. An instrument whose picture and whose
      reading cannot be seen at once is two instruments. The camera solver
      reads each pane's measured aspect ratio, so a shorter box reframes rather
      than crops.
    */
    max-height: 52vh;
    border: var(--glass-border, 1px solid rgba(255, 255, 255, 0.08));
    border-radius: 0.75rem;
    overflow: hidden;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  /*
    On a short landscape screen the fixed ratio is what pushes the readouts off
    the bottom. Let the row decide the height there instead.
  */
  @media (min-width: 700px) and (max-height: 560px) {
    .viewport {
      aspect-ratio: auto;
      min-height: 220px;
    }
  }

  @media (min-width: 1600px) {
    .viewport {
      min-height: 420px;
    }
  }
</style>
