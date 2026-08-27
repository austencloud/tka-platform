/**
 * Generate a scannable QR code for a sequence, headlessly (no browser).
 *
 * Resolves "sequence X" → short code → styled SVG QR → opens it locally.
 * Mirrors the app's QR branding (src/lib/shared/qr/services/qr-code-generator.ts
 * "modern" preset + center play badge) but runs in Node via jsdom, because the
 * in-app generator is browser-gated.
 *
 * Usage:
 *   node scripts/generate-qr.mjs CAKE                  # by word (publicSequences)
 *   node scripts/generate-qr.mjs <sequenceId>          # by publicSequences doc id
 *   node scripts/generate-qr.mjs AB3X                  # existing short code
 *   node scripts/generate-qr.mjs --url https://tka.run/AB3X   # any URL, no Firestore
 *   flags: --out <file.svg>  --no-open  --dark
 *
 * Short-code minting is delegated to scripts/create-shortcodes-batch.js (same
 * Firestore transaction + dedup logic); this script only adds lookup + render.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawn, spawnSync } from "child_process";
import { createRequire } from "module";
// Node ≥23.6 strips types natively, so the canonical simplifier is importable
// directly — every user-visible word must go through it (simplified-word-display).
import { simplifyRepeatedWord } from "../src/lib/shared/foundation/utils/word-simplifier.ts";

const require = createRequire(import.meta.url);

// Args

const argv = process.argv.slice(2);
const flags = { url: null, out: null, open: true, dark: false };
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--url") flags.url = argv[++i];
  else if (a === "--out") flags.out = argv[++i];
  else if (a === "--no-open") flags.open = false;
  else if (a === "--dark") flags.dark = true;
  else positional.push(a);
}

if (!flags.url && positional.length === 0) {
  console.error(
    "Usage: node scripts/generate-qr.mjs <word|sequenceId|shortCode> [--out file.svg] [--no-open] [--dark]\n" +
      "       node scripts/generate-qr.mjs --url <anyUrl> [--out file.svg] [--no-open]"
  );
  process.exit(1);
}

const input = positional.join(" ").trim();

// Resolve input → https://tka.run/{CODE} (unless --url given)

const CODE_RE = /^[0-9A-Z]{4,6}$/;

async function resolveToUrl() {
  if (flags.url) return { url: flags.url, label: flags.url };

  // Already a tka.run URL?
  const urlMatch = /tka\.run\/(?:q\/)?([0-9A-Za-z]{4,6})/.exec(input);
  if (urlMatch) {
    const code = urlMatch[1].toUpperCase();
    return { url: `https://tka.run/${code}`, label: code };
  }

  const { initFirestore } = await import("./lib/firestore-provider.js");
  const { db } = await initFirestore();

  // Existing short code?
  if (CODE_RE.test(input.toUpperCase())) {
    const code = input.toUpperCase();
    const snap = await db.collection("shortcodes").doc(code).get();
    if (snap.exists) {
      const word = simplifyRepeatedWord(snap.data()?.sequence || code);
      console.log(`Short code ${code} exists (word: ${word}) — reusing it.`);
      return { url: `https://tka.run/${code}`, label: `${word} (${code})` };
    }
  }

  // Word candidates: verbatim plus repeated forms (LOOP words are stored
  // expanded — user says "FΨ", the stored word may be "FΨFΨFΨFΨ").
  const candidates = [input, input.repeat(2), input.repeat(3), input.repeat(4)];

  // A shortcode for this word may already exist — including for sequences that
  // live ONLY as embedded sequenceData on the shortcode doc (deck/VTG codes
  // have no publicSequences entry at all). Reusing it also avoids minting a
  // duplicate code for a word that's already scannable.
  const byWordCode = await db
    .collection("shortcodes")
    .where("sequence", "in", candidates)
    .limit(5)
    .get();
  if (!byWordCode.empty) {
    const doc = byWordCode.docs[0];
    const word = simplifyRepeatedWord(doc.data()?.sequence || input);
    if (byWordCode.size > 1) {
      console.log(`Note: ${byWordCode.size} shortcodes exist for "${word}". Using ${doc.id}; others:`);
      byWordCode.docs.slice(1).forEach((d) => console.log(`  ${d.id}`));
    }
    console.log(`Existing shortcode for word "${word}" — reusing ${doc.id}.`);
    return { url: `https://tka.run/${doc.id}`, label: `${word} (${doc.id})` };
  }

  // publicSequences by doc id
  let seqId = null;
  let word = input;
  const byId = await db.collection("publicSequences").doc(input).get();
  if (byId.exists) {
    seqId = byId.id;
    word = byId.data()?.word || input;
  }

  // publicSequences by word
  if (!seqId) {
    const byWord = await db
      .collection("publicSequences")
      .where("word", "in", candidates)
      .get();
    if (!byWord.empty) {
      seqId = byWord.docs[0].id;
      word = byWord.docs[0].data()?.word || input;
      if (byWord.size > 1) {
        console.log(
          `Note: ${byWord.size} public sequences share word "${word}". Using ${seqId}; others:`
        );
        byWord.docs.slice(1).forEach((d) => console.log(`  ${d.id}`));
      }
    }
  }

  // by name field
  if (!seqId) {
    const byName = await db
      .collection("publicSequences")
      .where("name", "==", input)
      .get();
    if (!byName.empty) {
      seqId = byName.docs[0].id;
      word = byName.docs[0].data()?.word || input;
    }
  }

  if (!seqId) {
    throw new Error(
      `No public sequence found for "${input}" (tried doc id, word, repeated word, name). ` +
        `If it lives only in a user library, publish it first or pass --url.`
    );
  }

  // Mint or reuse the short code via the existing batch script (same
  // transaction/dedup logic; don't duplicate it here).
  word = simplifyRepeatedWord(word);
  console.log(`Resolved "${input}" → publicSequences/${seqId} (word: ${word})`);
  const res = spawnSync(
    process.execPath,
    ["scripts/create-shortcodes-batch.js", seqId],
    { encoding: "utf8", cwd: process.cwd() }
  );
  const out = `${res.stdout || ""}${res.stderr || ""}`;
  const codeMatch = /https:\/\/tka\.run\/([0-9A-Z]{4,6})/.exec(out);
  if (!codeMatch) {
    throw new Error(`Short code minting failed:\n${out.trim()}`);
  }
  const code = codeMatch[1];
  return { url: `https://tka.run/${code}`, label: `${word} (${code})` };
}

// Render — mirrors createQROptions() in qr-code-generator.ts ("modern" preset)

/**
 * Center play badge, same geometry as playIconDataUrl() in qr-code-generator.ts.
 * The in-app generator embeds it via qr-code-styling's `image` option, but that
 * path needs the native `canvas` module in Node (jsdom alone never fires the
 * image load). Since the QR output is SVG anyway, composite the badge directly:
 * the opaque circle occludes the modules beneath it exactly like
 * hideBackgroundDots does visually, and errorCorrectionLevel "H" keeps the
 * code scannable — the same contract the app relies on.
 */
function injectPlayBadge(svgText, size, moduleColor) {
  const light = /^#?(f|e|d)/i.test(moduleColor);
  const badge = light ? "#1a1a2e" : "#ffffff";
  const d = size * 0.23; // badge diameter ≈ app's imageSize 0.25 minus its margin
  const scale = d / 100;
  const offset = (size - d) / 2;
  const badgeGroup =
    `<g transform="translate(${offset} ${offset}) scale(${scale})">` +
    `<circle cx="50" cy="50" r="50" fill="${badge}"/>` +
    `<path d="M35 24 L35 76 L80 50 Z" fill="#22c55e" ` +
    `stroke="#22c55e" stroke-width="6" stroke-linejoin="round"/>` +
    `</g>`;
  return svgText.replace("</svg>", `${badgeGroup}</svg>`);
}

async function renderSvg(url) {
  const { JSDOM } = require("jsdom");
  const qrMod = require("qr-code-styling/lib/qr-code-styling.common.js");
  const QRCodeStyling = qrMod.QRCodeStyling || qrMod.default || qrMod;

  const color = flags.dark ? "#ffffff" : "#1a1a2e";
  const background = flags.dark ? "#00000000" : "#ffffff";

  const options = {
    jsdom: JSDOM,
    type: "svg",
    width: 1024,
    height: 1024,
    data: url,
    margin: 24,
    qrOptions: { typeNumber: 0, mode: "Byte", errorCorrectionLevel: "H" },
    dotsOptions: { color, type: "rounded" },
    cornersSquareOptions: { color, type: "extra-rounded" },
    cornersDotOptions: { color, type: "dot" },
    backgroundOptions: { color: background },
  };

  const qr = new QRCodeStyling(options);
  const raw = await qr.getRawData("svg");
  if (!raw) throw new Error("getRawData returned empty");
  let svgText = typeof raw === "string" ? raw : raw.toString("utf-8");
  // qr-code-styling emits clip-path="url('#id')" — the single quotes break
  // strict SVG consumers (Windows Photos, resvg). Browsers accept both forms.
  svgText = svgText.replace(/url\('#([^']+)'\)/g, "url(#$1)");
  return injectPlayBadge(svgText, 1024, color);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { url, label } = await resolveToUrl();
  const svg = await renderSvg(url);

  const code = /tka\.run\/([0-9A-Z]{4,6})/.exec(url)?.[1] || "qr";
  const outPath =
    flags.out || join(tmpdir(), "tka-qr", `${code}.svg`);
  mkdirSync(join(outPath, ".."), { recursive: true });
  writeFileSync(outPath, svg);

  console.log(`\nQR for: ${label}`);
  console.log(`URL:    ${url}`);
  console.log(`File:   ${outPath}`);

  if (flags.open) {
    // Windows default handler (browser/image viewer)
    spawn("cmd", ["/c", "start", "", outPath], {
      detached: true,
      stdio: "ignore",
      windowsVerbatimArguments: false,
    }).unref();
    console.log("Opened in default viewer.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err.message || err);
  process.exit(1);
});
