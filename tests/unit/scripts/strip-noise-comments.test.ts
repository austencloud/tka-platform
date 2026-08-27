import { describe, expect, it } from "vitest";

import { analyzeSource } from "../../../scripts/strip-noise-comments.mjs";

describe("strip-noise-comments", () => {
  it("removes only high-confidence syntax narration", () => {
    const source = `// src/example.ts
// ====================
// SETTINGS
// ====================
/** Get default settings */
function getDefaultSettings() {
  // Load records
  const records = loadRecords();
  return records;
}
`;

    const result = analyzeSource("src/example.ts", source);

    expect(result.output).toBe(`function getDefaultSettings() {
  const records = loadRecords();
  return records;
}
`);
    expect(result.edits.map((edit) => edit.reason)).toEqual([
      "file-path-header",
      "section-divider",
      "section-title",
      "section-divider",
      "restating-jsdoc",
      "syntax-narration",
    ]);
  });

  it("keeps rationale, contracts, and surprising semantics", () => {
    const source = `/** Conservative rating: mu - 2 * phi. */
function displayRating() {
  // Use addition rather than negation to avoid IEEE 754 negative zero.
  return 0 + value;
}

/** Get the player position in world space. */
function getPlayerPosition() {}

/** Get the next valid TKA letter. */
function getNextLetter() {}

// ── Retry window (resets after a cold start) ─────────────────────
// Check the WIP limit unless an administrator forced the claim.
if (!force) validateLimit();
`;

    expect(analyzeSource("src/example.ts", source).output).toBe(source);
  });

  it("protects compiler, framework, coverage, and work-tracking directives", () => {
    const source = `// @ts-expect-error: upstream types reject the browser implementation
useBrowserValue(value);
// eslint-disable-next-line no-console
console.log(value);
// TODO: replace this once the public API lands
runFallback();
`;

    expect(analyzeSource("src/example.ts", source).output).toBe(source);
  });

  it("handles script, markup, and style comments in Svelte files", () => {
    const source = `<!-- src/example.svelte -->
<script lang="ts">
  // ── Playback ─────────────────────────
  /** Start playback */
  function startPlayback() {}
</script>

<!-- Keep this because the user sees the fallback during loading. -->
<div>Loading</div>

<style>
  /* ==================== */
  div { color: red; }
</style>
`;

    const result = analyzeSource("src/example.svelte", source);

    expect(result.output).not.toContain("src/example.svelte");
    expect(result.output).not.toContain("// ── Playback");
    expect(result.output).not.toContain("Start playback");
    expect(result.output).not.toContain("====================");
    expect(result.output).toContain("because the user sees the fallback");
    expect(result.output).toContain("function startPlayback() {}");
    expect(result.output).toContain("div { color: red; }");
  });

  it("does not remove an inline comment together with executable code", () => {
    const source = `const speed = 1; // Set the playback speed
`;

    expect(analyzeSource("src/example.ts", source).output).toBe(source);
  });

  it("keeps decorated labels that group entries in a data table", () => {
    const source = `const references = [
  // --- Flow Arts Institute ---
  { title: "Timing and Direction" },
];
`;

    expect(analyzeSource("packages/example.ts", source).output).toBe(source);
  });

  it("does not treat comment-like text inside template literals as source comments", () => {
    const source = `function renderGallery() {
  return \`<style>
    /* -- Header -- */
    header { display: flex; }
  </style>\`;
}
`;

    expect(analyzeSource("tests/example.ts", source).output).toBe(source);
  });
});
