// Predict a card pair's fingerprint from structure, then measure it.
//
// letter-group.mjs established that a letter is (motion character, gap), that
// the gap coordinate IS the alpha/beta/gamma position family, and that the 13
// families are the orbits of the 90 gap step. If that structure is real, a
// pair's fingerprint should be a function of TWO numbers -- how far apart the
// two cards sit in gap, and whether they share a family -- and not of which
// letters they happen to be.
//
// This script states that model up front, derives each prediction from data,
// runs the exhaustive enumeration, and scores itself. A miss is the point: it
// says the model is wrong somewhere specific.
//
//   node scripts/combinator-research/pair-classes.mjs
//
// Same box as theory-512.mjs: unit <= 6 steps, <= 2 connectors, diamond, both
// cards required. Limits in README.md apply.

import { countPair, letterWorlds, familyOf, gapFamilies } from "./enumerate.mjs";


const GAP = { beta: 0, gamma: 2, alpha: 4 };

/** A card must return to the gap it started from, or it cannot run on its own. */
function cardWorld(letter) {
	const ws = [...(letterWorlds.get(letter) ?? [])];
	const stationary = ws.filter((w) => {
		const [s, e] = w.split(">");
		return s === e;
	});
	if (!stationary.length) return null;
	return stationary[0].split(">")[0];
}

/** Gap separation between two worlds, on the Z4 gap ring, as 0 / 2 / 4. */
function gapDelta(wa, wb) {
	const d = Math.abs(GAP[wa] - GAP[wb]) % 8;
	return Math.min(d, 8 - d);
}


// FIRST MODEL, REFUTED 2026-08-05. It read the published numbers as "a base set
// by gap separation, halved when the cards share a family", which forced base
// 1024 at separation 2 and predicted 1024 for a different-family gamma pair.
// A+U, A+T and B+S all measured 512, not 1024. The halving is not a general
// rule -- it happens in exactly one cell.
//
// CORRECTED MODEL. Every cross-world pair is 512. It halves to 256 only when the
// two cards are the SAME motion character at opposite gaps, i.e. when they are
// each other's gap-involution partner (A<->G, B<->H, C<->I). Separation 2 never
// halves, whether or not the cards share a family.
//
// Stated in the algebra's own terms: a pair's fingerprint asks one question --
// are these two cards gap partners? 256 means yes, 512 means no.
function predict(wa, wb, sameFamily) {
	const d = gapDelta(wa, wb);
	if (d === 0) {
		const both = wa === "gamma" && wb === "gamma";
		return { d, words: both ? 23466 : 7396, why: "same world — no bridge needed, every interleaving legal" };
	}
	const gapPartners = d === 4 && sameFamily;
	return {
		d,
		words: gapPartners ? 256 : 512,
		why: gapPartners ? "gap-involution partners" : `dgap ${d}, not gap partners`,
	};
}

// ---------------------------------------------------------------- test set

// Every runnable single-letter card, with the family it belongs to.
const CARDS = ["A", "B", "C", "G", "H", "I", "S", "T", "U", "V"];

// Published in the 2026-08-05 handoff. Any change here is a regression.
const KNOWN = {
	"A+G": 256,
	"B+H": 256,
	"C+I": 256,
	"A+H": 512,
	"B+G": 512,
	"A+S": 512,
	"G+S": 512,
};

// Cross-world pairs only — same-world pairs run ~11 minutes each and their
// class is already pinned by A+B / G+H / S+T.
const PAIRS = [
	// separation 4, gap partners — the whole cell. Families 0/1/2 each hold
	// exactly one alpha and one beta card, so these three are all of them.
	["A", "G"], // published 256
	["B", "H"], // published 256
	["C", "I"], // published 256
	// separation 4, not partners — completing the cell (A+H and B+G published)
	["A", "I"],
	["C", "G"],
	["B", "I"],
	["C", "H"],
	// separation 2 — the cell that refuted the first model. Both same-family
	// and different-family entries, from the alpha side and the beta side.
	["A", "S"], // published 512, same family
	["C", "U"], // same family, size-4 family's first gamma name
	["C", "V"], // same family, the OTHER gamma name
	["I", "V"], // same family, beta side
	["A", "U"], // different family
	["A", "T"], // different family
	["A", "V"], // different family
	["B", "S"], // different family
	["B", "U"], // different family
	["G", "T"], // different family, beta side
	["H", "S"], // different family, beta side
];

// ---------------------------------------------------------------- run

const fams = gapFamilies();
console.log("Runnable single-letter cards, by structure:\n");
console.log("  card   world   gap   family");
for (const c of CARDS) {
	const w = cardWorld(c);
	const f = familyOf(c);
	console.log(
		`  ${c.padEnd(6)} ${String(w).padEnd(7)} ${String(GAP[w]).padEnd(5)} #${f} { ${fams[f].join(", ")} }`,
	);
}

console.log("\n\nMODEL: every cross-world pair is 512 words, halving to 256 exactly when the");
console.log("       two cards are gap-involution partners — the same motion character at");
console.log("       opposite gaps. Separation 0 needs no bridge and explodes instead.\n");
console.log(
	"pair    worlds            dgap  fam   predicted   measured   verdict     time",
);
console.log("-".repeat(84));

let pass = 0;
let fail = 0;
for (const [a, b] of PAIRS) {
	const wa = cardWorld(a);
	const wb = cardWorld(b);
	const same = familyOf(a) === familyOf(b);
	const p = predict(wa, wb, same);
	const t0 = Date.now();
	const r = countPair({ lettersA: [a], lettersB: [b] });
	const secs = ((Date.now() - t0) / 1000).toFixed(1);
	const hit = r.words === p.words;
	if (hit) pass++;
	else fail++;
	const known = KNOWN[`${a}+${b}`];
	const reg = known !== undefined ? (known === r.words ? "  [regression ok]" : `  [REGRESSION! published ${known}]`) : "";
	console.log(
		`${(a + "+" + b).padEnd(8)}${(wa + "/" + wb).padEnd(18)}${String(p.d).padEnd(6)}${(same ? "same" : "diff").padEnd(6)}${String(p.words).padStart(9)}${String(r.words).padStart(11)}   ${(hit ? "PASS" : "MISS").padEnd(10)}${secs}s${reg}`,
	);
}

console.log("-".repeat(84));
console.log(`${pass} predicted correctly, ${fail} missed.`);
if (fail) {
	console.log("\nA miss is a result, not a bug: the model is wrong in a nameable cell.");
	console.log("Read the measured column for what the real base is.");
}
