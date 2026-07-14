/**
 * demo-anti-smoosh.ts — trace the FULL closed antispin flower from the shipped
 * petal model, for 0/1/2 turns, next to the pro arc. The flower curve calls the
 * real shipped concaveRadiusProfile, so this cannot drift from the code.
 * Run: npx tsx scripts/demo-anti-smoosh.ts
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import {
  concaveRadiusProfile,
  petalsPerStep,
  BASE_DIP_RADIUS,
} from "../src/lib/shared/3d/services/petal-path";

const N_PER_STEP = 120;
// Full CW cycle: N(90°)→E(0°)→S(−90°)→W(−180°)→N(−270°). Angle drops 90°/step.
const STEP_START = [90, 0, -90, -180].map((d) => (d * Math.PI) / 180);
const STEP_END = [0, -90, -180, -270].map((d) => (d * Math.PI) / 180);

type Pt = { x: number; y: number };

function flower(turns: number): Pt[] {
  const pts: Pt[] = [];
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < N_PER_STEP; i++) {
      const p = i / N_PER_STEP;
      const ang = STEP_START[s]! + (STEP_END[s]! - STEP_START[s]!) * p;
      const r = concaveRadiusProfile(p, turns, 0);
      pts.push({ x: r * Math.cos(ang), y: r * Math.sin(ang) });
    }
  }
  pts.push(pts[0]!); // close
  return pts;
}

function proArc(): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 360; i++) {
    const a = (i * Math.PI) / 180;
    pts.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  return pts;
}

const S = 120,
  CX = 150,
  CY = 150;
const toSvg = (pts: Pt[]) =>
  pts.map((p) => `${(CX + p.x * S).toFixed(1)},${(CY - p.y * S).toFixed(1)}`).join(" ");

const gridEls = `
  <circle cx="${CX}" cy="${CY}" r="${S}" fill="none" stroke="#2b303b" stroke-width="1" stroke-dasharray="3 4"/>
  <circle cx="${CX}" cy="${CY}" r="2.5" fill="#6b7280"/>`;

function cell(title: string, sub: string, curve: Pt[], color: string): string {
  return `<div class="cell"><h3>${title}</h3><p class="sub2">${sub}</p>
    <svg viewBox="0 0 300 300" width="100%">${gridEls}
      <polyline points="${toSvg(curve)}" fill="none" stroke="${color}" stroke-width="2.5"/>
    </svg></div>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{background:#0f1115;color:#e5e7eb;font-family:system-ui,sans-serif;margin:0;padding:24px}
  h1{font-size:20px;margin:0 0 4px} .sub{color:#9ca3af;margin:0 0 18px;font-size:13px;max-width:820px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;max-width:1200px}
  .cell{background:#171a21;border:1px solid #262b36;border-radius:10px;padding:12px}
  .cell h3{margin:0 0 2px;font-size:14px} .sub2{color:#9ca3af;font-size:12px;margin:0 0 6px}
</style></head><body>
  <h1>Antispin flowers from the shipped petal model (full cycle)</h1>
  <p class="sub">Each curve is the hand center path over one full 4-step cycle, computed by the shipped <code>concaveRadiusProfile</code> at k=0. Petals per cycle = 4·(1+turns). Matches the hand-drawn reference: pro = single arc; anti = 4 / 8 / 12 spikes.</p>
  <div class="grid">
    ${cell("pro", "always arc — 1 loop", proArc(), "#a78bfa")}
    ${cell("anti · 0 turns", `${petalsPerStep(0) * 4} petals`, flower(0), "#22d3ee")}
    ${cell("anti · 1 turn", `${petalsPerStep(1) * 4} petals`, flower(1), "#22d3ee")}
    ${cell("anti · 2 turns", `${petalsPerStep(2) * 4} petals`, flower(2), "#22d3ee")}
  </div>
  <p class="sub" style="margin-top:16px">Dip depth is currently constant (floor = ${BASE_DIP_RADIUS.toFixed(3)}·radius) for every turn count — the spikes get narrower as they multiply, but they all reach the same depth. The reference sketch shows shallower dips at higher turn counts. Open question flagged to Austen.</p>
</body></html>`;

const out = resolve(process.cwd(), "scripts/anti-smoosh-demo.html");
writeFileSync(out, html);
console.log("wrote", out);
for (const t of [0, 1, 2]) {
  console.log(`turns=${t}: petals/step=${petalsPerStep(t)}, /cycle=${petalsPerStep(t) * 4}`);
}
