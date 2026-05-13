/**
 * Backfill `encoded` field for specific shortcode docs.
 *
 * Reads source sequence from users/{ownerId}/sequences/{sequenceId},
 * runs SequenceEncoder to generate the "s~..." blob, updates the doc.
 *
 * Usage:
 *   node scripts/backfill-shortcode-encoded-targeted.js NYKN TPRE HUDY ...
 */

import { initFirestore } from "./lib/firestore-provider.js";

// Inline encoder: produces the pipe-delimited format + LZ compression.
// We can't easily import the TypeScript SequenceEncoder from a .js script,
// so we encode manually using the same format.

const LOC_MAP = { n: "no", ne: "ne", e: "ea", se: "se", s: "so", sw: "sw", w: "we", nw: "nw" };
const ORI_MAP = { in: "i", out: "o", cw: "c", ccw: "x" };
const ROT_MAP = { cw: "c", ccw: "x", no_rotation: "n" };
const TYPE_MAP = {
  pro: "p", anti: "a", static: "s", dash: "d", float: "f",
  pro_isolation: "P", anti_isolation: "A",
};
const PROP_MAP = {
  staff: "S", fan: "F", club: "C", triad: "T", hand: "X",
  bigstaff: "s", bigfan: "f", bigclub: "c", bigtriad: "t",
  simplestaff: "s",
};

function encodeLoc(loc) {
  if (!loc) return "no";
  return LOC_MAP[loc.toLowerCase()] || loc.slice(0, 2).toLowerCase();
}

function encodeOri(ori) {
  if (!ori) return "i";
  return ORI_MAP[ori.toLowerCase()] || ori.charAt(0).toLowerCase();
}

function encodeRot(rot) {
  if (!rot) return "n";
  return ROT_MAP[rot.toLowerCase()] || "n";
}

function encodeType(type) {
  if (!type) return "s";
  return TYPE_MAP[type.toLowerCase()] || type.charAt(0).toLowerCase();
}

function encodeTurns(turns) {
  const t = Number(turns);
  if (isNaN(t) || t === 0) return "0";
  if (t === 0.5) return "h";
  if (t === 1) return "1";
  if (t === 1.5) return "H";
  if (t === 2) return "2";
  if (t === 2.5) return "q";
  if (t === 3) return "3";
  return String(t);
}

function encodeProp(propType) {
  if (!propType) return "S";
  return PROP_MAP[propType.toLowerCase()] || "S";
}

function encodeMotion(motion, propType) {
  if (!motion) return "nonoinc0sS";
  const sl = encodeLoc(motion.startLocation || motion.startLoc);
  const el = encodeLoc(motion.endLocation || motion.endLoc);
  const so = encodeOri(motion.startOrientation || motion.startOri);
  const eo = encodeOri(motion.endOrientation || motion.endOri);
  const rd = encodeRot(motion.rotationDirection || motion.propRotDir);
  const tu = encodeTurns(motion.turns);
  const mt = encodeType(motion.motionType);
  const pt = encodeProp(propType);
  return `${sl}${el}${so}${eo}${rd}${tu}${mt}${pt}`;
}

function encodeSequence(sourceData) {
  const parts = [];

  // Start position
  const startPos = sourceData.startPosition || sourceData.startingPosition;
  if (startPos) {
    const motions = startPos.motions || {};
    const blue = motions.blue || {};
    const red = motions.red || {};
    const propType = sourceData.propType || "staff";
    parts.push(`${encodeMotion(blue, propType)}${encodeMotion(red, propType)}`);
  }

  // Steps/beats
  const steps = sourceData.beats || sourceData.steps || [];
  const sortedSteps = [...steps].sort((a, b) => {
    const aNum = a.beatNumber ?? a.stepNumber ?? 0;
    const bNum = b.beatNumber ?? b.stepNumber ?? 0;
    return aNum - bNum;
  });

  for (const step of sortedSteps) {
    const num = step.beatNumber ?? step.stepNumber ?? 0;
    if (num < 1) continue;

    const motions = step.motions || {};
    const blue = motions.blue || step.blueMotion || {};
    const red = motions.red || step.redMotion || {};
    const propType = sourceData.propType || "staff";
    parts.push(`${encodeMotion(blue, propType)}${encodeMotion(red, propType)}`);
  }

  return parts.join("|");
}

async function loadFflate() {
  try {
    return await import("fflate");
  } catch {
    console.error("fflate not available. Run: pnpm add fflate");
    process.exit(1);
  }
}

async function main() {
  const codes = process.argv.slice(2);
  if (codes.length === 0) {
    console.error("Usage: node scripts/backfill-shortcode-encoded-targeted.js <code1> [code2] ...");
    process.exit(1);
  }

  const fflate = await loadFflate();

  const { db } = await initFirestore();
  console.log(`Backfilling encoded field for ${codes.length} shortcodes\n`);

  for (const code of codes) {
    process.stdout.write(`${code}... `);

    const docRef = db.collection("shortcodes").doc(code);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      console.log("NOT FOUND");
      continue;
    }

    const data = docSnap.data();
    if (data.encoded) {
      console.log(`already has encoded (${data.encoded.length} chars)`);
      continue;
    }

    // Load source sequence
    const { ownerId, sequenceId, sequence: word } = data;
    let sourceData = null;

    if (ownerId && sequenceId) {
      try {
        const sourceRef = db.doc(`users/${ownerId}/sequences/${sequenceId}`);
        const sourceSnap = await sourceRef.get();
        if (sourceSnap.exists) {
          sourceData = sourceSnap.data();
        }
      } catch (e) {
        console.log(`(source load failed: ${e.message})`);
      }
    }

    if (!sourceData && sequenceId) {
      try {
        const pubRef = db.collection("publicSequences").doc(sequenceId);
        const pubSnap = await pubRef.get();
        if (pubSnap.exists) {
          sourceData = pubSnap.data();
          // publicSequences might have sourceRef pointing to the full doc
          if (sourceData.sourceRef && !sourceData.beats && !sourceData.steps) {
            const fullSnap = await db.doc(sourceData.sourceRef).get();
            if (fullSnap.exists) sourceData = fullSnap.data();
          }
        }
      } catch (e) {
        console.log(`(public index load failed: ${e.message})`);
      }
    }

    if (!sourceData) {
      console.log("NO SOURCE DATA");
      continue;
    }

    // Encode
    const pipeEncoded = encodeSequence(sourceData);
    if (!pipeEncoded || pipeEncoded.length === 0) {
      console.log("ENCODE FAILED (empty)");
      continue;
    }

    // Compress with fflate (deflate-raw + base64url)
    const raw = new TextEncoder().encode(pipeEncoded);
    const compressed = fflate.deflateSync(raw);
    let encoded;
    if (compressed.length >= raw.length) {
      encoded = `s~raw:${pipeEncoded}`;
    } else {
      let binary = "";
      for (let i = 0; i < compressed.length; i++) {
        binary += String.fromCharCode(compressed[i]);
      }
      const b64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      encoded = `s~d1:${b64}`;
    }

    // Output the encoded value (update via Firebase MCP if client SDK lacks write perms)
    console.log(`ENCODED (${encoded.length} chars)`);
    console.log(`  ${code}=${encoded}`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
