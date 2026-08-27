/**
 * First Fire Cinder Court — navigation-reset proposal generator.
 *
 * Emits the proposed replacement floor plan (top-down measured board) and five
 * computed eye-height sightline frames from one geometry definition. These are
 * pre-Gate-1 approval artifacts: filled-wireframe geometric proofs of route
 * readability, NOT visual targets. Flame/growth marks are diagram glyphs.
 *
 * Run: node scripts/generate-first-fire-navigation-reset-proposal.mjs
 * Output: docs/superpowers/specs/first-fire-cinder-court/navigation-reset/
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(
  process.cwd(),
  "docs/superpowers/specs/first-fire-cinder-court/navigation-reset"
);

// Geometry (room-local metres; origin = NW interior corner; x east, z south)
const ROOM = { w: 58, d: 44 };
const WEST_DOOR = { min: 20, max: 24 }; // Water, centre z 22
const EAST_DOOR = { min: 32, max: 36 }; // Earth, centre z 34
const WALL_HEIGHT = 6;
const EYE = 1.7;

const HUB = { x: 20, z: 22, r: 6.5 };

// Corridors: centreline + width. Walls derive from perpendicular offsets.
const CORRIDORS = {
  entry: { width: 4, points: [[0, 22], [13.5, 22]] },
  dj: { width: 3.5, points: [[15.4, 17.4], [14, 12], [12, 8], [12, 6.2]] },
  ek: { width: 3.5, points: [[20, 28.5], [20, 32], [19, 34.5]] },
  fl: { width: 3.5, points: [[24.6, 17.4], [30, 14], [36, 12], [37.5, 11.4]] },
  earth: { width: 3.5, points: [[24.6, 26.6], [30, 30], [40, 33], [50, 34], [58, 34]] },
};

// Courts — three deliberately different footprints/silhouettes.
const COURTS = {
  dj: {
    label: "DJ — Canyon Slot",
    kind: "slot",
    rect: { minX: 4, maxX: 12, minZ: 4, maxZ: 8.2 },
    performer: { x: 6, z: 6.1, word: "JDJD" },
    mouth: [12, 6.2],
  },
  ek: {
    label: "EK — Sunken Bowl",
    kind: "bowl",
    ellipse: { cx: 18, cz: 38.5, rx: 7, rz: 4.8, floorDrop: 1.5 },
    performer: { x: 18, z: 38.5, word: "KEKE" },
    mouth: [19, 34.5],
  },
  fl: {
    label: "FL — Chimney Rotunda",
    kind: "rotunda",
    circle: { cx: 42, cz: 10, r: 5, height: 12 },
    performer: { x: 42, z: 10, word: "LFLF" },
    mouth: [37.5, 11.4],
  },
};

const GATES = {
  dj: { at: [15.4, 17.4], bearing: "NW rim" },
  ek: { at: [20, 28.5], bearing: "S rim" },
  fl: { at: [24.6, 17.4], bearing: "NE rim" },
  earth: { at: [24.6, 26.6], bearing: "SE rim" },
};

const FRAMES = [
  {
    id: 1,
    slug: "water-threshold",
    title: "F1 — Water threshold",
    cam: { x: 1.5, z: 22, yawDeg: 0 },
    proves: "One straight corridor east; the hub ember glow is the single draw.",
  },
  {
    id: 2,
    slug: "hub-one-gate",
    title: "F2 — Hub arrival, one lit gate",
    cam: { x: 16.5, z: 24.5, yawDeg: -82 },
    proves: "From the hub, the DJ gate is the ONLY red landmark; EK/FL gates are dark rock.",
  },
  {
    id: 3,
    slug: "active-corridor",
    title: "F3 — Active fire corridor (DJ)",
    cam: { x: 14.4, z: 13.8, yawDeg: -115 },
    proves: "Flame rides the wall tops, off the centreline; the floor stays continuously readable.",
  },
  {
    id: 4,
    slug: "court-reveal",
    title: "F4 — Court reveal after the bend",
    cam: { x: 12.6, z: 6.4, yawDeg: 178 },
    proves: "The canyon opens onto the DJ court; the performer is the terminal focus.",
  },
  {
    id: 5,
    slug: "coals-back",
    title: "F5 — Coals lead back to the hub",
    cam: { x: 13.6, z: 10.5, yawDeg: 62 },
    proves: "Extinguished coals mark the walked floor; the hub glow is visible through the gate.",
  },
];

// Small vector helpers
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const norm = (v) => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l];
};
const perp = (v) => [-v[1], v[0]];

/** Left/right wall quads (floor y=0 → top y=h) for a corridor. */
function corridorWalls(corridor, height = WALL_HEIGHT) {
  const walls = [];
  const half = corridor.width / 2;
  for (let i = 0; i < corridor.points.length - 1; i++) {
    const a = corridor.points[i];
    const b = corridor.points[i + 1];
    const n = perp(norm(sub(b, a)));
    for (const side of [1, -1]) {
      const oa = [a[0] + n[0] * half * side, a[1] + n[1] * half * side];
      const ob = [b[0] + n[0] * half * side, b[1] + n[1] * half * side];
      walls.push({ a: oa, b: ob, height });
    }
  }
  return walls;
}

/** Wall segments approximating a circle/arc, skipping gate openings. */
function ringWalls(cx, cz, r, height, openings = [], segments = 48) {
  const walls = [];
  for (let i = 0; i < segments; i++) {
    const t0 = (i / segments) * Math.PI * 2;
    const t1 = ((i + 1) / segments) * Math.PI * 2;
    const mid = (t0 + t1) / 2;
    const midPt = [cx + Math.cos(mid) * r, cz + Math.sin(mid) * r];
    const open = openings.some((o) => Math.hypot(midPt[0] - o[0], midPt[1] - o[1]) < o[2]);
    if (open) continue;
    walls.push({
      a: [cx + Math.cos(t0) * r, cz + Math.sin(t0) * r],
      b: [cx + Math.cos(t1) * r, cz + Math.sin(t1) * r],
      height,
    });
  }
  return walls;
}

function rectWalls(rect, height, openings = []) {
  const c = [
    [rect.minX, rect.minZ],
    [rect.maxX, rect.minZ],
    [rect.maxX, rect.maxZ],
    [rect.minX, rect.maxZ],
  ];
  const walls = [];
  for (let i = 0; i < 4; i++) {
    const a = c[i];
    const b = c[(i + 1) % 4];
    const steps = Math.max(1, Math.ceil(len(sub(b, a)) / 1.5));
    for (let s = 0; s < steps; s++) {
      const p = [a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps];
      const q = [a[0] + ((b[0] - a[0]) * (s + 1)) / steps, a[1] + ((b[1] - a[1]) * (s + 1)) / steps];
      const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      if (openings.some((o) => Math.hypot(mid[0] - o[0], mid[1] - o[1]) < o[2])) continue;
      walls.push({ a: p, b: q, height });
    }
  }
  return walls;
}

// Perspective projection (pinhole; y up, camera at EYE height)
const VIEW_W = 1280;
const VIEW_H = 720;
const FOV_DEG = 78;

function makeCamera(cam) {
  const yaw = (cam.yawDeg * Math.PI) / 180;
  // yaw 0 looks toward +x (east); positive yaw rotates toward +z (south)
  const fwd = [Math.cos(yaw), Math.sin(yaw)];
  const right = [-Math.sin(yaw), Math.cos(yaw)];
  const f = VIEW_W / 2 / Math.tan(((FOV_DEG / 2) * Math.PI) / 180);
  return { pos: [cam.x, cam.z], fwd, right, f };
}

/** Project world point (x, z ground, y height) → { sx, sy, depth } or null. */
function project(camera, x, z, y) {
  const rel = [x - camera.pos[0], z - camera.pos[1]];
  const depth = rel[0] * camera.fwd[0] + rel[1] * camera.fwd[1];
  if (depth < 0.12) return null;
  const lateral = rel[0] * camera.right[0] + rel[1] * camera.right[1];
  return {
    sx: VIEW_W / 2 + (lateral / depth) * camera.f,
    sy: VIEW_H / 2 - ((y - EYE) / depth) * camera.f,
    depth,
  };
}

function projectQuad(camera, wall) {
  const pts = [
    project(camera, wall.a[0], wall.a[1], 0),
    project(camera, wall.b[0], wall.b[1], 0),
    project(camera, wall.b[0], wall.b[1], wall.height),
    project(camera, wall.a[0], wall.a[1], wall.height),
  ];
  if (pts.some((p) => !p)) return null;
  const depth = Math.min(pts[0].depth, pts[1].depth);
  return { pts, depth };
}

function shade(depth) {
  // Nearer rock reads lighter; falls off with distance.
  const t = Math.min(1, depth / 30);
  const v = Math.round(74 - t * 40);
  return `rgb(${v + 8},${v},${v - 6})`;
}

// ---------------------------------------------------------------------------
// SVG builders
// ---------------------------------------------------------------------------
function svgDoc(width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Segoe UI, sans-serif">${body}</svg>`;
}

const DEFS = `<defs>
  <radialGradient id="ember"><stop offset="0%" stop-color="#ffd9a0"/><stop offset="45%" stop-color="#ff8c3b" stop-opacity="0.85"/><stop offset="100%" stop-color="#ff5a1f" stop-opacity="0"/></radialGradient>
  <radialGradient id="coal"><stop offset="0%" stop-color="#ff7a45" stop-opacity="0.9"/><stop offset="100%" stop-color="#57150a" stop-opacity="0"/></radialGradient>
  <radialGradient id="growth"><stop offset="0%" stop-color="#a8ffb0"/><stop offset="100%" stop-color="#1f7a3a" stop-opacity="0"/></radialGradient>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0b0705"/><stop offset="100%" stop-color="#241611"/></linearGradient>
</defs>`;

function flameGlyph(x, y, scale = 1, hue = "ember") {
  return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(14 * scale).toFixed(1)}" ry="${(26 * scale).toFixed(1)}" fill="url(#${hue})"/>`;
}

function performerGlyph(camera, p, label) {
  const foot = project(camera, p.x, p.z, 0);
  const head = project(camera, p.x, p.z, 1.85);
  if (!foot || !head) return "";
  const h = foot.sy - head.sy;
  const w = h * 0.32;
  return `
  <ellipse cx="${foot.sx.toFixed(1)}" cy="${(head.sy + h * 0.62).toFixed(1)}" rx="${(w / 2).toFixed(1)}" ry="${(h * 0.38).toFixed(1)}" fill="#d8cdbf"/>
  <circle cx="${head.sx.toFixed(1)}" cy="${(head.sy + h * 0.12).toFixed(1)}" r="${(h * 0.11).toFixed(1)}" fill="#d8cdbf"/>
  <text x="${foot.sx.toFixed(1)}" y="${(foot.sy + 20).toFixed(1)}" fill="#ffe6c8" font-size="18" text-anchor="middle">${label}</text>`;
}

// ---------------------------------------------------------------------------
// Frame rendering
// ---------------------------------------------------------------------------
function allWalls() {
  const walls = [];
  for (const [key, corridor] of Object.entries(CORRIDORS)) {
    walls.push(...corridorWalls(corridor).map((w) => ({ ...w, tag: key })));
  }
  // Hub ring with four gate openings (each 3.5 m wide) plus Water entry mouth.
  const openings = [
    [...GATES.dj.at, 2.4],
    [...GATES.ek.at, 2.4],
    [...GATES.fl.at, 2.4],
    [...GATES.earth.at, 2.4],
    [13.5, 22, 2.6],
  ];
  walls.push(...ringWalls(HUB.x, HUB.z, HUB.r, WALL_HEIGHT, openings).map((w) => ({ ...w, tag: "hub" })));
  // DJ canyon court: tall slot, open at its east mouth.
  walls.push(
    ...rectWalls(COURTS.dj.rect, 7.5, [[12, 6.2, 2.2]]).map((w) => ({ ...w, tag: "dj-court" }))
  );
  // EK bowl rim (low) and FL rotunda (tall) with mouth openings.
  const ek = COURTS.ek.ellipse;
  walls.push(
    ...ringWalls(ek.cx, ek.cz, (ek.rx + ek.rz) / 2, 3, [[19, 34.5, 2.4]]).map((w) => ({
      ...w,
      tag: "ek-court",
    }))
  );
  const fl = COURTS.fl.circle;
  walls.push(
    ...ringWalls(fl.cx, fl.cz, fl.r, fl.height, [[37.5, 11.4, 2.4]]).map((w) => ({
      ...w,
      tag: "fl-court",
    }))
  );
  return walls;
}

function renderFrame(frame) {
  const camera = makeCamera(frame.cam);
  const quads = allWalls()
    .map((w) => ({ wall: w, q: projectQuad(camera, w) }))
    .filter((e) => e.q)
    .sort((a, b) => b.q.depth - a.q.depth);

  let body = `${DEFS}<rect width="${VIEW_W}" height="${VIEW_H}" fill="url(#sky)"/>`;
  // Floor plane hint
  body += `<rect y="${VIEW_H / 2}" width="${VIEW_W}" height="${VIEW_H / 2}" fill="#171310"/>`;

  // Hub ember glow behind geometry when hub is roughly ahead
  const hubGlow = project(camera, HUB.x, HUB.z, 1.2);
  if (hubGlow && frame.id !== 4) {
    body += `<ellipse cx="${hubGlow.sx.toFixed(1)}" cy="${hubGlow.sy.toFixed(1)}" rx="${(2600 / hubGlow.depth).toFixed(1)}" ry="${(1500 / hubGlow.depth).toFixed(1)}" fill="url(#ember)" opacity="0.55"/>`;
  }

  for (const { q } of quads) {
    const d = q.pts.map((p) => `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(" ");
    body += `<polygon points="${d}" fill="${shade(q.depth)}" stroke="#0d0906" stroke-width="1"/>`;
  }

  // State-dependent glyph layers per frame
  if (frame.id === 2) {
    // DJ gate: warm glow inside the opening plus two jamb flames — the only red.
    const inside = project(camera, GATES.dj.at[0] - 0.5, GATES.dj.at[1] - 1.6, 1.6);
    if (inside)
      body += `<ellipse cx="${inside.sx.toFixed(1)}" cy="${inside.sy.toFixed(1)}" rx="${(1400 / inside.depth).toFixed(1)}" ry="${(1700 / inside.depth).toFixed(1)}" fill="url(#ember)" opacity="0.8"/>`;
    // Jambs sit perpendicular to the gate's outward bearing (gate faces SE into hub).
    for (const side of [-1, 1]) {
      const g = project(
        camera,
        GATES.dj.at[0] + side * 1.5 * 0.71,
        GATES.dj.at[1] - side * 1.5 * 0.71,
        2.4
      );
      if (g && g.sy > 80) body += flameGlyph(g.sx, g.sy, Math.min(2.2, 22 / g.depth));
    }
  }
  if (frame.id === 3) {
    // Flames along DJ corridor wall TOPS, off the centreline.
    const walls = corridorWalls(CORRIDORS.dj);
    for (const w of walls) {
      for (const t of [0.25, 0.75]) {
        const x = w.a[0] + (w.b[0] - w.a[0]) * t;
        const z = w.a[1] + (w.b[1] - w.a[1]) * t;
        const g = project(camera, x, z, 3.2);
        if (g && g.sy > 70) body += flameGlyph(g.sx, g.sy, Math.min(1.6, 16 / g.depth));
      }
    }
  }
  if (frame.id === 4) {
    body += performerGlyph(camera, COURTS.dj.performer, `DJ · ${COURTS.dj.performer.word}`);
    const halo = project(camera, COURTS.dj.performer.x, COURTS.dj.performer.z, 1.4);
    if (halo) body += `<ellipse cx="${halo.sx.toFixed(1)}" cy="${halo.sy.toFixed(1)}" rx="${(900 / halo.depth).toFixed(1)}" ry="${(620 / halo.depth).toFixed(1)}" fill="url(#ember)" opacity="0.5"/>`;
  }
  if (frame.id === 5) {
    // Coal dots along the corridor floor edges back toward the hub.
    const walls = corridorWalls(CORRIDORS.dj, 0.01);
    for (const w of walls) {
      for (const t of [0.2, 0.5, 0.8]) {
        const x = w.a[0] + (w.b[0] - w.a[0]) * t;
        const z = w.a[1] + (w.b[1] - w.a[1]) * t;
        const g = project(camera, x, z, 0.08);
        if (g) body += `<circle cx="${g.sx.toFixed(1)}" cy="${g.sy.toFixed(1)}" r="${Math.min(14, 90 / g.depth).toFixed(1)}" fill="url(#coal)"/>`;
      }
    }
  }

  body += `<rect width="${VIEW_W}" height="64" fill="rgba(0,0,0,0.55)"/>
  <text x="20" y="28" fill="#ffe6c8" font-size="20" font-weight="600">${frame.title}</text>
  <text x="20" y="50" fill="#c9b8a4" font-size="14">cam (${frame.cam.x}, ${frame.cam.z}) yaw ${frame.cam.yawDeg}° eye ${EYE} m · ${frame.proves}</text>
  <text x="${VIEW_W - 20}" y="${VIEW_H - 14}" fill="#8a7a68" font-size="12" text-anchor="end">geometric readability proof — filled wireframe, not a visual target</text>`;
  return svgDoc(VIEW_W, VIEW_H, body);
}

// ---------------------------------------------------------------------------
// Top-down board
// ---------------------------------------------------------------------------
function renderBoard() {
  const S = 20; // px per metre
  const M = 70; // margin
  const W = ROOM.w * S + M * 2;
  const H = ROOM.d * S + M * 2 + 120;
  const X = (x) => M + x * S;
  const Z = (z) => M + z * S;

  let b = `${DEFS}<rect width="${W}" height="${H}" fill="#0f0b08"/>`;
  b += `<rect x="${X(0)}" y="${Z(0)}" width="${ROOM.w * S}" height="${ROOM.d * S}" fill="#241a13" stroke="#6b5a48" stroke-width="3"/>`;

  const corridorPath = (c) =>
    c.points.map((p, i) => `${i ? "L" : "M"}${X(p[0])},${Z(p[1])}`).join(" ");
  const FLOOR = "#4a4038";

  // Hub + courts as carved floor
  b += `<circle cx="${X(HUB.x)}" cy="${Z(HUB.z)}" r="${HUB.r * S}" fill="${FLOOR}"/>`;
  const dj = COURTS.dj.rect;
  b += `<rect x="${X(dj.minX)}" y="${Z(dj.minZ)}" width="${(dj.maxX - dj.minX) * S}" height="${(dj.maxZ - dj.minZ) * S}" fill="${FLOOR}"/>`;
  const ek = COURTS.ek.ellipse;
  b += `<ellipse cx="${X(ek.cx)}" cy="${Z(ek.cz)}" rx="${ek.rx * S}" ry="${ek.rz * S}" fill="#3d362f"/>`;
  b += `<ellipse cx="${X(ek.cx)}" cy="${Z(ek.cz)}" rx="${ek.rx * 0.6 * S}" ry="${ek.rz * 0.6 * S}" fill="#332c26"/>`;
  const fl = COURTS.fl.circle;
  b += `<circle cx="${X(fl.cx)}" cy="${Z(fl.cz)}" r="${fl.r * S}" fill="${FLOOR}"/>`;
  for (const c of Object.values(CORRIDORS)) {
    b += `<path d="${corridorPath(c)}" stroke="${FLOOR}" stroke-width="${c.width * S}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  }

  // Route with numbered stations
  const route = [
    { p: [0, 22], n: "1", t: "Water door" },
    { p: [HUB.x, HUB.z], n: "2", t: "Hub — ember cairn" },
    { p: [COURTS.dj.performer.x + 2.5, COURTS.dj.performer.z], n: "3", t: "" },
    { p: [HUB.x - 1, HUB.z - 2], n: "4", t: "return" },
    { p: [ek.cx + 2.5, ek.cz], n: "5", t: "" },
    { p: [HUB.x + 1, HUB.z + 2], n: "6", t: "return" },
    { p: [fl.cx + 2.5, fl.cz], n: "7", t: "" },
    { p: [50, 34], n: "8", t: "Earth door (green)" },
  ];
  for (const c of Object.values(CORRIDORS)) {
    b += `<path d="${corridorPath(c)}" stroke="#ffb26b" stroke-width="2.5" stroke-dasharray="10 7" fill="none" opacity="0.85"/>`;
  }
  for (const s of route) {
    b += `<circle cx="${X(s.p[0])}" cy="${Z(s.p[1])}" r="13" fill="#ff8c3b"/><text x="${X(s.p[0])}" y="${Z(s.p[1]) + 5}" text-anchor="middle" fill="#160c05" font-size="15" font-weight="700">${s.n}</text>`;
    if (s.t) b += `<text x="${X(s.p[0]) + 18}" y="${Z(s.p[1]) - 10}" fill="#ffd9a0" font-size="14">${s.t}</text>`;
  }

  // Gates and doors
  for (const [id, g] of Object.entries(GATES)) {
    const col = id === "earth" ? "#7dffa0" : "#ff5a1f";
    b += `<circle cx="${X(g.at[0])}" cy="${Z(g.at[1])}" r="7" fill="${col}"/>`;
    b += `<text x="${X(g.at[0]) + 10}" y="${Z(g.at[1]) + 4}" fill="${col}" font-size="12">${id.toUpperCase()} gate</text>`;
  }
  b += `<rect x="${X(0) - 6}" y="${Z(WEST_DOOR.min)}" width="6" height="${(WEST_DOOR.max - WEST_DOOR.min) * S}" fill="#5ab4ff"/><text x="${X(0) - 12}" y="${Z(22) + 4}" fill="#5ab4ff" font-size="14" text-anchor="end">WATER</text>`;
  b += `<rect x="${X(ROOM.w)}" y="${Z(EAST_DOOR.min)}" width="6" height="${(EAST_DOOR.max - EAST_DOOR.min) * S}" fill="#7dffa0"/><text x="${X(ROOM.w) + 12}" y="${Z(34) + 4}" fill="#7dffa0" font-size="14">EARTH</text>`;

  // Performers
  for (const c of Object.values(COURTS)) {
    b += `<circle cx="${X(c.performer.x)}" cy="${Z(c.performer.z)}" r="6" fill="#d8cdbf"/><text x="${X(c.performer.x)}" y="${Z(c.performer.z) + 26}" fill="#d8cdbf" font-size="14" text-anchor="middle">${c.label} · ${c.performer.word}</text>`;
  }

  // Frame cameras with view cones
  for (const f of FRAMES) {
    const yaw = (f.cam.yawDeg * Math.PI) / 180;
    const cx = X(f.cam.x);
    const cy = Z(f.cam.z);
    const spread = (FOV_DEG / 2) * (Math.PI / 180);
    const r = 3.4 * S;
    const p1 = [cx + Math.cos(yaw - spread) * r, cy + Math.sin(yaw - spread) * r];
    const p2 = [cx + Math.cos(yaw + spread) * r, cy + Math.sin(yaw + spread) * r];
    b += `<path d="M${cx},${cy} L${p1[0].toFixed(1)},${p1[1].toFixed(1)} L${p2[0].toFixed(1)},${p2[1].toFixed(1)} Z" fill="#5ab4ff" opacity="0.22"/>`;
    b += `<circle cx="${cx}" cy="${cy}" r="8" fill="#5ab4ff"/><text x="${cx}" y="${cy + 4}" fill="#08131c" font-size="11" font-weight="700" text-anchor="middle">F${f.id}</text>`;
  }

  // Scale + title
  b += `<line x1="${X(2)}" y1="${Z(ROOM.d) + 26}" x2="${X(12)}" y2="${Z(ROOM.d) + 26}" stroke="#c9b8a4" stroke-width="3"/><text x="${X(7)}" y="${Z(ROOM.d) + 46}" fill="#c9b8a4" font-size="14" text-anchor="middle">10 m</text>`;
  b += `<text x="${M}" y="42" fill="#ffe6c8" font-size="26" font-weight="700">First Fire Cinder Court — navigation-reset proposal (58 × 44 m)</text>`;
  b += `<text x="${M}" y="${H - 46}" fill="#c9b8a4" font-size="15">One lit path at a time: hub ember cairn is the fixed landmark; only the active gate burns red. Dark rock is solid basalt (collision); fire never owns collision.</text>`;
  b += `<text x="${M}" y="${H - 24}" fill="#8a7a68" font-size="13">Route: Water → hub → DJ canyon slot → hub → EK sunken bowl → hub → FL chimney rotunda → blackout → green growth → Earth. F1–F5 mark the sightline frames.</text>`;
  return svgDoc(W, H, b);
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "navigation-reset-plan.svg"), renderBoard());
const files = ["navigation-reset-plan.svg"];
for (const frame of FRAMES) {
  const name = `frame-${frame.id}-${frame.slug}.svg`;
  writeFileSync(join(OUT_DIR, name), renderFrame(frame));
  files.push(name);
}

const html = `<!doctype html><meta charset="utf-8"><title>First Fire navigation reset — review board</title>
<body style="margin:0;background:#0b0705;color:#e8dccb;font-family:Segoe UI,sans-serif;padding:24px">
<h1 style="font-weight:600">First Fire Cinder Court — navigation reset proposal</h1>
<p style="max-width:70rem;color:#c9b8a4">Pre-Gate-1 approval artifacts. Filled-wireframe geometric proofs of route readability — flame, coal, and growth marks are diagram glyphs, not visual targets. Approve or reject the topology; nothing downstream (Blender, GLB, runtime) is built from the rejected plan or from this one until approval.</p>
${files.map((f) => `<figure style="margin:24px 0"><img src="${f}" style="max-width:100%;border:1px solid #3b2f24"/><figcaption style="color:#8a7a68;margin-top:6px">${f}</figcaption></figure>`).join("\n")}
</body>`;
writeFileSync(join(OUT_DIR, "index.html"), html);
console.log(`Wrote ${files.length + 1} files to ${OUT_DIR}`);
