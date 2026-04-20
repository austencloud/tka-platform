#!/usr/bin/env node
/**
 * Sync MCP server data files from the canonical TS source.
 *
 * The @austencloud/tka-domain-mcp package (mcp-server-pkg) ships JSON data
 * files that the published server reads at runtime. These must be regenerated
 * from packages/domain/ whenever the canonical glossary or topics change.
 *
 * Run after editing packages/domain/src/data/glossary.ts or
 * packages/domain/src/reference/domain-topics.ts:
 *
 *   npm run build -w @tka/domain
 *   node scripts/sync-mcp-data.mjs
 *
 * Exits non-zero if the domain build is missing.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

const domainDist = resolve(repoRoot, "packages/domain/dist");
if (!existsSync(domainDist)) {
  console.error("ERR: packages/domain/dist not found. Run 'npm run build -w @tka/domain' first.");
  process.exit(1);
}

const glossaryModule = await import(pathToFileURL(resolve(domainDist, "data/glossary.js")).href);
const { GLOSSARY } = glossaryModule;
if (!GLOSSARY || typeof GLOSSARY !== "object") {
  console.error("ERR: GLOSSARY export not found in packages/domain/dist/data/glossary.js");
  process.exit(1);
}

const glossaryOut = resolve(repoRoot, "mcp-server-pkg/data/tka-glossary.json");
writeFileSync(glossaryOut, JSON.stringify(GLOSSARY, null, 2) + "\n", "utf-8");

const glossaryEntryCount = Object.keys(GLOSSARY).length;
console.log(`Wrote ${glossaryEntryCount} glossary entries → ${glossaryOut}`);

// If future topics need to be shipped as a separate JSON, add that here.
// Currently the mcp-server (flow-arts-knowledge-mcp) consumes topics via
// the @tka/domain package import directly, not a JSON data file.
