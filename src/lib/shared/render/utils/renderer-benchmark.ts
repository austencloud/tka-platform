/**
 * Renderer Benchmark Harness
 *
 * Compares performance of different pictograph rendering approaches:
 * - SVG (current implementation)
 * - Canvas 2D direct drawing
 * - WebGL GPU-accelerated
 *
 * Usage (from browser console):
 *   window.benchmarkRenderers()           // Quick test (10 pictographs)
 *   window.benchmarkRenderers(50)         // Full test
 */

import { browser } from "$app/environment";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { MotionColor, MotionType, RotationDirection, Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { IDirectRenderer, RenderTiming } from "../services/contracts/IDirectRenderer";
import { Canvas2DDirectRenderer } from "../services/implementations/Canvas2DDirectRenderer";
import { WebGLDirectRenderer } from "../services/implementations/WebGLDirectRenderer";
import { renderPictographToSVG, type PictographVisibilityOptions } from "./pictograph-to-svg";

interface RendererResult {
  name: string;
  supported: boolean;
  initTimeMs: number;
  renders: Array<{
    pictographId: string;
    timing: RenderTiming;
  }>;
  totalTimeMs: number;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  memoryUsage: number;
}

interface BenchmarkComparison {
  timestamp: string;
  pictographCount: number;
  results: {
    svg: RendererResult;
    canvas2d: RendererResult;
    webgl: RendererResult;
  };
  winner: string;
  speedupVsSvg: {
    canvas2d: string;
    webgl: string;
  };
}

// Default visibility options for benchmarking
const DEFAULT_VISIBILITY: PictographVisibilityOptions = {
  showTKA: true,
  showVTG: false,
  showElemental: false,
  showPositions: false,
  showReversals: true,
  showNonRadialPoints: false,
  darkMode: true,
};

const RENDER_SIZE = 240; // Standard beat size

/**
 * Generate test pictographs with varying complexity
 */
function generateTestPictographs(count: number): PictographData[] {
  const pictographs: PictographData[] = [];

  const motionTypes = [MotionType.PRO, MotionType.ANTI, MotionType.DASH, MotionType.STATIC, MotionType.FLOAT];
  const turns = [0, 0.5, 1, 1.5, 2, 2.5, 3];
  const orientations = [Orientation.IN, Orientation.OUT, Orientation.CLOCK, Orientation.COUNTER];
  const letters = [Letter.A, Letter.B, Letter.C, Letter.D, Letter.E, Letter.F, Letter.G, Letter.H, Letter.I, Letter.J, Letter.K, Letter.L];
  const gridModes = [GridMode.DIAMOND, GridMode.BOX];
  const startLocations = [GridLocation.NORTH, GridLocation.SOUTH, GridLocation.EAST, GridLocation.WEST];
  const endLocations = [GridLocation.SOUTH, GridLocation.NORTH, GridLocation.WEST, GridLocation.EAST];
  const rotations = [RotationDirection.CLOCKWISE, RotationDirection.COUNTER_CLOCKWISE, RotationDirection.NO_ROTATION];

  for (let i = 0; i < count; i++) {
    const motionType = motionTypes[i % motionTypes.length]!;
    const turn = turns[i % turns.length]!;
    const orientation = orientations[i % orientations.length]!;
    const letter = letters[i % letters.length]!;
    const gridMode = gridModes[i % gridModes.length]!;
    const startLoc = startLocations[i % startLocations.length]!;
    const endLoc = endLocations[i % endLocations.length]!;
    const rotation = rotations[i % rotations.length]!;

    const blueMotion = createMotionData({
      motionType,
      turns: turn,
      startOrientation: orientation,
      endOrientation: orientation,
      startLocation: startLoc,
      endLocation: endLoc,
      rotationDirection: rotation,
      color: MotionColor.BLUE,
      gridMode,
    });

    const redMotion = createMotionData({
      motionType: motionTypes[(i + 2) % motionTypes.length],
      turns: turns[(i + 1) % turns.length],
      startOrientation: orientations[(i + 1) % orientations.length],
      endOrientation: orientations[(i + 1) % orientations.length],
      startLocation: startLocations[(i + 1) % startLocations.length],
      endLocation: endLocations[(i + 1) % endLocations.length],
      rotationDirection: rotations[(i + 1) % rotations.length],
      color: MotionColor.RED,
      gridMode,
    });

    pictographs.push({
      id: `test-${i}`,
      letter,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
      },
    });
  }

  return pictographs;
}

/**
 * Benchmark the current SVG renderer
 */
async function benchmarkSVG(
  pictographs: PictographData[]
): Promise<RendererResult> {
  const renders: RendererResult["renders"] = [];
  const timings: number[] = [];

  const initStart = performance.now();
  // SVG has no init
  const initTimeMs = performance.now() - initStart;

  for (const pictograph of pictographs) {
    const start = performance.now();

    // Render SVG and convert to image (mimicking current flow)
    const svg = await renderPictographToSVG(
      pictograph,
      RENDER_SIZE,
      undefined,
      DEFAULT_VISIBILITY
    );

    // Convert to image (this is the expensive part)
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });

    const totalMs = performance.now() - start;
    timings.push(totalMs);

    renders.push({
      pictographId: pictograph.id ?? "unknown",
      timing: {
        totalMs,
        setupMs: 0,
        drawMs: totalMs,
        finalizeMs: 0,
      },
    });
  }

  return {
    name: "SVG (current)",
    supported: true,
    initTimeMs,
    renders,
    totalTimeMs: timings.reduce((a, b) => a + b, 0),
    avgTimeMs: timings.reduce((a, b) => a + b, 0) / timings.length,
    minTimeMs: Math.min(...timings),
    maxTimeMs: Math.max(...timings),
    memoryUsage: 0, // SVG doesn't track memory
  };
}

/**
 * Benchmark a direct renderer (Canvas 2D or WebGL)
 */
async function benchmarkDirectRenderer(
  renderer: IDirectRenderer,
  pictographs: PictographData[]
): Promise<RendererResult> {
  const renders: RendererResult["renders"] = [];
  const timings: number[] = [];

  // Check support
  if (!renderer.isSupported()) {
    return {
      name: renderer.getName(),
      supported: false,
      initTimeMs: 0,
      renders: [],
      totalTimeMs: 0,
      avgTimeMs: 0,
      minTimeMs: 0,
      maxTimeMs: 0,
      memoryUsage: 0,
    };
  }

  // Initialize
  const initStart = performance.now();
  await renderer.initialize();
  const initTimeMs = performance.now() - initStart;

  // Render each pictograph
  for (const pictograph of pictographs) {
    const { timing } = await renderer.renderPictographWithTiming(pictograph, {
      size: RENDER_SIZE,
      visibility: DEFAULT_VISIBILITY,
    });

    timings.push(timing.totalMs);

    renders.push({
      pictographId: pictograph.id ?? "unknown",
      timing,
    });
  }

  const result: RendererResult = {
    name: renderer.getName(),
    supported: true,
    initTimeMs,
    renders,
    totalTimeMs: timings.reduce((a, b) => a + b, 0),
    avgTimeMs: timings.length > 0 ? timings.reduce((a, b) => a + b, 0) / timings.length : 0,
    minTimeMs: timings.length > 0 ? Math.min(...timings) : 0,
    maxTimeMs: timings.length > 0 ? Math.max(...timings) : 0,
    memoryUsage: renderer.getMemoryUsage(),
  };

  // Cleanup
  renderer.dispose();

  return result;
}

/**
 * Run comprehensive benchmark comparing all renderers
 */
export async function benchmarkRenderers(
  pictographCount: number = 10
): Promise<BenchmarkComparison | null> {
  if (!browser) {
    console.error("[Benchmark] Must run in browser");
    return null;
  }

  console.log("\n" + "=".repeat(70));
  console.log("🏁 RENDERER BENCHMARK");
  console.log("=".repeat(70));
  console.log(`Testing with ${pictographCount} pictographs\n`);

  // Generate test data
  console.log("Generating test pictographs...");
  const pictographs = generateTestPictographs(pictographCount);

  // Warm up (first renders are always slower)
  console.log("Warming up...\n");
  const warmupPictographs = pictographs.slice(0, 3);

  // Benchmark SVG
  console.log("📊 Benchmarking SVG (current)...");
  const svgResult = await benchmarkSVG(pictographs);
  console.log(`   Avg: ${svgResult.avgTimeMs.toFixed(1)}ms, Total: ${svgResult.totalTimeMs.toFixed(0)}ms\n`);

  // Benchmark Canvas 2D
  console.log("📊 Benchmarking Canvas 2D...");
  const canvas2dRenderer = new Canvas2DDirectRenderer();
  const canvas2dResult = await benchmarkDirectRenderer(canvas2dRenderer, pictographs);
  if (canvas2dResult.supported) {
    console.log(`   Avg: ${canvas2dResult.avgTimeMs.toFixed(1)}ms, Total: ${canvas2dResult.totalTimeMs.toFixed(0)}ms\n`);
  } else {
    console.log("   Not supported\n");
  }

  // Benchmark WebGL
  console.log("📊 Benchmarking WebGL...");
  const webglRenderer = new WebGLDirectRenderer();
  const webglResult = await benchmarkDirectRenderer(webglRenderer, pictographs);
  if (webglResult.supported) {
    console.log(`   Avg: ${webglResult.avgTimeMs.toFixed(1)}ms, Total: ${webglResult.totalTimeMs.toFixed(0)}ms\n`);
  } else {
    console.log("   Not supported\n");
  }

  // Calculate speedups
  const canvas2dSpeedup = svgResult.avgTimeMs > 0
    ? ((1 - canvas2dResult.avgTimeMs / svgResult.avgTimeMs) * 100).toFixed(1) + "%"
    : "N/A";
  const webglSpeedup = svgResult.avgTimeMs > 0
    ? ((1 - webglResult.avgTimeMs / svgResult.avgTimeMs) * 100).toFixed(1) + "%"
    : "N/A";

  // Determine winner
  const supportedResults = [
    { name: "svg", avg: svgResult.avgTimeMs },
    canvas2dResult.supported ? { name: "canvas2d", avg: canvas2dResult.avgTimeMs } : null,
    webglResult.supported ? { name: "webgl", avg: webglResult.avgTimeMs } : null,
  ].filter(Boolean) as Array<{ name: string; avg: number }>;

  const winner = supportedResults.reduce((a, b) => (a.avg < b.avg ? a : b)).name;

  // Build result
  const comparison: BenchmarkComparison = {
    timestamp: new Date().toISOString(),
    pictographCount,
    results: {
      svg: svgResult,
      canvas2d: canvas2dResult,
      webgl: webglResult,
    },
    winner,
    speedupVsSvg: {
      canvas2d: canvas2dSpeedup,
      webgl: webglSpeedup,
    },
  };

  // Print summary
  printBenchmarkSummary(comparison);

  return comparison;
}

/**
 * Print formatted benchmark summary
 */
function printBenchmarkSummary(comparison: BenchmarkComparison): void {
  console.log("\n" + "=".repeat(70));
  console.log("📈 BENCHMARK RESULTS");
  console.log("=".repeat(70));

  console.log("\n┌─────────────────────────────────────────────────────────────────────┐");
  console.log("│ RENDER TIMES (per pictograph)                                       │");
  console.log("├─────────────────────────────────────────────────────────────────────┤");

  const { svg, canvas2d, webgl } = comparison.results;

  console.log(`│ SVG (current):     ${svg.avgTimeMs.toFixed(1).padStart(8)}ms avg   │ baseline              │`);

  if (canvas2d.supported) {
    console.log(`│ Canvas 2D:         ${canvas2d.avgTimeMs.toFixed(1).padStart(8)}ms avg   │ ${comparison.speedupVsSvg.canvas2d.padStart(6)} faster          │`);
  } else {
    console.log(`│ Canvas 2D:         not supported                                    │`);
  }

  if (webgl.supported) {
    console.log(`│ WebGL:             ${webgl.avgTimeMs.toFixed(1).padStart(8)}ms avg   │ ${comparison.speedupVsSvg.webgl.padStart(6)} faster          │`);
  } else {
    console.log(`│ WebGL:             not supported                                    │`);
  }

  console.log("└─────────────────────────────────────────────────────────────────────┘");

  console.log("\n┌─────────────────────────────────────────────────────────────────────┐");
  console.log("│ DETAILED METRICS                                                    │");
  console.log("├─────────────────────────────────────────────────────────────────────┤");
  console.log(`│ Pictographs tested:     ${String(comparison.pictographCount).padStart(5)}                                  │`);
  console.log(`│ SVG total time:         ${svg.totalTimeMs.toFixed(0).padStart(5)}ms                                 │`);
  if (canvas2d.supported) {
    console.log(`│ Canvas 2D total time:   ${canvas2d.totalTimeMs.toFixed(0).padStart(5)}ms (init: ${canvas2d.initTimeMs.toFixed(0)}ms)              │`);
  }
  if (webgl.supported) {
    console.log(`│ WebGL total time:       ${webgl.totalTimeMs.toFixed(0).padStart(5)}ms (init: ${webgl.initTimeMs.toFixed(0)}ms)              │`);
  }
  console.log("├─────────────────────────────────────────────────────────────────────┤");
  console.log(`│ SVG min/max:            ${svg.minTimeMs.toFixed(0).padStart(5)}ms / ${svg.maxTimeMs.toFixed(0).padStart(5)}ms                       │`);
  if (canvas2d.supported) {
    console.log(`│ Canvas 2D min/max:      ${canvas2d.minTimeMs.toFixed(0).padStart(5)}ms / ${canvas2d.maxTimeMs.toFixed(0).padStart(5)}ms                       │`);
  }
  if (webgl.supported) {
    console.log(`│ WebGL min/max:          ${webgl.minTimeMs.toFixed(0).padStart(5)}ms / ${webgl.maxTimeMs.toFixed(0).padStart(5)}ms                       │`);
  }
  console.log("└─────────────────────────────────────────────────────────────────────┘");

  console.log("\n┌─────────────────────────────────────────────────────────────────────┐");
  console.log("│ MEMORY USAGE                                                        │");
  console.log("├─────────────────────────────────────────────────────────────────────┤");
  console.log(`│ SVG:                    N/A (no persistent memory)                  │`);
  if (canvas2d.supported) {
    const canvas2dMB = (canvas2d.memoryUsage / 1024 / 1024).toFixed(2);
    console.log(`│ Canvas 2D:              ${canvas2dMB.padStart(6)}MB (path data)                       │`);
  }
  if (webgl.supported) {
    const webglMB = (webgl.memoryUsage / 1024 / 1024).toFixed(2);
    console.log(`│ WebGL:                  ${webglMB.padStart(6)}MB (texture atlas)                    │`);
  }
  console.log("└─────────────────────────────────────────────────────────────────────┘");

  console.log(`\n🏆 WINNER: ${comparison.winner.toUpperCase()}`);

  // Recommendation
  console.log("\n📝 RECOMMENDATION:");
  if (comparison.winner === "svg") {
    console.log("   SVG remains the fastest. Direct renderers need optimization.");
  } else if (comparison.winner === "canvas2d") {
    console.log("   Canvas 2D is faster than SVG. Consider adopting for fresh renders.");
  } else if (comparison.winner === "webgl") {
    console.log("   WebGL is fastest. Consider adopting if complexity is acceptable.");
  }

  const speedupNum = parseFloat(comparison.speedupVsSvg.canvas2d);
  if (speedupNum > 50) {
    console.log(`   ✓ Canvas 2D provides significant speedup (${speedupNum.toFixed(0)}%)`);
  }

  console.log("\n" + "=".repeat(70));
}

// Expose globally for console access
if (browser && typeof window !== "undefined") {
  (window as unknown as { benchmarkRenderers: typeof benchmarkRenderers }).benchmarkRenderers = benchmarkRenderers;
  console.log("[Benchmark] Utility loaded. Run: window.benchmarkRenderers()");
}
