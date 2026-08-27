<!--
  Test harness for Crossfade.svelte. The rapid-toggle button runs its key
  changes on real timers INSIDE the page so the interruption happens faster
  than the fade duration — driving it from the test runner would put a
  playwright round-trip between clicks and miss the mid-transition window.
-->
<script lang="ts">
  import Crossfade from "./Crossfade.svelte";

  let key = $state("alpha");
  let collapseMidpoint = $state(0);
  let stage: HTMLDivElement;

  const HEIGHTS: Record<string, number> = { alpha: 60, beta: 160, gamma: 100 };

  function rapidToggle(): void {
    key = "beta";
    setTimeout(() => (key = "alpha"), 20);
    setTimeout(() => (key = "beta"), 40);
  }

  function measureCollapse(): void {
    key = "beta";
    setTimeout(() => {
      key = "alpha";
      requestAnimationFrame(() => {
        setTimeout(() => {
          collapseMidpoint =
            stage
              .querySelector<HTMLElement>(".crossfade")
              ?.getBoundingClientRect().height ?? 0;
        }, 30);
      });
    }, 120);
  }
</script>

<button type="button" onclick={() => (key = "alpha")}>Show alpha</button>
<button type="button" onclick={() => (key = "gamma")}>Show gamma</button>
<button type="button" onclick={rapidToggle}>Rapid toggle</button>
<button type="button" onclick={measureCollapse}>Measure collapse</button>
<output data-testid="collapse-midpoint">{collapseMidpoint}</output>

<div bind:this={stage} data-testid="stage" style="width: 240px;">
  <Crossfade {key} duration={80} animateHeight>
    <div class="panel" style="height: {HEIGHTS[key]}px;">{key} panel</div>
  </Crossfade>
</div>
