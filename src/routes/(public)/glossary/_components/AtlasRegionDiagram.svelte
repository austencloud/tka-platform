<script lang="ts">
  let { region }: { region: string } = $props();
</script>

<div
  class="diagram"
  class:space={region === "space"}
  class:motion={region === "motion"}
  class:letters={region === "letters"}
  class:notation={region === "notation"}
  class:patterns={region === "patterns"}
  class:foundation={region === "foundation"}
  aria-hidden="true"
>
  {#if region === "space"}
    <svg viewBox="0 0 160 92">
      <path class="ghost" d="M80 7 143 46 80 85 17 46Z M80 7v78M17 46h126" />
      <path class="ghost" d="M35 16h90v60H35z" />
      <circle class="point" cx="80" cy="7" r="4" />
      <circle class="point" cx="143" cy="46" r="4" />
      <circle class="point" cx="80" cy="85" r="4" />
      <circle class="point" cx="17" cy="46" r="4" />
      <circle class="accent" cx="35" cy="16" r="4" />
      <circle class="accent" cx="125" cy="76" r="4" />
      <path class="stroke" d="M39 18 75 8M121 74 85 84" />
    </svg>
  {:else if region === "motion"}
    <svg viewBox="0 0 160 92">
      <path class="stroke" d="M16 67C35 14 67 15 81 49" />
      <path class="stroke" d="m74 40 8 10 5-12" />
      <circle class="point" cx="16" cy="67" r="4" />
      <path class="stroke" d="M96 69h44" />
      <path class="stroke" d="m130 60 11 9-11 9" />
      <circle class="point" cx="96" cy="69" r="4" />
      <circle class="ghost" cx="121" cy="29" r="20" />
      <path class="stroke" d="M113 10a20 20 0 0 1 25 12" />
      <path class="stroke" d="m133 15 6 8 2-10" />
    </svg>
  {:else if region === "letters"}
    <svg viewBox="0 0 160 92">
      <rect class="ghost" x="9" y="8" width="142" height="76" rx="10" />
      <path
        class="stroke"
        d="M22 25h48M82 25h24M117 25h21M22 46h31M64 46h43M118 46h20M22 67h23M57 67h34M102 67h36"
      />
      <circle class="accent" cx="70" cy="25" r="4" />
      <circle class="accent" cx="107" cy="46" r="4" />
      <circle class="accent" cx="91" cy="67" r="4" />
    </svg>
  {:else if region === "notation"}
    <svg viewBox="0 0 160 92">
      <path class="ghost" d="M12 20h136M12 46h136M12 72h136" />
      <path
        class="stroke"
        d="M24 10v20M19 16l5-6 5 6M53 13c13 0 13 13 27 13M99 10v20M94 24l5 6 5-6M123 18h18"
      />
      <circle class="accent" cx="24" cy="46" r="5" />
      <circle class="accent" cx="57" cy="46" r="5" />
      <path
        class="stroke"
        d="M84 38v16M107 38l15 16M139 38v16M22 72h34M69 63v18M91 72h50"
      />
    </svg>
  {:else if region === "patterns"}
    <svg viewBox="0 0 160 92">
      <rect class="ghost" x="6" y="24" width="31" height="45" rx="5" />
      <rect class="ghost" x="45" y="24" width="31" height="45" rx="5" />
      <rect class="ghost" x="84" y="24" width="31" height="45" rx="5" />
      <rect class="ghost" x="123" y="24" width="31" height="45" rx="5" />
      <path
        class="stroke"
        d="M15 55c6-24 13-24 16-6M54 35l14 25M93 55c6-24 13-24 16-6M132 35l14 25"
      />
      <path
        class="stroke"
        d="M138 14c10 0 16 5 16 15M154 29l-8-5M21 80C11 80 6 75 6 65M6 65l8 5"
      />
    </svg>
  {:else}
    <svg viewBox="0 0 160 92">
      <circle class="ghost" cx="80" cy="20" r="9" />
      <path
        class="ghost"
        d="M80 29v31M80 42 51 55M80 42l29 13M80 60 61 86M80 60l19 26"
      />
      <path class="stroke" d="M29 12 62 73M131 12 98 73" />
      <circle class="accent" cx="29" cy="12" r="4" />
      <circle class="accent" cx="131" cy="12" r="4" />
      <path class="stroke" d="M19 29C9 43 13 61 27 70M141 29c10 14 6 32-8 41" />
    </svg>
  {/if}
</div>

<style>
  .diagram {
    width: 100%;
    height: 100%;
    color: var(--atlas-region-accent, var(--theme-accent));
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .stroke,
  .ghost {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .stroke {
    stroke: currentColor;
    stroke-width: 2.5;
  }

  .ghost {
    stroke: color-mix(in oklch, var(--theme-text) 24%, transparent);
    stroke-width: 1.4;
  }

  .point {
    fill: color-mix(in oklch, var(--theme-text) 92%, transparent);
  }

  .accent {
    fill: currentColor;
  }
</style>
