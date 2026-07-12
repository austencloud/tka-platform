/**
 * Release Module Gate
 *
 * Catches changelog leaks: commits that belong to a module (or a dark
 * sub-feature of a live module) that is NOT yet released, so they don't slip
 * into the user-facing changelog. The recurring pain was hand-catching these
 * by eye every release ("don't ship that, Learn isn't live yet").
 *
 * Single source of truth for "what's live" is PRODUCTION_MODULES in
 * src/lib/shared/environment/environment-features.ts — parsed here, never
 * duplicated. Flip a module live there and the gate follows automatically.
 *
 * Pure functions (parse/resolve/classify/gate) take all inputs as arguments so
 * they unit-test without touching git or the filesystem. The thin I/O wrappers
 * (loadProductionModules, collectCommits) live at the bottom.
 */

import { readFileSync } from "fs";
import { execSync } from "child_process";

/** Default location of the module-visibility source of truth. */
export const PRODUCTION_MODULES_PATH =
  "src/lib/shared/environment/environment-features.ts";

/**
 * Commit scopes that don't equal their ModuleId. Only mismatches belong here —
 * a scope that already IS a PRODUCTION_MODULES key (mandala, train, museum,
 * shop, browse, ...) resolves directly and needs no entry.
 *
 * The learn family is the important case: play/guide/quiz/codex/lessons all
 * live under src/lib/features/learn/ and ship (or don't) as the `learn` module.
 */
export const SCOPE_TO_MODULE = {
  play: "learn",
  guide: "learn",
  quiz: "learn",
  codex: "learn",
  lesson: "learn",
  lessons: "learn",
  "math-foundations": "learn",
  concepts: "learn",
  store: "shop",
};

/**
 * Feature-directory aliases for the file-path fallback. The path segment right
 * after `src/lib/features/` usually equals the ModuleId; list only exceptions.
 * (learn/* nests, so the first segment is already `learn` — no entry needed.)
 */
export const DIR_TO_MODULE = {
  store: "shop",
  "choreo-card": "choreo_card",
};

/**
 * Dark-inside-a-live-module denylist. These match commits whose module IS live
 * but which touch a sub-feature that has NOT launched. PRODUCTION_MODULES can't
 * express sub-feature gates, so they're named here by hand.
 *
 * A commit is flagged when its subject matches `subject` OR any touched file
 * starts with one of `paths`. Add a block when a new dark sub-feature appears;
 * delete it the day that sub-feature ships.
 */
export const DARK_DENYLIST = [
  {
    label: "shop: LOOP deck listing",
    reason: "LOOP deck store/listing not launched yet (still in design)",
    subject: /\bLOOP (deck|listing|configurator|board|pack|turntable)\b/i,
    paths: [
      "src/lib/features/store/LoopDeck",
      "src/lib/features/store/components/Loop",
    ],
  },
];

/**
 * Extract PRODUCTION_MODULES from the environment-features source text into a
 * plain { moduleId: boolean } map. Regex, not a TS import — the real module
 * pulls in `$app/environment` and `import.meta.env`, which won't run in Node.
 *
 * @param {string} source - contents of environment-features.ts
 * @returns {Record<string, boolean>}
 */
export function parseProductionModules(source) {
  const start = source.indexOf("PRODUCTION_MODULES");
  if (start === -1) {
    throw new Error(
      "PRODUCTION_MODULES not found in environment-features source",
    );
  }
  const open = source.indexOf("{", start);
  const close = source.indexOf("};", open);
  if (open === -1 || close === -1) {
    throw new Error("Could not bound the PRODUCTION_MODULES object literal");
  }
  const body = source.slice(open + 1, close);

  const map = {};
  // Match `key: true|false` and `"quoted-key": true|false`, ignoring trailing
  // `// comments` (we only capture up to the boolean).
  const entry = /(?:^|\n)\s*["']?([A-Za-z0-9_-]+)["']?\s*:\s*(true|false)\b/g;
  let m;
  while ((m = entry.exec(body)) !== null) {
    map[m[1]] = m[2] === "true";
  }
  if (Object.keys(map).length === 0) {
    throw new Error("Parsed zero entries from PRODUCTION_MODULES");
  }
  return map;
}

/**
 * Parse the conventional-commit type + scope off a subject line.
 * `feat(play): x` -> { type: "feat", scope: "play" }. No scope -> scope null.
 *
 * @param {string} subject
 * @returns {{ type: string | null, scope: string | null }}
 */
export function parseConventional(subject) {
  const m = /^([a-z]+)(?:\(([^)]+)\))?!?:/i.exec(subject.trim());
  if (!m) return { type: null, scope: null };
  return { type: m[1].toLowerCase(), scope: m[2] ? m[2].toLowerCase() : null };
}

/**
 * Resolve a commit to a ModuleId using scope first, then touched files.
 * Returns null when nothing maps confidently — shared/infra commits (auth,
 * export, render) and anything unrecognized stay null so they're never gated.
 *
 * @param {{ scope: string | null, files?: string[] }} commit
 * @param {Record<string, boolean>} productionModules
 * @returns {string | null}
 */
export function resolveModule({ scope, files = [] }, productionModules) {
  // Scope is the authoritative signal of intent: a `feat(mandala):` /
  // `feat(play):` commit is that module's work even if it also edits shared
  // infra. Only fall back to files when scope names no module.
  if (scope) {
    if (SCOPE_TO_MODULE[scope]) return SCOPE_TO_MODULE[scope];
    if (scope in productionModules) return scope;
  }

  // File fallback — resolve to the SINGLE feature module the commit owns, or
  // null when it's cross-cutting. A commit that touches `src/lib/shared/` is
  // infrastructure that serves live surfaces, and a commit spanning more than
  // one feature module isn't owned by any — both mis-flag as some lone dark
  // dir they happen to touch (this is what wrongly gated the live
  // Share/Download export sweep as mandala/video). Gating is then a pure
  // productionModules lookup on the returned module.
  if (files.some((f) => f.startsWith("src/lib/shared/"))) return null;

  const featureModules = [];
  for (const file of files) {
    const m = /^src\/lib\/features\/([A-Za-z0-9_-]+)\//.exec(file);
    if (!m) continue;
    const module = DIR_TO_MODULE[m[1]] ?? m[1];
    if (module in productionModules && !featureModules.includes(module)) {
      featureModules.push(module);
    }
  }
  return featureModules.length === 1 ? featureModules[0] : null;
}

/**
 * Does a commit hit the dark-sub-feature denylist? Returns the matching entry
 * (for its reason/label) or null.
 *
 * @param {{ subject: string, files?: string[] }} commit
 * @param {Array} denylist
 */
export function matchDenylist({ subject, files = [] }, denylist = DARK_DENYLIST) {
  for (const rule of denylist) {
    if (rule.subject && rule.subject.test(subject)) return rule;
    if (rule.paths && files.some((f) => rule.paths.some((p) => f.startsWith(p)))) {
      return rule;
    }
  }
  return null;
}

/**
 * Classify one commit's release visibility.
 *
 * released: false = behind a dark flag (module gated, or denylist hit)
 *           true  = its module is live
 *           null  = couldn't resolve a module (shared/infra) — never gated
 *
 * @param {{ hash?: string, subject: string, files?: string[] }} commit
 * @param {{ productionModules: Record<string, boolean>, denylist?: Array }} ctx
 */
export function classifyCommit(commit, { productionModules, denylist = DARK_DENYLIST }) {
  const { scope } = parseConventional(commit.subject);
  const files = commit.files ?? [];

  const dark = matchDenylist({ subject: commit.subject, files }, denylist);
  if (dark) {
    return {
      hash: commit.hash,
      subject: commit.subject,
      scope,
      module: resolveModule({ scope, files }, productionModules),
      released: false,
      darkReason: dark.label,
    };
  }

  const module = resolveModule({ scope, files }, productionModules);
  const released = module == null ? null : productionModules[module] === true;
  return {
    hash: commit.hash,
    subject: commit.subject,
    scope,
    module,
    released,
    darkReason: released === false ? `module "${module}" not released` : null,
  };
}

/**
 * Classify a batch and split into flagged (behind a dark flag) vs shown.
 * `shown` keeps live (true) AND unknown (null) — we only withhold what we're
 * confident is dark.
 *
 * @param {Array} commits
 * @param {{ productionModules: Record<string, boolean>, denylist?: Array }} ctx
 * @returns {{ flagged: Array, shown: Array }}
 */
export function gateCommits(commits, ctx) {
  const classified = commits.map((c) => classifyCommit(c, ctx));
  return {
    flagged: classified.filter((c) => c.released === false),
    shown: classified.filter((c) => c.released !== false),
  };
}

// ── Thin I/O wrappers (not unit-tested; exercised by release.js) ────────────

/**
 * Load + parse PRODUCTION_MODULES from disk.
 * @param {string} [path]
 * @returns {Record<string, boolean>}
 */
export function loadProductionModules(path = PRODUCTION_MODULES_PATH) {
  return parseProductionModules(readFileSync(path, "utf8"));
}

/**
 * Collect commits in a git range with the files each one touched.
 * @param {string} range - e.g. "v0.28.1..HEAD" or "HEAD"
 * @returns {Array<{ hash: string, subject: string, files: string[] }>}
 */
export function collectCommits(range) {
  // NUL-delimited records: hash \x1f subject, then one file path per line.
  const raw = execSync(
    `git log ${range} --no-merges --name-only --pretty=format:"%x1e%H%x1f%s"`,
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const commits = [];
  for (const record of raw.split("\x1e")) {
    if (!record.trim()) continue;
    const [header, ...fileLines] = record.split("\n");
    const sep = header.indexOf("\x1f");
    if (sep === -1) continue;
    commits.push({
      hash: header.slice(0, sep),
      subject: header.slice(sep + 1),
      files: fileLines.map((l) => l.trim()).filter(Boolean),
    });
  }
  return commits;
}
