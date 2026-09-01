export interface PropState {
  centerPathAngle: number;
  staffRotationAngle: number;
  x?: number; // Optional: Only set for dash motions (Cartesian coordinates)
  y?: number; // Optional: Only set for dash motions (Cartesian coordinates)
}

export interface PropStates {
  left: PropState;
  right: PropState;
}
