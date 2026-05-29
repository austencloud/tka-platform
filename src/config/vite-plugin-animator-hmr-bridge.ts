import type { HmrContext, Plugin } from "vite";

/**
 * THROWAWAY (delete in P4). Works around a @sveltejs/kit 2.48→2.61 svelte-HMR
 * regression where vite-plugin-svelte fails to partial-accept certain heavy
 * components, crashing the HMR client and wedging the page (a refresh hangs
 * once, then works on the second try, throwing
 * "Cannot read properties of undefined (reading 'default')").
 *
 * The unrecoverable components are the WebGL canvases:
 *   - AnimatorCanvas.svelte — self-imports, forming a circular module
 *   - the Threlte <Canvas> viewer components — context + WebGL teardown can't be
 *     hot-swapped cleanly, so partial-accept throws "Failed to reload"
 *
 * Partial-accept also fails for any component that DIRECTLY embeds one of these
 * canvases (e.g. ViewerSplitPane), because the broken WebGL child can't remount
 * inside the parent's hot update. So we force a clean full-reload both when a
 * canvas changes AND when a direct importer of a canvas changes — detected from
 * the module graph rather than a hand-maintained allowlist (35+ embedders).
 */
export function animatorCanvasHmrBridge(): Plugin {
  const CANVAS_COMPONENTS = [
    "/animation-engine/components/AnimatorCanvas.svelte",
    "/shared/3d/components/Viewer3DCanvas.svelte",
    "/shared/3d/components/Viewer3DScene.svelte",
    "/shared/3d/components/UnifiedViewerCanvas.svelte",
  ];
  const isCanvas = (file: string): boolean =>
    CANVAS_COMPONENTS.some((t) => file.endsWith(t));

  return {
    name: "animator-canvas-hmr-bridge",
    apply: "serve",
    handleHotUpdate(ctx: HmrContext) {
      const file = ctx.file.replace(/\\/g, "/");

      // 1. A canvas component itself changed.
      if (isCanvas(file)) {
        ctx.server.ws.send({ type: "full-reload" });
        return [];
      }

      // 2. A component that directly embeds a canvas changed — its partial-accept
      //    can't cleanly remount the WebGL child, so force a full reload too.
      for (const mod of ctx.modules) {
        for (const imported of mod.importedModules) {
          const impFile = (imported.file ?? imported.url ?? "").replace(/\\/g, "/");
          if (isCanvas(impFile)) {
            ctx.server.ws.send({ type: "full-reload" });
            return [];
          }
        }
      }

      return undefined;
    },
  };
}
