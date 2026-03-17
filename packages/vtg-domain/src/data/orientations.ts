/**
 * VTG Orientations
 *
 * Grid orientations (diamond/box) and plane orientations (vertical/horizontal)
 * as defined in VTG. These affect how patterns are performed in physical space.
 *
 * Grid orientation (diamond vs box) determines the position of petals relative
 * to the spinner's body. Plane orientation (vertical vs horizontal) describes
 * the axis along which the flower pattern is arranged.
 *
 * The three planes (Wall, Wheel, Floor) were formalized by Lorq Nichols
 * and are used across VTG and the broader flow arts community.
 *
 * Sources: VTG V2 Chapter 2, VTG V2 Index 1/3, Book of P.H.A.T.
 */

import type { SourcedClaim } from "@flow-arts/core";

export type GridOrientation = "diamond" | "box";
export type PlaneOrientation = "wall-plane" | "wheel-plane" | "floor-plane";

export interface VTGOrientation {
	/** Unique identifier */
	id: string;
	/** Orientation name */
	name: string;
	/** Grid orientation */
	grid?: GridOrientation;
	/** Plane orientation */
	plane?: PlaneOrientation;
	/** Plain-language description */
	description: string;
	/** Where this orientation definition comes from */
	source: SourcedClaim;
	/** TKA equivalent concept, if any */
	tkaEquivalent?: string;
}

/**
 * VTG orientations covering grid orientations, pattern orientations, and planes.
 *
 * Grid orientations (diamond/box) describe whether the antispin flower's petals
 * align with the cardinal axes (diamond) or sit rotated 45 degrees (box).
 * VTG V2 systematically indexes patterns in both orientations.
 *
 * Pattern orientations (vertical/horizontal) describe whether the flower's
 * petals are arranged vertically (up-down) or horizontally (side-to-side).
 *
 * Planes (wall/wheel/floor) describe the 2D plane in 3D space where the
 * movement occurs. These were formalized by Lorq Nichols and adopted across
 * the flow arts theory community.
 */
export const VTG_ORIENTATIONS: VTGOrientation[] = [
	// --- Grid Orientations ---
	{
		id: "diamond",
		name: "Diamond Orientation",
		grid: "diamond",
		description:
			"The antispin flower's petals align with the cardinal directions (up, down, left, right). The pattern forms a diamond shape when viewed from the front. This is the default orientation for most antispin patterns.",
		source: {
			claim:
				"VTG V2 indexes patterns in Diamond Orientation, where petals align with cardinal axes. The V2 index shows 'Diamond Antispin' as a distinct orientation category.",
			sourceType: "document",
			sourceRef: "VTG V2 Chapter 2, Index 1/3",
		},
		tkaEquivalent: "Diamond grid mode",
	},
	{
		id: "box",
		name: "Box Orientation",
		grid: "box",
		description:
			"The antispin flower's petals are rotated 45 degrees from cardinal, sitting in the diagonal positions. The pattern forms a box (square) shape when viewed from the front.",
		source: {
			claim:
				"VTG V2 indexes patterns in Box Orientation as a separate category from Diamond. The V2 index shows 'Box Orientation' patterns alongside Diamond Orientation patterns.",
			sourceType: "document",
			sourceRef: "VTG V2 Chapter 2, Index 1/3",
		},
		tkaEquivalent: "Box grid mode",
	},

	// --- Pattern Orientations ---
	{
		id: "vertical",
		name: "Vertical Orientation",
		description:
			"The flower pattern's petals are arranged along the vertical axis (up and down). In VTG V2, this is one of two orientations indexed for each antispin pattern. For example, 'Diamond Antispin Vs. Two Petal Spin Flower Vertical Orientation' has petals stacked vertically.",
		source: {
			claim:
				"VTG V2 Chapter 2 distinguishes Vertical Orientation from Horizontal Orientation for antispin flowers: 'Diamond Antispin Vs. Two Petal Spin Flower Vertical Orientation'.",
			sourceType: "document",
			sourceRef: "VTG V2 Chapter 2",
		},
	},
	{
		id: "horizontal",
		name: "Horizontal Orientation",
		description:
			"The flower pattern's petals are arranged along the horizontal axis (left and right). In VTG V2, this is indexed alongside vertical orientation for each pattern. For example, 'Diamond Antispin Vs. Two Petal Spin Flower Horizontal Orientation' has petals arranged side by side.",
		source: {
			claim:
				"VTG V2 Chapter 2 distinguishes Horizontal Orientation from Vertical Orientation for antispin flowers: 'Diamond Antispin Vs. Two Petal Spin Flower Horizontal Orientation'.",
			sourceType: "document",
			sourceRef: "VTG V2 Chapter 2",
		},
	},

	// --- Planes ---
	{
		id: "wall-plane",
		name: "Wall Plane",
		plane: "wall-plane",
		description:
			"The plane parallel to a wall in front of the spinner. Movement occurs along the Y (vertical) and X (horizontal) axes. Abbreviated 'W' in VTG notation. The most common plane for learning poi patterns.",
		source: {
			claim:
				"Wall plane (W): Y+X axes. The three planes (Wall, Wheel, Floor) were formalized by Lorq Nichols.",
			sourceType: "document",
			sourceRef: "Book of P.H.A.T. (Lorq Nichols)",
		},
	},
	{
		id: "wheel-plane",
		name: "Wheel Plane",
		plane: "wheel-plane",
		description:
			"The plane parallel to a wheel rolling alongside the spinner. Movement occurs along the Y (vertical) and Z (depth) axes. Abbreviated 'H' in VTG notation (for 'horizontal wheel').",
		source: {
			claim:
				"Wheel plane (H): Y+Z axes. Formalized by Lorq Nichols as part of the three-plane system.",
			sourceType: "document",
			sourceRef: "Book of P.H.A.T. (Lorq Nichols)",
		},
	},
	{
		id: "floor-plane",
		name: "Floor Plane",
		plane: "floor-plane",
		description:
			"The plane parallel to the floor beneath the spinner. Movement occurs along the Z (depth) and X (horizontal) axes. Abbreviated 'F' in VTG notation.",
		source: {
			claim:
				"Floor plane (F): Z+X axes. Formalized by Lorq Nichols as part of the three-plane system.",
			sourceType: "document",
			sourceRef: "Book of P.H.A.T. (Lorq Nichols)",
		},
	},
];
