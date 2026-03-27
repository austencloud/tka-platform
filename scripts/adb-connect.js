#!/usr/bin/env node
/**
 * ADB Auto-Connect Script
 * Ensures wireless debugging is connected and port forwarding is set up.
 * Run before starting dev server for mobile testing.
 *
 * Behavior:
 * - If device is available: connects and sets up port forwarding
 * - If no device: prints warning but exits successfully (allows server to start)
 * - Background watcher mode: continuously monitors for devices and auto-connects
 */

import { execSync, spawn } from "child_process";
import { existsSync } from "fs";

const PORT = 5173;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const WATCH_INTERVAL_MS = 5000; // Check for devices every 5 seconds

// Check if running in watch mode
const WATCH_MODE = process.argv.includes("--watch");

// Find adb executable - check PATH first, then known locations
function findAdb() {
  try {
    execSync("adb version", { stdio: "pipe" });
    return "adb";
  } catch {}

  const knownPaths = [
    process.env.LOCALAPPDATA + "\\Android\\Sdk\\platform-tools\\adb.exe",
    "C:\\Users\\" + (process.env.USERNAME || "Austen") + "\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe",
  ];

  for (const p of knownPaths) {
    if (existsSync(p)) return `"${p}"`;
  }

  return null;
}

const ADB = findAdb();

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (e) {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getConnectedDevices() {
  const output = exec(`${ADB} devices`);
  if (!output) return [];

  return output
    .split("\n")
    .slice(1)
    .filter((line) => line.includes("device") && !line.includes("offline"))
    .map((line) => line.split("\t")[0]);
}

function getOfflineDevices() {
  const output = exec(`${ADB} devices`);
  if (!output) return [];

  return output
    .split("\n")
    .slice(1)
    .filter((line) => line.includes("offline"))
    .map((line) => line.split("\t")[0]);
}

function setupReversePort(device) {
  // Remove existing reverse for this port
  exec(`${ADB} -s ${device} reverse --remove tcp:${PORT} 2>/dev/null`);

  // Set up new reverse
  const result = exec(`${ADB} -s ${device} reverse tcp:${PORT} tcp:${PORT}`);
  return result !== null;
}

function verifyReversePort(device) {
  const list = exec(`${ADB} -s ${device} reverse --list`);
  return list && list.includes(`tcp:${PORT}`);
}

function tryMdnsConnect() {
  // adb mdns services lists all wireless debugging devices on the network
  const mdnsOutput = exec(`${ADB} mdns services`);
  if (!mdnsOutput) return false;

  // Look for adb-tls-connect entries (wireless debugging)
  // Format: "service-name	_adb-tls-connect._tcp.	ip:port"
  const lines = mdnsOutput.split("\n");
  for (const line of lines) {
    if (!line.includes("adb-tls-connect")) continue;

    // Extract IP:port from the line
    const match = line.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
    if (match) {
      const addr = `${match[1]}:${match[2]}`;
      console.log(`   📡 Found device via mDNS: ${addr}`);
      const result = exec(`${ADB} connect ${addr}`);
      if (result && result.includes("connected")) {
        return true;
      }
    }
  }
  return false;
}

async function main() {
  console.log("🔌 ADB Auto-Connect");
  console.log("─".repeat(40));

  // Check if adb is available
  if (!ADB) {
    console.log("⚠️  ADB not found. Skipping device setup.");
    console.log("   Install Android SDK Platform-Tools to enable mobile testing.");
    return { success: false, devices: [] };
  }

  // Disconnect any offline/stale devices first
  const offlineDevices = getOfflineDevices();
  for (const d of offlineDevices) {
    console.log(`   Disconnecting stale device: ${d}`);
    exec(`${ADB} disconnect ${d}`);
  }

  // Get connected devices
  let devices = getConnectedDevices();

  if (devices.length === 0) {
    console.log("📱 No devices connected. Trying auto-discovery...");

    // Step 1: Try reconnecting previously paired devices
    exec(`${ADB} reconnect offline`);
    await sleep(RETRY_DELAY_MS);
    devices = getConnectedDevices();

    // Step 2: Try mDNS discovery (finds wireless debugging devices on the network)
    if (devices.length === 0) {
      console.log("📡 Scanning network via mDNS...");
      if (tryMdnsConnect()) {
        await sleep(RETRY_DELAY_MS);
        devices = getConnectedDevices();
      }
    }

    // Step 3: If still nothing, check if adb has any known devices
    if (devices.length === 0) {
      const knownOutput = exec(`${ADB} devices -l`) || "";
      // Sometimes adb knows about devices but they need a kick
      exec(`${ADB} kill-server`);
      await sleep(1500);
      exec(`${ADB} start-server`);
      await sleep(RETRY_DELAY_MS);

      if (tryMdnsConnect()) {
        await sleep(RETRY_DELAY_MS);
        devices = getConnectedDevices();
      }
    }
  }

  if (devices.length === 0) {
    console.log("⚠️  No devices found. Make sure:");
    console.log("   1. Wireless debugging is ON on your phone");
    console.log("   2. Phone and PC are on the same network");
    console.log("   3. You've paired the device at least once");
    console.log("");
    console.log("   To pair a new device:");
    console.log("   adb pair <ip>:<pairing-port>");
    console.log("   adb connect <ip>:<connect-port>");
    console.log("");
    console.log("   Or run: npm run adb:watch (auto-connects when device appears)");
    console.log("");
    console.log("📡 Server will start anyway.");
    return { success: false, devices: [] };
  }

  console.log(`📱 Found ${devices.length} device(s):`);
  devices.forEach((d) => console.log(`   • ${d}`));
  console.log("");

  // Set up reverse port for each device
  let successCount = 0;
  for (const device of devices) {
    console.log(`🔧 Setting up port ${PORT} for ${device}...`);

    let success = false;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (setupReversePort(device) && verifyReversePort(device)) {
        success = true;
        break;
      }
      if (attempt < MAX_RETRIES) {
        console.log(`   Retry ${attempt}/${MAX_RETRIES}...`);
        await sleep(RETRY_DELAY_MS);
      }
    }

    if (success) {
      console.log(`   ✅ localhost:${PORT} → phone`);
      successCount++;
    } else {
      console.log(`   ❌ Failed to set up port forwarding`);
    }
  }

  console.log("");
  if (successCount > 0) {
    console.log(`✅ Ready! Open http://localhost:${PORT} on your phone`);
    return { success: true, devices };
  } else {
    console.log("⚠️  No devices configured successfully, but server will start anyway.");
    return { success: false, devices };
  }
}

// Track which devices we've already set up (for watch mode)
const configuredDevices = new Set();

async function watchForDevices() {
  console.log("");
  console.log("👀 Watching for devices... (Ctrl+C to stop)");
  console.log("─".repeat(40));

  while (true) {
    await sleep(WATCH_INTERVAL_MS);

    const devices = getConnectedDevices();
    const newDevices = devices.filter((d) => !configuredDevices.has(d));

    // If no devices at all, try mDNS discovery periodically
    if (devices.length === 0 && configuredDevices.size === 0) {
      tryMdnsConnect();
      await sleep(RETRY_DELAY_MS);
      const retryDevices = getConnectedDevices();
      retryDevices.forEach((d) => {
        if (!configuredDevices.has(d)) newDevices.push(d);
      });
    }

    if (newDevices.length > 0) {
      console.log("");
      console.log(`📱 New device(s) detected: ${newDevices.join(", ")}`);

      for (const device of newDevices) {
        console.log(`🔧 Setting up port ${PORT} for ${device}...`);

        let success = false;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          if (setupReversePort(device) && verifyReversePort(device)) {
            success = true;
            break;
          }
          if (attempt < MAX_RETRIES) {
            console.log(`   Retry ${attempt}/${MAX_RETRIES}...`);
            await sleep(RETRY_DELAY_MS);
          }
        }

        if (success) {
          console.log(`   ✅ localhost:${PORT} → phone`);
          configuredDevices.add(device);
        } else {
          console.log(`   ❌ Failed to set up port forwarding`);
        }
      }
    }

    // Clean up disconnected devices from our tracking
    for (const configured of configuredDevices) {
      if (!devices.includes(configured)) {
        configuredDevices.delete(configured);
        console.log(`📴 Device disconnected: ${configured}`);
      }
    }
  }
}

async function run() {
  const result = await main();

  // In watch mode, continue monitoring for devices (never exits)
  if (WATCH_MODE) {
    // Add already-configured devices to our tracking
    if (result && result.devices) {
      result.devices.forEach((d) => configuredDevices.add(d));
    }
    await watchForDevices();
    // watchForDevices runs forever — this line is never reached
  }

  // Non-watch mode: exit successfully so chained commands can start
  process.exit(0);
}

run().catch((err) => {
  console.error("Error:", err.message);
  // Still exit successfully - don't block the dev server
  process.exit(0);
});
