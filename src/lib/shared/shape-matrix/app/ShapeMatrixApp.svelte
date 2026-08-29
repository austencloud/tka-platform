<script lang="ts">
  import { onMount } from "svelte";
  import { loadShapeMatrix } from "$lib/shared/shape-matrix/services/shape-matrix-flowers";

  import { setShapeMatrixAppContext } from "./context/shape-matrix-app-context";
  import ShapeMatrixAboutModal from "./components/ShapeMatrixAboutModal.svelte";
  import ShapeMatrixPropPickerModal from "./components/ShapeMatrixPropPickerModal.svelte";
  import ShapeMatrixAppShell from "./components/ShapeMatrixAppShell.svelte";
  import {
    createShapeMatrixAppState,
    type ShapeMatrixAppPersistence,
  } from "./state/shape-matrix-app-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  interface Props {
    persistence?: ShapeMatrixAppPersistence;
  }

  let { persistence }: Props = $props();
  let host: HTMLDivElement;
  const state = createShapeMatrixAppState(
    {
      loadMatrix: loadShapeMatrix,
      syncState: (snapshot) => persistence?.persist(snapshot),
    },
    {
      level: 2,
      blueTurn: 2,
      redTurn: 2,
      activeAxis: "both",
      labelMode: "turns",
      propType: PropType.STAFF,
      relationshipDriver: "hands",
      pair: null,
      mode: null,
      propMode: null,
    },
    false
  );
  setShapeMatrixAppContext(state);

  onMount(() => {
    const restored = persistence?.restore() ?? null;
    if (restored) state.restoreState(restored);

    const applyLayout = (width: number, height: number) => {
      const compact = width < 1200 || height < 672;
      state.setCompact(compact);
    };
    const bounds = host.getBoundingClientRect();
    applyLayout(bounds.width, bounds.height);

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      applyLayout(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(host);

    void state.load();

    return () => observer.disconnect();
  });
</script>

<div class="shape-matrix-app-host" bind:this={host}>
  <ShapeMatrixAppShell />
  <ShapeMatrixAboutModal />
  <ShapeMatrixPropPickerModal />
</div>

<style>
  .shape-matrix-app-host {
    container: shape-matrix-app / size;
    position: relative;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    color-scheme: dark;
  }
</style>
