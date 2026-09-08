/**
 * Opt-in attribution for the scene-boot window.
 *
 * `boot-spans.ts` answers "how long did assets take". It cannot answer "doing
 * what", which is the question that decides whether a boot optimization is
 * worth building. Three attempts to answer it with an external profiler failed
 * — a shared renderer process mixed other tabs' frames into the trace, the
 * production build strips the test routes, and the captured windows landed on
 * steady-state rendering rather than the load. So the measurement lives in the
 * app that owns the boot, where it also works in the packaged desktop build.
 *
 * Enabled by `?bootprofile=1`, `localStorage["tka-boot-profile"] = "1"`, or
 * `window.__sceneBootProfileEnabled = true`. Disabled, nothing is patched and
 * no observer is created.
 */

import {
  clipIntervals,
  subtractIntervals,
  summarizeIntervals,
  unionMs,
  type BootInterval,
  type IntervalStats,
} from "./boot-interval-math";

export type BootProfileCategory =
  | "fetch"
  | "decode"
  | "textureUpload"
  | "bufferUpload"
  | "shaderSync"
  | "gpuSync";

const CATEGORIES: BootProfileCategory[] = [
  "fetch",
  "decode",
  "textureUpload",
  "bufferUpload",
  "shaderSync",
  "gpuSync",
];

export interface BootPhaseProfile {
  phase: string;
  startMs: number;
  endMs: number;
  windowMs: number;
  categories: Record<BootProfileCategory, IntervalStats>;
  /** Union of long tasks — main-thread time in blocks of 50 ms or more. */
  blockedMs: number;
  /**
   * Blocked time that no instrumented call explains. GLB JSON parse, geometry
   * construction, and scene-graph assembly land here.
   */
  unexplainedBlockedMs: number;
  /** Window time covered by no observed activity at all. */
  idleMs: number;
}

export interface BootResourceEntry {
  name: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  transferBytes: number;
  decodedBytes: number;
  initiator: string;
}

export interface BootLongTask {
  startMs: number;
  durationMs: number;
  attribution: string;
}

export interface BootFeatureReady {
  key: string;
  atMs: number;
  sinceStartMs: number;
}

export interface BootProfileReport {
  enabled: true;
  startedAtMs: number;
  finishedAtMs: number | null;
  totalMs: number | null;
  phases: BootPhaseProfile[];
  features: BootFeatureReady[];
  topResources: BootResourceEntry[];
  topLongTasks: BootLongTask[];
  notes: string[];
}

declare global {
  interface Window {
    __sceneBootProfileEnabled?: boolean;
    __sceneBootProfile?: BootProfileReport | { enabled: false };
  }
}

interface PhaseBoundary {
  phase: string;
  startMs: number;
  endMs: number | null;
}

interface ProfilerState {
  startedAtMs: number;
  finishedAtMs: number | null;
  intervals: Record<BootProfileCategory, BootInterval[]>;
  longTasks: BootLongTask[];
  resources: BootResourceEntry[];
  features: BootFeatureReady[];
  phases: PhaseBoundary[];
  restore: (() => void)[];
  notes: string[];
}

let state: ProfilerState | null = null;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function isBootProfileEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (window.__sceneBootProfileEnabled === true) return true;
  try {
    if (new URLSearchParams(window.location.search).get("bootprofile") === "1") {
      return true;
    }
  } catch {
    // A malformed or unavailable location must never break scene boot.
  }
  try {
    return localStorage.getItem("tka-boot-profile") === "1";
  } catch {
    return false;
  }
}

function record(category: BootProfileCategory, start: number, end: number) {
  if (!state) return;
  state.intervals[category].push({ start, end });
}

/** Time a synchronous method on a prototype, attributing it to a category. */
function patchSync(
  target: object | undefined,
  method: string,
  category: BootProfileCategory,
  restore: (() => void)[]
): void {
  if (!target) return;
  const holder = target as Record<string, unknown>;
  const original = holder[method];
  if (typeof original !== "function") return;
  const fn = original as (...args: unknown[]) => unknown;
  holder[method] = function patched(this: unknown, ...args: unknown[]) {
    const start = now();
    try {
      return fn.apply(this, args);
    } finally {
      record(category, start, now());
    }
  };
  restore.push(() => {
    holder[method] = original;
  });
}

function installImageDecode(restore: (() => void)[]): void {
  if (typeof window.createImageBitmap !== "function") return;
  const original = window.createImageBitmap.bind(window);
  window.createImageBitmap = function patched(
    ...args: Parameters<typeof original>
  ) {
    const start = now();
    const stamp = () => record("decode", start, now());
    return original(...args).then(
      (bitmap) => {
        stamp();
        return bitmap;
      },
      (error: unknown) => {
        stamp();
        throw error;
      }
    );
  } as typeof window.createImageBitmap;
  restore.push(() => {
    window.createImageBitmap = original;
  });
}

function installWebGl(restore: (() => void)[]): void {
  const contexts = [
    typeof WebGL2RenderingContext !== "undefined"
      ? WebGL2RenderingContext.prototype
      : undefined,
    typeof WebGLRenderingContext !== "undefined"
      ? WebGLRenderingContext.prototype
      : undefined,
  ];
  for (const proto of contexts) {
    if (!proto) continue;
    for (const method of [
      "texImage2D",
      "texSubImage2D",
      "texImage3D",
      "texSubImage3D",
      "texStorage2D",
      "compressedTexImage2D",
      "compressedTexSubImage2D",
      "generateMipmap",
    ]) {
      patchSync(proto, method, "textureUpload", restore);
    }
    for (const method of ["bufferData", "bufferSubData"]) {
      patchSync(proto, method, "bufferUpload", restore);
    }
    // getProgramParameter is where a driver using KHR_parallel_shader_compile
    // actually blocks: compileShader and linkProgram return immediately and the
    // wait surfaces when the link status is read.
    for (const method of [
      "compileShader",
      "linkProgram",
      "getProgramParameter",
      "getShaderParameter",
      "getProgramInfoLog",
    ]) {
      patchSync(proto, method, "shaderSync", restore);
    }
    for (const method of ["finish", "readPixels"]) {
      patchSync(proto, method, "gpuSync", restore);
    }
  }
}

function installObservers(restore: (() => void)[]): void {
  if (typeof PerformanceObserver !== "function") return;

  try {
    const longTasks = new PerformanceObserver((list) => {
      if (!state) return;
      for (const entry of list.getEntries()) {
        const attribution = (
          entry as PerformanceEntry & {
            attribution?: { containerName?: string; containerSrc?: string }[];
          }
        ).attribution;
        const first = attribution?.[0];
        state.longTasks.push({
          startMs: entry.startTime,
          durationMs: entry.duration,
          attribution: first?.containerSrc || first?.containerName || "self",
        });
      }
    });
    longTasks.observe({ type: "longtask", buffered: true });
    restore.push(() => longTasks.disconnect());
  } catch {
    state?.notes.push("longtask observer unavailable in this browser");
  }

  try {
    const resources = new PerformanceObserver((list) => {
      if (!state) return;
      for (const entry of list.getEntries()) {
        const timing = entry as PerformanceResourceTiming;
        state.resources.push({
          name: timing.name,
          startMs: timing.startTime,
          endMs: timing.responseEnd,
          durationMs: timing.responseEnd - timing.startTime,
          transferBytes: timing.transferSize ?? 0,
          decodedBytes: timing.decodedBodySize ?? 0,
          initiator: timing.initiatorType,
        });
      }
    });
    resources.observe({ type: "resource", buffered: true });
    restore.push(() => resources.disconnect());
  } catch {
    state?.notes.push("resource observer unavailable in this browser");
  }
}

export function startBootProfile(): void {
  if (typeof window === "undefined") return;
  if (!isBootProfileEnabled()) {
    window.__sceneBootProfile = { enabled: false };
    return;
  }
  stopBootProfile();
  const restore: (() => void)[] = [];
  state = {
    startedAtMs: now(),
    finishedAtMs: null,
    intervals: {
      fetch: [],
      decode: [],
      textureUpload: [],
      bufferUpload: [],
      shaderSync: [],
      gpuSync: [],
    },
    longTasks: [],
    resources: [],
    features: [],
    phases: [],
    restore,
    notes: [],
  };
  installImageDecode(restore);
  installWebGl(restore);
  installObservers(restore);
}

export function stopBootProfile(): void {
  if (!state) return;
  for (const undo of state.restore) {
    try {
      undo();
    } catch {
      // Restoring instrumentation must never throw into scene teardown.
    }
  }
  state.restore = [];
}

export function markBootPhaseStart(phase: string): void {
  if (!state) return;
  state.phases.push({ phase, startMs: now(), endMs: null });
}

export function markBootPhaseEnd(phase: string): void {
  if (!state) return;
  for (let i = state.phases.length - 1; i >= 0; i -= 1) {
    const boundary = state.phases[i];
    if (boundary && boundary.phase === phase && boundary.endMs === null) {
      boundary.endMs = now();
      return;
    }
  }
}

export function recordBootFeatureReady(key: string): void {
  if (!state) return;
  if (state.features.some((feature) => feature.key === key)) return;
  const atMs = now();
  state.features.push({
    key,
    atMs,
    sinceStartMs: atMs - state.startedAtMs,
  });
}

function fetchIntervals(current: ProfilerState): BootInterval[] {
  return current.resources.map((resource) => ({
    start: resource.startMs,
    end: resource.endMs,
  }));
}

function profilePhase(
  current: ProfilerState,
  phase: string,
  startMs: number,
  endMs: number
): BootPhaseProfile {
  const categories = {} as Record<BootProfileCategory, IntervalStats>;
  const all: BootInterval[] = [];
  for (const category of CATEGORIES) {
    const source =
      category === "fetch"
        ? fetchIntervals(current)
        : current.intervals[category];
    const clipped = clipIntervals(source, startMs, endMs);
    categories[category] = summarizeIntervals(clipped);
    all.push(...clipped);
  }

  const longTaskIntervals = clipIntervals(
    current.longTasks.map((task) => ({
      start: task.startMs,
      end: task.startMs + task.durationMs,
    })),
    startMs,
    endMs
  );
  const explained = [
    ...clipIntervals(current.intervals.textureUpload, startMs, endMs),
    ...clipIntervals(current.intervals.bufferUpload, startMs, endMs),
    ...clipIntervals(current.intervals.shaderSync, startMs, endMs),
    ...clipIntervals(current.intervals.gpuSync, startMs, endMs),
  ];
  all.push(...longTaskIntervals);

  const windowMs = Math.max(0, endMs - startMs);
  return {
    phase,
    startMs,
    endMs,
    windowMs,
    categories,
    blockedMs: unionMs(longTaskIntervals),
    unexplainedBlockedMs: unionMs(
      subtractIntervals(longTaskIntervals, explained)
    ),
    idleMs: Math.max(0, windowMs - unionMs(all)),
  };
}

export function buildBootProfileReport(): BootProfileReport | null {
  if (!state) return null;
  const current = state;
  const finishedAtMs = current.finishedAtMs ?? now();

  const phases: BootPhaseProfile[] = [];
  for (const boundary of current.phases) {
    phases.push(
      profilePhase(
        current,
        boundary.phase,
        boundary.startMs,
        boundary.endMs ?? finishedAtMs
      )
    );
  }
  phases.push(profilePhase(current, "total", current.startedAtMs, finishedAtMs));

  const topResources = [...current.resources]
    .filter((resource) => resource.endMs >= current.startedAtMs)
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 15);
  const topLongTasks = [...current.longTasks]
    .filter((task) => task.startMs >= current.startedAtMs)
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 15);

  return {
    enabled: true,
    startedAtMs: current.startedAtMs,
    finishedAtMs: current.finishedAtMs,
    totalMs: current.finishedAtMs
      ? current.finishedAtMs - current.startedAtMs
      : null,
    phases,
    features: [...current.features].sort((a, b) => a.atMs - b.atMs),
    topResources,
    topLongTasks,
    notes: current.notes,
  };
}

function ms(value: number): string {
  return `${value.toFixed(0)} ms`.padStart(9);
}

/** A console-readable table. The JSON report stays on window for tooling. */
export function formatBootProfile(report: BootProfileReport): string {
  const lines: string[] = [];
  lines.push(`scene boot — ${(report.totalMs ?? 0).toFixed(0)} ms total`);
  for (const phase of report.phases) {
    lines.push("");
    lines.push(`[${phase.phase}] window ${phase.windowMs.toFixed(0)} ms`);
    for (const category of CATEGORIES) {
      const stats = phase.categories[category];
      if (stats.count === 0) continue;
      lines.push(
        `  ${category.padEnd(15)}${ms(stats.wallMs)} wall  ` +
          `${ms(stats.totalMs)} cpu  x${stats.count}  ` +
          `peak ${stats.maxInFlight}`
      );
    }
    lines.push(`  ${"blocked".padEnd(15)}${ms(phase.blockedMs)} wall`);
    lines.push(
      `  ${"  unexplained".padEnd(15)}${ms(phase.unexplainedBlockedMs)} wall`
    );
    lines.push(`  ${"idle".padEnd(15)}${ms(phase.idleMs)} wall`);
  }
  if (report.features.length > 0) {
    lines.push("");
    lines.push("feature ready (ms from boot start)");
    for (const feature of report.features) {
      lines.push(`  ${feature.key.padEnd(24)}${ms(feature.sinceStartMs)}`);
    }
  }
  if (report.topResources.length > 0) {
    lines.push("");
    lines.push("slowest fetches");
    for (const resource of report.topResources.slice(0, 8)) {
      const kb = (resource.transferBytes / 1024).toFixed(0);
      const name = resource.name.split("/").slice(-1)[0] ?? resource.name;
      lines.push(`  ${name.slice(0, 40).padEnd(42)}${ms(resource.durationMs)}  ${kb} KB`);
    }
  }
  if (report.topLongTasks.length > 0) {
    lines.push("");
    lines.push("longest main-thread blocks");
    for (const task of report.topLongTasks.slice(0, 8)) {
      lines.push(`  ${task.attribution.slice(0, 40).padEnd(42)}${ms(task.durationMs)}`);
    }
  }
  return lines.join("\n");
}

export function finishBootProfile(): void {
  if (!state) return;
  state.finishedAtMs = now();
  stopBootProfile();
  const report = buildBootProfileReport();
  state = null;
  if (typeof window === "undefined" || !report) return;
  window.__sceneBootProfile = report;
  console.info(formatBootProfile(report));
}
