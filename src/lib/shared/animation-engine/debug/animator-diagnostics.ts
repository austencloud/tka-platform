/**
 * animator-diagnostics.ts
 *
 * Dev-only LED / fire diagnostic plumbing extracted out of the CanvasSurface
 * leaf render component. This installs `window.__tka_*_diag` helpers used from
 * the browser console to inspect the fire simulation and LED overlay FBOs, and
 * to export composite snapshots.
 *
 * This MUST NOT run in production. The single call site in CanvasSurface gates
 * on `import.meta.env.DEV`. Keeping the blob here keeps the production render
 * hot path free of these `window` globals and their closures.
 *
 * `captureEffectDiagnostics` on the engine (used by the context menu) is a
 * SEPARATE engine method and is intentionally untouched by this module.
 */

import type { AnimationEngine } from "../services/implementations/AnimationEngine.svelte";

/** Live getter for the canvas wrapper element (a Svelte `$state` ref). */
type ContainerGetter = () => HTMLDivElement | undefined;

/**
 * Installs the `window.__tka_fire_diag` / `__tka_fire_snapshot` / `__tka_led_diag`
 * diagnostic helpers, reading the engine and the (live) container element.
 *
 * @param engine The AnimationEngine instance owned by CanvasSurface.
 * @param getContainerElement Getter returning the current `.canvas-wrapper`
 *   element. Passed as a getter because the diagnostics read it lazily at
 *   call-time, after the element has mounted.
 * @returns A teardown function that removes the installed window globals.
 */
export function installAnimatorDiagnostics(
  engine: AnimationEngine,
  getContainerElement: ContainerGetter,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const win = window as any;

  win.__tka_fire_diag = {
    enable: () => engine.enableFireDiagnostics(),
    disable: () => engine.disableFireDiagnostics(),
    reset: () => engine.resetFireDiagnosticCounter(),
    sample: () => engine.sampleFireCanvas(),
  };
  win.__tka_fire_snapshot = () => engine.snapshotFireCanvas();
  win.__tka_led_diag = {
    stats: () => {
      const renderer = engine.getLedRenderer();
      if (!renderer) {
        console.log("[led-diag] no ledRenderer");
        return;
      }
      const display = renderer.readPixelStats();
      const trail = renderer.readTrailFBOStats();
      const bloom = renderer.readBloomFBOStats();
      console.log(
        `[led-diag] display(8bit): maxR=${display?.maxR} maxG=${display?.maxG} maxB=${display?.maxB} maxA=${display?.maxA} nonZero=${display?.nonZero}/${display?.total}`,
      );
      console.log(
        `[led-diag] trail(float): maxR=${trail?.maxR?.toFixed(4)} maxG=${trail?.maxG?.toFixed(4)} maxB=${trail?.maxB?.toFixed(4)} maxA=${trail?.maxA?.toFixed(4)}`,
      );
      console.log(
        `[led-diag] bloom(float): maxR=${bloom?.maxR?.toFixed(4)} maxG=${bloom?.maxG?.toFixed(4)} maxB=${bloom?.maxB?.toFixed(4)} maxA=${bloom?.maxA?.toFixed(4)}`,
      );
      return { display, trail, bloom };
    },
    snapshot: () => {
      const renderer = engine.getLedRenderer();
      if (!renderer?.getCanvas()) {
        console.log("[led-diag] no canvas");
        return;
      }
      const c = renderer.getCanvas()!;
      c.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `led-overlay-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        console.log("[led-diag] snapshot saved");
      });
    },
    exportCompositeTest: () => {
      const containerElement = getContainerElement();
      if (!containerElement) {
        console.log("[led-diag] no container");
        return;
      }
      const mainCanvas = containerElement.querySelector("canvas");
      if (!mainCanvas) {
        console.log("[led-diag] no main canvas");
        return;
      }
      const container = mainCanvas.parentElement!;

      const outputSize = 974;
      const offscreen = document.createElement("canvas");
      offscreen.width = outputSize;
      offscreen.height = outputSize;
      const ctx = offscreen.getContext("2d")!;

      ctx.drawImage(mainCanvas, 0, 0, mainCanvas.width, mainCanvas.height, 0, 0, outputSize, outputSize);

      const overlays = container.querySelectorAll("canvas");
      for (const ov of overlays) {
        if (ov === mainCanvas || ov.width === 0 || ov.height === 0) continue;
        const isWebGL = !!(
          (ov as HTMLCanvasElement).getContext("webgl2") ||
          (ov as HTMLCanvasElement).getContext("webgl")
        );
        if (isWebGL && ov.width !== outputSize) {
          const tmp = document.createElement("canvas");
          tmp.width = ov.width;
          tmp.height = ov.height;
          const tmpCtx = tmp.getContext("2d")!;
          tmpCtx.clearRect(0, 0, ov.width, ov.height);
          tmpCtx.drawImage(ov, 0, 0);
          ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, outputSize, outputSize);
        } else {
          ctx.drawImage(ov, 0, 0, ov.width, ov.height, 0, 0, outputSize, outputSize);
        }
      }

      const pixels = ctx.getImageData(0, 0, outputSize, outputSize).data;
      let maxR = 0,
        maxG = 0,
        maxB = 0,
        maxA = 0;
      let aboveA5 = 0,
        aboveA25 = 0,
        aboveA100 = 0;
      const total = outputSize * outputSize;
      for (let px = 0; px < pixels.length; px += 4) {
        const pr = pixels[px]!,
          pg = pixels[px + 1]!,
          pb = pixels[px + 2]!,
          pa = pixels[px + 3]!;
        if (pr > maxR) maxR = pr;
        if (pg > maxG) maxG = pg;
        if (pb > maxB) maxB = pb;
        if (pa > maxA) maxA = pa;
        if (pa > 5) aboveA5++;
        if (pa > 25) aboveA25++;
        if (pa > 100) aboveA100++;
      }
      console.log(
        `[led-blast] COMPOSITE: maxRGBA=${maxR},${maxG},${maxB},${maxA} coverageA>5=${((aboveA5 / total) * 100).toFixed(1)}% A>25=${((aboveA25 / total) * 100).toFixed(1)}% A>100=${((aboveA100 / total) * 100).toFixed(1)}%`,
      );

      offscreen.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const dl = document.createElement("a");
        dl.href = url;
        dl.download = `led-export-composite-${Date.now()}.png`;
        dl.click();
        URL.revokeObjectURL(url);
      });
    },
    nuclearBlast: async () => {
      const containerElement = getContainerElement();
      if (!containerElement) {
        console.log("[led-blast] no container");
        return;
      }
      const mainCanvas = containerElement.querySelector("canvas");
      if (!mainCanvas) {
        console.log("[led-blast] no main canvas");
        return;
      }
      const container = mainCanvas.parentElement!;

      const configs = [
        { name: "BASELINE", flags: {} },
        { name: "NO_BLOOM", flags: { noBloom: true } },
        { name: "NO_TRAIL", flags: { noTrail: true } },
        { name: "SPRITES_ONLY", flags: { spritesOnly: true } },
        { name: "NO_BLOOM+NO_TRAIL", flags: { noBloom: true, noTrail: true } },
      ];

      const outputSize = 974;
      const results: {
        name: string;
        maxRGBA: string;
        coverageA5: string;
        coverageA25: string;
        coverageA100: string;
      }[] = [];

      for (const cfg of configs) {
        win.__tka_led_blast = cfg.flags;
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );

        const offscreen = document.createElement("canvas");
        offscreen.width = outputSize;
        offscreen.height = outputSize;
        const ctx = offscreen.getContext("2d")!;
        ctx.drawImage(mainCanvas, 0, 0, mainCanvas.width, mainCanvas.height, 0, 0, outputSize, outputSize);

        const overlays = container.querySelectorAll("canvas");
        for (const ov of overlays) {
          if (ov === mainCanvas || ov.width === 0 || ov.height === 0) continue;
          const isWebGL = !!(
            (ov as HTMLCanvasElement).getContext("webgl2") ||
            (ov as HTMLCanvasElement).getContext("webgl")
          );
          if (isWebGL && ov.width !== outputSize) {
            const tmp = document.createElement("canvas");
            tmp.width = ov.width;
            tmp.height = ov.height;
            const tmpCtx = tmp.getContext("2d")!;
            tmpCtx.clearRect(0, 0, ov.width, ov.height);
            tmpCtx.drawImage(ov, 0, 0);
            ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, outputSize, outputSize);
          } else {
            ctx.drawImage(ov, 0, 0, ov.width, ov.height, 0, 0, outputSize, outputSize);
          }
        }

        const pixels = ctx.getImageData(0, 0, outputSize, outputSize).data;
        let maxR = 0,
          maxG = 0,
          maxB = 0,
          maxA = 0;
        let aboveA5 = 0,
          aboveA25 = 0,
          aboveA100 = 0;
        const total = outputSize * outputSize;
        for (let px = 0; px < pixels.length; px += 4) {
          const pr = pixels[px]!,
            pg = pixels[px + 1]!,
            pb = pixels[px + 2]!,
            pa = pixels[px + 3]!;
          if (pr > maxR) maxR = pr;
          if (pg > maxG) maxG = pg;
          if (pb > maxB) maxB = pb;
          if (pa > maxA) maxA = pa;
          if (pa > 5) aboveA5++;
          if (pa > 25) aboveA25++;
          if (pa > 100) aboveA100++;
        }

        const result = {
          name: cfg.name,
          maxRGBA: `${maxR},${maxG},${maxB},${maxA}`,
          coverageA5: ((aboveA5 / total) * 100).toFixed(1),
          coverageA25: ((aboveA25 / total) * 100).toFixed(1),
          coverageA100: ((aboveA100 / total) * 100).toFixed(1),
        };
        results.push(result);
        console.log(
          `[led-blast] ${cfg.name}: maxRGBA=${result.maxRGBA} A>5=${result.coverageA5}% A>25=${result.coverageA25}% A>100=${result.coverageA100}%`,
        );
      }

      win.__tka_led_blast = {};
      console.log("[led-blast] === NUCLEAR BLAST COMPLETE ===");
      console.table(results);
      return results;
    },
  };

  return () => {
    delete win.__tka_fire_diag;
    delete win.__tka_fire_snapshot;
    delete win.__tka_led_diag;
    delete win.__tka_led_blast;
  };
}
