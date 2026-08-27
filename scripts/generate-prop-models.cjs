/**
 * Generate 3D Prop Models via Meshy AI
 *
 * Generates .glb models for each TKA prop type using Meshy's text-to-3D API.
 * Downloads the results to static/models/props/ and updates the registry.
 *
 * Usage:
 *   node scripts/generate-prop-models.cjs --api-key YOUR_MESHY_API_KEY
 *   node scripts/generate-prop-models.cjs --api-key YOUR_KEY --prop club
 *   node scripts/generate-prop-models.cjs --api-key YOUR_KEY --list
 *
 * Requirements:
 *   - Meshy Pro account (https://www.meshy.ai/)
 *   - API key from https://www.meshy.ai/api
 *
 * Each generation costs ~20 credits on Meshy 6.
 * 13 base props × 20 credits = ~260 credits total.
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// Prop definitions — carefully crafted prompts for each prop type

const PROP_DEFINITIONS = {
  staff: {
    prompt:
      "A flow arts staff prop, straight cylindrical wooden staff about 4 feet long and 1 inch diameter, " +
      "with a perpendicular T-bar crosspiece at one end (the thumb end) and a rounded rubber cap at the other end, " +
      "a rubber grip ring wrapped around the center where the hand holds it, " +
      "clean simple design, solid colored, no decorations, white background",
    style: "low-poly",
    negativePrompt: "fire, flames, person, hand, ornate decorations",
  },
  club: {
    prompt:
      "A juggling club prop, bowling-pin shaped, about 20 inches long, " +
      "thin handle at one end with a small knob, widening gradually into a fat bulbous body, " +
      "tapering to a rounded head at the other end, " +
      "smooth solid surface, single color, held at the thin handle end, white background",
    style: "low-poly",
    negativePrompt: "fire, flames, person, hand, ornate decorations, Indian club",
  },
  fan: {
    prompt:
      "A flow arts folding fan prop, semicircular fabric blade spread open about 150 degrees, " +
      "with thin rigid spine ribs radiating from a pivot handle at the base, " +
      "short tapered grip handle below the pivot, " +
      "flat fan shape, solid colored fabric, white background",
    style: "low-poly",
    negativePrompt: "electric fan, ceiling fan, person, hand, ornate patterns",
  },
  buugeng: {
    prompt:
      "A buugeng flow prop, an S-shaped curved staff, smooth continuous S-curve from end to end, " +
      "about 2 feet long, uniform tube diameter throughout, " +
      "grip in the center of the S-curve, rounded end caps, " +
      "solid colored, smooth surface, white background",
    style: "low-poly",
    negativePrompt: "person, hand, ornate decorations, straight staff",
  },
  triad: {
    prompt:
      "A triad flow prop, Y-shaped with three equal-length arms radiating from a central hub at 120 degree angles, " +
      "each arm is a smooth cylindrical tube about 10 inches long, " +
      "central hub is a sphere slightly larger than the arms, " +
      "rounded end caps on each arm tip, solid colored, white background",
    style: "low-poly",
    negativePrompt: "person, hand, ornate decorations",
  },
  minihoop: {
    prompt:
      "A mini hoop flow arts prop, a simple circular ring about 24 inches diameter, " +
      "the tube thickness is about 3/4 inch, like polypro tubing, " +
      "smooth continuous circle, no gap, solid single color, " +
      "simple clean hoop, white background",
    style: "low-poly",
    negativePrompt: "hula hoop, person, hand, decorations, LED, tape",
  },
  sword: {
    prompt:
      "A flow arts sword prop, straight flat blade tapering to a point, " +
      "perpendicular crossguard at the grip, short wrapped handle with round pommel, " +
      "blade is metallic silver, guard and pommel are gold, handle is dark brown leather, " +
      "medieval arming sword style, about 30 inches total length, white background",
    style: "low-poly",
    negativePrompt: "person, hand, scabbard, shield, ornate engravings",
  },
  torch: {
    prompt:
      "A fire spinning torch prop, long straight metal shaft about 20 inches, " +
      "with wrapped dark kevlar wick at one end (wider than the shaft, like wrapped cloth), " +
      "small rounded pommel cap at the other end, " +
      "grip ring in the area near the pommel end, no fire or flames, unlit, white background",
    style: "low-poly",
    negativePrompt: "fire, flames, lit, burning, person, hand",
  },
  guitar: {
    prompt:
      "A prop guitar for flow arts, simplified guitar shape, " +
      "long thin neck extending from a figure-8 shaped body with upper and lower bout, " +
      "small headstock at the end of the neck, " +
      "dark sound hole circle on the body face, " +
      "no strings, simplified smooth shape, solid colored, white background",
    style: "low-poly",
    negativePrompt: "person, hand, strings, tuning pegs, realistic guitar",
  },
  chicken: {
    prompt:
      "A chicken stick flow prop, a very thin straight stick about 3 feet long, " +
      "uniform thin cylindrical shape throughout, slightly thinner than a staff, " +
      "small rounded caps on both ends, grip ring at the center, " +
      "like a thin dowel rod, solid colored, white background",
    style: "low-poly",
    negativePrompt: "person, hand, chicken animal, feathers",
  },
  doublestar: {
    prompt:
      "A doublestar flow prop, two four-pointed star shapes connected by a short bar at their centers, " +
      "each star is like a ring with 4 pointed protrusions, stacked vertically, " +
      "grip ring where the connecting bar meets, " +
      "solid colored, symmetrical, white background",
    style: "low-poly",
    negativePrompt: "person, hand, ornate decorations",
  },
  triquetra: {
    prompt:
      "A triquetra flow prop, three interlocked circular arcs forming a trefoil knot pattern, " +
      "each arc is a partial ring that weaves through the others, " +
      "like a Celtic triquetra symbol made from tubing, " +
      "small hub at the center, solid colored, white background",
    style: "low-poly",
    negativePrompt: "person, hand, ornate decorations, flat 2D symbol",
  },
  eightrings: {
    prompt:
      "An eight-rings flow prop, a figure-8 shape made from two connected rings, " +
      "upper ring and lower ring overlap at the center where the hand grips, " +
      "rings are slightly tilted relative to each other creating a 3D figure-8, " +
      "uniform tube thickness, solid colored, white background",
    style: "low-poly",
    negativePrompt: "person, hand, ornate decorations, flat 2D",
  },
};

// Meshy API client

const MESHY_API_BASE = "https://api.meshy.ai";

function meshyRequest(apiKey, method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, MESHY_API_BASE);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function createTextTo3D(apiKey, propName, definition) {
  console.log(`\n🎨 Generating ${propName}...`);
  console.log(`   Prompt: "${definition.prompt.substring(0, 80)}..."`);

  const result = await meshyRequest(apiKey, "POST", "/openapi/v2/text-to-3d", {
    mode: "preview",
    prompt: definition.prompt,
    negative_prompt: definition.negativePrompt || "",
    art_style: definition.style || "realistic",
    should_remesh: true,
    topology: "triangle",
    target_polycount: 5000,
  });

  if (result.status !== 200 && result.status !== 202) {
    console.error(`   ❌ Failed to create task: ${JSON.stringify(result.data)}`);
    return null;
  }

  const taskId = result.data.result;
  console.log(`   Task created: ${taskId}`);
  return taskId;
}

async function pollTask(apiKey, taskId) {
  const maxAttempts = 60; // 5 minutes max
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(5000);

    const result = await meshyRequest(
      apiKey,
      "GET",
      `/openapi/v2/text-to-3d/${taskId}`
    );

    if (result.status !== 200) {
      console.error(`   ❌ Poll failed: ${JSON.stringify(result.data)}`);
      return null;
    }

    const status = result.data.status;
    const progress = result.data.progress || 0;

    if (status === "SUCCEEDED") {
      console.log(`   ✅ Complete!`);
      return result.data;
    } else if (status === "FAILED" || status === "EXPIRED") {
      console.error(
        `   ❌ Task ${status}: ${result.data.task_error?.message || "unknown"}`
      );
      return null;
    }

    process.stdout.write(`   ⏳ ${status} ${progress}%\r`);
  }

  console.error(`   ❌ Timed out after 5 minutes`);
  return null;
}

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
          downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
          return;
        }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const apiKeyIdx = args.indexOf("--api-key");
  const propIdx = args.indexOf("--prop");
  const listFlag = args.includes("--list");

  if (listFlag) {
    console.log("\nAvailable props to generate:\n");
    for (const [name, def] of Object.entries(PROP_DEFINITIONS)) {
      console.log(`  ${name.padEnd(15)} ${def.prompt.substring(0, 60)}...`);
    }
    console.log(`\nTotal: ${Object.keys(PROP_DEFINITIONS).length} props`);
    return;
  }

  if (apiKeyIdx === -1 || !args[apiKeyIdx + 1]) {
    console.error(
      "Usage: node scripts/generate-prop-models.cjs --api-key YOUR_KEY [--prop name]"
    );
    console.error("       node scripts/generate-prop-models.cjs --list");
    process.exit(1);
  }

  const apiKey = args[apiKeyIdx + 1];
  const specificProp = propIdx !== -1 ? args[propIdx + 1] : null;
  const outputDir = path.join(__dirname, "..", "static", "models", "props");

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Determine which props to generate
  const propsToGenerate = specificProp
    ? { [specificProp]: PROP_DEFINITIONS[specificProp] }
    : PROP_DEFINITIONS;

  if (specificProp && !PROP_DEFINITIONS[specificProp]) {
    console.error(`Unknown prop: ${specificProp}`);
    console.error(
      `Available: ${Object.keys(PROP_DEFINITIONS).join(", ")}`
    );
    process.exit(1);
  }

  console.log(`\n🏭 TKA 3D Prop Model Generator`);
  console.log(`   Output: ${outputDir}`);
  console.log(
    `   Props: ${Object.keys(propsToGenerate).length} to generate\n`
  );

  const results = {};

  for (const [propName, definition] of Object.entries(propsToGenerate)) {
    const glbPath = path.join(outputDir, `${propName}.glb`);

    // Skip if already exists
    if (fs.existsSync(glbPath)) {
      console.log(`⏭️  ${propName}.glb already exists, skipping`);
      results[propName] = { status: "skipped" };
      continue;
    }

    // Create generation task
    const taskId = await createTextTo3D(apiKey, propName, definition);
    if (!taskId) {
      results[propName] = { status: "failed", error: "task creation" };
      continue;
    }

    // Poll until complete
    const taskResult = await pollTask(apiKey, taskId);
    if (!taskResult) {
      results[propName] = { status: "failed", error: "generation" };
      continue;
    }

    // Find GLB download URL
    const glbUrl =
      taskResult.model_urls?.glb || taskResult.model_url?.glb || null;

    if (!glbUrl) {
      console.error(`   ❌ No GLB URL in result for ${propName}`);
      results[propName] = { status: "failed", error: "no glb url" };
      continue;
    }

    // Download the GLB
    console.log(`   📥 Downloading ${propName}.glb...`);
    try {
      await downloadFile(glbUrl, glbPath);
      const stats = fs.statSync(glbPath);
      console.log(
        `   💾 Saved: ${glbPath} (${(stats.size / 1024).toFixed(1)} KB)`
      );
      results[propName] = { status: "success", size: stats.size };
    } catch (err) {
      console.error(`   ❌ Download failed: ${err.message}`);
      results[propName] = { status: "failed", error: "download" };
    }

    // Brief pause between generations to be nice to the API
    await sleep(2000);
  }

  // Summary
  console.log("\n📊 Generation Summary:\n");
  for (const [name, result] of Object.entries(results)) {
    const icon =
      result.status === "success"
        ? "✅"
        : result.status === "skipped"
          ? "⏭️"
          : "❌";
    const detail =
      result.status === "success"
        ? `${(result.size / 1024).toFixed(1)} KB`
        : result.status === "skipped"
          ? "already exists"
          : result.error;
    console.log(`  ${icon} ${name.padEnd(15)} ${detail}`);
  }

  // Generate registry update snippet
  const successProps = Object.entries(results).filter(
    ([, r]) => r.status === "success"
  );
  if (successProps.length > 0) {
    console.log("\n📝 Add these to prop-model-registry.ts:\n");
    for (const [name] of successProps) {
      const enumName = name.toUpperCase();
      console.log(
        `  [PropType.${enumName}]: { modelUrl: modelUrl("${name}.glb"), scale: 1, gripOffsetY: 0 },`
      );
    }
  }
}

main().catch(console.error);
