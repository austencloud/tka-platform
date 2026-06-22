<!--
  ScanActivityGlobe.svelte

  Rotatable 3D globe (globe.gl / three.js) showing scan-origin pins.
  Auto-rotates when idle, user can drag to spin. Newest pin pulses.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Globe from "globe.gl";

  interface GlobePoint {
    id: string;
    lat: number;
    lng: number;
    label: string;
    newest?: boolean;
  }

  interface GlobeArc {
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
  }

  let {
    points = [],
    arcs = [],
    height = 260,
  }: {
    points?: GlobePoint[];
    arcs?: GlobeArc[];
    height?: number;
  } = $props();

  let container: HTMLDivElement;
  let globe: InstanceType<typeof Globe> | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const enriched = $derived(
    points.map((p) => ({
      ...p,
      color: p.newest ? "#34d399" : "#10b981",
      altitude: p.newest ? 0.04 : 0.015,
      radius: p.newest ? 0.7 : 0.4,
    }))
  );

  onMount(() => {
    globe = new Globe(container)
      .globeImageUrl("//unpkg.com/three-globe/example/img/earth-night.jpg")
      .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
      .backgroundColor("rgba(0,0,0,0)")
      .showAtmosphere(true)
      .atmosphereColor("#34d399")
      .atmosphereAltitude(0.18)
      .pointsData(enriched)
      .pointLat("lat")
      .pointLng("lng")
      .pointColor("color")
      .pointAltitude("altitude")
      .pointRadius("radius")
      .pointLabel("label")
      .pointsMerge(false)
      .arcsData(arcs)
      .arcColor(() => "#34d399")
      .arcStroke(0.6)
      .arcAltitudeAutoScale(0.4)
      .arcDashLength(0.5)
      .arcDashGap(0.4)
      .arcDashAnimateTime(2200)
      .width(container.clientWidth)
      .height(height);

    const controls = globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableZoom = false;
    controls.enablePan = false;

    globe.pointOfView({ lat: 25, lng: -20, altitude: 2.2 }, 0);

    resizeObserver = new ResizeObserver(() => {
      globe?.width(container.clientWidth).height(height);
    });
    resizeObserver.observe(container);
  });

  $effect(() => {
    globe?.pointsData(enriched);
  });

  $effect(() => {
    globe?.arcsData(arcs);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    globe?._destructor?.();
    globe = null;
  });
</script>

<div bind:this={container} class="globe" style:height={`${height}px`}></div>

<style>
  .globe {
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
    background: var(--theme-panel-bg, radial-gradient(ellipse at center, #0a0f1f 0%, #050810 70%));
  }

  @media (prefers-reduced-motion: reduce) {
    /* globe.gl autoRotate handled in component; we don't stop it here,
       but three.js damping makes it gentle. Disable via controls if needed. */
  }
</style>
