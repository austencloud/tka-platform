#!/usr/bin/env node
/**
 * Video Export Verification Script
 *
 * Inspects exported MP4 files to verify FPS, resolution, duration, and codec settings.
 * Uses ffprobe (bundled with ffmpeg) for metadata extraction.
 *
 * Usage:
 *   node scripts/verify-export.cjs <path-to-mp4>
 *   node scripts/verify-export.cjs <path-to-mp4> --expect-fps=30 --expect-resolution=720
 *   node scripts/verify-export.cjs <directory>  (checks all .mp4 files in directory)
 *
 * Options:
 *   --expect-fps=<number>        Verify frame rate matches
 *   --expect-resolution=<number> Verify height matches (720 or 1080)
 *   --expect-duration=<seconds>  Verify duration is within 0.5s of expected
 *   --expect-codec=<string>      Verify video codec (default: h264)
 *   --json                       Output raw JSON instead of formatted table
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const FFPROBE_PATH = "C:/ffmpeg/ffmpeg-8.0.1-essentials_build/bin/ffprobe.exe";

function findMp4Files(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    return [targetPath];
  }
  if (stat.isDirectory()) {
    return fs
      .readdirSync(targetPath)
      .filter((f) => f.toLowerCase().endsWith(".mp4"))
      .map((f) => path.join(targetPath, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  }
  return [];
}

function probeFile(filePath) {
  const cmd = [
    `"${FFPROBE_PATH}"`,
    "-v quiet",
    "-print_format json",
    "-show_format",
    "-show_streams",
    `"${filePath}"`,
  ].join(" ");

  try {
    const output = execSync(cmd, { encoding: "utf8", timeout: 10000 });
    return JSON.parse(output);
  } catch (err) {
    return { error: err.message };
  }
}

function extractVideoInfo(probeData, filePath) {
  if (probeData.error) {
    return { file: path.basename(filePath), error: probeData.error };
  }

  const videoStream = (probeData.streams || []).find(
    (s) => s.codec_type === "video"
  );
  if (!videoStream) {
    return { file: path.basename(filePath), error: "No video stream found" };
  }

  // Parse frame rate from r_frame_rate (e.g., "60/1" or "30000/1001")
  const [fpsNum, fpsDen] = (videoStream.r_frame_rate || "0/1").split("/");
  const fps = Math.round((parseInt(fpsNum) / parseInt(fpsDen)) * 100) / 100;

  // Parse average frame rate
  const [avgNum, avgDen] = (videoStream.avg_frame_rate || "0/1").split("/");
  const avgFps = Math.round((parseInt(avgNum) / parseInt(avgDen)) * 100) / 100;

  const duration = parseFloat(probeData.format?.duration || videoStream.duration || "0");
  const fileSize = parseInt(probeData.format?.size || "0");
  const bitrate = parseInt(probeData.format?.bit_rate || "0");

  return {
    file: path.basename(filePath),
    fullPath: filePath,
    codec: videoStream.codec_name,
    profile: videoStream.profile,
    level: videoStream.level,
    width: videoStream.width,
    height: videoStream.height,
    fps,
    avgFps,
    duration: Math.round(duration * 100) / 100,
    totalFrames: parseInt(videoStream.nb_frames || "0"),
    fileSize,
    fileSizeMB: Math.round((fileSize / 1024 / 1024) * 100) / 100,
    bitrate,
    bitrateMbps: Math.round((bitrate / 1_000_000) * 100) / 100,
    pixelFormat: videoStream.pix_fmt,
  };
}

function verifyExpectations(info, expectations) {
  const results = [];

  if (expectations.fps !== undefined) {
    const tolerance = 1; // Allow 1fps tolerance
    const pass = Math.abs(info.fps - expectations.fps) <= tolerance;
    results.push({
      check: "FPS",
      expected: expectations.fps,
      actual: info.fps,
      pass,
    });
  }

  if (expectations.resolution !== undefined) {
    const pass = info.height === expectations.resolution;
    results.push({
      check: "Resolution",
      expected: `${expectations.resolution}p`,
      actual: `${info.height}p (${info.width}x${info.height})`,
      pass,
    });
  }

  if (expectations.duration !== undefined) {
    const tolerance = 0.5;
    const pass = Math.abs(info.duration - expectations.duration) <= tolerance;
    results.push({
      check: "Duration",
      expected: `${expectations.duration}s`,
      actual: `${info.duration}s`,
      pass,
    });
  }

  if (expectations.codec !== undefined) {
    const pass = info.codec === expectations.codec;
    results.push({
      check: "Codec",
      expected: expectations.codec,
      actual: info.codec,
      pass,
    });
  }

  return results;
}

function formatTable(info) {
  const lines = [
    "",
    `  File: ${info.file}`,
    `  ${"=".repeat(60)}`,
    `  Codec:      ${info.codec} (${info.profile}, level ${info.level})`,
    `  Resolution:  ${info.width} x ${info.height}`,
    `  Frame Rate:  ${info.fps} fps (avg: ${info.avgFps} fps)`,
    `  Duration:    ${info.duration}s (${info.totalFrames} frames)`,
    `  File Size:   ${info.fileSizeMB} MB`,
    `  Bitrate:     ${info.bitrateMbps} Mbps`,
    `  Pixel Fmt:   ${info.pixelFormat}`,
    "",
  ];
  return lines.join("\n");
}

function formatVerification(results) {
  if (results.length === 0) return "";

  const lines = ["  Verification:", "  " + "-".repeat(50)];
  let allPass = true;

  for (const r of results) {
    const icon = r.pass ? "PASS" : "FAIL";
    lines.push(`    ${icon}  ${r.check}: expected ${r.expected}, got ${r.actual}`);
    if (!r.pass) allPass = false;
  }

  lines.push("  " + "-".repeat(50));
  lines.push(allPass ? "  ALL CHECKS PASSED" : "  SOME CHECKS FAILED");
  lines.push("");

  return lines.join("\n");
}

// --- Main ---

function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const flags = {};
  const positional = [];
  for (const arg of args) {
    if (arg.startsWith("--expect-fps=")) {
      flags.fps = parseFloat(arg.split("=")[1]);
    } else if (arg.startsWith("--expect-resolution=")) {
      flags.resolution = parseInt(arg.split("=")[1]);
    } else if (arg.startsWith("--expect-duration=")) {
      flags.duration = parseFloat(arg.split("=")[1]);
    } else if (arg.startsWith("--expect-codec=")) {
      flags.codec = arg.split("=")[1];
    } else if (arg === "--json") {
      flags.json = true;
    } else {
      positional.push(arg);
    }
  }

  if (positional.length === 0) {
    // Default: check Downloads folder for most recent MP4
    const downloads = path.join(process.env.USERPROFILE || process.env.HOME, "Downloads");
    const mp4s = findMp4Files(downloads);
    if (mp4s.length === 0) {
      console.error("No MP4 files found in Downloads. Pass a path as argument.");
      process.exit(1);
    }
    // Take most recent
    positional.push(mp4s[0]);
    console.log(`  Auto-detected most recent MP4 in Downloads:\n  ${mp4s[0]}\n`);
  }

  // Verify ffprobe exists
  if (!fs.existsSync(FFPROBE_PATH)) {
    console.error(`ffprobe not found at: ${FFPROBE_PATH}`);
    console.error("Install ffmpeg or update FFPROBE_PATH in this script.");
    process.exit(1);
  }

  let allPassed = true;

  for (const target of positional) {
    const files = findMp4Files(target);
    if (files.length === 0) {
      console.error(`No MP4 files found at: ${target}`);
      continue;
    }

    for (const file of files) {
      const probeData = probeFile(file);
      const info = extractVideoInfo(probeData, file);

      if (info.error) {
        console.error(`  ERROR: ${info.file}: ${info.error}`);
        allPassed = false;
        continue;
      }

      if (flags.json) {
        console.log(JSON.stringify(info, null, 2));
      } else {
        console.log(formatTable(info));
      }

      const hasExpectations = flags.fps || flags.resolution || flags.duration || flags.codec;
      if (hasExpectations) {
        const results = verifyExpectations(info, flags);
        console.log(formatVerification(results));
        if (results.some((r) => !r.pass)) allPassed = false;
      }
    }
  }

  process.exit(allPassed ? 0 : 1);
}

main();
