#!/usr/bin/env node
// Screenshots both the connected iPhone and Android phone in parallel.
// Real framebuffers — includes system UI, status bar, notch, native dialogs.
//
// Prereqs:
//   - Android: USB debugging enabled, adb sees the device.
//   - iOS: device paired, Developer Mode on, and pymobiledevice3 tunnel running.
//     One-time per boot, open an ELEVATED (run-as-admin) terminal and run:
//       py -m pymobiledevice3 remote tunneld
//     Leave it running. (It creates a virtual network interface, hence admin.)
//
// Usage:
//   node scripts/capture-devices.cjs            // both devices
//   node scripts/capture-devices.cjs ios        // iPhone only
//   node scripts/capture-devices.cjs android    // Android only

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ADB = "C:/Users/Austen/AppData/Local/Android/Sdk/platform-tools/adb.exe";
const SAVE_DIR = path.join(__dirname, "..", ".screenshots");
fs.mkdirSync(SAVE_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const which = (process.argv[2] || "both").toLowerCase();

function pickAndroidSerial() {
  const { execSync } = require("child_process");
  try {
    const out = execSync(`"${ADB}" devices`, { encoding: "utf8" });
    const lines = out
      .split(/\r?\n/)
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l.endsWith("\tdevice"));
    if (lines.length === 0) return null;
    // Prefer physical serial over wireless adb-tls entry.
    const physical = lines.find((l) => !l.startsWith("adb-"));
    const pick = physical ?? lines[0];
    return pick.split("\t")[0];
  } catch {
    return null;
  }
}

function captureAndroid() {
  return new Promise((resolve) => {
    const out = path.join(SAVE_DIR, `${stamp}_android.png`);
    const serial = pickAndroidSerial();
    const args = serial
      ? ["-s", serial, "exec-out", "screencap", "-p"]
      : ["exec-out", "screencap", "-p"];
    const child = spawn(ADB, args);
    const file = fs.createWriteStream(out);
    let err = "";
    child.stdout.pipe(file);
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => {
      file.close(() => {
        if (code !== 0 || !fs.existsSync(out) || fs.statSync(out).size < 1000) {
          try {
            fs.unlinkSync(out);
          } catch {}
          resolve({
            device: "android",
            ok: false,
            error: err.trim() || `adb exit ${code} / empty output`,
          });
        } else {
          resolve({
            device: "android",
            ok: true,
            path: out,
            bytes: fs.statSync(out).size,
          });
        }
      });
    });
    child.on("error", (e) =>
      resolve({ device: "android", ok: false, error: e.message })
    );
  });
}

function captureIPhone() {
  return new Promise((resolve) => {
    const out = path.join(SAVE_DIR, `${stamp}_iphone.png`);
    const child = spawn(
      "py",
      ["-m", "pymobiledevice3", "developer", "dvt", "screenshot", out],
      { shell: false }
    );
    let err = "";
    let stdout = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", (code) => {
      if (code !== 0 || !fs.existsSync(out) || fs.statSync(out).size < 1000) {
        try {
          fs.unlinkSync(out);
        } catch {}
        const msg = (err + stdout).toLowerCase();
        const hint = msg.includes("tunneld")
          ? "Tunnel not running. Open an ELEVATED terminal and run:\n" +
            "    py -m pymobiledevice3 remote tunneld\n" +
            "  Leave it running, then retry."
          : null;
        resolve({
          device: "iphone",
          ok: false,
          error: err.trim() || `exit ${code}`,
          hint,
        });
      } else {
        resolve({
          device: "iphone",
          ok: true,
          path: out,
          bytes: fs.statSync(out).size,
        });
      }
    });
    child.on("error", (e) =>
      resolve({ device: "iphone", ok: false, error: e.message })
    );
  });
}

(async () => {
  const jobs = [];
  if (which === "both" || which === "android") jobs.push(captureAndroid());
  if (which === "both" || which === "ios" || which === "iphone")
    jobs.push(captureIPhone());

  const results = await Promise.all(jobs);
  let anyFail = false;
  for (const r of results) {
    if (r.ok) {
      console.log(
        `[ok]  ${r.device.padEnd(8)} ${path.relative(process.cwd(), r.path)} (${(r.bytes / 1024).toFixed(0)} KB)`
      );
      // Also maintain latest_<device>.png for easy overwrite/read pattern.
      const latest = path.join(SAVE_DIR, `latest_${r.device}.png`);
      fs.copyFileSync(r.path, latest);
    } else {
      anyFail = true;
      console.error(`[err] ${r.device.padEnd(8)} ${r.error}`);
      if (r.hint) console.error(`      ${r.hint.replace(/\n/g, "\n      ")}`);
    }
  }
  process.exit(anyFail ? 1 : 0);
})();
