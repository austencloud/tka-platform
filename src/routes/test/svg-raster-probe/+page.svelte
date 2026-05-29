<script lang="ts">
  import { buildDecorationsSVGInline } from "./probe-svg";
  let result = $state<string>("(idle)");
  function run() {
    const worker = new Worker(
      new URL("$lib/shared/render/workers/__spike__/svg-raster-probe.worker.ts", import.meta.url),
      { type: "module" },
    );
    const svg = buildDecorationsSVGInline();
    worker.onmessage = (e) => { result = JSON.stringify(e.data, null, 2); worker.terminate(); };
    worker.onerror = (e) => { result = "worker error: " + e.message; };
    worker.postMessage({ svg, w: 1644, h: 2244 });
  }
</script>
<button onclick={run}>Run probe</button>
<pre>{result}</pre>
