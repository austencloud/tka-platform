// Builds static/data/mandala-glyphs.json: one representative sequence per
// distinct mandala glyph, for the visual census page. Reads the prebuilt index
// (static/data/mandala-index.json), picks refs[0] per shapeKey, fetches only
// those ~60 sequence docs from Firestore for their `steps`, and emits a small
// file the lab page renders via the real SequenceMandala component.
// Usage: node scripts/build-mandala-glyphs.cjs
const admin = require("firebase-admin");
const { readFileSync, writeFileSync, mkdirSync } = require("fs");
const { resolve, dirname } = require("path");

const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, "../serviceAccountKey.json"), "utf8")
);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function normalizeMotion(motion, hand) {
  if (!motion) return undefined;
  const { color: _legacyColor, ...rest } = motion;
  return { ...rest, hand };
}

function normalizeStep(step) {
  const motions = step?.motions;
  if (!motions) return step;
  const left = motions.left ?? motions.blue;
  const right = motions.right ?? motions.red;
  return {
    ...step,
    leftReversal: step.leftReversal ?? step.blueReversal ?? false,
    rightReversal: step.rightReversal ?? step.redReversal ?? false,
    motions: {
      ...(left && { left: normalizeMotion(left, "left") }),
      ...(right && { right: normalizeMotion(right, "right") }),
    },
    blueReversal: undefined,
    redReversal: undefined,
  };
}

async function main() {
  const idx = JSON.parse(
    readFileSync(
      resolve(__dirname, "../static/data/mandala-index.json"),
      "utf8"
    )
  );

  // orbitKey → total pathway count across all its glyphs (for a "twin" badge).
  const orbitGlyphCount = {};
  for (const [ok, shapeKeys] of Object.entries(idx.byOrbit)) {
    orbitGlyphCount[ok] = shapeKeys.length;
  }

  const entries = Object.entries(idx.byShape); // [shapeKey, refs[]]
  console.log(`Fetching ${entries.length} representative sequences...`);

  const glyphs = [];
  for (const [shapeKey, refs] of entries) {
    const rep = refs[0];
    const snap = await db
      .doc(`catalogs/${rep.deck}/sequences/${rep.seqId}`)
      .get();
    if (!snap.exists) {
      console.warn(`  missing ${rep.deck}/${rep.seqId} — skipped`);
      continue;
    }
    const seq = snap.data();
    if (!seq.steps || seq.steps.length === 0) continue;
    glyphs.push({
      shapeKey,
      word: rep.word,
      count: refs.length, // pathways collapsing to this glyph
      decks: [...new Set(refs.map((r) => r.deck))].length,
      orbitKey: rep.orbitKey,
      orbitGlyphs: orbitGlyphCount[rep.orbitKey] ?? 1, // distinct glyphs in this orbit
      steps: seq.steps.map(normalizeStep),
    });
  }

  glyphs.sort((a, b) => b.count - a.count);

  const out = { version: 1, total: glyphs.length, glyphs };
  const outPath = resolve(__dirname, "../static/data/mandala-glyphs.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out));
  console.log(`Wrote ${glyphs.length} glyphs → ${outPath}`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
