/**
 * Camera framing for the staff-grip inspection lab.
 *
 * The four panes are one set: every camera aims at a named anatomical region
 * whose size comes from the performer's own proportions, so the panes share a
 * scale relationship and none of them moves while the phase slider does. The
 * pose is deliberately not an input here — a camera that chases the palms
 * re-frames itself on every settle frame, which is what made the old lab hard
 * to read.
 *
 * `$lib/shared/3d/camera/compute-framing-shot` stays the owner of "fit N
 * performers plus their prop clearance in frame" and is used by the quiz, play
 * preview, and film-director surfaces. It is deliberately not used here: it
 * bakes in a 1.2 m per-performer horizontal extent and a 2 m minimum distance,
 * and this lab frames a region (a grip zone at roughly 1.3 m of frame height)
 * rather than a performer. The shot vocabulary below follows the same
 * composition pattern that `test/film-director/_lib/camera-language.ts` uses:
 * declare a subject, an azimuth, and an elevation, and solve the distance.
 */

import { STAGE, userProportionsState } from "@austencloud/scene-3d";

export type InspectionSubjectId = "body" | "grip";

export interface InspectionSubject {
  /** World-space point every camera for this subject looks at. */
  center: [number, number, number];
  /** Half the region's width in the image plane, in metres. */
  halfWidth: number;
  /** Half the region's height in the image plane, in metres. */
  halfHeight: number;
  /**
   * Half the region's extent along the performer's chest-forward axis. The
   * grips work on a plane standing in front of the chest, so an off-axis
   * camera sees that depth as extra width and an overhead one sees it as extra
   * height. Carrying it explicitly is what keeps the performer centred in the
   * three-quarter and overhead panes instead of drifting to one side.
   */
  halfDepth: number;
}

export interface InspectionView {
  id: string;
  label: string;
  /** One line saying what this pane is for, shown under the label. */
  hint: string;
  subject: InspectionSubjectId;
  /** 0 faces the performer from the audience; positive swings to their left. */
  azimuthDeg: number;
  /** 0 is level with the subject; positive looks down on it. */
  elevationDeg: number;
  /** Full grid for the wide reference, muted where it would cover the hands. */
  grid: "reference" | "muted";
}

export interface InspectionShot {
  position: [number, number, number];
  target: [number, number, number];
}

/** One focal length across the set, so magnification reads as distance alone. */
export const INSPECTION_FOV_DEG = 36;

/**
 * Breathing room around each subject box. The reference pane carries a little
 * more than the close panes: its subject is the widest thing on the stage and
 * the wall ring sits at the near face of the box, so the extra margin is what
 * keeps a fully extended side hold inside the frame at every pane shape.
 */
const BODY_PADDING = 1.1;
const GRIP_PADDING = 1.08;

/**
 * How far a hand reaches past its own grid point. The grip point sits in the
 * palm; knuckles, wrist and the far edge of the fist live outside it.
 */
const HAND_MARGIN_METERS = 0.12;

/**
 * A staff tip swings from a hand, and a hand hangs off a shoulder rather than
 * the body midline, so the widest lateral reach is the outer ring plus about a
 * shoulder half-span. The scene package's reference measurements put an adult
 * shoulder span at 44 cm, and the lab's own telemetry reports 221.6 mm for the
 * intake rig, so the reference pane budgets that much beyond the outer ring
 * instead of clipping a fully extended side hold.
 */
const SHOULDER_HALF_SPAN_METERS = 0.22;

/** Keeps a close pane clear of the camera's near plane. */
const MIN_DISTANCE_METERS = 0.4;

const DEGREES_TO_RADIANS = Math.PI / 180;

export const INSPECTION_VIEWS: readonly InspectionView[] = [
  {
    id: "audience",
    label: "Audience",
    hint: "Whole body and the full staff sweep",
    subject: "body",
    azimuthDeg: 0,
    elevationDeg: 4,
    grid: "reference",
  },
  {
    id: "grip-front",
    label: "Grip front",
    hint: "Where the hold sits on the body",
    subject: "grip",
    azimuthDeg: 0,
    elevationDeg: 4,
    grid: "muted",
  },
  {
    id: "grip-quarter",
    label: "Three-quarter",
    hint: "Arm extension and elbow position",
    subject: "grip",
    azimuthDeg: 55,
    elevationDeg: 10,
    grid: "muted",
  },
  {
    id: "grip-overhead",
    label: "Overhead",
    hint: "Depth between the two grips",
    subject: "grip",
    azimuthDeg: 0,
    elevationDeg: 68,
    grid: "muted",
  },
];

/**
 * World height of the grid plane. `PerformerRig` sits at `groundOffset`, which
 * `LiveSequencePerformer3D` sets to `position.y - groundY`, and the avatar hangs
 * `groundY` below that. So the performer's feet land on world y = 0 and the grid
 * — the shoulder-height plane the hands work in — sits this far above them.
 */
function shoulderHeight(): number {
  return -userProportionsState.groundY;
}

/**
 * The standing performer plus the volume their staffs sweep. The staff tip at
 * the top of the hand circle reaches higher than the head, so the top of this
 * box is prop-driven; the bottom is the floor the performer stands on.
 */
export function bodySubject(): InspectionSubject {
  const top = shoulderHeight() + userProportionsState.outerPointRadius;
  return {
    center: [0, top / 2, 0],
    halfWidth:
      userProportionsState.outerPointRadius + SHOULDER_HALF_SPAN_METERS,
    halfHeight: top / 2,
    halfDepth: STAGE.AVATAR_GRID_OFFSET,
  };
}

/**
 * The plane the hands actually work in: the wall-grid circle, centred on the
 * performer at shoulder height and standing `AVATAR_GRID_OFFSET` in front of
 * the chest. Sizing it to the whole hand circle means the grips stay in frame
 * at every step instead of only the ones the camera was tuned on, and the box
 * is close enough to isotropic that the same distance frames it from the
 * front, from three-quarter, and from above.
 */
export function gripSubject(): InspectionSubject {
  const reach = userProportionsState.handPointRadius + HAND_MARGIN_METERS;
  const halfDepth = STAGE.AVATAR_GRID_OFFSET / 2;
  return {
    center: [0, shoulderHeight(), halfDepth],
    halfWidth: reach,
    halfHeight: reach,
    halfDepth,
  };
}

export function inspectionSubject(id: InspectionSubjectId): InspectionSubject {
  return id === "body" ? bodySubject() : gripSubject();
}

/**
 * Place the eye so the whole subject box fits both frustum axes. A pane that
 * is tall and narrow has a much smaller horizontal field than its vertical
 * one, so fitting only the height would push the sides of the subject out of
 * frame.
 */
export function solveInspectionShot(
  subject: InspectionSubject,
  options: {
    fovDeg?: number;
    aspectRatio: number;
    azimuthDeg: number;
    elevationDeg: number;
    padding?: number;
  }
): InspectionShot {
  const {
    fovDeg = INSPECTION_FOV_DEG,
    aspectRatio,
    azimuthDeg,
    elevationDeg,
    padding = GRIP_PADDING,
  } = options;

  const azimuthRad = azimuthDeg * DEGREES_TO_RADIANS;
  const elevationRad = elevationDeg * DEGREES_TO_RADIANS;

  const halfFovRad = (fovDeg / 2) * DEGREES_TO_RADIANS;
  const safeAspect = Math.max(0.1, aspectRatio);
  const horizontalHalfFovRad = Math.atan(Math.tan(halfFovRad) * safeAspect);

  // The in-plane extent is never foreshortened away: keeping it whole is what
  // makes the panes share one magnification instead of the off-axis views
  // quietly zooming in on a squashed circle. The chest-forward depth is added
  // to whichever screen axis the swing rotates it into.
  const viewHalfWidth =
    subject.halfWidth + subject.halfDepth * Math.abs(Math.sin(azimuthRad));
  const viewHalfHeight =
    subject.halfHeight + subject.halfDepth * Math.abs(Math.sin(elevationRad));

  const verticalDistance = (viewHalfHeight * padding) / Math.tan(halfFovRad);
  const horizontalDistance =
    (viewHalfWidth * padding) / Math.tan(horizontalHalfFovRad);
  const distance = Math.max(
    MIN_DISTANCE_METERS,
    verticalDistance,
    horizontalDistance
  );

  const horizontal = distance * Math.cos(elevationRad);

  return {
    position: [
      subject.center[0] + Math.sin(azimuthRad) * horizontal,
      subject.center[1] + Math.sin(elevationRad) * distance,
      subject.center[2] + Math.cos(azimuthRad) * horizontal,
    ],
    target: [subject.center[0], subject.center[1], subject.center[2]],
  };
}

/** The padding a given subject is framed with. */
export function subjectPadding(id: InspectionSubjectId): number {
  return id === "body" ? BODY_PADDING : GRIP_PADDING;
}

/** Solve one view against the pane it is rendered into. */
export function inspectionShotForView(
  view: InspectionView,
  aspectRatio: number
): InspectionShot {
  return solveInspectionShot(inspectionSubject(view.subject), {
    aspectRatio,
    azimuthDeg: view.azimuthDeg,
    elevationDeg: view.elevationDeg,
    padding: subjectPadding(view.subject),
  });
}
