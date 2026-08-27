#!/usr/bin/env node
/**
 * beat-rename-audit.mjs
 *
 * Classifies every `beat` token in a TypeScript/Svelte file per the
 * beat→step rename spec at `docs/superpowers/specs/2026-04-20-beat-to-step-rename-design.md`.
 *
 * Usage:
 *   node scripts/beat-rename-audit.mjs <file-or-glob>
 *
 * Output:
 *   JSON array to stdout: [{ file, line, identifier, classification, reason }]
 *
 * Classification values:
 *   - RENAME : the identifier describes a sequence step; rename to step*
 *   - KEEP   : the identifier describes a musical beat / audio tick
 *   - REVIEW : ambiguous; human must decide, add TODO comment
 *
 * Exit codes:
 *   0 on success
 *   1 on I/O error or no files matched
 */
// @ts-check

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { glob } from "node:fs/promises";

// Rule 1 — File-path KEEP zones (musical / BPM / audio / video)
const KEEP_PATHS = [
  "src/lib/features/compose/",
  "src/lib/features/video/",
  "src/lib/shared/video-collaboration/",
  "src/lib/shared/sequence-viewer/components/beat-mapping/",
  "src/lib/shared/device-sync/",
];

const KEEP_FILENAME_PATTERNS = [
  /(^|\/)bpm-[^/]+$/i,
  /[A-Z][a-z]*Bpm/,
  /AudioState/,
  /AudioStorage/,
  /metronome/i,
  /tempo/i,
];

// Named-exception files: live under a KEEP path but every beat* is RENAME
const NAMED_RENAME_EXCEPTIONS = [
  "src/lib/features/compose/services/implementations/AnimationPlaybackController.ts",
  "src/lib/features/compose/services/contracts/IAnimationPlaybackController.ts",
  "src/lib/features/compose/services/implementations/AnimationPlaybackControllerFactory.ts",
  "src/lib/features/compose/services/contracts/IAnimationPlaybackControllerFactory.ts",
];

// Rule 2 — File-path RENAME zones (sequence domain)
const RENAME_PATHS = [
  "packages/sequence-engine/",
  "packages/tka-types/",
  "packages/domain/",
  "packages/render-core/",
  "packages/render-composition/",
  "packages/pictograph/",
  "packages/animation-renderer/",
  "src/lib/features/create/",
  "src/lib/features/browse/",
  "src/lib/features/library/",
  "src/lib/features/gallery-generator/",
  "src/lib/features/choreo-card/",
  "src/lib/features/fuse/",
  "src/lib/features/write/",
  "src/lib/features/assemble-lab/",
  "src/lib/features/disassemble-lab/",
  "src/lib/features/levels/",
  "src/lib/features/loop-labeler/",
  "src/lib/features/mandala/",
  "src/lib/features/phrase-effort-lab/",
  "src/lib/features/effort-lab/",
  "src/lib/shared/pictograph/",
  "src/lib/shared/sequence-viewer/",
  "src/lib/shared/sequence-",
  "src/lib/shared/render/",
  "src/lib/shared/animation-engine/",
];

// Rule 3 — Identifier-name heuristics
const RENAME_IDENT_TRIGGERS = [
  "beatIndex",
  "beatNumber",
  "beatCount",
  "beatId",
  "beatKey",
  "beatSteps",
  "beatSelection",
  "selectedBeat",
  "currentBeat",
  "totalBeats",
  "BeatData",
  "BeatGridItem",
  "stepHalfBeatForward",
  "stepFullBeatForward",
  "animateToBeat",
  "animateToBeatInternal",
  "jumpToBeat",
  "seekToBeat",
  "getBeatKey",
  "beatStart",
  "beatEnd",
  "getTimePositionForBeat",
  "beatProgress",
];

const KEEP_IDENT_TRIGGERS = [
  "bpm",
  "Bpm",
  "BPM",
  "tempo",
  "Tempo",
  "metronome",
  "Metronome",
  "beatMarker",
  "BeatMarker",
  "globalBeatMarkers",
  "beatsPerMinute",
  "beatsPerMeasure",
  "timeSignature",
  "strongBeat",
  "isStrongBeat",
  "beatSubdivision",
];

// Ambiguity Catalog — spec Section 6
// Each entry describes an identifier pattern and its default action per spec.
// "default" of REVIEW means always flag; "default" of RENAME/KEEP means auto
// after the catalog-documented per-site verification.
const AMBIGUITY_CATALOG = [
  {
    identifier: /^BeatDuration$|^beatDuration$/,
    catalogId: "beatDuration-per-file",
    default: "REVIEW",
    reason:
      "BeatDuration/beatDuration — ambiguous: BPM-derived seconds (KEEP) vs choreographic step duration (RENAME). Per-file decision required.",
  },
  {
    identifier: /^BeatMap$|^beatMap$/,
    catalogId: "beatMap-global-decision",
    default: "KEEP",
    reason:
      "BeatMap/beatMap — Austen's global decision: KEEP (holds video timestamps). Local context may override if clearly sequence-step-map.",
  },
  {
    identifier: /^beatTimestamps$/,
    catalogId: "beatTimestamps-locked-to-beatMap",
    default: "KEEP",
    reason:
      "beatTimestamps — locked to BeatMap decision; video-time anchors.",
  },
  {
    identifier: /^beatOffset$/,
    catalogId: "beatOffset-arrange-musical",
    default: "KEEP",
    reason:
      "beatOffset — per-layer musical offset in arrange/*; KEEP documented in catalog.",
  },
  {
    identifier: /^beatProgress$/,
    catalogId: "beatProgress-interpolation",
    default: "RENAME",
    reason:
      "beatProgress — interpolation factor between steps in all current uses; RENAME to stepProgress.",
  },
  {
    identifier: /^BeatStart$|^beatStart$/,
    catalogId: "beatStart-sequence-domain",
    default: "RENAME",
    reason:
      "BeatStart/beatStart — always sequence-domain in current uses; RENAME to StepStart/stepStart.",
  },
  {
    identifier: /^BeatForward$|^stepHalfBeatForward$|^stepFullBeatForward$/,
    catalogId: "beatForward-transport-subtick",
    default: "RENAME",
    reason:
      "BeatForward — transport sub-tick (half/full step), not music. RENAME to StepForward variant (deprecation alias policy: Austen decides).",
  },
  {
    identifier: /^BeatCount$|^totalBeatCount$/,
    catalogId: "beatCount-per-file-review",
    default: "REVIEW",
    reason:
      "BeatCount/totalBeatCount — per-file review: if compared against sequence.steps.length → RENAME; if music beats → KEEP.",
  },
  {
    identifier: /^getTimePositionForBeat$/,
    catalogId: "getTimePositionForBeat",
    default: "RENAME",
    reason:
      "getTimePositionForBeat — argument is a step index per verified usage; RENAME to getTimePositionForStep.",
  },
  {
    identifier: /^BeatGridItem$/,
    catalogId: "beatGridItem-per-file-review",
    default: "REVIEW",
    reason:
      "BeatGridItem — RENAME in StepGrid/SpotlightGrid/StandardGrid; REVIEW in TimelineGrid (may be BPM tick).",
  },
  {
    identifier: /^beatMarker$|^BeatMarker$|^globalBeatMarkers$/,
    catalogId: "beatMarker-musical",
    default: "KEEP",
    reason:
      "beatMarker/BeatMarker — waveform-placed musical markers; KEEP.",
  },
  {
    identifier: /^currentBeat$/,
    catalogId: "currentBeat-context",
    default: "REVIEW",
    reason:
      "currentBeat — KEEP in arrange-grid-state (music playback clock); RENAME in sequence-step contexts. Per-file review.",
  },
  {
    identifier: /^activeBeatIndex$/,
    catalogId: "activeBeatIndex-video-mapping-exception",
    default: "RENAME",
    reason:
      "activeBeatIndex — index into sequence steps even inside beat-mapping/ KEEP zone; RENAME to activeStepIndex.",
  },
];

// Identifier-token regex
// Matches any identifier containing 'beat' or 'Beat' (case-sensitive on the
// leading 'B'/'b' to avoid matching inside user-facing strings like
// "Beats Per Minute" only when they are wrapped in a quoted literal).
const IDENT_TOKEN_RE = /\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g;
const CONTAINS_BEAT_RE = /beat/i;

/**
 * Decide if an identifier string contains beat/Beat/BEAT in an identifier sense.
 * The identifier must contain the token 'beat' case-insensitively; we filter
 * out identifiers where 'beat' is a coincidental substring (e.g. 'BEATen' has no
 * such real collision in the codebase, but guard anyway).
 */
function identifierContainsBeat(ident) {
  if (!CONTAINS_BEAT_RE.test(ident)) return false;
  // Accept if identifier actually has a b/B followed by 'eat'
  return /[Bb]eat/.test(ident) || /BEAT/.test(ident);
}

function pathStartsWithAny(filePath, prefixes) {
  const normalized = filePath.replace(/\\/g, "/");
  return prefixes.some((p) => normalized.includes(p));
}

function matchesFilenamePattern(filePath, patterns) {
  const normalized = filePath.replace(/\\/g, "/");
  return patterns.some((re) => re.test(normalized));
}

function classifyByAmbiguityCatalog(identifier) {
  for (const entry of AMBIGUITY_CATALOG) {
    if (entry.identifier.test(identifier)) {
      return {
        classification: entry.default,
        reason: entry.reason,
        catalogId: entry.catalogId,
      };
    }
  }
  return null;
}

function classifyByIdentName(identifier) {
  for (const trigger of KEEP_IDENT_TRIGGERS) {
    if (identifier.includes(trigger)) {
      return {
        classification: "KEEP",
        reason: `Rule 3 KEEP: identifier contains '${trigger}' (musical/BPM token).`,
      };
    }
  }
  for (const trigger of RENAME_IDENT_TRIGGERS) {
    if (identifier.includes(trigger)) {
      return {
        classification: "RENAME",
        reason: `Rule 3 RENAME: identifier contains '${trigger}' (sequence-step token).`,
      };
    }
  }
  return null;
}

/**
 * Apply Section 4 decision tree to a single identifier at a single file:line.
 */
function classify({ filePath, identifier, lineContext }) {
  const normalized = filePath.replace(/\\/g, "/");

  // Step 0: named-exception files override all KEEP rules
  if (NAMED_RENAME_EXCEPTIONS.some((p) => normalized.endsWith(p))) {
    // Fall through to Rule 3, then catalog, then default RENAME
    const byName = classifyByIdentName(identifier);
    if (byName?.classification === "KEEP") {
      // Even in named-exception file, musical tokens still KEEP
      return byName;
    }
    const byCatalog = classifyByAmbiguityCatalog(identifier);
    if (byCatalog) return byCatalog;
    return {
      classification: "RENAME",
      reason: "Named-exception file (AnimationPlaybackController family): default RENAME.",
    };
  }

  // Step 1: Rule 1 — file-path KEEP
  const rule1Keep =
    pathStartsWithAny(normalized, KEEP_PATHS) ||
    matchesFilenamePattern(normalized, KEEP_FILENAME_PATTERNS);

  // Step 2: Rule 2 — file-path RENAME
  const rule2Rename = pathStartsWithAny(normalized, RENAME_PATHS);

  // Rule 3 — identifier name heuristic (runs regardless, may override in preserve zones only if catalog/named-rule applies)
  const byName = classifyByIdentName(identifier);
  const byCatalog = classifyByAmbiguityCatalog(identifier);

  if (rule1Keep) {
    // In KEEP zone: default KEEP, but catalog may force REVIEW/RENAME
    if (byCatalog) return byCatalog;
    // Rule 4 (local override simplified): identifier heuristic can escalate to REVIEW if RENAME-trigger hits in KEEP zone
    if (byName?.classification === "RENAME") {
      return {
        classification: "REVIEW",
        reason: `Rule 4 escalation: ${byName.reason} but file is in Rule 1 KEEP zone. Human review required.`,
      };
    }
    return {
      classification: "KEEP",
      reason: "Rule 1 KEEP: file is in a preserved audio/video/BPM path.",
    };
  }

  if (rule2Rename) {
    // In RENAME zone: default RENAME, but catalog may force REVIEW/KEEP
    if (byCatalog) return byCatalog;
    if (byName?.classification === "KEEP") {
      return {
        classification: "REVIEW",
        reason: `Rule 4 escalation: ${byName.reason} inside a Rule 2 RENAME zone. Human review required.`,
      };
    }
    return {
      classification: "RENAME",
      reason: "Rule 2 RENAME: file is in a sequence-domain path; identifier renames to step*.",
    };
  }

  // Neutral path
  if (byName) return byName;
  if (byCatalog) return byCatalog;

  return {
    classification: "REVIEW",
    reason: "Neutral path, no heuristic or catalog hit. Human review required.",
  };
}

/**
 * Extract all identifiers containing 'beat' from a file's text.
 * Skips matches inside:
 *   - Line comments (// ...)
 *   - Block comments (/* ... *\/)
 *   - String literals ("..." | '...' | `...`)
 * because Section 3 Non-Goal #5 excludes standalone comment/prose rewrites.
 */
function extractIdentMatches(source) {
  const results = [];
  const lines = source.split(/\r?\n/);

  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let cursor = 0;
    let cleaned = "";

    // Strip comments and string literals line-by-line while tracking block-comment state
    while (cursor < line.length) {
      const two = line.slice(cursor, cursor + 2);

      if (inBlockComment) {
        const end = line.indexOf("*/", cursor);
        if (end === -1) {
          cursor = line.length;
        } else {
          inBlockComment = false;
          cursor = end + 2;
        }
        continue;
      }

      if (two === "/*") {
        inBlockComment = true;
        cursor += 2;
        continue;
      }

      if (two === "//") {
        // rest of line is a comment
        break;
      }

      const ch = line[cursor];
      if (ch === '"' || ch === "'" || ch === "`") {
        // skip string literal
        const quote = ch;
        cursor++;
        while (cursor < line.length) {
          if (line[cursor] === "\\") {
            cursor += 2;
            continue;
          }
          if (line[cursor] === quote) {
            cursor++;
            break;
          }
          cursor++;
        }
        continue;
      }

      cleaned += ch;
      cursor++;
    }

    // Now extract identifiers from the cleaned-of-comments/strings line
    const matches = cleaned.matchAll(IDENT_TOKEN_RE);
    for (const m of matches) {
      const ident = m[1];
      if (identifierContainsBeat(ident)) {
        results.push({ line: i + 1, identifier: ident, lineContext: line });
      }
    }
  }

  return results;
}

async function expandGlob(pattern) {
  // Node 22+: fs.promises.glob — but guard for older via fallback to literal
  const matches = [];
  try {
    // @ts-ignore
    for await (const p of glob(pattern)) {
      matches.push(resolve(p));
    }
  } catch {
    // Fallback: treat as literal path
    matches.push(resolve(pattern));
  }
  return matches;
}

async function auditFile(filePath) {
  const absolute = resolve(filePath);
  let source;
  try {
    source = await readFile(absolute, "utf8");
  } catch (err) {
    process.stderr.write(`ERROR: cannot read ${absolute}: ${err.message}\n`);
    return [];
  }

  const normalizedPath = absolute.replace(/\\/g, "/");
  const projectRelativeIdx = normalizedPath.indexOf("/tka-platform/");
  const relativeForClassification =
    projectRelativeIdx >= 0
      ? normalizedPath.slice(projectRelativeIdx + "/tka-platform/".length)
      : normalizedPath;

  const idents = extractIdentMatches(source);
  return idents.map(({ line, identifier, lineContext }) => {
    const { classification, reason, catalogId } = classify({
      filePath: relativeForClassification,
      identifier,
      lineContext,
    });
    return {
      file: relativeForClassification,
      line,
      identifier,
      classification,
      reason,
      ...(catalogId ? { catalogId } : {}),
    };
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    process.stderr.write(
      "Usage: node scripts/beat-rename-audit.mjs <file-or-glob> [more...]\n"
    );
    process.exit(1);
  }

  const files = [];
  for (const arg of args) {
    const expanded = await expandGlob(arg);
    for (const f of expanded) {
      files.push(f);
    }
  }

  if (files.length === 0) {
    process.stderr.write("ERROR: no files matched the given pattern(s)\n");
    process.exit(1);
  }

  const all = [];
  for (const f of files) {
    const entries = await auditFile(f);
    for (const e of entries) all.push(e);
  }

  process.stdout.write(JSON.stringify(all, null, 2) + "\n");
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`FATAL: ${err.stack || err.message}\n`);
  process.exit(1);
});
