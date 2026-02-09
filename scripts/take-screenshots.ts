/**
 * CLI Entry Point for Multi-Device Screenshot Testing
 *
 * Parses CLI args, sets env vars, runs Playwright, generates gallery.
 *
 * Usage:
 *   npm run screenshots                           # All routes, all devices, dark mode
 *   npm run screenshots -- /browse /create         # Specific modules
 *   npm run screenshots -- --public                # Public routes only (no auth)
 *   npm run screenshots -- --light                 # Light mode
 *   npm run screenshots -- --compare               # Compare against baselines
 *   npm run screenshots -- --update-baselines      # Save current as baselines
 *   npm run screenshots -- --devices phone         # Phone devices only
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, rmSync, readdirSync } from "fs";
import http from "http";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, "..");
const CAPTURES_DIR = join(ROOT, "tests", "screenshots", "captures");
const GALLERY_SCRIPT = join(ROOT, "tests", "screenshots", "generate-gallery.ts");
const PW_CONFIG = join(ROOT, "tests", "screenshots", "screenshot.config.ts");

// ─── Parse CLI Args ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);

const publicOnly = args.includes("--public");
const lightMode = args.includes("--light");
const darkMode = args.includes("--dark") || !lightMode;
const compareMode = args.includes("--compare");
const updateBaselines = args.includes("--update-baselines");

let deviceFilter = "";
const devicesIdx = args.indexOf("--devices");
if (devicesIdx !== -1 && args[devicesIdx + 1]) {
  deviceFilter = args[devicesIdx + 1];
}

// Route patterns: anything that doesn't start with "--"
// Git Bash on Windows expands /foo to C:/Program Files/Git/foo — detect and strip
function stripGitBashExpansion(arg: string): string {
  const gitBashPrefix = /^[A-Z]:\/Program Files\/Git\//i;
  if (gitBashPrefix.test(arg)) {
    return "/" + arg.replace(gitBashPrefix, "");
  }
  return arg;
}

const routePatterns = args
  .filter(
    (a) =>
      !a.startsWith("--") &&
      a !== deviceFilter &&
      (args.indexOf(a) === 0 || args[args.indexOf(a) - 1] !== "--devices")
  )
  .map(stripGitBashExpansion);

// ─── Env Vars ─────────────────────────────────────────────────────────────────

const env: Record<string, string> = { ...process.env } as Record<string, string>;

if (publicOnly) env.SCREENSHOT_PUBLIC = "true";
if (!darkMode) env.SCREENSHOT_DARK = "false";
if (deviceFilter) env.SCREENSHOT_DEVICE_FILTER = deviceFilter;
if (routePatterns.length > 0) env.SCREENSHOT_ROUTES = routePatterns.join(",");

// ─── Preflight Checks ─────────────────────────────────────────────────────────

function checkDevServer(): Promise<boolean> {
  // Use 127.0.0.1 explicitly — Node 18+ resolves "localhost" to IPv6 (::1) first,
  // but Vite only binds to IPv4 by default, causing ERR_CONNECTION_REFUSED.
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:5173", { timeout: 5000 }, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n  Screenshot Capture\n");

  // Check dev server
  if (!(await checkDevServer())) {
    console.error(
      "  Dev server not reachable at localhost:5173.\n" +
        "  Start it first: npm run dev (in VS Code)\n"
    );
    process.exit(1);
  }
  console.log("  Dev server: OK");

  // Show config
  console.log(`  Mode: ${darkMode ? "dark" : "light"}`);
  console.log(`  Devices: ${deviceFilter || "all"}`);
  console.log(`  Routes: ${routePatterns.length > 0 ? routePatterns.join(", ") : "all"}`);
  if (publicOnly) console.log("  Public only (no auth)");
  if (compareMode) console.log("  Compare mode: ON");
  console.log();

  // Check for credentials
  if (!publicOnly && !env.SCREENSHOT_TEST_EMAIL) {
    const localConfig = join(ROOT, "scripts", "screenshot-capture", "screenshot-config.local.json");
    if (!existsSync(localConfig)) {
      console.log(
        "  No auth credentials found. Auth routes will be skipped.\n" +
          "  To capture app modules, set env vars:\n" +
          "    SCREENSHOT_TEST_EMAIL=your@email.com\n" +
          "    SCREENSHOT_TEST_PASSWORD=yourpassword\n" +
          "  Or create scripts/screenshot-capture/screenshot-config.local.json\n"
      );
    }
  }

  // Handle --update-baselines (just runs gallery script with flag)
  if (updateBaselines) {
    console.log("  Updating baselines...");
    execSync(`npx tsx "${GALLERY_SCRIPT}" --update-baselines`, {
      cwd: ROOT,
      stdio: "inherit",
      env,
    });
    return;
  }

  // Clean previous captures
  if (existsSync(CAPTURES_DIR)) {
    const pngFiles = readdirSync(CAPTURES_DIR).filter((f) => f.endsWith(".png"));
    if (pngFiles.length > 0) {
      rmSync(CAPTURES_DIR, { recursive: true });
      console.log(`  Cleaned ${pngFiles.length} previous captures`);
    }
  }
  mkdirSync(CAPTURES_DIR, { recursive: true });

  // Run Playwright
  console.log("  Running Playwright...\n");
  try {
    execSync(`npx playwright test --config "${PW_CONFIG}"`, {
      cwd: ROOT,
      stdio: "inherit",
      env,
      timeout: 900_000, // 15 minutes max (1 worker × 9 devices × ~15s/test)
    });
  } catch (error) {
    // Playwright may exit non-zero if some tests fail. Continue to gallery.
    console.log("\n  Some captures may have failed. Generating gallery anyway.\n");
  }

  // Count captures
  const capturedFiles = existsSync(CAPTURES_DIR)
    ? readdirSync(CAPTURES_DIR).filter((f) => f.endsWith(".png"))
    : [];

  if (capturedFiles.length === 0) {
    console.error("  No screenshots were captured. Check Playwright output above.");
    process.exit(1);
  }

  // Generate gallery
  console.log(`\n  Generating gallery from ${capturedFiles.length} screenshots...`);
  const galleryArgs = compareMode ? "--compare" : "";
  execSync(`npx tsx "${GALLERY_SCRIPT}" ${galleryArgs}`, {
    cwd: ROOT,
    stdio: "inherit",
    env,
  });

  // Summary
  const deviceCount = new Set(
    capturedFiles.map((f) => f.replace(/^.*--/, "").replace(".png", ""))
  ).size;
  const routeCount = new Set(
    capturedFiles.map((f) => f.replace(/--[^.]+\.png$/, ""))
  ).size;

  console.log(
    `\n  Done: ${capturedFiles.length} screenshots across ${deviceCount} devices, ${routeCount} screens`
  );
  console.log("  Gallery: tests/screenshots/gallery.html\n");

  // Open gallery in browser
  const galleryPath = join(ROOT, "tests", "screenshots", "gallery.html");
  try {
    if (process.platform === "win32") {
      execSync(`start "" "${galleryPath}"`, { stdio: "ignore" });
    } else if (process.platform === "darwin") {
      execSync(`open "${galleryPath}"`, { stdio: "ignore" });
    } else {
      execSync(`xdg-open "${galleryPath}"`, { stdio: "ignore" });
    }
  } catch {
    // Non-critical if auto-open fails
  }
}

main();
