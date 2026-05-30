import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * REGRESSION LOCK — paintFrontJob must stay $env-clean.
 *
 * paint-front-job.ts is the worker painter. Its runtime (value) import graph must
 * NEVER reach anything that touches SvelteKit's $app/$env, Firebase, or the
 * main-thread-only caches/composers. The original crash ("reading 'env' at
 * public:1:47") came from $app/environment being pulled into the worker bundle.
 *
 * This test walks the VALUE-import graph of paint-front-job.ts from source on
 * disk and asserts no forbidden specifier appears anywhere in it.
 *
 * CRITICAL: `import type {...}` / `import { type X }` edges are ERASED at runtime
 * and are SAFE — paint-front-job.ts imports front-job.ts and card-front-assembler.ts
 * as TYPE-ONLY, and those DO transitively reach $app/environment. A naive text grep
 * that followed type imports would false-positive. The walker below distinguishes
 * type-only imports (skip) from value imports (follow). Dynamic import() is also
 * runtime-deferred and is NOT followed (e.g. text-renderer.ts reaches
 * get-glyph-cache only via a dynamic import — allowed).
 */

const FORBIDDEN: RegExp[] = [
  /\$app\//,
  /\$env\//,
  /(^|\/)firebase($|\/)/,
  /get-glyph-cache/,
  /getMandalaGeometryCalculator/,
  /pictograph-blob-cache/,
  /pictograph-svg-cache/,
  /image-composer/,
];

const SRC = resolve(__dirname, "../../../src");
const ENTRY = resolve(SRC, "lib/shared/render/services/paint-front-job.ts");

interface ParsedImport {
  /** The module specifier as written, e.g. "./front-job" or "$lib/.../x". */
  specifier: string;
  /** True if the whole statement is type-only and erased at runtime. */
  typeOnly: boolean;
  /** True if this is a dynamic import() (runtime-deferred, not bundled statically). */
  dynamic: boolean;
}

/**
 * Pragmatic import parser. Not a full TS parser — its only job is to robustly
 * tell type-only / dynamic imports apart from value imports, then capture the
 * specifier string. Handles multi-line import blocks by collapsing the source
 * between `import` and its `from "..."` clause.
 */
function parseImports(source: string): ParsedImport[] {
  const out: ParsedImport[] = [];

  // Strip block + line comments so commented-out imports never count.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  // 1. Static imports: `import ... from "spec"` and `import "spec"`.
  //    [\s\S]*? spans multi-line specifier lists; non-greedy stops at first `from`.
  const staticRe =
    /\bimport\b(\s+type\b)?([\s\S]*?)\bfrom\b\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = staticRe.exec(code)) !== null) {
    const isTypeKeyword = !!m[1]; // `import type ...`
    const clause = m[2] ?? "";
    const specifier = m[3];

    // `import { type A, type B }` — every named specifier prefixed with `type`.
    const named = clause.match(/\{([\s\S]*?)\}/);
    let allNamedAreType = false;
    if (named) {
      const parts = named[1]
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      allNamedAreType =
        parts.length > 0 && parts.every((p) => /^type\s+/.test(p));
    }

    out.push({
      specifier,
      typeOnly: isTypeKeyword || allNamedAreType,
      dynamic: false,
    });
  }

  // 2. Side-effect imports: `import "spec";` (no `from`). These are value imports.
  const sideEffectRe = /\bimport\s*["']([^"']+)["']/g;
  while ((m = sideEffectRe.exec(code)) !== null) {
    out.push({ specifier: m[1], typeOnly: false, dynamic: false });
  }

  // 3. `export ... from "spec"` re-exports. `export type ... from` is erased.
  const reExportRe =
    /\bexport\b(\s+type\b)?[\s\S]*?\bfrom\b\s*["']([^"']+)["']/g;
  while ((m = reExportRe.exec(code)) !== null) {
    out.push({ specifier: m[2], typeOnly: !!m[1], dynamic: false });
  }

  // 4. Dynamic import(): runtime-deferred, NOT followed.
  const dynamicRe = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = dynamicRe.exec(code)) !== null) {
    out.push({ specifier: m[1], typeOnly: false, dynamic: true });
  }

  return out;
}

/**
 * Resolve a relative or $lib specifier to a file on disk, trying common
 * extensions. Returns null for bare/package specifiers (node_modules, $app/$env)
 * or anything not found — those are recorded as specifiers but not recursed into.
 */
function resolveToFile(specifier: string, importerFile: string): string | null {
  let base: string;
  if (specifier.startsWith("$lib/")) {
    base = resolve(SRC, "lib", specifier.slice("$lib/".length));
  } else if (specifier === "$lib") {
    base = resolve(SRC, "lib");
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    base = resolve(dirname(importerFile), specifier);
  } else {
    // Bare package, $app/*, $env/* — not a file we own; don't recurse.
    return null;
  }

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.svelte.ts`,
    `${base}/index.ts`,
    `${base}.svelte`,
  ];
  for (const c of candidates) {
    if (existsSync(c) && !c.endsWith("/")) {
      // Reject directory-only matches; require an actual file.
      try {
        readFileSync(c);
        return c;
      } catch {
        /* directory or unreadable — skip */
      }
    }
  }
  return null;
}

interface WalkResult {
  specifiers: { file: string; specifier: string }[];
  offenders: string[];
  filesWalked: number;
}

function walkValueGraph(entry: string): WalkResult {
  const specifiers: { file: string; specifier: string }[] = [];
  const offenders: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [entry];

  while (queue.length > 0) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);

    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue; // unreadable; nothing to follow
    }

    for (const imp of parseImports(source)) {
      // Type-only and dynamic imports are erased / deferred — never part of the
      // static runtime bundle, so skip both following AND asserting on them.
      if (imp.typeOnly || imp.dynamic) continue;

      specifiers.push({ file, specifier: imp.specifier });

      for (const re of FORBIDDEN) {
        if (re.test(imp.specifier)) {
          offenders.push(`${file} imports ${imp.specifier}`);
          break;
        }
      }

      const target = resolveToFile(imp.specifier, file);
      if (target && !visited.has(target)) {
        queue.push(target);
      }
    }
  }

  return { specifiers, offenders, filesWalked: visited.size };
}

describe("paintFrontJob env-clean import graph", () => {
  it("value-import graph contains no $app/$env/firebase/forbidden modules", () => {
    const { offenders } = walkValueGraph(ENTRY);
    expect(
      offenders,
      `forbidden imports found:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("actually walks a meaningful portion of the source tree", () => {
    // Sanity guard: if resolution silently broke and we walked ~1 file, the
    // first test would pass vacuously. paint-front-job's value graph reaches
    // many shared modules, so require a non-trivial walk.
    const { filesWalked } = walkValueGraph(ENTRY);
    expect(filesWalked).toBeGreaterThan(5);
  });
});
