/**
 * CLI Entry Point for Multi-Device Screenshot Testing
 *
 * Parses CLI args, validates environment, runs Playwright, generates gallery.
 *
 * Run `npm run screenshots -- --help` for full usage.
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, rmSync, readdirSync } from "fs";
import http from "http";
import https from "https";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, "..");
const CAPTURES_DIR = join(ROOT, "tests", "screenshots", "captures");
const GALLERY_SCRIPT = join(ROOT, "tests", "screenshots", "generate-gallery.ts");
const PW_CONFIG = join(ROOT, "tests", "screenshots", "screenshot.config.ts");

// ─── Help Text ───────────────────────────────────────────────────────────────

const HELP_TEXT = `
  Multi-Device Screenshot Testing
  ================================

  Captures screenshots across 9 device viewports and generates
  an interactive HTML gallery for visual QA.

  Usage:
    npm run screenshots                              All routes, all devices
    npm run screenshots -- --public                  Public routes only (no auth)
    npm run screenshots -- --devices phone           Phone devices only
    npm run screenshots -- --devices tablet,desktop   Multiple device categories
    npm run screenshots -- --devices iphone-se        Specific device by slug
    npm run screenshots -- /browse /create            Specific modules
    npm run screenshots -- --light                   Light mode (default: dark)
    npm run screenshots -- --compare                 Compare against baselines
    npm run screenshots -- --update-baselines        Save current as baselines
    npm run screenshots -- --landscape               Include landscape captures
    npm run screenshots -- --portable                Embed images as base64

  Device Categories:
    phone     iPhone SE, iPhone 16 Pro, iPhone 16 Pro Max, Galaxy S24, Galaxy S24 Ultra
    tablet    iPad Mini, iPad Air
    desktop   Desktop HD (1366x768), Desktop FHD (1920x1080)

  Credentials (for auth-required routes):
    Option 1: Environment variables
      SCREENSHOT_TEST_EMAIL=you@example.com
      SCREENSHOT_TEST_PASSWORD=yourpassword

    Option 2: Local config file
      Create tests/screenshots/credentials.local.json:
      { "email": "you@example.com", "password": "yourpassword" }

  Output:
    tests/screenshots/captures/    PNG files ({route}--{device}.png)
    tests/screenshots/gallery.html Interactive gallery (auto-opens in browser)
    tests/screenshots/baselines/   Reference screenshots for regression
`;

// ─── Parse CLI Args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(HELP_TEXT);
  process.exit(0);
}

const publicOnly = args.includes("--public");
const lightMode = args.includes("--light");
const darkMode = args.includes("--dark") || !lightMode;
const compareMode = args.includes("--compare");
const updateBaselines = args.includes("--update-baselines");
const landscape = args.includes("--landscape");
const portable = args.includes("--portable");

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

// ─── Env Vars ────────────────────────────────────────────────────────────────

const env: Record<string, string> = { ...process.env } as Record<string, string>;

if (publicOnly) env.SCREENSHOT_PUBLIC = "true";
if (!darkMode) env.SCREENSHOT_DARK = "false";
if (deviceFilter) env.SCREENSHOT_DEVICE_FILTER = deviceFilter;
if (routePatterns.length > 0) env.SCREENSHOT_ROUTES = routePatterns.join(",");
if (landscape) env.SCREENSHOT_LANDSCAPE = "true";
if (portable) env.SCREENSHOT_PORTABLE = "true";

// ─── Preflight Checks ───────────────────────────────────────────────────────

// Use 127.0.0.1 explicitly — Node 18+ resolves "localhost" to IPv6 (::1) first,
// but Vite only binds to IPv4 by default, causing ERR_CONNECTION_REFUSED.
function probeHttps(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.get(
      "https://127.0.0.1:5173",
      { timeout: 5000, rejectUnauthorized: false },
      (res) => {
        res.resume();
        resolve(res.statusCode !== undefined && res.statusCode < 500);
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function probeHttp(): Promise<boolean> {
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

// The dev server runs HTTPS/h2 when the mkcert dev cert exists (.cert/), else
// HTTP/1.1 (fresh clone / CI). Try https first (self-signed cert → skip
// verification), then fall back to http.
async function checkDevServer(): Promise<boolean> {
  return (await probeHttps()) || probeHttp();
}

function checkPlaywrightBrowsers(): boolean {
  // Playwright stores browsers in a platform-specific cache directory.
  // Rather than guessing the path, try running a quick Playwright command.
  try {
    execSync("npx playwright --version", {
      cwd: ROOT,
      stdio: "pipe",
      timeout: 10_000,
    });
  } catch {
    return false;
  }

  // Check that chromium is actually installed by looking for the executable
  // in the standard Playwright cache location.
  const cacheDir =
    process.env.PLAYWRIGHT_BROWSERS_PATH ??
    (process.platform === "win32"
      ? join(process.env.LOCALAPPDATA ?? "", "ms-playwright")
      : join(process.env.HOME ?? "", ".cache", "ms-playwright"));

  if (!existsSync(cacheDir)) return false;

  // Look for any chromium directory
  try {
    const entries = readdirSync(cacheDir);
    return entries.some((e) => e.startsWith("chromium"));
  } catch {
    return false;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n  Screenshot Capture\n");

  // Check Playwright browsers
  if (!checkPlaywrightBrowsers()) {
    console.error(
      "  Playwright browsers not installed.\n" +
        "  Run: npx playwright install chromium\n" +
        "  (Only needed once, downloads ~150MB)\n"
    );
    process.exit(1);
  }
  console.log("  Playwright: OK");

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
  if (publicOnly) console.log("  Scope: public only (no auth)");
  if (landscape) console.log("  Orientation: portrait + landscape");
  if (compareMode) console.log("  Compare: ON (diff against baselines)");
  if (portable) console.log("  Gallery: portable (base64 embedded)");
  console.log();

  // Check for credentials
  if (!publicOnly && !env.SCREENSHOT_TEST_EMAIL) {
    const localConfig = join(ROOT, "tests", "screenshots", "credentials.local.json");
    if (!existsSync(localConfig)) {
      console.log(
        "  No auth credentials found. Auth routes will be skipped.\n" +
          "  To capture app modules, set env vars:\n" +
          "    SCREENSHOT_TEST_EMAIL=your@email.com\n" +
          "    SCREENSHOT_TEST_PASSWORD=yourpassword\n" +
          "  Or create tests/screenshots/credentials.local.json:\n" +
          '    { "email": "you@example.com", "password": "yourpass" }\n'
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
      timeout: 900_000, // 15 minutes max
    });
  } catch {
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
  const galleryFlags = [
    compareMode ? "--compare" : "",
    portable ? "--portable" : "",
  ]
    .filter(Boolean)
    .join(" ");
  execSync(`npx tsx "${GALLERY_SCRIPT}" ${galleryFlags}`, {
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
