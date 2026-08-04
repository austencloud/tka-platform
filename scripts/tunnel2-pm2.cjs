// pm2 entry point for the tka-dev2 Cloudflare tunnel (dev2.tkaflowarts.com ->
// this machine's https://localhost:5173). Machine assignment (2026-08-03):
// dev = d1 (primary desktop), dev2 = d2 (office desktop), dev3 = laptop.
// Runs independently of HOW vite is started (manual terminal or pm2 tka-dev)
// — it just forwards to whatever serves :5173. Same shim pattern as
// start-dev-pm2.cjs (pm2's direct .exe spawning is unreliable on Windows).
//
// Token-based so the machine only needs the token file, not cert.pem or the
// tunnel credentials json. Get it on any logged-in machine with
// `cloudflared tunnel token tka-dev2` and save it (one line, no trailing
// newline matters not) to %USERPROFILE%\.cloudflared\tka-dev2.token
const { spawn, execSync } = require("child_process");
const { readFileSync } = require("fs");
const { join } = require("path");

const tokenFile = join(process.env.USERPROFILE, ".cloudflared", "tka-dev2.token");
const token = readFileSync(tokenFile, "utf8").trim();

const child = spawn(
  "cloudflared",
  // Flag order matters: --url and --no-tls-verify belong to the `tunnel`
  // command, not the `run` subcommand. Placed AFTER `run` they parse without
  // error but never reach the ingress builder, and cloudflared logs
  // "No ingress rules were defined ... will return 503 for all incoming HTTP
  // requests". tka-dev survives the same mistake only because that older tunnel
  // carries remote ingress config in Cloudflare; tka-dev2/tka-dev3 have none.
  ["tunnel", "--url", "https://localhost:5173", "--no-tls-verify", "run", "--token", token],
  // windowsHide here, not just in ecosystem config — pm2's own flag doesn't
  // reach grandchildren, so without it the cloudflared console pops up as a
  // visible window that "can't be closed" (pm2 respawns it on every X-click).
  { stdio: ["ignore", "inherit", "inherit"], shell: true, windowsHide: true }
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
