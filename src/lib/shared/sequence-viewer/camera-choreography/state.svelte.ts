/**
 * Camera Choreography State
 *
 * Holds the currently selected preset, the live CameraControls ref
 * registered by Viewer3DCamera, and per-frame + loop-boundary dispatch
 * that drivers use.
 *
 * Two layers:
 *  - UI layer: `activePresetId` - which tile is selected in the Export
 *    popover. `"free"` means "no choreography, user drives the camera".
 *  - Runtime layer: `driving` + `controls` - populated while a preset
 *    is actively driving the camera during a recording. `isDriving`
 *    reflects that recording is happening AND a non-free preset is on.
 *
 * The recording pipeline calls `applyPreset(id)` to attach the driver
 * and gets a disposer back. Nothing else mutates `_driving`.
 */

import type CameraControls from "camera-controls";
import type { CameraPreset } from "./types";
import { evaluatePreset, type PresetEvaluation } from "./types";
import { getPresetById, type PresetId } from "./presets";

export type CameraPresetId = PresetId;

export function createCameraChoreographyState() {
  let _activePresetId = $state<CameraPresetId>("free");
  let _controls = $state<CameraControls | null>(null);
  let _driving = $state(false);

  // Per-frame tick listeners + loop-boundary listeners. Drivers subscribe
  // via the ctx passed into apply(). Using arrays instead of Sets so the
  // iteration order is deterministic (drivers typically register exactly
  // one of each, but the plumbing allows multiple for composite presets).
  const _tickFns: Array<(deltaSec: number) => void> = [];
  const _loopFns: Array<() => void> = [];

  function tick(deltaSec: number): void {
    if (!_driving) return;
    for (const fn of _tickFns) fn(deltaSec);
  }

  function emitLoopBoundary(): void {
    if (!_driving) return;
    // Copy so handlers that unsubscribe themselves don't invalidate the loop.
    for (const fn of [..._loopFns]) fn();
  }

  function onTick(fn: (deltaSec: number) => void): () => void {
    _tickFns.push(fn);
    return () => {
      const i = _tickFns.indexOf(fn);
      if (i >= 0) _tickFns.splice(i, 1);
    };
  }

  function onLoopBoundary(fn: () => void): () => void {
    _loopFns.push(fn);
    return () => {
      const i = _loopFns.indexOf(fn);
      if (i >= 0) _loopFns.splice(i, 1);
    };
  }

  return {
    get activePresetId(): CameraPresetId {
      return _activePresetId;
    },
    setPresetId(id: CameraPresetId): void {
      _activePresetId = id;
    },

    get controls(): CameraControls | null {
      return _controls;
    },
    registerControls(controls: CameraControls): void {
      _controls = controls;
    },
    unregisterControls(controls: CameraControls): void {
      if (_controls === controls) _controls = null;
    },

    get isDriving(): boolean {
      return _driving;
    },

    /**
     * Attach the selected preset's driver to the live controls ref and
     * start driving. Returns a disposer. Safe to call multiple times -
     * calls after the first no-op until the returned disposer runs.
     *
     * Returns null if: no controls registered, preset is "free", or
     * the preset doesn't pass its eligibility rule.
     */
    applyPreset(
      presetId: CameraPresetId,
      opts: {
        performers: Parameters<CameraPreset["apply"]>[1]["performers"];
        sequenceDurationSec: number;
      },
    ): (() => void) | null {
      if (_driving) return null;
      if (presetId === "free") return null;
      const preset = getPresetById(presetId);
      if (!preset) return null;
      if (!_controls) return null;
      const evalResult = evaluatePreset(preset, opts.performers.length);
      if (!evalResult.eligible) return null;

      _driving = true;
      const controls = _controls;
      const presetDisposer = preset.apply(controls, {
        performers: opts.performers,
        sequenceDurationSec: opts.sequenceDurationSec,
        totalLoops: preset.totalLoops,
        onTick,
        onLoopBoundary,
      });

      let released = false;
      return () => {
        if (released) return;
        released = true;
        try {
          presetDisposer();
        } finally {
          // Drop any tick/boundary listeners the driver forgot to clean up.
          _tickFns.length = 0;
          _loopFns.length = 0;
          _driving = false;
        }
      };
    },

    /** Resolve the selected preset (may be null for "free"). */
    get activePreset(): CameraPreset | null {
      return getPresetById(_activePresetId);
    },

    /** Eligibility for a given performer count (for picker UI). */
    evaluate(presetId: CameraPresetId, performerCount: number): PresetEvaluation {
      const preset = getPresetById(presetId);
      if (!preset) return { eligible: true };
      return evaluatePreset(preset, performerCount);
    },

    // ── Runtime dispatch (called by the driver host component) ─────
    /** Called every Threlte useTask frame by CameraChoreographyDriver. */
    tick,
    /** Called by the orchestrator when playback wraps back to zero. */
    emitLoopBoundary,
  };
}

export type CameraChoreographyState = ReturnType<typeof createCameraChoreographyState>;
