/**
 * Quick test harness for sequence rendering.
 *
 * Runs as a fresh process each time, so it always picks up
 * the latest code changes — no MCP server restart needed.
 *
 * Usage:
 *   npx tsx mcp-server/scripts/test-render.ts
 *   npx tsx mcp-server/scripts/test-render.ts --word BOOK
 *   npx tsx mcp-server/scripts/test-render.ts --length 32
 *   npx tsx mcp-server/scripts/test-render.ts --length 16 --preset reversal
 */

import { ensureDataLoadedAsync, saveAndOpenImage } from "../src/shared/server-context.js";
import { renderSequenceToImage } from "../src/core/sequence-renderer.js";
import { ensureTransitionGraphInitialized } from "../src/core/letter-transition-graph.js";
import {
  allocateTurns,
  type PictographData,
} from "@tka/sequence-engine/generation";
import { generateViaEngine } from "../src/core/engine-generation-adapter.js";

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const word = getArg("word");
const length = getArg("length") ? parseInt(getArg("length")!, 10) : undefined;
const preset = getArg("preset") ?? "smooth";
const level = getArg("level") ? parseInt(getArg("level")!, 10) : 1;
const cellSize = getArg("cellSize") ? parseInt(getArg("cellSize")!, 10) : 900;
const layout = (getArg("layout") as "grid" | "strip") ?? "grid";

if (!word && !length) {
  console.error("Usage: npx tsx mcp-server/scripts/test-render.ts --word BOOK");
  console.error("       npx tsx mcp-server/scripts/test-render.ts --length 32");
  console.error("       npx tsx mcp-server/scripts/test-render.ts --length 16 --preset reversal");
  process.exit(1);
}

async function main() {
  console.error("Loading data...");
  await ensureTransitionGraphInitialized();
  const allPictographs = (await ensureDataLoadedAsync()) as PictographData[];

  let result;

  if (length && !word) {
    // Length-based generation via engine
    console.error(`Generating ${length}-beat sequence (preset: ${preset}, level: ${level})...`);
    const engineResult = generateViaEngine({
      length,
      constraintPreset: preset,
      level,
    }, allPictographs);
    result = { steps: engineResult.result.steps, word: engineResult.result.word ?? "sequence" };
  } else {
    // Word-based generation via engine (same path as MCP tool)
    console.error(`Generating sequence for "${word}" (preset: ${preset}, level: ${level})...`);
    const engineResult = generateViaEngine({
      word: word!.toUpperCase(),
      constraintPreset: preset,
      level,
    }, allPictographs);
    result = { steps: engineResult.result.steps, word: engineResult.result.word ?? word! };
  }

  const stepCount = result.steps.length - 1;
  const turnAllocation = allocateTurns(stepCount, level);

  console.error(`Rendering ${stepCount} beats...`);
  const pngBuffer = await renderSequenceToImage(result.steps, result.word, {
    layout,
    cellSize,
    showStepNumbers: true,
    showWord: true,
    darkMode: true,
    padding: 8,
    showDifficulty: true,
    level,
    turnAllocation,
    showReversals: true,
  });

  const tempPath = saveAndOpenImage(pngBuffer, `test-${result.word}`);
  console.error(`Opened: ${tempPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
