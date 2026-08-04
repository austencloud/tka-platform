// pm2 entry point for the tka-dev3 Cloudflare tunnel (dev3.tkaflowarts.com ->
// this machine's https://localhost:5173). Machine assignment (2026-08-03):
// dev = d1 (primary desktop), dev2 = d2 (office desktop), dev3 = laptop.
// The laptop previously ran tka-dev2; that hostname now belongs to d2, so the
// laptop moves here. Runs independently of HOW vite is started — it just
// forwards to whatever serves :5173. Same shim pattern as start-dev-pm2.cjs.
//
// Token-based so the machine only needs the token file, not cert.pem or the
// tunnel credentials json. Get it on any logged-in machine with
// `cloudflared tunnel token tka-dev3` and save it to
// %USERPROFILE%\.cloudflared\tka-dev3.token
const { spawn, execSync } = require("child_process");
const { readFileSync } = require("fs");
const { join } = require("path");

const tokenFile = join(process.env.USERPROFILE, ".cloudflared", "tka-dev3.token");
const token = readFileSync(tokenFile, "utf8").trim();

const child = spawn(
  "cloudflared",
  // Flag order matters: --url and --no-tls-verify belong to the `tunnel`
  // command, not the `run` subcommand. Placed AFTER `run` they parse without
  // error but never reach the ingress builder, and cloudflared logs
  // "No ingress rules were defined ... will return 503 for all incoming HTTP
  // requests" — which is exactly what dev3 did on 2026-08-03. tka-dev survives
  // the same mistake only because that older tunnel carries remote ingress
  // config in Cloudflare; tka-dev2/tka-dev3 have none and depend on --url.
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
