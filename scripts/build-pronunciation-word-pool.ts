/**
 * Build the candidate word pool the corpus planner draws from.
 *
 * A pool word is a walk of the letter transition graph, so every adjacency it
 * contains is one a real TKA label can contain. That matters more than it
 * looks: the bank's neighbour and join costs assume tokens carry the influence
 * of the letters beside them, and an invented adjacency would put a join in the
 * bank that no label ever asks for.
 *
 * Run: pnpm exec tsx scripts/build-pronunciation-word-pool.ts
 */
import { readFileSync, writeFileSync } from "node:fs";

import { TransitionGraph } from "../packages/sequence-engine/src/core/transition-graph/TransitionGraph.js";

/**
 * Letter mappings only. The graph's `initialize` reads position groups from
 * this file; `loadLetterVariations` is never reached on the code paths this
 * script uses, so the pictograph CSV stays out of it.
 */
const MAPPINGS_PATH = "static/data/learn/letter-mappings.json";

const LENGTHS = [2, 3, 4, 5, 6, 8];
const WORDS_PER_LENGTH = 400;
const OUTPUT = "static/data/pronunciation-word-pool.json";

function walk(
  graph: TransitionGraph,
  start: string,
  length: number,
  pick: (options: string[], depth: number) => string | null
): string[] | null {
  const word = [start];
  while (word.length < length) {
    const successors = graph.getValidSuccessors(word[word.length - 1]!);
    const chosen = pick(successors, word.length);
    if (chosen === null) return null;
    word.push(chosen);
  }
  return word;
}

async function main(): Promise<void> {
  const graph = new TransitionGraph({
    loadLetterMappings: async () =>
      JSON.parse(readFileSync(MAPPINGS_PATH, "utf8")),
  } as never);
  await graph.initialize();

  const letters = graph.getAllLetters();
  const pool: string[][] = [];
  const seen = new Set<string>();

  for (const length of LENGTHS) {
    let attempts = 0;
    let produced = 0;
    // Deterministic rotation rather than randomness, so the checked-in pool is
    // reproducible and a diff on it means the graph changed.
    while (produced < WORDS_PER_LENGTH && attempts < WORDS_PER_LENGTH * 40) {
      const start = letters[attempts % letters.length]!;
      const offset = Math.floor(attempts / letters.length);
      const word = walk(graph, start, length, (options, depth) =>
        options.length === 0 ? null : options[(offset + depth) % options.length]!
      );
      attempts++;
      if (!word) continue;

      const key = word.join(" ");
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(word);
      produced++;
    }
    console.log(`length ${length}: ${produced} words in ${attempts} attempts`);
  }

  // The letter list ships alongside the words because it, not the `Letter`
  // enum, is the corpus's real scope. The enum carries 54 entries; the TKA
  // alphabet is 47 (MCP `list_available_letters`: 22 + 8 + 8 + 3 + 3 + 3). The
  // extra 7 are position names the enum groups as letters — ζ η τ ⊕ (obtuse,
  // acute, one-center, both-center) plus μ ν and τ-. A position name cannot sit
  // inside a word, so planning corpus cells for it would put Austen in front of
  // a microphone reading labels that are not TKA words.
  //
  // Emitting what the graph reports keeps that scope self-correcting: extend
  // letter-mappings.json and the corpus grows on the next regeneration, with no
  // hardcoded 47 to go stale.
  const payload = { version: 1, letters, words: pool };
  writeFileSync(OUTPUT, `${JSON.stringify(payload)}\n`);
  console.log(
    `wrote ${pool.length} words over ${letters.length} letters to ${OUTPUT}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
