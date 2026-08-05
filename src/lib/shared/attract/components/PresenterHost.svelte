<!--
  PresenterHost — mounts the ghost mind over the whole app.

  Presentation mode only (`?present=1`). It owns four things and nothing else:
  the ghost's coordinate space, the takeover listener, the route watchdog, and
  the two visible pieces (the pointer and its thought).

  Everything about WHAT the ghost does lives in the intention bag; everything
  about HOW it moves lives in the attract-ghost core. This file deliberately
  knows neither.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import GhostPointer from "./GhostPointer.svelte";
  import ThoughtCaption from "./ThoughtCaption.svelte";
  import { createAttractGhost } from "../services/attract-ghost.svelte";
  import { createSensors, readRoute } from "../services/sensors";
  import { createGhostMind } from "../services/mind.svelte";
  import { ALL_INTENTIONS } from "../intentions";
  import { setEscapeHatch } from "../intentions/explore";
  import { scoreAll } from "../domain/scoring";
  import { isDeniedModule, isDeniedPath } from "../domain/annotations";

  let { seed }: { seed?: number } = $props();

  // The ghost's coordinate space is the document body — that is also the query
  // root, so `waitFor` sees the whole app rather than one section's band. The
  // overlay is fixed, so a body that is offset from the viewport (a banner, a
  // scrolled document) would shear the two apart; measure once and correct.
  let originX = $state(0);
  let originY = $state(0);

  const { core, run } = createAttractGhost({ getRoot: () => document.body });
  const { sense } = createSensors();
  const mind = createGhostMind({
    intentions: ALL_INTENTIONS,
    ghost: core,
    sense,
    seed,
  });
  const act = run(mind.tick);
  const ghost = act.ghost;

  /**
   * Safety layer 2. The allowlist means the ghost should never be able to walk
   * into /admin or checkout, but a denied route reached by any means at all is
   * a demo showing a stranger the admin panel — so this is a hard backstop, not
   * a nicety. It is the one place the presenter navigates programmatically,
   * because a safety retreat is not choreography.
   */
  /**
   * A real module switch, the same one pressing the nav performs. NEVER goto()
   * or history.back(): those move the URL while the module system carries on
   * believing it is elsewhere, and the shell then renders an empty screen
   * until a human clicks a module. The presenter must not be able to leave the
   * app in a state a visitor has to rescue it from.
   */
  async function goHome(): Promise<void> {
    await handleModuleChange("create");
  }

  function guardRoute(): void {
    const pathname = window.location.pathname;
    const { moduleId } = readRoute(pathname);
    if (isDeniedPath(pathname) || isDeniedModule(moduleId)) {
      void goHome();
    }
  }

  onMount(() => {
    console.info(
      `[ghost] presentation mode — seed ${mind.seed}. Replay with ?present=${mind.seed}`,
    );

    // The trail answers the only question worth asking when the ghost stalls
    // in front of strangers — which precondition lied. Reachable from the
    // console at a jam, not just in a test.
    (window as unknown as { __ghost?: unknown }).__ghost = {
      seed: mind.seed,
      trail: () => mind.trail.entries(),
      failures: () => mind.trail.failures(),
      memory: mind.memory,
      /** What the ghost is weighing right now, best first. */
      scores: () =>
        scoreAll(ALL_INTENTIONS, { ...sense(), ...mind.memory }).map(
          (s) => `${s.intention.id} ${s.score.toFixed(3)}`,
        ),
      world: () => sense(),
      pause: () => act.pause(),
      resume: () => act.resume(),
      stop: () => act.kill(),
    };

    setEscapeHatch(goHome);

    const measure = () => {
      const r = document.body.getBoundingClientRect();
      originX = r.left;
      originY = r.top;
    };
    measure();

    // Takeover: a REAL pointer event means a visitor has the wheel. The core's
    // press never dispatches pointer events, so this can only ever be a human.
    const onRealPointer = (event: PointerEvent) => {
      if (!event.isTrusted) return;
      act.pause();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") act.kill();
      else if (event.isTrusted) act.pause();
    };

    window.addEventListener("pointerdown", onRealPointer, { capture: true });
    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("resize", measure);
    const guard = setInterval(guardRoute, 1000);

    act.setVisible(true);
    act.start();

    return () => {
      setEscapeHatch(null);
      clearInterval(guard);
      window.removeEventListener("pointerdown", onRealPointer, { capture: true });
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("resize", measure);
      act.kill();
    };
  });
</script>

<div class="presenter-overlay" style={`transform: translate(${originX}px, ${originY}px)`}>
  <GhostPointer
    x={ghost.x}
    y={ghost.y}
    pressed={ghost.pressed}
    visible={ghost.visible}
    parked={ghost.parked}
    onResume={() => act.resume()}
  />
</div>

{#if !ghost.parked}
  <ThoughtCaption
    thought={mind.thought}
    x={ghost.x + originX}
    y={ghost.y + originY}
  />
{/if}

<style>
  /* Fixed and inert: the ghost must never occlude the elementFromPoint probe
     that gates every press, and must never eat a visitor's click. The parked
     resume button re-enables pointer events on itself only. */
  .presenter-overlay {
    position: fixed;
    inset: 0;
    /* Above EVERYTHING, including drawers, sheets and the fullscreen sequence
       viewer. The ghost demonstrates those surfaces, so a z-index that lets
       one of them cover it makes the presenter invisible exactly when it is
       doing its most interesting work. Safe to sit on top: the layer is
       inert, so it never occludes the elementFromPoint probe that gates every
       press, and never eats a visitor's click. */
    z-index: 2147483000;
    pointer-events: none;
  }
</style>
