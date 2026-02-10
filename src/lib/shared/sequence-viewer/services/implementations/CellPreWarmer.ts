/**
 * CellPreWarmer
 *
 * Pre-warms the PictographBlobCache with rendered pictograph cells using the
 * Prioritized Task Scheduling API (scheduler.postTask / scheduler.yield).
 *
 * Scheduling strategy:
 * - "background" priority: Cells are rendered one at a time, yielding between
 *   each via scheduler.yield(). Never competes with gallery rendering or scroll.
 * - "user-visible" priority: All uncached cells rendered in parallel at normal priority.
 *   Used on hover — gives ~200ms head start before the user clicks.
 * - "user-blocking" priority: Same as user-visible but at highest priority.
 *   Used on click — starts before the drawer animation, races the mount.
 *
 * Fallback: Browsers without scheduler support get requestIdleCallback (background)
 * or microtask (user-visible/user-blocking).
 *
 * Cancellation: Each sequence gets its own AbortController. Calling cancelPreWarm()
 * aborts all in-flight renders for that sequence, freeing worker pool capacity.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PreviewCellRenderOptions } from "../contracts/IPreviewCellRenderer";
import type { ICellPreWarmer, PreWarmPriority } from "../contracts/ICellPreWarmer";
import type { LayerRenderOptions, LayerVisibility } from "$lib/shared/render/services/contracts/ILayerCompositor";
import { cellCacheKeyDeriver } from "./CellCacheKeyDeriver";
import { pictographBlobCache } from "$lib/shared/render/services/implementations/PictographBlobCache";
import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
import { getWorkerRenderPool } from "$lib/shared/render/services/implementations/WorkerRenderPool";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";
import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
import { isCatDogMode } from "$lib/features/browse/sequences/display/utils/prop-mode-helpers";
import { createStartPositionFromBeatStart } from "$lib/features/create/shared/services/implementations/sequence-transforms/sequence-transforms";

/** Cell to be rendered: pictograph data + step number + cache key per mode */
interface CellTask {
  pictographData: PictographData;
  stepNumber: number | undefined;
  lightKey: string;
  darkKey: string;
}

/** Check if the Prioritized Task Scheduling API is available */
function hasSchedulerApi(): boolean {
  return typeof globalThis.scheduler !== "undefined"
    && typeof globalThis.scheduler.postTask === "function";
}

/** Check if scheduler.yield() is available */
function hasSchedulerYield(): boolean {
  return hasSchedulerApi()
    && typeof globalThis.scheduler!.yield === "function";
}

/**
 * Schedule a task with the appropriate priority.
 * Falls back to requestIdleCallback (background) or queueMicrotask (others).
 */
function scheduleTask(
  fn: () => void | Promise<void>,
  priority: PreWarmPriority,
  signal?: AbortSignal
): void {
  if (signal?.aborted) return;

  if (hasSchedulerApi()) {
    globalThis.scheduler!.postTask(fn, { priority, signal }).catch(() => {
      // AbortError is expected on cancellation — swallow it
    });
    return;
  }

  // Fallback for browsers without scheduler API
  if (priority === "background") {
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(() => {
        if (!signal?.aborted) fn();
      });
      signal?.addEventListener("abort", () => cancelIdleCallback(id), { once: true });
    } else {
      const id = setTimeout(() => {
        if (!signal?.aborted) fn();
      }, 50);
      signal?.addEventListener("abort", () => clearTimeout(id), { once: true });
    }
  } else {
    // user-visible and user-blocking: run immediately via microtask
    queueMicrotask(() => {
      if (!signal?.aborted) fn();
    });
  }
}

export class CellPreWarmer implements ICellPreWarmer {
  /** Active AbortControllers keyed by sequence ID */
  private activeWarms = new Map<string, AbortController>();

  /** Track which sequences have been fully pre-warmed to avoid redundant work */
  private completedSequences = new Set<string>();

  preWarmSequence(sequence: SequenceData, priority: PreWarmPriority): void {
    if (!sequence.steps?.length) return;

    const seqId = sequence.id;

    // Already fully pre-warmed — skip
    if (this.completedSequences.has(seqId)) return;

    // If there's already a warm in progress at equal or higher priority, skip.
    // Higher priority upgrades: cancel the old one and re-start.
    const existing = this.activeWarms.get(seqId);
    if (existing) {
      // Already warming — only upgrade if new priority is strictly higher
      const priorityRank: Record<PreWarmPriority, number> = {
        "background": 0,
        "user-visible": 1,
        "user-blocking": 2,
      };
      const existingPriority = (existing as AbortController & { _priority?: PreWarmPriority })._priority ?? "background";
      if (priorityRank[priority] <= priorityRank[existingPriority]) {
        return; // Already at this priority or higher
      }
      // Upgrade: cancel old, start new at higher priority
      existing.abort();
    }

    const controller = new AbortController();
    (controller as AbortController & { _priority?: PreWarmPriority })._priority = priority;
    this.activeWarms.set(seqId, controller);

    const renderOptions = this.buildRenderOptions();
    const cellTasks = this.buildCellTasks(sequence, renderOptions);

    if (priority === "background") {
      this.warmSequential(seqId, cellTasks, renderOptions, controller.signal);
    } else {
      this.warmParallel(seqId, cellTasks, renderOptions, controller.signal);
    }
  }

  cancelPreWarm(sequenceId: string): void {
    const controller = this.activeWarms.get(sequenceId);
    if (controller) {
      controller.abort();
      this.activeWarms.delete(sequenceId);
    }
  }

  cancelAll(): void {
    for (const controller of this.activeWarms.values()) {
      controller.abort();
    }
    this.activeWarms.clear();
  }

  // =========================================================================
  // Render options — mirrors what LayeredSequencePreview uses
  // =========================================================================

  private buildRenderOptions(): PreviewCellRenderOptions {
    const settings = getSettings();
    const visibility = settings.visibility;
    const bluePropType = settingsService.settings.bluePropType;
    const redPropType = settingsService.settings.redPropType;
    const catDogMode = settingsService.settings.catDogMode;
    const catDogModeEnabled = isCatDogMode(bluePropType, redPropType, catDogMode);

    return {
      size: 480, // Same CELL_SIZE as LayeredSequencePreview
      bluePropType,
      redPropType,
      catDogModeEnabled,
      showStepNumbers: true, // Default for preview
      showNonRadialPoints: visibility?.nonRadialPoints ?? true,
      handPointVisibility: visibility?.handPointVisibility ?? "all",
      showTKA: visibility?.tkaGlyph ?? true,
      showReversals: visibility?.reversalIndicators ?? true,
    };
  }

  // =========================================================================
  // Build the list of cells that need rendering
  // =========================================================================

  private buildCellTasks(
    sequence: SequenceData,
    options: PreviewCellRenderOptions
  ): CellTask[] {
    const tasks: CellTask[] = [];

    // Start position
    const firstStep = sequence.steps![0];
    if (sequence.startPosition || firstStep) {
      const startData = sequence.startPosition || createStartPositionFromBeatStart(firstStep!);
      tasks.push({
        pictographData: startData,
        stepNumber: undefined,
        lightKey: cellCacheKeyDeriver.deriveCacheKey(startData, undefined, false, options),
        darkKey: cellCacheKeyDeriver.deriveCacheKey(startData, undefined, true, options),
      });
    }

    // Steps
    for (let i = 0; i < sequence.steps!.length; i++) {
      const step = sequence.steps![i];
      if (!step) continue;
      const stepNumber = i + 1;
      tasks.push({
        pictographData: step,
        stepNumber,
        lightKey: cellCacheKeyDeriver.deriveCacheKey(step, stepNumber, false, options),
        darkKey: cellCacheKeyDeriver.deriveCacheKey(step, stepNumber, true, options),
      });
    }

    return tasks;
  }

  // =========================================================================
  // Sequential warming (background priority) — one cell at a time, yielding
  // =========================================================================

  private async warmSequential(
    seqId: string,
    tasks: CellTask[],
    options: PreviewCellRenderOptions,
    signal: AbortSignal
  ): Promise<void> {
    try {
      for (const task of tasks) {
        if (signal.aborted) return;

        await this.renderCellIfNeeded(task, options, signal);

        // Yield between cells so background work never blocks the main thread
        if (signal.aborted) return;
        if (hasSchedulerYield()) {
          await globalThis.scheduler!.yield();
        } else if (typeof requestIdleCallback !== "undefined") {
          await new Promise<void>(resolve => requestIdleCallback(() => resolve()));
        }
      }

      // All cells rendered
      this.completedSequences.add(seqId);
    } finally {
      this.activeWarms.delete(seqId);
    }
  }

  // =========================================================================
  // Parallel warming (user-visible / user-blocking) — all cells at once
  // =========================================================================

  private async warmParallel(
    seqId: string,
    tasks: CellTask[],
    options: PreviewCellRenderOptions,
    signal: AbortSignal
  ): Promise<void> {
    try {
      const promises = tasks.map(task => this.renderCellIfNeeded(task, options, signal));
      await Promise.allSettled(promises);

      if (!signal.aborted) {
        this.completedSequences.add(seqId);
      }
    } finally {
      this.activeWarms.delete(seqId);
    }
  }

  // =========================================================================
  // Render a single cell (both light and dark) if not already cached
  // =========================================================================

  private async renderCellIfNeeded(
    task: CellTask,
    options: PreviewCellRenderOptions,
    signal: AbortSignal
  ): Promise<void> {
    // Check both modes — render whichever is missing
    const [lightCached, darkCached] = await Promise.all([
      pictographBlobCache.has(task.lightKey),
      pictographBlobCache.has(task.darkKey),
    ]);

    if (lightCached && darkCached) return;
    if (signal.aborted) return;

    // Prepare the pictograph data (DOM-free, main thread)
    const prepared = await pictographPreparer.prepareSingle(task.pictographData, {
      themeMode: "dark", // Theme mode for SVG asset loading; actual render mode is per-call below
      bluePropType: options.bluePropType,
      redPropType: options.catDogModeEnabled
        ? options.redPropType
        : options.bluePropType,
    });

    if (signal.aborted) return;

    const pool = getWorkerRenderPool();

    const visibility: LayerVisibility = {
      showTKA: options.showTKA ?? true,
      showReversals: options.showReversals ?? true,
    };

    // Render both modes in parallel
    const renderPromises: Promise<void>[] = [];

    if (!lightCached) {
      const lightOptions: LayerRenderOptions = {
        size: options.size,
        darkMode: false,
        showNonRadialPoints: options.showNonRadialPoints ?? true,
        handPointVisibility: options.handPointVisibility ?? "all",
        bluePropType: options.bluePropType,
        redPropType: options.catDogModeEnabled
          ? options.redPropType
          : options.bluePropType,
      };
      renderPromises.push(
        pool.render(prepared, lightOptions, visibility, options.showStepNumbers ? task.stepNumber : undefined)
          .then(async blob => {
            if (!signal.aborted) {
              await pictographBlobCache.set(task.lightKey, blob);
            }
          })
          .catch(() => {}) // Swallow render/cache errors — pre-warming is best-effort
      );
    }

    if (!darkCached) {
      const darkOptions: LayerRenderOptions = {
        size: options.size,
        darkMode: true,
        showNonRadialPoints: options.showNonRadialPoints ?? true,
        handPointVisibility: options.handPointVisibility ?? "all",
        bluePropType: options.bluePropType,
        redPropType: options.catDogModeEnabled
          ? options.redPropType
          : options.bluePropType,
      };
      renderPromises.push(
        pool.render(prepared, darkOptions, visibility, options.showStepNumbers ? task.stepNumber : undefined)
          .then(async blob => {
            if (!signal.aborted) {
              await pictographBlobCache.set(task.darkKey, blob);
            }
          })
          .catch(() => {})
      );
    }

    await Promise.allSettled(renderPromises);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const cellPreWarmer = new CellPreWarmer();
