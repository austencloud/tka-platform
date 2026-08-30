<!--
  ShapeMatrixToy.svelte - The Shape Matrix explorer mounted as a Toys tab.
  The shared app owns everything; this host only supplies persistence.
  The standalone /notation/shape-matrix route persists to the URL for
  deep-linking; inside the app the toy remembers its state locally instead,
  because module tabs do not own the URL.
-->
<script lang="ts">
  import ShapeMatrixApp from "$lib/shared/shape-matrix/app/ShapeMatrixApp.svelte";
  import type { ShapeMatrixAppSnapshot } from "$lib/shared/shape-matrix/app/state/shape-matrix-app-state.svelte";

  const STORAGE_KEY = "toys-shape-matrix-state-v1";

  const persistence = {
    restore: (): ShapeMatrixAppSnapshot | null => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as ShapeMatrixAppSnapshot;
        return parsed && [1, 2, 3, 4].includes(parsed.level) ? parsed : null;
      } catch {
        return null;
      }
    },
    persist: (snapshot: ShapeMatrixAppSnapshot): void => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        /* storage unavailable - the toy just starts fresh next visit */
      }
    },
  };
</script>

<div class="shape-matrix-toy">
  <ShapeMatrixApp {persistence} />
</div>

<style>
  .shape-matrix-toy {
    flex: 1;
    display: flex;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
</style>
