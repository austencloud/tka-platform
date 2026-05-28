import type { HmrContext, Plugin } from "vite";

/**
 * THROWAWAY (delete in P4). Works around a @sveltejs/kit 2.48→2.61 svelte-HMR
 * regression: AnimatorCanvas.svelte self-imports (line 53), forming a circular
 * module that the newer vite-plugin-svelte fails to partial-accept, crashing
 * the HMR client. Until the self-import is removed in P4, force a clean
 * full-reload when this one file changes instead of the broken partial-accept.
 */
export function animatorCanvasHmrBridge(): Plugin {
  const TARGET = "/animation-engine/components/AnimatorCanvas.svelte";
  return {
    name: "animator-canvas-hmr-bridge",
    apply: "serve",
    handleHotUpdate(ctx: HmrContext) {
      if (ctx.file.replace(/\\/g, "/").endsWith(TARGET)) {
        ctx.server.ws.send({ type: "full-reload" });
        return [];
      }
      return undefined;
    },
  };
}
