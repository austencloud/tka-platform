// Ambient types for the vendored js-aruco2 library (Task 9).
// The vendored .js files are plain browser globals (AR / CV / POS / SVD); these
// interfaces describe only the surface the typed wrapper (index.ts) consumes.

export interface ArucoMarker {
  id: number;
  corners: { x: number; y: number }[];
}

export interface PositPose {
  bestError: number;
  bestRotation: number[][];
  bestTranslation: number[];
}

export interface ArucoDetector {
  detect(imageData: ImageData): ArucoMarker[];
}

export interface PositSolver {
  pose(corners: { x: number; y: number }[]): PositPose;
}
