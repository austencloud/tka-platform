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

  writeFileSync(OUTPUT, `${JSON.stringify({ version: 1, words: pool })}\n`);
  console.log(`wrote ${pool.length} words to ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
