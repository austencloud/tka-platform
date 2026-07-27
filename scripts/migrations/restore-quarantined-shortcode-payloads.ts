/**
 * Restore embedded payload copies for the PAYLOAD_INCOMPLETE quarantine
 * (parity-repair spec follow-up, 2026-07-27).
 *
 * These are blob-only mints whose legacy wire slot carries the float's own
 * noRotation — the mint-era encoder never read prefloat fields, so the wire
 * physically destroyed the float beats' letter information. The blob's OTHER
 * columns (locations, rotations, turns, both channels) survived intact: for
 * every word-labeled record in the class, the strict derivation spells the
 * stored label perfectly at every derivable beat, with gaps exactly at the
 * floats.
 *
 * The repair restores the record's EMBEDDED payload copy from its own blob
 * decode — the same dual-source shape every source mint carries — so the
 * embedded channel's canonical semantics apply. Letters come from, in
 * preference order:
 *
 *   1. the canonical alternatives lookup (`floatAlternatives: true`, the
 *      qCE8jd-class semantics) wherever it reproduces the label's letter —
 *      witness-validated: the lookup alone is only ~50% right on destroyed
 *      floats (287/579 witness beats), so agreement with the label is the
 *      per-beat proof, not the lookup itself;
 *   2. the mint-time label's letter at that position, STAMPED as stored
 *      testimony, where the lookup disagrees. The label is the only
 *      surviving projection of the destroyed letters, and it is
 *      corroborated positionally by every derivable beat.
 *
 * Witness sources, most direct first:
 *   - FULL label: token count equals the beat count and every derivable
 *     beat matches its token — the gap's token is the witness.
 *   - PERIODIC label (old 6-char truncated labels, e.g. "LEAΩ-R" on a
 *     24-beat ×4 LOOP): the derivable letters must be strictly periodic and
 *     match the label prefix; a gap's witness is its period-class token.
 *   - SIBLING label (auto-named records): an explicitly listed content
 *     sibling whose motion signatures are beat-for-beat identical lends its
 *     reviewed full-form label (0XHN ≡ seed half of 5247).
 *
 * A record with any gap that has NO witness, any non-float gap, or any
 * misaligned derivable beat is left untouched and reported RESIDUAL.
 * `encoded`, `encoderHash`, and hash claims are never touched — the blob
 * stays byte-identical, so the R2 snapshot and offline scans are unaffected.
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/restore-quarantined-shortcode-payloads.ts             # dry-run
 *   TKA_ADMIN=1 npx tsx scripts/migrations/restore-quarantined-shortcode-payloads.ts --apply
 *   TKA_ADMIN=1 npx tsx scripts/migrations/restore-quarantined-shortcode-payloads.ts --only 0KUH,7FJ8
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { initFirestore } from "../lib/firestore-provider.js";
import {
  contentStepsOf,
  deriveFromSteps,
  letterForBeat,
  PAYLOAD_SCHEMA_VERSION,
  type AnyRec,
} from "./lib/shortcode-derivation";
import { decodeSequenceFromQR } from "../../src/lib/shared/navigation/services/sequence-encoder";

const APPLY = process.argv.includes("--apply");
const ONLY = (() => {
  const i = process.argv.indexOf("--only");
  return i >= 0 && process.argv[i + 1]
    ? new Set(process.argv[i + 1]!.split(","))
    : null;
})();

const BASELINE_PATH = join(
  "scripts",
  "diagnostics",
  "parity-audit-baseline.json"
);
const WORD_SHAPE = /^[A-ZΑ-Ωα-ω-]+$/u;
const TOKEN = /[A-ZΑ-Ωα-ω]-?/gu;

/** Auto-named records whose gap letters are witnessed by a content sibling:
 *  every beat's motion signature must match the sibling's beat at the same
 *  index, and the sibling's label must be full-form. Extend only with the
 *  signature proof in hand. */
const SIBLING_WITNESS: Record<string, string> = {
  // 0XHN is the seed half of 5247 (verified beat-for-beat identical
  // signatures, 2026-07-27); 5247's reviewed label lends its first 5 tokens.
  "0XHN": "5247",
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

interface Motionish {
  motionType?: string;
  startLocation?: string;
  endLocation?: string;
  rotationDirection?: string;
  turns?: unknown;
  gridMode?: string;
  prefloatMotionType?: string;
}

const motionsOf = (step: AnyRec) =>
  (step.motions ?? {}) as { blue?: Motionish; red?: Motionish };

const isPrefloatlessFloat = (m?: Motionish) =>
  String(m?.motionType ?? "").toLowerCase() === "float" &&
  !m?.prefloatMotionType;

const signature = (step: AnyRec): string => {
  const m = motionsOf(step);
  const one = (mm?: Motionish) =>
    [
      mm?.motionType,
      mm?.startLocation,
      mm?.endLocation,
      mm?.rotationDirection,
      String(mm?.turns),
    ].join("/");
  return `B:${one(m.blue)} R:${one(m.red)}`;
};

/** Smallest divisor p of n under which every mod-p class of positions holds
 *  at most one distinct non-null letter. Returns null if none. */
function findPeriod(letters: (string | null)[]): number | null {
  const n = letters.length;
  for (let p = 1; p < n; p++) {
    if (n % p !== 0) continue;
    let ok = true;
    for (let c = 0; c < p && ok; c++) {
      let seen: string | null = null;
      for (let i = c; i < n; i += p) {
        const l = letters[i];
        if (l === null || l === undefined) continue;
        if (seen === null) seen = l;
        else if (seen !== l) {
          ok = false;
          break;
        }
      }
    }
    if (ok) return p;
  }
  return null;
}

interface Plan {
  code: string;
  witnessSource: "full-label" | "periodic-label" | "sibling-label";
  expectedWord: string;
  stampedIndexes: number[];
  stampedLetters: string[];
  agreedGaps: number[];
  stepCount: number;
  storedLabel: string;
  evidence: string;
}

async function main(): Promise<void> {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as {
    quarantined: Record<string, string>;
  };
  let codes = Object.keys(baseline.quarantined);
  if (ONLY) codes = codes.filter((c) => ONLY.has(c));

  const { db, sdk, isAdmin } = (await initFirestore()) as AnyRec & {
    db: AnyRec;
    sdk: string;
    isAdmin: boolean;
  };
  if (!isAdmin) throw new Error("run with TKA_ADMIN=1");
  console.log(
    `via ${sdk} — ${APPLY ? "APPLY" : "DRY-RUN"} — ${codes.length} quarantined code(s)`
  );

  const docOf = async (code: string) => {
    const ref = (db.collection as (p: string) => AnyRec)("shortcodes")["doc"](
      code
    ) as AnyRec;
    const snap = await (ref["get"] as () => Promise<AnyRec>)();
    if (!(snap.exists as boolean)) return null;
    return { ref, data: (snap.data as () => AnyRec)() };
  };

  const plans: Array<Plan & { ref: AnyRec; embed: AnyRec; previous: AnyRec }> =
    [];
  const residuals: Array<{ code: string; reason: string }> = [];

  for (const code of codes) {
    const doc = await docOf(code);
    if (!doc) {
      residuals.push({ code, reason: "DOC_MISSING" });
      continue;
    }
    const { ref, data } = doc;
    if (data.sequenceData) {
      residuals.push({ code, reason: "HAS_EMBED_ALREADY — refusing to clobber" });
      continue;
    }
    if (typeof data.encoded !== "string" || !data.encoded) {
      residuals.push({ code, reason: "NO_BLOB" });
      continue;
    }

    let decoded: AnyRec;
    try {
      decoded = (await decodeSequenceFromQR(data.encoded)) as unknown as AnyRec;
    } catch (e) {
      residuals.push({
        code,
        reason: `DECODE_FAILED — ${String(e).slice(0, 100)}`,
      });
      continue;
    }
    const rawSteps = (decoded.steps ?? []) as AnyRec[];
    const content = contentStepsOf(rawSteps);
    const n = content.length;
    const startPosition = decoded.startPosition as AnyRec | undefined;
    if (n === 0 || !startPosition) {
      residuals.push({ code, reason: "EMPTY_DECODE" });
      continue;
    }

    const strict = content.map((s) => letterForBeat(s));
    const alt = content.map((s) => letterForBeat(s, { floatAlternatives: true }));
    const gaps = strict.flatMap((l, i) => (l === null ? [i] : []));
    if (gaps.length === 0) {
      residuals.push({ code, reason: "NO_GAPS — not this defect class" });
      continue;
    }

    // Every gap must be legacy float damage — anything else is a different
    // defect (P9LY's mirrored-rotation corruption, 3CLR's non-alphabet beats)
    // and gets its own treatment, never a letter stamp.
    const nonFloatGaps = gaps.filter((i) => {
      const m = motionsOf(content[i]!);
      return !isPrefloatlessFloat(m.blue) && !isPrefloatlessFloat(m.red);
    });
    if (nonFloatGaps.length > 0) {
      residuals.push({
        code,
        reason: `NON_FLOAT_GAPS at ${nonFloatGaps.join(",")} — not float damage`,
      });
      continue;
    }

    const storedLabel = String(
      data.payloadWord ?? data.sequenceName ?? data.sequence ?? ""
    );
    const labelIsWord = storedLabel.length > 0 && WORD_SHAPE.test(storedLabel);

    // ── determine the witness letter for every gap ──────────────────────────
    let witnessSource: Plan["witnessSource"];
    let witnessTokens: string[]; // aligned to positions 0..n-1 where known
    let evidence: string;

    if (labelIsWord) {
      const tokens = storedLabel.match(TOKEN) ?? [];
      if (tokens.length === n) {
        // FULL label: positional identity, corroborated by every derivable beat.
        const misaligned = strict.flatMap((l, i) =>
          l !== null && l !== tokens[i] ? [i] : []
        );
        if (misaligned.length > 0) {
          residuals.push({
            code,
            reason: `MISALIGNED derivable beats ${misaligned.join(",")} vs label`,
          });
          continue;
        }
        witnessSource = "full-label";
        witnessTokens = tokens as string[];
        evidence = `${n - gaps.length} derivable beats all match the ${n}-token label`;
      } else if (tokens.length < n) {
        // PERIODIC label (truncated-display era): derivable letters must be
        // strictly periodic and match the label prefix positionally.
        const p = findPeriod(strict);
        if (p === null) {
          residuals.push({
            code,
            reason: `LABEL_SHORTER (${tokens.length} tokens vs ${n} beats) and derivable letters not periodic`,
          });
          continue;
        }
        const prefixMisaligned = strict.flatMap((l, i) =>
          i < tokens.length && l !== null && l !== tokens[i] ? [i] : []
        );
        if (prefixMisaligned.length > 0) {
          residuals.push({
            code,
            reason: `PREFIX_MISALIGNED at ${prefixMisaligned.join(",")}`,
          });
          continue;
        }
        witnessTokens = Array.from({ length: n }, (_, i) => {
          const cls = i % p;
          // Prefer any derivable letter in the class, else the label token.
          for (let j = cls; j < n; j += p) {
            if (strict[j] !== null) return strict[j]!;
          }
          return cls < tokens.length ? (tokens[cls] as string) : "";
        });
        if (witnessTokens.some((t) => t === "")) {
          residuals.push({
            code,
            reason: `PERIODIC_GAP_UNWITNESSED (period ${p}, label ${tokens.length} tokens)`,
          });
          continue;
        }
        witnessSource = "periodic-label";
        evidence = `derivable letters ${p}-periodic across ${n} beats; label prefix (${tokens.length} tokens) matches positionally`;
      } else {
        residuals.push({
          code,
          reason: `LABEL_LONGER (${tokens.length} tokens vs ${n} beats)`,
        });
        continue;
      }
    } else if (SIBLING_WITNESS[code]) {
      const sibCode = SIBLING_WITNESS[code]!;
      const sib = await docOf(sibCode);
      if (!sib) {
        residuals.push({ code, reason: `SIBLING ${sibCode} missing` });
        continue;
      }
      const sibLabel = String(
        sib.data.payloadWord ?? sib.data.sequenceName ?? sib.data.sequence ?? ""
      );
      const sibTokens = (sibLabel.match(TOKEN) ?? []) as string[];
      let sibContent: AnyRec[];
      try {
        const sibDecoded = (await decodeSequenceFromQR(
          String(sib.data.encoded)
        )) as unknown as AnyRec;
        sibContent = contentStepsOf((sibDecoded.steps ?? []) as AnyRec[]);
      } catch {
        residuals.push({ code, reason: `SIBLING ${sibCode} decode failed` });
        continue;
      }
      if (
        sibTokens.length !== sibContent.length ||
        sibContent.length < n ||
        !WORD_SHAPE.test(sibLabel)
      ) {
        residuals.push({
          code,
          reason: `SIBLING ${sibCode} label not full-form (${sibTokens.length} tokens, ${sibContent.length} beats)`,
        });
        continue;
      }
      const sigMismatch = content.flatMap((s, i) =>
        signature(s) !== signature(sibContent[i]!) ? [i] : []
      );
      if (sigMismatch.length > 0) {
        residuals.push({
          code,
          reason: `SIBLING ${sibCode} signature mismatch at ${sigMismatch.join(",")}`,
        });
        continue;
      }
      witnessSource = "sibling-label";
      witnessTokens = sibTokens.slice(0, n);
      evidence = `all ${n} motion signatures identical to ${sibCode}[0..${n - 1}], whose full-form label lends the letters`;
    } else {
      residuals.push({
        code,
        reason: `NO_WITNESS — label ${JSON.stringify(storedLabel)} is not a word and no sibling listed`,
      });
      continue;
    }

    // ── stamp plan: label testimony only where the canonical lookup fails ───
    const stampedIndexes: number[] = [];
    const stampedLetters: string[] = [];
    const agreedGaps: number[] = [];
    for (const i of gaps) {
      const witness = witnessTokens[i]!;
      if (alt[i] === witness) {
        agreedGaps.push(i);
      } else {
        stampedIndexes.push(i);
        stampedLetters.push(witness);
      }
    }
    const expectedWord = strict
      .map((l, i) => l ?? witnessTokens[i]!)
      .join("");

    // ── build + gate the embed ──────────────────────────────────────────────
    const embedSteps = content.map((s, i) => {
      const step = clone(s);
      step.stepNumber = i + 1;
      const at = stampedIndexes.indexOf(i);
      if (at >= 0) step.letter = stampedLetters[at]!;
      return step;
    });
    const derived = deriveFromSteps(embedSteps, "embedded");
    if (!derived.complete || derived.word !== expectedWord) {
      residuals.push({
        code,
        reason: `GATE_FAILED — embed derives ${JSON.stringify(derived.word)} (complete ${derived.complete}), expected ${JSON.stringify(expectedWord)}`,
      });
      continue;
    }

    const gridModes = new Set(
      embedSteps.flatMap((s) => {
        const m = motionsOf(s);
        return [m.blue?.gridMode, m.red?.gridMode].filter(Boolean) as string[];
      })
    );
    const embed: AnyRec = {
      word: expectedWord,
      isCircular: decoded.isCircular === true,
      ...(gridModes.size === 1 ? { gridMode: [...gridModes][0] } : {}),
      startPosition: clone(startPosition),
      steps: embedSteps,
    };

    plans.push({
      code,
      witnessSource,
      expectedWord,
      stampedIndexes,
      stampedLetters,
      agreedGaps,
      stepCount: n,
      storedLabel,
      evidence,
      ref,
      embed,
      previous: {
        payloadWord: data.payloadWord ?? null,
        payloadStepCount: data.payloadStepCount ?? null,
        payloadSchemaVersion: data.payloadSchemaVersion ?? null,
        sequenceName: data.sequenceName ?? null,
        sequence: data.sequence ?? null,
        hadSequenceData: false,
      },
    });
  }

  // ── report ────────────────────────────────────────────────────────────────
  console.log(`\n════ PLANS (${plans.length}) ════`);
  for (const p of plans) {
    const relabel =
      p.storedLabel === p.expectedWord
        ? ""
        : ` — label ${JSON.stringify(p.storedLabel)} → ${JSON.stringify(p.expectedWord)}`;
    console.log(
      `  ${APPLY ? "✅" : "· "} ${p.code} [${p.witnessSource}] "${p.expectedWord}"` +
        ` — ${p.stampedIndexes.length} stamped (${p.stampedIndexes.join(",") || "none"}), ` +
        `${p.agreedGaps.length} gap(s) already canonical${relabel}`
    );
    console.log(`       ${p.evidence}`);
  }
  console.log(`\n════ RESIDUALS (${residuals.length}) ════`);
  for (const r of residuals) console.log(`  ⚠️  ${r.code}: ${r.reason}`);

  if (!APPLY) {
    console.log("\ndry-run — re-run with --apply to write.");
    process.exit(0);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(
    "scripts",
    "migrations",
    "backups",
    `restore-quarantined-payloads-${stamp}.json`
  );
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        repair:
          "embedded payload restored from own blob decode; float-gap letters from canonical lookup where it matches the label witness, else stamped label testimony",
        plans: plans.map(({ ref: _r, embed: _e, ...rest }) => rest),
        residuals,
      },
      null,
      2
    )
  );
  console.log(`backup: ${backupPath}`);

  for (const p of plans) {
    await (p.ref["update"] as (u: AnyRec) => Promise<unknown>)({
      sequenceData: p.embed,
      payloadWord: p.expectedWord,
      payloadStepCount: p.stepCount,
      payloadSchemaVersion: PAYLOAD_SCHEMA_VERSION,
      sequenceName: p.expectedWord,
      sequence: p.expectedWord,
    });
    console.log(`  ✅ ${p.code} written`);
  }
  console.log(`${plans.length} record(s) restored; ${residuals.length} residual(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
