/**
 * Post-build: injects <link rel="modulepreload"> hints into built HTML.
 *
 * Reads .vite/manifest.json from the build output, extracts the chunk
 * dependency graph for critical entry modules (Create, Browse), and
 * injects modulepreload links into index.html so the browser fetches
 * the chunk chain in parallel instead of sequentially.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const buildDir = resolve(projectRoot, "build");

// SvelteKit with adapter-static writes the Vite client manifest to
// .svelte-kit/output/client/.vite/manifest.json — not to the build dir.
// Fall back to build-dir locations for non-SvelteKit setups.
const manifestPaths = [
  resolve(projectRoot, ".svelte-kit", "output", "client", ".vite", "manifest.json"),
  resolve(buildDir, ".vite", "manifest.json"),
  resolve(buildDir, "manifest.json"),
];

let manifest;
for (const p of manifestPaths) {
  if (existsSync(p)) {
    manifest = JSON.parse(readFileSync(p, "utf-8"));
    console.log(`[modulepreload] Found manifest at ${p}`);
    break;
  }
}

if (!manifest) {
  console.warn("[modulepreload] No manifest found — skipping injection.");
  process.exit(0);
}

const criticalModules = [
  "src/lib/features/create/shared/components/CreateModule.svelte",
  "src/lib/features/browse/shared/components/BrowseModule.svelte",
];

function collectChunks(entryFile, maxDepth = 2) {
  const chunks = new Set();
  const queue = [{ file: entryFile, depth: 0 }];

  while (queue.length > 0) {
    const { file, depth } = queue.shift();
    const entry = manifest[file];
    if (!entry || depth > maxDepth) continue;

    if (entry.file && !chunks.has(entry.file)) {
      chunks.add(entry.file);
    }

    if (entry.imports) {
      for (const imp of entry.imports) {
        if (!chunks.has(manifest[imp]?.file)) {
          queue.push({ file: imp, depth: depth + 1 });
        }
      }
    }

    if (entry.css) {
      for (const css of entry.css) {
        chunks.add(css);
      }
    }
  }

  return chunks;
}

const allChunks = new Set();
for (const mod of criticalModules) {
  if (manifest[mod]) {
    const chunks = collectChunks(mod);
    for (const c of chunks) allChunks.add(c);
    console.log(`[modulepreload] ${mod}: ${chunks.size} chunks`);
  } else {
    console.warn(`[modulepreload] Entry not in manifest: ${mod}`);
  }
}

if (allChunks.size === 0) {
  console.log("[modulepreload] No chunks to preload — skipping.");
  process.exit(0);
}

const links = [...allChunks]
  .slice(0, 15)
  .map((chunk) => {
    if (chunk.endsWith(".css")) {
      return `    <link rel="preload" href="/${chunk}" as="style" />`;
    }
    return `    <link rel="modulepreload" href="/${chunk}" />`;
  })
  .join("\n");

const htmlFiles = ["index.html", "app.html"].map((f) => resolve(buildDir, f)).filter(existsSync);

const IDEMPOTENCY_MARKER = "<!-- modulepreload-injected -->";

for (const htmlPath of htmlFiles) {
  let html = readFileSync(htmlPath, "utf-8");
  const marker = "</head>";
  if (!html.includes(marker)) continue;
  if (html.includes(IDEMPOTENCY_MARKER)) {
    console.log(`[modulepreload] Already injected in ${htmlPath} — skipping (idempotent).`);
    continue;
  }
  html = html.replace(marker, `${IDEMPOTENCY_MARKER}\n${links}\n  ${marker}`);
  writeFileSync(htmlPath, html);
  console.log(`[modulepreload] Injected ${allChunks.size} preload hints into ${htmlPath}`);
}

console.log("[modulepreload] Done.");
