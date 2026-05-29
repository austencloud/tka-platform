import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PreviewCellRenderOptions } from "./preview-cell-renderer";
import type { LayerRenderOptions, LayerVisibility } from "../../render/services/types";

export type PreWarmPriority = "background" | "user-visible" | "user-blocking";
import { cellCacheKeyDeriver } from "./cell-cache-key-deriver";
import { pictographBlobCache } from "$lib/shared/render/services/pictograph-blob-cache";
import { pictographPreparer } from "$lib/shared/pictograph/shared/services/pictograph-preparer";
import { getWorkerRenderPool } from "$lib/shared/render/services/worker-render-pool";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";
import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
import { isCatDogMode } from "$lib/shared/browse/utils/prop-mode-helpers";
import { createStartPositionFromBeatStart } from "$lib/shared/create/services/sequence-transforms";
import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";

interface CellTask {
  pictographData: PictographData;
  stepNumber: number | undefined;
  cacheKey: string;
  isDark: boolean;
}

function hasSchedulerApi(): boolean {
  return typeof globalThis.scheduler !== "undefined"
    && typeof globalThis.scheduler.postTask === "function";
}

function hasSchedulerYield(): boolean {
  return hasSchedulerApi()
    && typeof globalThis.scheduler!.yield === "function";
}

export class CellPreWarmer {
  private activeWarms = new Map<string, AbortController>();
  private completedSequences = new Set<string>();

  preWarmSequence(sequence: SequenceData, priority: PreWarmPriority): void {
    if (!sequence.steps?.length) return;

    const seqId = sequence.id;

    if (this.completedSequences.has(seqId)) return;

    const existing = this.activeWarms.get(seqId);
    if (existing) {
      const priorityRank: Record<PreWarmPriority, number> = {
        "background": 0,
        "user-visible": 1,
        "user-blocking": 2,
      };
      const existingPriority = (existing as AbortController & { _priority?: PreWarmPriority })._priority ?? "background";
      if (priorityRank[priority] <= priorityRank[existingPriority]) {
        return;
      }
      existing.abort();
    }

    const controller = new AbortController();
    (controller as AbortController & { _priority?: PreWarmPriority })._priority = priority;
    this.activeWarms.set(seqId, controller);

    const isDark = settingsService.settings.darkMode ?? false;
    const renderOptions = this.buildRenderOptions();
    const cellTasks = this.buildCellTasks(sequence, renderOptions, isDark);

    if (priority === "background") {
      this.warmSequential(seqId, cellTasks, renderOptions, controller.signal);
    } else {
      this.warmParallel(seqId, cellTasks, renderOptions, controller.signal);
    }
  }

  async preWarmSequenceAsync(sequence: SequenceData): Promise<void> {
    if (!sequence.steps?.length) return;

    const seqId = sequence.id;
    if (this.completedSequences.has(seqId)) return;

    const controller = new AbortController();
    this.activeWarms.set(seqId, controller);

    const isDark = settingsService.settings.darkMode ?? false;
    const renderOptions = this.buildRenderOptions();
    const cellTasks = this.buildCellTasks(sequence, renderOptions, isDark);

    await this.warmParallel(seqId, cellTasks, renderOptions, controller.signal);
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

  invalidateCompleted(): void {
    this.completedSequences.clear();
  }

  private buildRenderOptions(): PreviewCellRenderOptions {
    const settings = getSettings();
    const visibility = settings.visibility;
    const bluePropType = settingsService.settings.bluePropType;
    const redPropType = settingsService.settings.redPropType;
    const catDogMode = settingsService.settings.catDogMode;
    const catDogModeEnabled = isCatDogMode(bluePropType, redPropType, catDogMode);

    return {
      size: 240, 
      bluePropType,
      redPropType,
      catDogModeEnabled,
      showStepNumbers: false,
      showNonRadialPoints: visibility?.nonRadialPoints ?? true,
      handPointVisibility: visibility?.handPointVisibility ?? "all",
      showTKA: visibility?.tkaGlyph ?? true,
      showReversals: visibility?.reversalIndicators ?? true,
      showTnD: getVisibilityStateManager().getRawGlyphVisibility("tndGlyph"),
      showElemental: getVisibilityStateManager().getRawGlyphVisibility("elementalGlyph"),
      showPositions: getVisibilityStateManager().getRawGlyphVisibility("positionsGlyph"),
    };
  }

  private buildCellTasks(
    sequence: SequenceData,
    options: PreviewCellRenderOptions,
    isDark: boolean
  ): CellTask[] {
    const tasks: CellTask[] = [];

    const firstStep = sequence.steps![0];
    if (sequence.startPosition || firstStep) {
      const startData = sequence.startPosition || createStartPositionFromBeatStart(firstStep!);
      tasks.push({
        pictographData: startData,
        stepNumber: undefined,
        cacheKey: cellCacheKeyDeriver.deriveCacheKey(startData, undefined, isDark, options),
        isDark,
      });
    }

    for (let i = 0; i < sequence.steps!.length; i++) {
      const step = sequence.steps![i];
      if (!step) continue;
      const stepNumber = i + 1;
      tasks.push({
        pictographData: step,
        stepNumber,
        cacheKey: cellCacheKeyDeriver.deriveCacheKey(step, stepNumber, isDark, options),
        isDark,
      });
    }

    return tasks;
  }

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

        if (signal.aborted) return;
        if (hasSchedulerYield()) {
          await globalThis.scheduler!.yield();
        } else if (typeof requestIdleCallback !== "undefined") {
          await new Promise<void>(resolve => requestIdleCallback(() => resolve()));
        }
      }

      this.completedSequences.add(seqId);
    } finally {
      this.activeWarms.delete(seqId);
    }
  }

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

  private async renderCellIfNeeded(
    task: CellTask,
    options: PreviewCellRenderOptions,
    signal: AbortSignal
  ): Promise<void> {
    const cached = await pictographBlobCache.has(task.cacheKey);
    if (cached) return;

    if (signal.aborted) return;

    const prepared = await pictographPreparer.prepareSingle(task.pictographData, {
      themeMode: task.isDark ? "dark" : "light",
      bluePropType: options.bluePropType,
      redPropType: options.catDogModeEnabled
        ? options.redPropType
        : options.bluePropType,
      showBlueMotion: options.showBlueMotion,
      showRedMotion: options.showRedMotion,
    });

    if (signal.aborted) return;

    const pool = getWorkerRenderPool();

    const visibility: LayerVisibility = {
      showTKA: options.showTKA ?? true,
      showReversals: options.showReversals ?? true,
    };

    const renderOptions: LayerRenderOptions = {
      size: options.size,
      darkMode: task.isDark,
      showNonRadialPoints: options.showNonRadialPoints ?? true,
      handPointVisibility: options.handPointVisibility ?? "all",
      bluePropType: options.bluePropType,
      redPropType: options.catDogModeEnabled
        ? options.redPropType
        : options.bluePropType,
      showBlueMotion: options.showBlueMotion,
      showRedMotion: options.showRedMotion,
      showTnD: options.showTnD,
      showElemental: options.showElemental,
      showPositions: options.showPositions,
    };

    try {
      const resolvedStepNum = options.showStepNumbers ? task.stepNumber : undefined;
      const blob = await pool.render(prepared, renderOptions, visibility, resolvedStepNum);
      if (!signal.aborted) {
        await pictographBlobCache.set(task.cacheKey, blob);
      }
    } catch {
      // Best-effort
    }
  }
}

export const cellPreWarmer = new CellPreWarmer();
