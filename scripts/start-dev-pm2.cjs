// pm2 entry point for the TKA dev server. pm2's direct .exe spawning is
// unreliable on Windows (powershell exits instantly with empty logs), but its
// node-script handling is first-class — so this shim spawns start-dev.ps1 and
// bridges lifecycle both ways: child exit -> process exit (pm2 restarts us),
// pm2 stop/restart -> tree-kill the whole powershell/vite/cloudflared family.
const { spawn, execSync } = require("child_process");
const path = require("path");

const child = spawn(
  "powershell.exe",
  ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "start-dev.ps1")],
  { cwd: path.join(__dirname, ".."), stdio: ["ignore", "inherit", "inherit"] }
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
