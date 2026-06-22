<!--
  ScanJourneyInterstitial.svelte

  The viral reveal shown on /q/[code] between loading and playing: a globe with
  the card's travel arcs + a distance headline. Lazy-loads the heavy globe.gl
  component so three.js only arrives with the reveal. Tap-to-skip + auto-advance.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import {
    totalDistanceKm,
    uniqueCities,
    uniqueCountries,
    toArcs,
  } from "$lib/shared/qr/journey/journey-stats";
  import type { JourneyPoint } from "$lib/shared/qr/journey/journey-loader";

  let {
    points,
    word,
    onContinue,
  }: {
    points: JourneyPoint[];
    word: string;
    onContinue: () => void;
  } = $props();

  const hasPath = $derived(points.length >= 2);
  const distanceKm = $derived(Math.round(totalDistanceKm(points)));
  const cities = $derived(uniqueCities(points));
  const countries = $derived(uniqueCountries(points));
  const arcs = $derived(toArcs(points));

  const globePoints = $derived(
    points.map((p, i) => ({
      id: `${p.timestamp}-${i}`,
      lat: p.lat,
      lng: p.lng,
      label: p.city ?? p.country ?? "",
      newest: i === points.length - 1,
    }))
  );

  // Match the lazy-load typing pattern established in +page.svelte
  // (typeof import(...).default | null rather than Component<any>).
  let GlobeComp:
    | typeof import("$lib/features/choreo-card/components/scan-activity/ScanActivityGlobe.svelte").default
    | null = $state(null);

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const AUTO_ADVANCE_MS = reduceMotion ? 6500 : 4500;

  onMount(() => {
    import(
      "$lib/features/choreo-card/components/scan-activity/ScanActivityGlobe.svelte"
    )
      .then((m) => (GlobeComp = m.default))
      .catch(() => {
        // Globe chunk failed — skip straight to the sequence.
        onContinue();
      });

    const timer = setTimeout(onContinue, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  });
</script>

<div class="journey" role="button" tabindex="0" onclick={onContinue} onkeydown={(e) => e.key === "Enter" && onContinue()}>
  <div class="globe-wrap">
    {#if GlobeComp && hasPath}
      <GlobeComp points={globePoints} {arcs} height={320} />
    {:else if GlobeComp}
      <GlobeComp points={globePoints} height={320} />
    {/if}
  </div>

  <div class="headline">
    {#if hasPath}
      <p class="lead">This card has traveled</p>
      <p class="stats">
        <span class="num">{cities}</span> cities ·
        <span class="num">{countries}</span> countries ·
        <span class="num">{distanceKm.toLocaleString()}</span> km
      </p>
    {:else}
      <p class="lead">You're the first to scan this card.</p>
      <p class="stats subtle">Its journey starts here.</p>
    {/if}
    <p class="word">{word}</p>
  </div>

  <button class="skip" onclick={(e) => { e.stopPropagation(); onContinue(); }}>
    Tap to continue →
  </button>
</div>

<style>
  .journey {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    background: radial-gradient(ellipse at center, #0a0f1f 0%, #050810 70%);
    color: #fff;
    cursor: pointer;
    padding: 1.5rem;
  }
  .globe-wrap {
    width: min(92vw, 420px);
    height: 320px;
  }
  .headline {
    text-align: center;
  }
  .lead {
    margin: 0;
    font-size: 0.95rem;
    color: var(--theme-text-dim, #9aa4b2);
    letter-spacing: 0.02em;
  }
  .stats {
    margin: 0.35rem 0 0;
    font-size: 1.25rem;
    font-weight: 600;
    /* No layout shift as numbers vary in width. */
    font-variant-numeric: tabular-nums;
  }
  .stats.subtle {
    font-size: 1rem;
    font-weight: 400;
    color: var(--theme-text-dim, #9aa4b2);
  }
  .num {
    color: #34d399;
  }
  .word {
    margin: 0.75rem 0 0;
    font-size: 0.85rem;
    color: var(--theme-text-dim, #9aa4b2);
  }
  .skip {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: #fff;
    border-radius: 999px;
    padding: 0.6rem 1.25rem;
    font-size: 0.9rem;
    min-height: 44px;
    cursor: pointer;
  }
  .skip:hover {
    background: rgba(255, 255, 255, 0.08);
  }
</style>
