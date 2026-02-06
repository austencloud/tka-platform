/**
 * Prebuild launcher for demo sequence generation.
 *
 * Calls the MCP server's generator script (which has access to the
 * pictograph dataframes and sequence builder) and validates the output.
 *
 * Usage: node scripts/generate-demo-sequences.js
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MCP_SERVER = resolve(__dirname, "../../../mcp-server");
const OUTPUT = resolve(__dirname, "../static/data/demo-sequences.json");

console.log("[generate-demo-sequences] Running generator...");

try {
  execSync("npx tsx scripts/generate-demo-sequences.ts", {
    cwd: MCP_SERVER,
    stdio: "inherit",
    timeout: 30_000,
  });
} catch (error) {
  console.error("[generate-demo-sequences] Generator failed:", error.message);
  // If output already exists from a previous run, don't fail the build
  if (existsSync(OUTPUT)) {
    console.warn("[generate-demo-sequences] Using existing demo-sequences.json");
  } else {
    process.exit(1);
  }
}

// Validate output
if (!existsSync(OUTPUT)) {
  console.error("[generate-demo-sequences] Output file not found:", OUTPUT);
  process.exit(1);
}

try {
  const data = JSON.parse(readFileSync(OUTPUT, "utf-8"));
  const l1 = data.level1?.length ?? 0;
  const l2 = data.level2?.length ?? 0;
  const l3 = data.level3?.length ?? 0;
  const total = l1 + l2 + l3;

  console.log(`[generate-demo-sequences] Valid output: ${total} sequences`);
  console.log(`  Level 1: ${l1}, Level 2: ${l2}, Level 3: ${l3}`);

  if (total === 0) {
    console.error("[generate-demo-sequences] No sequences generated!");
    process.exit(1);
  }
} catch (error) {
  console.error("[generate-demo-sequences] Invalid JSON:", error.message);
  process.exit(1);
}
