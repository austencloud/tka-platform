/**
 * Staff grip pose presets derived from the Yale GRASP Taxonomy (Feix et al. 2016).
 *
 * Each pose maps to a specific grasp type from the 33-type taxonomy:
 *   IDLE    = Relaxed hand (no taxonomy equivalent)
 *   SQUARE  = Small Diameter (#15) - tight cylindrical wrap
 *   PENCIL  = Prismatic 3 Finger (#2) - thumb + index + middle pinch
 *   CRADLE  = Light Tool (#18) - relaxed cylindrical hold
 *   OPEN_PALM = Platform (#27) - flat open palm
 *   RELEASE = Extended fingers (no taxonomy equivalent)
 *
 * Joint angles from published kinematic ranges (Santello et al. 1998,
 * Ninapro CyberGlove calibrations). Quaternions in [x, y, z, w] format,
 * authored for left hand. Right hand mirrored at runtime.
 *
 * Source: scripts/generate-grip-poses-from-taxonomy.py
 */

import { GripType, type GripPose } from "../../domain/models/GripPose";

/** Relaxed Idle - slight natural curl, no object */
const IDLE_POSE: GripPose = {
  name: "Relaxed Idle",
  type: GripType.IDLE,
  rotations: [
    [0.0, 0.0, 0.0872, 0.9962],     // Thumb1: slight Z abduction
    [0.0, 0.0, 0.0436, 0.999],      // Thumb2
    [0.0, 0.0, 0.0, 1.0],           // Thumb3
    [0.0872, 0.0, 0.0, 0.9962],     // Index1: 10° curl
    [0.1305, 0.0, 0.0, 0.9914],     // Index2: 15° curl
    [0.0872, 0.0, 0.0, 0.9962],     // Index3: 10° curl
    [0.1045, 0.0, 0.0, 0.9945],     // Middle1: 12°
    [0.1564, 0.0, 0.0, 0.9877],     // Middle2: 18°
    [0.1045, 0.0, 0.0, 0.9945],     // Middle3: 12°
    [0.1305, 0.0, 0.0, 0.9914],     // Ring1: 15°
    [0.1736, 0.0, 0.0, 0.9848],     // Ring2: 20°
    [0.1305, 0.0, 0.0, 0.9914],     // Ring3: 15°
    [0.1564, 0.0, 0.0, 0.9877],     // Pinky1: 18°
    [0.1908, 0.0, 0.0, 0.9816],     // Pinky2: 22°
    [0.1564, 0.0, 0.0, 0.9877],     // Pinky3: 18°
  ],
};

/** Small Diameter (#15) - tight wrap around thin cylinder (staff shaft) */
const SQUARE_POSE: GripPose = {
  name: "Square Staff Grip",
  type: GripType.SQUARE,
  rotations: [
    [0.162, 0.2189, 0.2125, 0.9384],   // Thumb1: abducted + flexed + opposed
    [0.342, 0.0, 0.0, 0.9397],         // Thumb2: 40° curl around shaft
    [0.2588, 0.0, 0.0, 0.9659],        // Thumb3: 30° tip contact
    [0.6088, 0.0, 0.0, 0.7934],        // Index1: 75° curl
    [0.6756, 0.0, 0.0, 0.7373],        // Index2: 85° curl
    [0.5, 0.0, 0.0, 0.866],            // Index3: 60° curl
    [0.6293, 0.0, 0.0, 0.7771],        // Middle1: 78°
    [0.6947, 0.0, 0.0, 0.7193],        // Middle2: 88°
    [0.515, 0.0, 0.0, 0.8572],         // Middle3: 62°
    [0.6428, 0.0, 0.0, 0.766],         // Ring1: 80°
    [0.7071, 0.0, 0.0, 0.7071],        // Ring2: 90°
    [0.5373, 0.0, 0.0, 0.8434],        // Ring3: 65°
    [0.6561, 0.0, 0.0, 0.7547],        // Pinky1: 82°
    [0.7071, 0.0, 0.0, 0.7071],        // Pinky2: 90°
    [0.5592, 0.0, 0.0, 0.829],         // Pinky3: 68°
  ],
};

/** Prismatic 3 Finger (#2) - thumb + index + middle pinch, ring/pinky relaxed */
const PENCIL_POSE: GripPose = {
  name: "Pencil Grip",
  type: GripType.PENCIL,
  rotations: [
    [0.1403, 0.2335, 0.0882, 0.9581],  // Thumb1: abducted to oppose index
    [0.2588, 0.0, 0.0, 0.9659],        // Thumb2: 30° flex
    [0.1736, 0.0, 0.0, 0.9848],        // Thumb3: 20° tip
    [0.342, 0.0, 0.0, 0.9397],         // Index1: 40° - primary pinch
    [0.4226, 0.0, 0.0, 0.9063],        // Index2: 50°
    [0.2588, 0.0, 0.0, 0.9659],        // Index3: 30°
    [0.3007, 0.0, 0.0, 0.9537],        // Middle1: 35° - support
    [0.3827, 0.0, 0.0, 0.9239],        // Middle2: 45°
    [0.2164, 0.0, 0.0, 0.9763],        // Middle3: 25°
    [0.1305, 0.0, 0.0, 0.9914],        // Ring1: 15° - relaxed
    [0.1736, 0.0, 0.0, 0.9848],        // Ring2: 20°
    [0.0872, 0.0, 0.0, 0.9962],        // Ring3: 10°
    [0.1564, 0.0, 0.0, 0.9877],        // Pinky1: 18° - relaxed
    [0.1908, 0.0, 0.0, 0.9816],        // Pinky2: 22°
    [0.1045, 0.0, 0.0, 0.9945],        // Pinky3: 12°
  ],
};

/** Light Tool (#18) - relaxed cylindrical hold, passive cradle */
const CRADLE_POSE: GripPose = {
  name: "Cradle",
  type: GripType.CRADLE,
  rotations: [
    [0.1176, 0.1026, 0.1176, 0.9807],  // Thumb1: lightly placed alongside
    [0.1736, 0.0, 0.0, 0.9848],        // Thumb2: 20°
    [0.0872, 0.0, 0.0, 0.9962],        // Thumb3: 10°
    [0.3827, 0.0, 0.0, 0.9239],        // Index1: 45°
    [0.4226, 0.0, 0.0, 0.9063],        // Index2: 50°
    [0.2588, 0.0, 0.0, 0.9659],        // Index3: 30°
    [0.4067, 0.0, 0.0, 0.9135],        // Middle1: 48°
    [0.4462, 0.0, 0.0, 0.8949],        // Middle2: 53°
    [0.2756, 0.0, 0.0, 0.9613],        // Middle3: 32°
    [0.4226, 0.0, 0.0, 0.9063],        // Ring1: 50°
    [0.4617, 0.0, 0.0, 0.887],         // Ring2: 55°
    [0.3007, 0.0, 0.0, 0.9537],        // Ring3: 35°
    [0.4384, 0.0, 0.0, 0.8988],        // Pinky1: 52°
    [0.4772, 0.0, 0.0, 0.8788],        // Pinky2: 57°
    [0.3256, 0.0, 0.0, 0.9455],        // Pinky3: 38°
  ],
};

/** Platform (#27) - flat open palm, staff resting on top */
const OPEN_PALM_POSE: GripPose = {
  name: "Open Palm",
  type: GripType.OPEN_PALM,
  rotations: [
    [0.0, 0.1305, 0.0, 0.9914],        // Thumb1: slight abduction only
    [0.0, 0.0, 0.0, 1.0],              // Thumb2: flat
    [0.0, 0.0, 0.0, 1.0],              // Thumb3: flat
    [0.0, 0.0, 0.0, 1.0],              // Index1: fully extended
    [0.0, 0.0, 0.0, 1.0],              // Index2
    [0.0, 0.0, 0.0, 1.0],              // Index3
    [0.0, 0.0, 0.0, 1.0],              // Middle1
    [0.0, 0.0, 0.0, 1.0],              // Middle2
    [0.0, 0.0, 0.0, 1.0],              // Middle3
    [0.0, 0.0, 0.0, 1.0],              // Ring1
    [0.0, 0.0, 0.0, 1.0],              // Ring2
    [0.0, 0.0, 0.0, 1.0],              // Ring3
    [0.0, 0.0, 0.0, 1.0],              // Pinky1
    [0.0, 0.0, 0.0, 1.0],              // Pinky2
    [0.0, 0.0, 0.0, 1.0],              // Pinky3
  ],
};

/** Release - all fingers extended, staff airborne */
const RELEASE_POSE: GripPose = {
  name: "Release",
  type: GripType.RELEASE,
  rotations: [
    [-0.043, 0.1735, 0.0076, 0.9839],  // Thumb1: extended outward
    [-0.0436, 0.0, 0.0, 0.999],        // Thumb2: slight hyperextension
    [-0.0175, 0.0, 0.0, 0.9998],       // Thumb3
    [-0.0436, 0.0, 0.0, 0.999],        // Index1: -5° (extended past neutral)
    [-0.0262, 0.0, 0.0, 0.9997],       // Index2
    [-0.0175, 0.0, 0.0, 0.9998],       // Index3
    [-0.0436, 0.0, 0.0, 0.999],        // Middle1
    [-0.0262, 0.0, 0.0, 0.9997],       // Middle2
    [-0.0175, 0.0, 0.0, 0.9998],       // Middle3
    [-0.0436, 0.0, 0.0, 0.999],        // Ring1
    [-0.0262, 0.0, 0.0, 0.9997],       // Ring2
    [-0.0175, 0.0, 0.0, 0.9998],       // Ring3
    [-0.0436, 0.0, 0.0, 0.999],        // Pinky1
    [-0.0262, 0.0, 0.0, 0.9997],       // Pinky2
    [-0.0175, 0.0, 0.0, 0.9998],       // Pinky3
  ],
};

export const STAFF_GRIP_POSES: Record<GripType, GripPose> = {
  [GripType.IDLE]: IDLE_POSE,
  [GripType.SQUARE]: SQUARE_POSE,
  [GripType.PENCIL]: PENCIL_POSE,
  [GripType.CRADLE]: CRADLE_POSE,
  [GripType.OPEN_PALM]: OPEN_PALM_POSE,
  [GripType.RELEASE]: RELEASE_POSE,
};
