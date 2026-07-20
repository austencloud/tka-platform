/**
 * launchpad-tiles.ts - data for the homepage Launchpad bento grid
 *
 * Pure TypeScript, zero .svelte imports — this module is imported by a
 * node-environment unit test, so it must stay import-safe outside a browser/
 * Svelte runtime.
 */

export interface LaunchpadTileDef {
	id: string;
	href: string;
	heading: string;
	descriptor: string;
	span: "2x2" | "2x1" | "1x1";
	/** Per-destination signature color (hex), consumed as the tile's --c var. */
	color: string;
	/** FontAwesome solid icon class, e.g. "fa-pen-nib". */
	icon: string;
	/** Which live media embed (if any) fills the tile's decorative layer. */
	media?:
		| "mandala"
		| "loop-mandala"
		| "choreo-card"
		| "pictograph"
		| "pictograph-fade"
		| "dictionary"
		| "guide-cover"
		| "alphabet-strip";
	chips?: { label: string; href: string }[];
	/** Opt this tile into the pointer-follow magnetic pull (composer only). */
	magnetic?: boolean;
}

export const LAUNCHPAD_TILES: LaunchpadTileDef[] = [
	{
		id: "composer",
		href: "/composer",
		heading: "Composer",
		descriptor: "Write a sequence in TKA letters and play it back.",
		span: "2x2",
		color: "#a78bfa",
		icon: "fa-pen-nib",
		media: "mandala",
		magnetic: true,
	},
	{
		id: "choreo-cards",
		href: "/shop/choreography-cards",
		heading: "Choreo Cards",
		descriptor: "Printed decks of real sequences. Scan a card and it plays.",
		span: "2x1",
		color: "#34d399",
		icon: "fa-layer-group",
		media: "choreo-card",
		chips: [
			{ label: "LOOP Deck", href: "/shop/loop-deck" },
			{ label: "Shop", href: "/shop" },
		],
	},
	{
		id: "notation",
		href: "/notation",
		heading: "The Notation",
		descriptor: "The positions and motions behind every letter.",
		span: "2x1",
		color: "#22d3ee",
		icon: "fa-bezier-curve",
		media: "pictograph",
		chips: [
			{ label: "Staves", href: "/notation/staves" },
			{ label: "Fans", href: "/notation/fans" },
			{ label: "Clubs", href: "/notation/clubs" },
			{ label: "Buugeng", href: "/notation/buugeng" },
			{ label: "Poi", href: "/notation/poi" },
		],
	},
	// The grid's cell count must stay a multiple of 4 or the last row ships
	// holes. 12 cells = three clean rows: composer 2x2, three 2x1s, two 1x1s.
	// One tile per visitor question — do (Composer), hold (Choreo Cards),
	// understand (Notation), go deeper (LOOPs + sibling chips), learn (Guide,
	// Alphabet). Deep-cut notation destinations (Shape Matrix, CAPs) ride as
	// chips here instead of holding their own tiles; reference material
	// (Glossary, Staff Choreography) lives in the strip.
	{
		id: "loops",
		href: "/notation/loops",
		heading: "The LOOP Algebra",
		descriptor: "Six ways for a sequence to return to where it started.",
		span: "2x1",
		color: "#36c3ff",
		icon: "fa-rotate",
		media: "loop-mandala",
		chips: [
			{ label: "Shape Matrix", href: "/notation/shape-matrix" },
			{ label: "CAPs", href: "/notation/caps" },
		],
	},
	{
		id: "guide",
		href: "/guide",
		heading: "The Guide",
		descriptor: "Read and write TKA, level by level.",
		span: "1x1",
		color: "#60a5fa",
		icon: "fa-map-signs",
		media: "guide-cover",
	},
	{
		id: "alphabet",
		href: "/notation/letters",
		heading: "The Alphabet",
		descriptor: "Every letter, drawn as a pictograph.",
		span: "1x1",
		color: "#f472b6",
		icon: "fa-font",
		media: "alphabet-strip",
	},
];

export const STRIP_LINKS: { label: string; href: string }[] = [
	{ label: "Glossary", href: "/glossary" },
	{ label: "Staff Choreography", href: "/learn/staff-spinning-choreography" },
	{ label: "FAQ", href: "/faq" },
	{ label: "Software Roots", href: "/roots/software" },
	{ label: "Support", href: "/support" },
	{ label: "About", href: "/about" },
];

export const HERO_POINTER = {
	prefix: "New here? Start with ",
	label: "What is TKA?",
	href: "/about",
} as const;
