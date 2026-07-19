// pm2 entry point for the tka-dev2 Cloudflare tunnel (dev2.tkaflowarts.com ->
// this machine's https://localhost:5173). Laptop-only: dev.tkaflowarts.com is
// permanently claimed by the home desktop's connector, so away-from-home work
// gets its own hostname instead of round-robin roulette. Runs independently of
// HOW vite is started (manual terminal or pm2 tka-dev) — it just forwards to
// whatever serves :5173. Same shim pattern as start-dev-pm2.cjs (pm2's direct
// .exe spawning is unreliable on Windows).
const { spawn, execSync } = require("child_process");

const child = spawn(
  "cloudflared",
  ["tunnel", "run", "--url", "https://localhost:5173", "--no-tls-verify", "tka-dev2"],
  { stdio: ["ignore", "inherit", "inherit"], shell: true }
);

child.on("exit", (code) => process.exit(code ?? 1));

function killTree() {
  try {
    execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: "ignore" });
  } catch {}
  process.exit(0);
}
process.on("SIGINT", killTree);
process.on("SIGTERM", killTree);
