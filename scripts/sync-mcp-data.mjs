#!/usr/bin/env node
/**
 * Sync MCP server data files from the canonical TS source.
 *
 * The @austencloud/tka-domain-mcp package (mcp-server-pkg) ships JSON data
 * files that the published server reads at runtime. These must be regenerated
 * from packages/domain/ whenever the canonical glossary or topics change.
 *
 * Run after editing packages/domain/src/data/glossary.ts,
 * packages/domain/src/constants/alias-map.ts, or
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

// Aliases travel with the glossary. mcp-server-pkg used to carry its own
// hand-written copy, which drifted: it mapped "type 1" to a key the glossary no
// longer had, so the alias resolved to a not-found. One source, both servers.
const aliasModule = await import(
  pathToFileURL(resolve(domainDist, "constants/alias-map.js")).href
);
const { TERM_ALIASES } = aliasModule;
if (!TERM_ALIASES || typeof TERM_ALIASES !== "object") {
  console.error(
    "ERR: TERM_ALIASES export not found in packages/domain/dist/constants/alias-map.js"
  );
  process.exit(1);
}

const danglingAliases = Object.entries(TERM_ALIASES).filter(
  ([, target]) => !(target in GLOSSARY)
);
if (danglingAliases.length > 0) {
  console.error(
    `ERR: ${danglingAliases.length} alias(es) point at a term the glossary does not define:`
  );
  for (const [alias, target] of danglingAliases) {
    console.error(`  "${alias}" → "${target}"`);
  }
  process.exit(1);
}

// An alias whose key is itself a glossary term shadows the real entry: the
// lookup resolves the alias first and the reader never reaches the definition.
// "trigeng" was exactly this before it earned an entry of its own.
const shadowingAliases = Object.keys(TERM_ALIASES).filter((alias) => alias in GLOSSARY);
if (shadowingAliases.length > 0) {
  console.error(
    `ERR: ${shadowingAliases.length} alias(es) shadow a glossary term of the same name:`
  );
  for (const alias of shadowingAliases) {
    console.error(`  "${alias}" → "${TERM_ALIASES[alias]}" (but "${alias}" is a term)`);
  }
  process.exit(1);
}

const aliasOut = resolve(repoRoot, "mcp-server-pkg/data/tka-term-aliases.json");
writeFileSync(aliasOut, JSON.stringify(TERM_ALIASES, null, 2) + "\n", "utf-8");
console.log(
  `Wrote ${Object.keys(TERM_ALIASES).length} term aliases → ${aliasOut}`
);

// If future topics need to be shipped as a separate JSON, add that here.
// Currently the mcp-server (flow-arts-knowledge-mcp) consumes topics via
// the @tka/domain package import directly, not a JSON data file.
