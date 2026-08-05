// Austen's hypothesis (2026-08-05): for any pair of base sequences, the number
// of distinct combination words inside a fixed box is consistently 512.
// Box held identical for every pair: unit <= 6 steps, <= 2 connectors, diamond.

import { readFileSync } from "node:fs";

const DIR = "E:/tka-platform/mcp-server-pkg/assets/data/pictographs";
const RING = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
const ri = (l) => RING.indexOf(l);

const rows = [];
for (const line of readFileSync(`${DIR}/DiamondPictographDataframe.csv`, "utf8").trim().split(/\r?\n/).slice(1)) {
  const [letter, startPosition, endPosition, , , bT, bR, bS, bE, rT, rR, rS, rE] = line.split(",");
  if (!letter || !startPosition) continue;
  rows.push({ letter, startPosition, endPosition, bT, bR, bS, bE, rT, rR, rS, rE });
}
const posPair = new Map();
for (const r of rows) if (!posPair.has(r.startPosition)) posPair.set(r.startPosition, [r.bS, r.rS]);
for (const r of rows) if (!posPair.has(r.endPosition)) posPair.set(r.endPosition, [r.bE, r.rE]);
const out = new Map();
for (const r of rows) {
  if (!out.has(r.startPosition)) out.set(r.startPosition, []);
  out.get(r.startPosition).push(r);
}

const rotL = (l, s) => (ri(l) < 0 ? l : RING[(ri(l) + s + 8) % 8]);
const mirL = (l) => (ri(l) < 0 ? l : RING[(8 - ri(l)) % 8]);
const OPS = [];
for (let k = 0; k < 4; k++) for (const refl of [false, true]) for (const swap of [false, true])
  OPS.push({ k, refl, swap, apply: ([b, r]) => {
    let bb = refl ? mirL(b) : b, rr = refl ? mirL(r) : r;
    bb = rotL(bb, k * 2); rr = rotL(rr, k * 2);
    return swap ? [rr, bb] : [bb, rr];
  }});
const eqPair = (a, b) => a[0] === b[0] && a[1] === b[1];
const closes = (s, e) => {
  const sp = posPair.get(s), ep = posPair.get(e);
  return sp && ep && OPS.some((op) => eqPair(op.apply(sp), ep));
};
const tuple = (r) => [r.bT, r.bR, r.bS, r.bE, r.rT, r.rR, r.rS, r.rE].join("|");
const byTuple = new Map();
for (const r of rows) if (!byTuple.has(tuple(r))) byTuple.set(tuple(r), r);

function count({ lettersA, lettersB, maxLen = 6, maxConnectors = 2 }) {
  const A = new Set(lettersA), B = new Set(lettersB);
  const kind = (l) => (A.has(l) ? "A" : B.has(l) ? "B" : "C");
  const found = [];
  let explored = 0;
  for (const startPos of posPair.keys()) {
    const walk = [];
    (function dfs(pos, conn, uA, uB) {
      if (walk.length >= 1) {
        explored++;
        if (uA && uB && closes(startPos, pos)) found.push([...walk]);
      }
      if (walk.length >= maxLen) return;
      for (const e of out.get(pos) ?? []) {
        const k = kind(e.letter);
        if (k === "C" && conn >= maxConnectors) continue;
        walk.push(e);
        dfs(e.endPosition, conn + (k === "C" ? 1 : 0), uA || k === "A", uB || k === "B");
        walk.pop();
      }
    })(startPos, 0, false, false);
  }

  const applyOp = (r, op) => {
    const [bS, rS] = op.apply([r.bS, r.rS]);
    const [bE, rE] = op.apply([r.bE, r.rE]);
    return op.swap ? [r.rT, r.rR, bS, bE, r.bT, r.bR, rS, rE].join("|")
                   : [r.bT, r.bR, bS, bE, r.rT, r.rR, rS, rE].join("|");
  };
  const neck = (arr) => { let b = null; for (let i = 0; i < arr.length; i++) { const s = arr.slice(i).concat(arr.slice(0, i)).join("::"); if (b === null || s < b) b = s; } return b; };
  const canon = (steps) => { let b = null; for (const op of OPS) { const k = neck(steps.map((r) => applyOp(r, op))); if (b === null || k < b) b = k; } return b; };

  const seen = new Map();
  for (const st of found) { const k = canon(st); if (!seen.has(k)) seen.set(k, st); }

  // orbit dedup: a discovery and its one-hand-rotation faces are one entry
  const famSeen = new Set(); const reps = [];
  for (const [key, st] of seen) {
    if (famSeen.has(key)) continue;
    famSeen.add(key);
    for (const s of [2, 4, 6]) {
      const rot = st.map((r) => byTuple.get([r.bT, r.bR, r.bS, r.bE, r.rT, r.rR, rotL(r.rS, s), rotL(r.rE, s)].join("|")));
      if (rot.some((x) => !x)) continue;
      famSeen.add(canon(rot));
    }
    reps.push(st);
  }
  const words = new Set(reps.map((st) => st.map((s) => s.letter).join("")));
  const byLen = {};
  for (const w of words) byLen[w.length] = (byLen[w.length] ?? 0) + 1;
  return { explored, closed: found.length, reps: reps.length, words: words.size, byLen };
}

const CARDS = {
  "A (α pro same)": ["A"],
  "B (α anti same)": ["B"],
  "C (α hybrid same)": ["C"],
  "G (β pro same)": ["G"],
  "H (β anti same)": ["H"],
  "I (β hybrid same)": ["I"],
  "S (γ pro same)": ["S"],
  "T (γ anti same)": ["T"],
  "DJ (opp pro)": ["D", "J"],
  "EK (opp anti)": ["E", "K"],
  "FL (opp hybrid)": ["F", "L"],
  "ΦΨ (dash)": ["Φ", "Ψ"],
  "MP (γ opp pro)": ["M", "P"],
  "NQ (γ opp anti)": ["N", "Q"],
};

const PAIRS = [
  ["A (α pro same)", "G (β pro same)"],
  ["B (α anti same)", "H (β anti same)"],
  ["A (α pro same)", "H (β anti same)"],
  ["B (α anti same)", "G (β pro same)"],
  ["C (α hybrid same)", "I (β hybrid same)"],
  ["A (α pro same)", "B (α anti same)"],
  ["G (β pro same)", "H (β anti same)"],
  ["A (α pro same)", "S (γ pro same)"],
  ["G (β pro same)", "S (γ pro same)"],
  ["S (γ pro same)", "T (γ anti same)"],
  ["A (α pro same)", "DJ (opp pro)"],
  ["G (β pro same)", "EK (opp anti)"],
  ["A (α pro same)", "FL (opp hybrid)"],
  ["A (α pro same)", "ΦΨ (dash)"],
  ["G (β pro same)", "ΦΨ (dash)"],
  ["DJ (opp pro)", "EK (opp anti)"],
  ["DJ (opp pro)", "FL (opp hybrid)"],
  ["S (γ pro same)", "MP (γ opp pro)"],
  ["MP (γ opp pro)", "NQ (γ opp anti)"],
];

console.log("box: unit <= 6 steps, <= 2 connectors, diamond, both cards required\n");
console.log("pair".padEnd(38) + "words   reps    closed     by length");
console.log("-".repeat(96));
for (const [a, b] of PAIRS) {
  const t0 = Date.now();
  const r = count({ lettersA: CARDS[a], lettersB: CARDS[b] });
  const lens = Object.entries(r.byLen).sort((x, y) => x[0] - y[0]).map(([k, v]) => `${k}:${v}`).join(" ");
  console.log(
    `${(a + "  +  " + b).padEnd(38)}${String(r.words).padStart(5)}  ${String(r.reps).padStart(6)}  ${String(r.closed).padStart(8)}     ${lens}   (${((Date.now() - t0) / 1000).toFixed(1)}s)`
  );
}
