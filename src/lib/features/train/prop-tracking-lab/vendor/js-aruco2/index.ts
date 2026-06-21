// Typed wrapper around the vendored js-aruco2 globals (Task 9).
//
// The four .js files are loaded for their side effect: each publishes its
// namespace on globalThis (SVD / CV / AR / POS) after the TKA adaptation in
// their headers — see "TKA: adapted for ESM/global loading". Import ORDER is
// load-bearing: svd → cv → aruco (needs CV) → posit1 (needs SVD).
// (allowJs is on + checkJs is off, so these bare side-effect imports type-clean.)
import './svd.js';
import './cv.js';
import './aruco.js';
import './posit1.js';
import type { ArucoDetector, PositSolver, ArucoMarker, PositPose } from './js-aruco2';

type ARNamespace = { Detector: new (opts?: { dictionaryName?: string }) => ArucoDetector };
type POSNamespace = { Posit: new (modelSize: number, focalLength: number) => PositSolver };

const AR = (globalThis as Record<string, unknown>).AR as ARNamespace | undefined;
const POS = (globalThis as Record<string, unknown>).POS as POSNamespace | undefined;

if (!AR?.Detector || !POS?.Posit) {
  throw new Error('js-aruco2 failed to load: AR.Detector / POS.Posit missing on globalThis');
}

// Narrowed locals: the guard above proved both namespaces loaded.
const ArDetector = AR.Detector;
const PosPosit = POS.Posit;

export function createDetector(dictionaryName = 'ARUCO_MIP_36h12'): ArucoDetector {
  return new ArDetector({ dictionaryName });
}

export function createPosit(modelSize: number, focalLength: number): PositSolver {
  return new PosPosit(modelSize, focalLength);
}

export type { ArucoDetector, PositSolver, ArucoMarker, PositPose };
