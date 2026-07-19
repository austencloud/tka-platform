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
	{
		id: "shape-matrix",
		href: "/notation/shape-matrix",
		heading: "Shape Matrix",
		descriptor: "144 even-petaled flowers, decoded as TKA notation.",
		span: "1x1",
		color: "#f97316",
		icon: "fa-diagram-project",
		media: "pictograph",
	},
	{
		id: "loops",
		href: "/notation/loops",
		heading: "The LOOP Algebra",
		descriptor: "Six ways for a sequence to return to where it started.",
		span: "1x1",
		color: "#36c3ff",
		icon: "fa-rotate",
		media: "loop-mandala",
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
		id: "glossary",
		href: "/glossary",
		heading: "Glossary",
		descriptor: "TKA terms, defined.",
		span: "1x1",
		color: "#94a3b8",
		icon: "fa-book-open",
		media: "dictionary",
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
	{
		id: "staff-choreo",
		href: "/learn/staff-spinning-choreography",
		heading: "Staff Choreography",
		descriptor: "Learn to write staff sequences in TKA.",
		span: "1x1",
		color: "#fbbf24",
		icon: "fa-graduation-cap",
		media: "pictograph-fade",
	},
];

export const STRIP_LINKS: { label: string; href: string }[] = [
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
