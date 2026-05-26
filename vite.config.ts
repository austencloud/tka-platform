import { getEnabledFeaturesDefineMap } from "./src/config/feature-flags";
import { featureGatePlugin } from "./src/config/vite-plugin-feature-gate";
import { museumPlacementPlugin } from './src/lib/features/museum/dev/museum-placement-plugin';
import { composerPlacementPlugin } from './src/lib/shared/3d/scene-composer/persistence/composer-placement-plugin';
import { sveltekit } from "@sveltejs/kit/vite";
// Paraglide removed - using lightweight JSON-based i18n in $lib/shared/i18n/
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import path from "path";
import type { ViteDevServer } from "vite";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { visualizer } from "rollup-plugin-visualizer";

/**
 * Serves PNG files from desktop directory
 * 2025: Added error handling and proper caching
 */
import { fileURLToPath } from "node:url";
const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const dictionaryPlugin = () => ({
  name: "dictionary-files",
  configureServer(server: ViteDevServer) {
    server.middlewares.use(
      "/dictionary",
      (
        req: IncomingMessage,
        res: ServerResponse,
        next: (err?: unknown) => void
      ) => {
        if (req.url && req.url.endsWith(".png")) {
          try {
            const decodedUrl = decodeURIComponent(req.url);
            const relativePath = decodedUrl.substring(1);
            const baseDir = path.resolve("../../../desktop/data/dictionary");
            const filePath = path.resolve(baseDir, relativePath);
            // Prevent path traversal - filePath must stay within baseDir
            if (!filePath.startsWith(baseDir + path.sep) && filePath !== baseDir) {
              res.writeHead(403);
              res.end("Forbidden");
              return;
            }
            if (fs.existsSync(filePath)) {
              res.setHeader("Content-Type", "image/png");
              res.setHeader("Cache-Control", "public, max-age=31536000"); // 2026: Better caching
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          } catch (error) {
            console.error("Dictionary file error:", error);
          }
        }
        next();
      }
    );
  },
});

/**
 * 📱 MOBILE DEBUGGING: CORS headers for font files
 * - Fonts require CORS headers when accessed from different origins
 * - Mobile devices connect via IP address, which browsers treat as cross-origin
 * - Without this, Font Awesome icons won't load on mobile dev
 */
const fontCorsPlugin = () => ({
  name: "font-cors-headers",
  configureServer(server: ViteDevServer) {
    server.middlewares.use(
      (
        req: IncomingMessage,
        res: ServerResponse,
        next: (err?: unknown) => void
      ) => {
        const url = req.url || "";

        // Add CORS headers for font files
        if (
          url.includes(".woff2") ||
          url.includes(".woff") ||
          url.includes(".ttf") ||
          url.includes(".otf") ||
          url.includes(".eot")
        ) {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        }

        next();
      }
    );
  },
});

/**
 * 🚀 2025 OPTIMIZATION: Aggressive no-cache during development
 * - Disables ALL caching for development files
 * - Works with browser cache and service workers
 * - Ensures every change is immediately visible
 */
const devCachePlugin = () => ({
  name: "dev-cache-headers",
  configureServer(server: ViteDevServer) {
    server.middlewares.use(
      (
        req: IncomingMessage,
        res: ServerResponse,
        next: (err?: unknown) => void
      ) => {
        // Skip WebSocket upgrade requests - critical for HMR
        if (req.headers.upgrade === "websocket") {
          next();
          return;
        }

        // Skip Vite's pre-bundled deps — they use content-hashed URLs for
        // cache busting. Stripping cache headers causes 504 "Outdated Optimize
        // Dep" errors when Vite re-optimizes and the hash changes mid-session.
        if (req.url?.includes(".vite/deps")) {
          next();
          return;
        }

        // Disable caching for all other dev server responses
        {
          const originalWriteHead = res.writeHead;
          res.writeHead = function (...args: any[]) {
            res.setHeader(
              "Cache-Control",
              "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
            );
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
            res.setHeader("Surrogate-Control", "no-store");
            res.setHeader("ETag", `"${Date.now()}"`); // Force cache miss
            return originalWriteHead.apply(res, args);
          };
        }

        next();
      }
    );
  },
});

// Use relative path for vite-plugin-static-copy, absolute for dev server
const webpEncoderWasmRelative =
  "node_modules/webp-encoder/lib/assets/a.out.wasm";
const webpEncoderWasmAbsolute = path.resolve(dirname, webpEncoderWasmRelative);

/**
 * 🎯 ARROW SPRITE HMR: Auto-reload when sprite is edited in Illustrator
 * - Watches static/images/arrows-sprite.svg
 * - Sends custom HMR event when file changes
 * - ArrowSvgLoader listens and reloads sprite without page refresh
 */
const arrowSpriteHmrPlugin = () => ({
  name: "arrow-sprite-hmr",
  configureServer(server: ViteDevServer) {
    const spritePath = path.resolve(dirname, "static/images/arrows-sprite.svg");

    server.watcher.add(spritePath);

    server.watcher.on("change", (changedPath: string) => {
      if (changedPath.replace(/\\/g, "/").endsWith("arrows-sprite.svg")) {
        console.log("🎯 Arrow sprite changed - sending HMR update");
        server.ws.send({
          type: "custom",
          event: "arrow-sprite-update",
          data: { timestamp: Date.now() },
        });
      }
    });
  },
});

/**
 * 🌐 I18N HMR: Auto-reload translations when locale JSON files change
 * - Watches messages/*.json (excluded from global watcher to save handles)
 * - Reads the changed file and sends its contents via custom HMR event
 * - i18n.svelte.ts receives the new messages and hot-swaps without page reload
 */
const i18nHmrPlugin = () => ({
  name: "i18n-hmr",
  configureServer(server: ViteDevServer) {
    const messagesDir = path.resolve(dirname, "messages");

    server.watcher.add(messagesDir);

    server.watcher.on("change", (changedPath: string) => {
      const normalized = changedPath.replace(/\\/g, "/");
      const match = normalized.match(/messages\/(\w+(?:-\w+)?)\.json$/);
      if (match) {
        const locale = match[1];
        try {
          const content = JSON.parse(fs.readFileSync(changedPath, "utf-8"));
          console.log(
            `🌐 Translation changed: ${locale} (${Object.keys(content).length} keys) - sending HMR update`
          );
          server.ws.send({
            type: "custom",
            event: "i18n-update",
            data: { locale, messages: content },
          });
        } catch (e) {
          console.error(`🌐 Failed to read ${locale} translations:`, e);
        }
      }
    });
  },
});

/**
 * Serves screenshot captures and baselines from tests/screenshots/
 * Also provides a manifest endpoint that scans the captures directory.
 * Dev-only — never included in production builds.
 */
interface CaptureJob {
  id: string;
  status: "running" | "completed" | "failed";
  total: number;
  completed: number;
  startedAt: number;
  finishedAt: number | null;
  error: string | null;
  process: ChildProcess | null;
  capturedFiles: string[];
}

const captureJobs = new Map<string, CaptureJob>();

const screenshotsPlugin = () => ({
  name: "screenshots-gallery",
  configureServer(server: ViteDevServer) {
    const capturesDir = path.resolve(dirname, "tests/screenshots/captures");
    const baselinesDir = path.resolve(dirname, "tests/screenshots/baselines");
    const screenshotConfigPath = path.resolve(dirname, "tests/screenshots/screenshot.config.ts");

    // Manifest endpoint — scans captures dir and returns structured metadata
    server.middlewares.use(
      "/screenshots/manifest.json",
      (
        _req: IncomingMessage,
        res: ServerResponse,
        _next: (err?: unknown) => void
      ) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");

        if (!fs.existsSync(capturesDir)) {
          res.end(JSON.stringify({ captures: [], timestamp: null }));
          return;
        }

        const files = fs
          .readdirSync(capturesDir)
          .filter((f) => f.endsWith(".png"));

        let latestMtime = 0;
        const captures = files.map((filename) => {
          const stat = fs.statSync(path.join(capturesDir, filename));
          if (stat.mtimeMs > latestMtime) latestMtime = stat.mtimeMs;

          // Parse filename: "routeLabel--deviceSlug.png"
          const base = filename.replace(/\.png$/, "");
          const lastDash = base.lastIndexOf("--");
          const routeLabel = lastDash > 0 ? base.substring(0, lastDash) : base;
          const deviceSlug = lastDash > 0 ? base.substring(lastDash + 2) : "";
          const hasBaseline = fs.existsSync(
            path.join(baselinesDir, filename)
          );

          return { filename, routeLabel, deviceSlug, hasBaseline };
        });

        res.end(
          JSON.stringify({
            captures,
            timestamp: latestMtime > 0 ? new Date(latestMtime).toISOString() : null,
          })
        );
      }
    );

    // Validate and serve a PNG from a specific directory (path traversal safe)
    function servePng(
      baseDir: string,
      req: IncomingMessage,
      res: ServerResponse,
      next: (err?: unknown) => void
    ): void {
      if (!req.url || !req.url.endsWith(".png")) {
        next();
        return;
      }

      const requestedFile = decodeURIComponent(req.url.substring(1));

      // Reject anything that isn't a simple filename (no slashes, no ..)
      if (!/^[a-zA-Z0-9_-]+\.png$/.test(requestedFile)) {
        res.statusCode = 400;
        res.end("Invalid filename");
        return;
      }

      const filePath = path.join(baseDir, requestedFile);

      // Belt-and-suspenders: verify resolved path stays within baseDir
      if (!filePath.startsWith(baseDir)) {
        res.statusCode = 403;
        res.end("Forbidden");
        return;
      }

      if (fs.existsSync(filePath)) {
        res.setHeader("Content-Type", "image/png");
        res.setHeader("Cache-Control", "no-cache");
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      next();
    }

    // Serve capture PNGs
    server.middlewares.use(
      "/screenshots/captures",
      (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) =>
        servePng(capturesDir, req, res, next)
    );

    // Serve baseline PNGs
    server.middlewares.use(
      "/screenshots/baselines",
      (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) =>
        servePng(baselinesDir, req, res, next)
    );

    // Validation: lowercase letters, digits, hyphens only (route labels use -- as separator)
    const SAFE_SLUG = /^[a-z0-9-]+$/;

    // POST /screenshots/capture — spawn a selective Playwright capture job
    // GET  /screenshots/capture/:jobId — poll job status
    server.middlewares.use(
      "/screenshots/capture",
      (
        req: IncomingMessage,
        res: ServerResponse,
        next: (err?: unknown) => void
      ) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");

        // ── GET /screenshots/capture/:jobId ──
        if (req.method === "GET") {
          const match = req.url?.match(/^\/([a-z0-9-]+)$/);
          if (!match) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "Invalid job ID format" }));
            return;
          }

          const job = captureJobs.get(match[1]);
          if (!job) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Job not found" }));
            return;
          }

          // Count new files since job started to derive progress
          if (job.status === "running" && fs.existsSync(capturesDir)) {
            const currentFiles = fs
              .readdirSync(capturesDir)
              .filter((f) => f.endsWith(".png"));
            // Only count files modified after job started (this job's output)
            const jobFiles = currentFiles.filter((f) => {
              const stat = fs.statSync(path.join(capturesDir, f));
              return stat.mtimeMs >= job.startedAt;
            });
            job.completed = jobFiles.length;
          }

          res.end(
            JSON.stringify({
              id: job.id,
              status: job.status,
              total: job.total,
              completed: job.completed,
              startedAt: job.startedAt,
              finishedAt: job.finishedAt,
              error: job.error,
              ...(job.status === "completed" && { capturedFiles: job.capturedFiles }),
            })
          );
          return;
        }

        // ── POST /screenshots/capture ──
        if (req.method === "POST") {
          // Reject concurrent captures
          for (const [, job] of captureJobs) {
            if (job.status === "running") {
              res.statusCode = 409;
              res.end(
                JSON.stringify({
                  error: "Capture already in progress",
                  jobId: job.id,
                })
              );
              return;
            }
          }

          let body = "";
          req.on("data", (chunk: Buffer) => {
            body += chunk.toString();
          });
          req.on("end", () => {
            let routes: unknown;
            let devices: unknown;

            try {
              const parsed = JSON.parse(body);
              routes = parsed.routes;
              devices = parsed.devices;
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid JSON body" }));
              return;
            }

            // Type and format validation
            if (!Array.isArray(routes) || !Array.isArray(devices)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "routes and devices must be arrays" }));
              return;
            }

            if (routes.length === 0 || devices.length === 0) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "routes and devices arrays are required" }));
              return;
            }

            if (routes.length > 50 || devices.length > 20) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Too many routes or devices" }));
              return;
            }

            // Sanitize: only allow safe slug characters
            const safeRoutes = routes.filter(
              (r): r is string => typeof r === "string" && SAFE_SLUG.test(r)
            );
            const safeDevices = devices.filter(
              (d): d is string => typeof d === "string" && SAFE_SLUG.test(d)
            );

            if (safeRoutes.length === 0 || safeDevices.length === 0) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Invalid route or device format" }));
              return;
            }

            const jobId = `cap-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
            const total = safeRoutes.length * safeDevices.length;

            const captureEnv: Record<string, string> = {
              ...(process.env as Record<string, string>),
              SCREENSHOT_ROUTES: safeRoutes.join(","),
              SCREENSHOT_DEVICE_FILTER: safeDevices.join(","),
            };

            const child = spawn(
              "npx",
              ["playwright", "test", "--config", screenshotConfigPath],
              {
                cwd: dirname,
                env: captureEnv,
                stdio: "pipe",
                shell: true,
              }
            );

            const job: CaptureJob = {
              id: jobId,
              status: "running",
              total,
              completed: 0,
              startedAt: Date.now(),
              finishedAt: null,
              error: null,
              process: child,
              capturedFiles: [],
            };
            captureJobs.set(jobId, job);

            let stderrOutput = "";
            child.stderr?.on("data", (data: Buffer) => {
              stderrOutput += data.toString();
            });

            child.on("close", (code) => {
              job.process = null;
              job.finishedAt = Date.now();

              // Collect filenames modified after job start for final count
              if (fs.existsSync(capturesDir)) {
                const finalFiles = fs
                  .readdirSync(capturesDir)
                  .filter((f) => {
                    if (!f.endsWith(".png")) return false;
                    const stat = fs.statSync(path.join(capturesDir, f));
                    return stat.mtimeMs >= job.startedAt;
                  });
                job.completed = finalFiles.length;
                job.capturedFiles = finalFiles;
              }

              if (code === 0 || job.completed > 0) {
                job.status = "completed";
              } else {
                job.status = "failed";
                job.error =
                  stderrOutput.slice(-500) ||
                  `Playwright exited with code ${code}`;
              }
            });

            child.on("error", (err) => {
              job.process = null;
              job.status = "failed";
              job.finishedAt = Date.now();
              job.error = err.message;
            });

            res.statusCode = 202;
            res.end(JSON.stringify({ jobId, total }));
          });
          return;
        }

        // Other methods — pass through
        next();
      }
    );
  },
});

const webpWasmDevPlugin = () => ({
  name: "webp-wasm-dev-server",
  configureServer(server: ViteDevServer) {
    server.middlewares.use(
      (
        req: IncomingMessage,
        res: ServerResponse,
        next: (err?: unknown) => void
      ) => {
        if (
          req.url &&
          req.url.endsWith("a.out.wasm") &&
          fs.existsSync(webpEncoderWasmAbsolute)
        ) {
          res.setHeader("Content-Type", "application/wasm");
          fs.createReadStream(webpEncoderWasmAbsolute).pipe(res);
          return;
        }
        next();
      }
    );
  },
});

const webpStaticCopyPlugin = () => {
  if (!fs.existsSync(webpEncoderWasmAbsolute)) {
    return null;
  }

  return viteStaticCopy({
    targets: [
      {
        src: webpEncoderWasmRelative,
        dest: ".", // Copy to root - webp-encoder expects /a.out.wasm
      },
    ],
  });
};

// Read package.json version at build time
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(dirname, "package.json"), "utf-8")
);

export default defineConfig(({ mode }) => ({
  esbuild: {
    pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
  },
  define: {
    __DEFINES__: JSON.stringify({}),
    __APP_VERSION__: JSON.stringify(packageJson.version),
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(packageJson.version),
    ...getEnabledFeaturesDefineMap(),
  },
  plugins: [
    featureGatePlugin(),
    // realtime-bpm-analyzer is browser-only (AudioContext) and has broken
    // package exports that Vite/Rollup can't resolve in some environments
    // (especially pnpm on Cloudflare Pages). SSR: mark external.
    // Client: locate the actual ESM file via fileURLToPath.
    {
      name: "fix-realtime-bpm-analyzer",
      enforce: "pre" as const,
      resolveId(id: string, _importer: string | undefined, options?: { ssr?: boolean }) {
        if (id === "realtime-bpm-analyzer") {
          if (options?.ssr) {
            return { id: "realtime-bpm-analyzer", external: true };
          }
          try {
            // import.meta.resolve returns a file:// URL; convert to OS path
            // @ts-expect-error -- import.meta.resolve is sync in Node 20+
            const pkgUrl = import.meta.resolve("realtime-bpm-analyzer/package.json");
            const pkgPath = fileURLToPath(pkgUrl);
            return path.resolve(path.dirname(pkgPath), "dist", "index.esm.js");
          } catch {
            return path.resolve(dirname, "node_modules", "realtime-bpm-analyzer", "dist", "index.esm.js");
          }
        }
      },
    },
    sveltekit({
      // Explicitly enable HMR and hot module replacement
      hot: {
        preserveLocalState: true,
        injectCss: true,
      },
    }),
    dictionaryPlugin(),
    screenshotsPlugin(), // Screenshot gallery for Lab module
    fontCorsPlugin(), // 📱 CORS headers for fonts (mobile debugging)
    devCachePlugin(), // 🚀 2025: Smart caching (no-cache for CSS/JS, cache for SVGs)
    arrowSpriteHmrPlugin(), // 🎯 Auto-reload arrows when sprite is edited in Illustrator
    i18nHmrPlugin(), // 🌐 Auto-reload translations when locale JSON changes
    webpWasmDevPlugin(),
    webpStaticCopyPlugin(),
    museumPlacementPlugin(), // Dev-only: writes placement data to disk via POST /__museum-placements
    composerPlacementPlugin(), // Dev-only: writes scene placements to disk via POST /__composer-placements
    // 📊 Bundle analyzer - generates stats.html when ANALYZE=true
    process.env.ANALYZE === "true" &&
      visualizer({
        filename: "stats.html",
        open: true,
        gzipSize: true,
        brotliSize: true,
        template: "treemap", // or "sunburst", "network"
      }),
  ].filter(Boolean),
  resolve: {
    dedupe: ["three", "@threlte/core"],
    alias: {
      // Aliases handled by SvelteKit
    },
    // Conditions handled by SvelteKit plugin (client) and ssr.resolve.conditions (server)
  },
  // ============================================================================
  // BUILD (Production optimization)
  // ============================================================================
  build: {
    // Source maps disabled in production for security (exposes original source)
    // Enable locally with: VITE_SOURCEMAP=true npm run build
    sourcemap: false,
    target: "esnext",
    minify: "esbuild",
    // 2026: Fast default minification
    cssMinify: "esbuild",
    // 2026: Works with Svelte 5

    rollupOptions: {
      // Externalize server-only modules that can't be bundled
      external: [
        "@resvg/resvg-js",
        /mcp-server/,
      ],
      output: {
        // Strategic chunking for your actual dependencies
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            // Three.js + Threlte bridge svelte ↔ three, creating circular chunks
            // if split from vendor. Keep them together in vendor to avoid TDZ errors.
            if (id.includes("fabric")) return "vendor-fabric";
            if (id.includes("pdfjs-dist")) return "vendor-pdf";
            // CSP-sensitive libs (use `new Function` — no unsafe-eval allowed).
            // Let Rollup auto-generate dynamic chunks for these so they only
            // load when consumers actually dynamic-import them.
            if (
              id.includes("pdf-lib") ||
              id.includes("html2canvas") ||
              id.includes("@mediapipe") ||
              id.includes("peerjs") ||
              id.includes("protobufjs") ||
              // JSZip uses new Function for its worker pipeline
              id.includes("jszip") ||
              // Vercel AI SDK uses new Function for JSON schema compilation.
              // Only needed by Tika module — let it lazy-load with the module.
              id.includes("node_modules/ai/") ||
              id.includes("@ai-sdk/") ||
              // JSON schema validators that commonly use new Function
              id.includes("ajv/") ||
              id.includes("json-schema-to-ts")
            ) {
              // Returning undefined → Rollup decides (usually its own chunk
              // based on dynamic import boundaries). Never lands in vendor.
              return undefined;
            }
            if (id.includes("firebase")) return "vendor-firebase";
            if (id.includes("dexie")) return "vendor-dexie";
            // pixi.js is heavy (~500KB) - keep it in its own chunk
            if (id.includes("pixi.js") || id.includes("pixi"))
              return "vendor-pixi";
            return "vendor";
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Warn for 1MB+ chunks
  },
  // ============================================================================
  // SSR
  // ============================================================================
  ssr: {
    noExternal: [
      "svelte",
      "@tka/domain",
      "@tka/render-core",
      "@vtg/domain",
      "@flow-arts/core",
      "@tka/sequence-engine",
      "@tka/sequence-engine/generation",
      "@tka/sequence-engine/core",
      "@tka/sequence-engine/loop",
      "@tka/sequence-engine/analysis",
      // Threlte packages need svelte export condition, keep bundled
      "@threlte/core",
      "@threlte/extras",
      "@threlte/rapier",
      // ESM packages with extensionless imports — Node can't resolve them natively
      "@austencloud/media-tagging-core",
      "@austencloud/media-tagging-firebase",
      "@austencloud/media-tagging-types",
      "@austencloud/media-tagging-ui",
    ],
    external: [
      "pdfjs-dist",
      "page-flip",
      // MCP server has native dependencies that can't be bundled
      /mcp-server/,
      "@resvg/resvg-js",
      // Three.js and related WebGL packages - must be external for SSR because
      // they access WebGL constants at module load time which don't exist in Node.js
      // (causes "Cannot read properties of undefined (reading 'VERTEX')" error)
      "three",
      /^three\//,
      "troika-three-text",
      "postprocessing",
      "three-perf",
      "@dimforge/rapier3d-compat",
    ],
    // Include svelte condition for threlte packages, but node/module first for SSR
    resolve: {
      conditions: ["svelte", "node", "module", "import", "default"],
    },
  },
  // ============================================================================
  // WORKER
  // ============================================================================
  worker: {
    format: "es",
    rollupOptions: {
      // The composition worker dynamically imports modules that transitively
      // reference $app/environment (resolved to __sveltekit/environment by SvelteKit).
      // This virtual module doesn't exist in the worker Rollup context. Since these
      // dynamic imports are behind try/catch and never actually reached in worker
      // context, externalizing the unresolvable module lets the build succeed.
      external: [
        "__sveltekit/environment",
        /^\$env\//,
      ],
    },
  },
  // ============================================================================
  // CSS
  // ============================================================================
  css: {
    devSourcemap: true,
  },
  // ============================================================================
  // DEPENDENCY PRE-BUNDLING (Vite 6.0)
  // ⚡ PERFORMANCE: Only pre-bundle lightweight essentials + dependencies that need ESM transformation
  // Heavy libraries (fabric, page-flip) are excluded and load on-demand when features are used
  // This reduces initial dev server load time from 30s+ to ~5-10s
  // ============================================================================
  optimizeDeps: {
    include: [
      // Validation (lightweight, needed immediately)
      "zod",

      // Firebase: pre-bundle every subpath used at boot to prevent the
      // "optimized dependencies changed — reloading" cycle. Vite triggers
      // a full page reload whenever it discovers an unbundled dep mid-session.
      "firebase/app",
      "firebase/auth",
      "firebase/firestore",
      "firebase/storage",
      "firebase/database",
      "firebase/functions",
      "firebase/messaging",
      "firebase/analytics",


      // UI components (lightweight)
      "bits-ui",
      "embla-carousel-svelte",

      // Small utilities
      "fflate",

      // ⚡ PERFORMANCE FIX: Pre-bundle dexie for proper ESM handling
      // Needs Vite transformation despite being in dataModule (Tier 1)
      "dexie",
      // Threlte: avoid on-demand re-optimization (prevents stale dep 504s)
      "@threlte/core",
      "@threlte/extras",
      // WebGPU renderer: pre-bundle to avoid 504 "Outdated Optimize Dep" errors
      "three/webgpu",

      // Prevent mid-session optimization reloads (lightweight deps discovered late)
      "@tanstack/svelte-virtual",
      "threlte-postprocessing",
      "threlte-postprocessing/effects",
      "three/examples/jsm/controls/PointerLockControls.js",
      "@austencloud/backgrounds",
      "@austencloud/backgrounds/card",
      "@capacitor/core",
      "@capgo/capacitor-updater",
      "qr-code-styling",
      "posthog-js",
      "mediabunny",

      // 3D scene deps: discovered mid-session → browserHash changes → 504 on refresh
      "three",
      "postprocessing",
      "camera-controls",
      "three-good-godrays",
      "three-mesh-bvh",
      "miniplex",
      "three/examples/jsm/loaders/GLTFLoader.js",
      "three/examples/jsm/loaders/DRACOLoader.js",
      "three/examples/jsm/libs/meshopt_decoder.module.js",
      "three/examples/jsm/misc/GPUComputationRenderer.js",
      "three/examples/jsm/objects/Reflector.js",
      "three/examples/jsm/utils/BufferGeometryUtils.js",

      // Media/networking deps discovered late
      "h264-mp4-encoder",
      "peerjs",
      "wavesurfer.js",
      "web-vitals",

      // Capacitor plugins (mobile)
      "@capacitor/app",
      "@capacitor/haptics",
      "@capacitor/keyboard",
      "@capacitor/splash-screen",
      "@capacitor/status-bar",
    ],
    exclude: [
      "pdfjs-dist",
      // Workspace packages: exclude from prebundling so changes are
      // picked up by HMR without restarting the dev server
      "@tka/sequence-engine",
      // file: linked Svelte packages — esbuild can't parse .svelte exports
      "@austencloud/scene-3d",
      "@austencloud/camera-3d",
      // ⚡ Lazy-load these heavy libraries on-demand
      "fabric", // ~500KB canvas library (loads when user uses animator)
      "page-flip", // PDF flipbook (loads in learn module)
    ],
  },
  // ============================================================================
  // DEV SERVER (Vite 6.0 enhancements)
  // ============================================================================
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true, // 📱 Mobile debugging requires consistent port (ADB reverse tcp:5173)
    allowedHosts: [".trycloudflare.com", "dev.tkaflowarts.com"],
    headers: {
      // Enable OAuth popups to communicate with parent window
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Cross-Origin-Embedder-Policy": "unsafe-none",
    },
    fs: {
      allow: [".", "../../", "../../../animator", "../../../desktop"],
      strict: true, // 2026: Security best practice
    },
    hmr: {
      overlay: true,
      timeout: 30000, // 30s timeout instead of default 5s
    },
    watch: {
      // 🚨 HANDLE LEAK FIX: Chokidar creates one fs.watch() per directory.
      // On Windows, each = one kernel handle via ReadDirectoryChangesW.
      // Without filtering, ~12,000 directories get watched = 50,000-83,000 handles.
      // Only src/ and static/ need HMR. Everything else is ignored.
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/.svelte-kit/**",
        // "apps" exists inside src/ (retro/win95/components/apps/) so we
        // match only the root-level apps/ dir using an absolute path.
        path.resolve(dirname, "apps") + "/**",
        // Ignore root-level directories that don't need HMR.
        // Uses **/ prefix because chokidar receives absolute paths on Windows.
        // CAUTION: These match at ANY depth. Only use names that are unique to
        // the project root and DON'T appear inside src/ (e.g. "apps" exists at
        // src/lib/features/retro/win95/components/apps/ — can't use **/apps/**).
        "**/_ARCHIVE/**",
        "**/tka-worlds/**",
        "**/firebase-functions/**",
        "**/functions/**",
        "**/mcp-server/**",
        // Watch packages/sequence-engine/src/ for HMR (shared generation logic).
        // Ignore everything else under packages/ to avoid handle bloat.
        "**/packages/*/node_modules/**",
        "**/packages/*/tests/**",
        "**/packages/*/dist/**",
        "**/android-twa/**",
        "**/_GUIDE/**",
        "**/Assets/**",
        "**/deployment/**",
        "**/docs/**",
        "**/feedback-images/**",
        // "**/messages/**" — NOT ignored: i18nHmrPlugin watches these for live translation reload
        "**/scripts/**",
        "**/tests/**",
        "**/.playwright-mcp/**",
        "**/.wrangler/**",
        "**/.husky/**",
        "**/.github/**",
        "**/.vscode/**",
        "**/dev-dist/**",
        "**/build/**",
        "**/dist/**",
        // static/ has 514 subdirs (364 in gallery/ alone). Arrow sprite HMR
        // uses server.watcher.add() for its specific file, so bulk watching isn't needed.
        "**/static/**",
      ],
    },
    // 2026: Preload critical files on dev start
    // warmup removed — was causing vite-plugin-svelte double-compilation errors
  },
  // ============================================================================
  // PREVIEW (Testing production builds)
  // ============================================================================
  preview: {
    port: 4173,
    strictPort: true,
    host: "0.0.0.0",
  },
}));
