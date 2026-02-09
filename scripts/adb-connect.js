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

const PORT = 5173;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const WATCH_INTERVAL_MS = 5000; // Check for devices every 5 seconds

// Check if running in watch mode
const WATCH_MODE = process.argv.includes("--watch");

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
  const output = exec("adb devices");
  if (!output) return [];

  return output
    .split("\n")
    .slice(1)
    .filter((line) => line.includes("device") && !line.includes("offline"))
    .map((line) => line.split("\t")[0]);
}

function setupReversePort(device) {
  // Remove existing reverse for this port
  exec(`adb -s ${device} reverse --remove tcp:${PORT} 2>/dev/null`);

  // Set up new reverse
  const result = exec(`adb -s ${device} reverse tcp:${PORT} tcp:${PORT}`);
  return result !== null;
}

function verifyReversePort(device) {
  const list = exec(`adb -s ${device} reverse --list`);
  return list && list.includes(`tcp:${PORT}`);
}

async function main() {
  console.log("🔌 ADB Auto-Connect");
  console.log("─".repeat(40));

  // Check if adb is available
  if (!exec("adb version")) {
    console.log("⚠️  ADB not found in PATH. Skipping device setup.");
    console.log("   Install Android SDK Platform-Tools to enable mobile testing.");
    return { success: false, devices: [] };
  }

  // Get connected devices
  let devices = getConnectedDevices();

  if (devices.length === 0) {
    console.log("📱 No devices connected. Checking for wireless devices...");

    // Try to reconnect to any previously paired wireless devices
    exec("adb reconnect offline");
    await sleep(RETRY_DELAY_MS);
    devices = getConnectedDevices();
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
    console.log("📡 Server will start anyway. Device will auto-connect when available.");
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

  // In watch mode, continue monitoring for devices
  if (WATCH_MODE) {
    // Add already-configured devices to our tracking
    if (result && result.devices) {
      result.devices.forEach((d) => configuredDevices.add(d));
    }
    await watchForDevices();
  }

  // Always exit successfully so the dev server can start
  process.exit(0);
}

run().catch((err) => {
  console.error("Error:", err.message);
  // Still exit successfully - don't block the dev server
  process.exit(0);
});
