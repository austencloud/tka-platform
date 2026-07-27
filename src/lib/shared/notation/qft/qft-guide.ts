/**
 * The eight canonical moves, in the order the 2011 guide teaches them.
 *
 * Each entry pairs a restored animation with the knob values that reproduce the
 * same move. Aspect ratios are the extracted crops' real proportions, written by
 * scripts/extract-qft-frames.mjs — several of these drawings are markedly tall
 * or wide, and each card is shaped to fit its own.
 *
 * Quotes are only those verified in docs/reference/archive/qft-notation/README.md.
 * A move without a transcribed passage carries none rather than invented text.
 */

import type { QftKnobs } from "./qft-model";

export interface GuideMove {
	id: string;
	title: string;
	/** Frame directory under /notation/qft/frames/. */
	stem: string;
	/** The crop's own proportions, e.g. "421/265". */
	aspect: string;
	knobs: QftKnobs;
	pendulum?: boolean;
	/** Factual label: the knob values that produce this move. */
	spec: string;
	quote?: string;
}

export const GUIDE_MOVES: GuideMove[] = [
	{
		id: "static",
		title: "Static spin",
		stem: "static2",
		aspect: "344/389",
		knobs: { radius: 0, downbeats: 1, spin: "inspin" },
		spec: "radius 0 · one prop rotation per hand rotation",
		quote: "Because we made this thing up and we say so."
	},
	{
		id: "pendulum",
		title: "Pendulum",
		stem: "pendulum",
		aspect: "196/189",
		knobs: { radius: 0, downbeats: 1, spin: "inspin" },
		pendulum: true,
		spec: "radius 0 · the swing never reaches 7, 8 or 1"
	},
	{
		id: "extension",
		title: "Extension",
		stem: "extension",
		aspect: "296/298",
		knobs: { radius: 1, downbeats: 1, spin: "inspin" },
		spec: "radius 1 · hand and prop orientations identical",
		quote: "…because it's the only constant distance we can think of in spinning."
	},
	{
		id: "isolation",
		title: "Isolation",
		stem: "isolationanimated",
		aspect: "191/219",
		knobs: { radius: 0.5, downbeats: 1, spin: "inspin", phase: 4 },
		spec: "radius 0.5 · prop opposite the hand on the compass"
	},
	{
		id: "cateye",
		title: "Cateye",
		stem: "cateyeanimated",
		aspect: "124/200",
		knobs: { radius: 0.5, downbeats: 1, spin: "antispin" },
		spec: "radius 0.5 · prop advances one position per step"
	},
	{
		id: "triquetra",
		title: "Triquetra",
		stem: "triquetraanimated",
		aspect: "421/265",
		knobs: { radius: 1, downbeats: 2, spin: "antispin" },
		spec: "radius 1 · two prop rotations per hand rotation"
	},
	{
		id: "antispin4",
		title: "4-petal antispin",
		stem: "antispindiranimated",
		aspect: "350/488",
		knobs: { radius: 1, downbeats: 3, spin: "antispin" },
		spec: "radius 1 · three prop rotations per hand rotation"
	},
	{
		id: "inspin4",
		title: "4-petal inspin",
		stem: "inspindiranimated",
		aspect: "350/486",
		knobs: { radius: 1, downbeats: 5, spin: "inspin" },
		spec: "radius 1 · five prop rotations · same positions as antispin, opposite directions"
	}
];

/** The four sources, ranked by authority in the sourcing archive. */
export const SOURCES = [
	{
		label: "Charlie Cushing — QfT Tutorial Series",
		href: "https://www.youtube.com/playlist?list=PL45D3844B85CB8D80"
	},
	{
		label: "Drex — A Beginner's Guide to Prop QFT Notation",
		href: "https://www.homeofpoi.com/en/community/forums/topics/932537/A-Beginner-s-Guide-to-Prop-QFT-Notation"
	},
	{
		/* Named as the image source because it is: these frames were pulled from
		   here, and this is the copy that still serves them. */
		label: "Drex — the same guide on his blog, images intact",
		href: "https://drexfactor.com/weirdscience/2011/05/18/beginners_guide_poi_qft_notation"
	}
];

export const TIMELINE = [
	{ when: "2011", what: "Charlie Cushing devises QfT. Drex writes up the notation." },
	{ when: "May 2011", what: "The guide is posted to Home of Poi and to Drex's blog." },
	{ when: "Nov 2011", what: "Charlie publishes ten video chapters covering the full formula." },
	{ when: "2022", what: "A forum question about horizontal-plane moves goes unanswered." },
	{
		when: "since",
		what: "No further published work. The forum's images stop loading; the blog's still serve."
	}
];
