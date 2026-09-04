/**
 * Camera framing for the negative-space reach lab.
 *
 * The distance solve is shared with the grip lab through
 * `../_lab-kit/inspection-shot`, so a pane here and a pane there at the same
 * subject size sit at the same magnification. What this module owns is the set
 * of angles THIS study needs, and one of them is not optional: the document
 * describes the endpoint of the negative-space route "viewed from above", so a
 * genuine plan view has to exist or that paragraph cannot be checked at all.
 *
 * The cameras do not follow the pose. A camera that chases the hand re-frames
 * itself every settle frame and makes two panes impossible to compare, which is
 * the whole point of putting the routes side by side.
 */

import { STAGE, userProportionsState } from "@austencloud/scene-3d";

import {
  solveInspectionShot,
  type InspectionShot,
  type InspectionSubject,
} from "../_lab-kit/inspection-shot";

export type { InspectionShot, InspectionSubject };

export type ReachSubjectId = "body" | "reach";

export interface ReachView {
  id: string;
  label: string;
  /** Shown when the full label will not fit the picker's track. */
  pickerLabel?: string;
  /** One line saying what this angle is for. */
  hint: string;
  /**
   * Which way stage depth runs on screen from this angle, in the reader's own
   * terms. The document's central predicate is a depth question, so a pane that
   * does not say where depth went is a pane that cannot be argued with.
   */
  depthNote: string;
  subject: ReachSubjectId;
  /** 0 faces the performer from the audience; negative swings to their right. */
  azimuthDeg: number;
  /** 0 is level with the subject; 90 is straight down. */
  elevationDeg: number;
  grid: "reference" | "muted";
}

const BODY_PADDING = 1.1;
const REACH_PADDING = 1.08;

/** How far a hand reaches past its own grid point: knuckles, wrist, fist edge. */
const HAND_MARGIN_METERS = 0.12;

/**
 * Half of the longest staff the fitter will hand a performer, in metres. Used
 * only to keep a staff end inside the frame; nothing measures against it.
 *
 * The staff the fitter produced for a mid-sized rig measured 0.864 m, so half
 * of it is 0.432 m; this rounds up from there. It was 0.55 first, which framed
 * so loosely that the body arrived small in a wide pane with the reach circle
 * floating in empty margin.
 */
const PROP_HALF_SPAN_METERS = 0.45;

/** A staff tip swings from a hand, and a hand hangs off a shoulder. */
const SHOULDER_HALF_SPAN_METERS = 0.22;

export const REACH_VIEWS: readonly ReachView[] = [
  {
    id: "overhead",
    label: "Overhead",
    hint: "The angle §4 describes the endpoint from",
    depthNote: "Upstage at the top, the audience at the bottom",
    subject: "reach",
    // Not 68 degrees like the grip lab's overhead pane. The document says
    // "viewed from above", and at 68 degrees a thumb end sitting behind the
    // forearm still reads as sitting above it.
    azimuthDeg: 0,
    elevationDeg: 89,
    grid: "muted",
  },
  {
    id: "right-side",
    label: "Performer's right",
    pickerLabel: "Right",
    hint: "The forearm predicate, seen directly",
    depthNote: "Downstage to the right of frame",
    subject: "reach",
    // Looking along the performer's own right axis, so stage depth lies across
    // the screen. Upstage-or-downstage of the forearm becomes a left-or-right
    // question, which the eye can settle without a readout.
    azimuthDeg: -90,
    elevationDeg: 8,
    grid: "muted",
  },
  {
    id: "pocket",
    label: "Over the shoulder",
    pickerLabel: "Pocket",
    hint: "Whether the pocket above the shoulder is entered",
    depthNote: "Downstage toward the viewer, from the performer's right",
    subject: "reach",
    azimuthDeg: -50,
    elevationDeg: 30,
    grid: "muted",
  },
  {
    id: "audience",
    label: "Audience",
    hint: "How the notation itself reads",
    depthNote: "Depth is toward the viewer and invisible here",
    subject: "body",
    azimuthDeg: 0,
    elevationDeg: 4,
    grid: "reference",
  },
];

export const DEFAULT_REACH_VIEW_ID = REACH_VIEWS[0]!.id;

export function reachViewById(id: string | null | undefined): ReachView {
  return REACH_VIEWS.find((view) => view.id === id) ?? REACH_VIEWS[0]!;
}

/**
 * World height of the grid plane. `PerformerRig` sits at `groundOffset`, which
 * `LiveSequencePerformer3D` sets to `position.y - groundY`, and the character
 * hangs `groundY` below that, so the feet land on world y = 0 and the
 * shoulder-height plane the hands work in sits here.
 */
export function shoulderHeight(): number {
  return -userProportionsState.groundY;
}

/**
 * Centre of the wall grid in world space: on the midline, at shoulder height,
 * standing `AVATAR_GRID_OFFSET` in front of the chest. The telemetry reads a
 * notated `in` against this point, so it has to be the same centre the stage
 * puts the grid at.
 */
export function reachGridCenter(): { x: number; y: number; z: number } {
  return { x: 0, y: shoulderHeight(), z: STAGE.AVATAR_GRID_OFFSET };
}

/** The standing performer plus the volume their staffs sweep. */
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
 * The plane the hands work in, plus the staff that sticks out of them.
 *
 * The hand circle alone is the wrong frame here: every measurement on this
 * page is about a staff END, and a staff end sits most of a half-length beyond
 * the hand holding it. Framing to the hand circle cropped both ends out of
 * shot, which is the one thing the reader has to be able to see.
 *
 * The allowance is a fixed worst case rather than the character's own fitted
 * staff, because `LiveSequencePerformer3D` fits the length to the body after
 * the rig loads and the camera has to be placed before that. Sizing to the
 * longest supported staff costs a little empty margin on a small body and
 * never crops a large one.
 */
export function reachSubject(): InspectionSubject {
  const reach =
    userProportionsState.handPointRadius +
    HAND_MARGIN_METERS +
    PROP_HALF_SPAN_METERS;
  const halfDepth = STAGE.AVATAR_GRID_OFFSET / 2;
  return {
    center: [0, shoulderHeight(), halfDepth],
    halfWidth: reach,
    halfHeight: reach,
    halfDepth,
  };
}

export function reachSubjectFor(id: ReachSubjectId): InspectionSubject {
  return id === "body" ? bodySubject() : reachSubject();
}

export function reachShotForView(
  view: ReachView,
  aspectRatio: number
): InspectionShot {
  return solveInspectionShot(reachSubjectFor(view.subject), {
    aspectRatio,
    azimuthDeg: view.azimuthDeg,
    elevationDeg: view.elevationDeg,
    padding: view.subject === "body" ? BODY_PADDING : REACH_PADDING,
  });
}
