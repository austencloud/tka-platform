import type { GuideBlock } from "../guide-content-blocks";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionType,
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

const { NORTH: N, EAST: E, SOUTH: SO_ } = GridLocation;
const { IN, OUT } = Orientation;
const CCW = RotationDirection.COUNTER_CLOCKWISE;
const CW = RotationDirection.CLOCKWISE;
const NOROT = RotationDirection.NO_ROTATION;

// Real single-staff pictographs (red hand only) - copied verbatim from
// _pages/StaffMotionsPage.svelte. The halfway frame (a bare grid with a raw
// staff-SVG path hand-composited at a mid-motion pose) is sheet-only artwork,
// not pictograph data, and is intentionally NOT reproduced here - start / end /
// combined are the three REAL system-rendered pictographs per row.
const redStaff = (
  id: string,
  type: MotionType,
  from: GridLocation,
  to: GridLocation,
  startOri: Orientation,
  endOri: Orientation,
  rot: RotationDirection
) => ({
  id: `sm-${id}`,
  letter: null,
  gridMode: GridMode.DIAMOND,
  motions: {
    red: createMotionData({
      motionType: type,
      rotationDirection: rot,
      startLocation: from,
      endLocation: to,
      startOrientation: startOri,
      endOrientation: endOri,
      turns: 0,
      color: MotionColor.RED,
      propType: PropType.STAFF,
      gridMode: GridMode.DIAMOND,
    }),
  },
});
const stat = (id: string, loc: GridLocation, ori: Orientation) =>
  redStaff(id, MotionType.STATIC, loc, loc, ori, ori, NOROT);

type RowDef = {
  start: ReturnType<typeof redStaff>;
  end: ReturnType<typeof redStaff>;
  combined: ReturnType<typeof redStaff>;
};
const ROWS: RowDef[] = [
  {
    // Prospin: isolation S→E, thumb stays in.
    start: stat("pro-start", SO_, IN),
    end: stat("pro-end", E, IN),
    combined: redStaff("pro-full", MotionType.PRO, SO_, E, IN, IN, CCW),
  },
  {
    // Antispin: S→E, prop counter-rotates; thumb flips in → out.
    start: stat("anti-start", SO_, IN),
    end: stat("anti-end", E, OUT),
    combined: redStaff("anti-full", MotionType.ANTI, SO_, E, IN, OUT, CW),
  },
  {
    // Dash: S→N through the center; thumb flips in → out.
    start: stat("dash-start", SO_, IN),
    end: stat("dash-end", N, OUT),
    combined: redStaff("dash-full", MotionType.DASH, SO_, N, IN, OUT, NOROT),
  },
];

const rowItems = (row: RowDef): PictographData[] =>
  [row.start, row.end, row.combined] as unknown as PictographData[];

/** STAFF props, TKA letter glyph off - matching StaffMotionsPage's PICTO_FLAGS (showTKA: false). */
const RENDER = { propType: PropType.STAFF, showTKA: false } as const;

// Verbatim prose lifted from _pages/StaffMotionsPage.svelte (Austen's words - never AI-written).
export const staffMotionsContent: GuideBlock[] = [
  { kind: "heading", level: 1, text: "Staff Motions" },

  { kind: "heading", level: 2, text: "Shift" },
  {
    kind: "prose",
    html: "During a shift, a prop can rotate in one of two directions - Prospin or Antispin",
  },

  { kind: "heading", level: 3, text: "Prospin" },
  {
    kind: "prose",
    html:
      "• <strong>Prospin</strong> - The prop rotates the same direction as the handpath<br>A 90 degree isolation is our base unit of a prospin.",
  },
  {
    kind: "pictographGroup",
    items: rowItems(ROWS[0]!),
    flowCols: 3,
    layout: "strip",
    render: RENDER,
    caption: "start · end · combined",
  },
  { kind: "prose", html: "In a base isolation, the thumb orientation remains the same for the entire motion." },

  { kind: "heading", level: 3, text: "Antispin" },
  {
    kind: "prose",
    html:
      "• <strong>Antispin</strong> - The prop rotates in the opposite direction of the handpath<br>A 90 degree antispin is our base unit of antispin.",
  },
  {
    kind: "pictographGroup",
    items: rowItems(ROWS[1]!),
    flowCols: 3,
    layout: "strip",
    render: RENDER,
    caption: "start · end · combined",
  },
  { kind: "prose", html: "In an antispin, the ends swap orientation. Here, it moves from thumb in to thumb out." },

  { kind: "heading", level: 2, text: "Dash" },
  { kind: "prose", html: "In a base dash, the thumb ends also swap orientation." },
  {
    kind: "pictographGroup",
    items: rowItems(ROWS[2]!),
    flowCols: 3,
    layout: "strip",
    render: RENDER,
    caption: "start · end · combined",
  },
  { kind: "prose", html: "Halfway through the motion, the center of the staff is at the grid’s center point." },
];
