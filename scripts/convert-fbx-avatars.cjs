/**
 * Convert Mixamo FBX character models to GLB and register as village avatars.
 *
 * Usage: node scripts/convert-fbx-avatars.cjs [source-dir]
 * Default source: F:/Downloads
 *
 * Uses Godot's FBX2glTF binary for reliable conversion.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SOURCE_DIR = process.argv[2] || "F:/Downloads";
const OUTPUT_DIR = path.resolve(__dirname, "../static/models/avatars");
const FBX2GLTF = path.resolve(__dirname, "FBX2glTF.exe");
const DEFINITIONS_FILE = path.resolve(
  __dirname,
  "../src/lib/shared/3d/config/avatar-definitions.ts"
);
const VILLAGE_WORLD_FILE = path.resolve(
  __dirname,
  "../src/lib/features/village/engine/VillageWorld.ts"
);

const CHARACTER_NAMES = {
  ch01: "Marcus", ch07: "Jade", ch10: "Viktor", ch12: "Luna",
  ch14: "Kai", ch15: "Aria", ch17: "Dante", ch18: "Nora",
  ch21: "Felix", ch22: "Maya", ch24: "Leo", ch26: "Zara",
  ch29: "Orion", ch31: "Ivy", ch33: "Axel", ch34: "Suki",
  ch36: "Rex", ch38: "Pearl", ch41: "Blake", ch42: "Sage",
  ch44: "Quinn", ch46: "Nova",
};

function main() {
  if (!fs.existsSync(FBX2GLTF)) {
    console.error(`FBX2glTF not found at ${FBX2GLTF}`);
    console.error("Download from: https://github.com/godotengine/FBX2glTF/releases");
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Find character FBX files (Ch##_nonPBR.fbx pattern)
  const files = fs.readdirSync(SOURCE_DIR).filter(f => /^Ch\d+.*\.fbx$/i.test(f));
  if (files.length === 0) {
    console.log(`No Ch*.fbx files found in ${SOURCE_DIR}`);
    return;
  }

  console.log(`Found ${files.length} character models in ${SOURCE_DIR}`);

  const existingContent = fs.readFileSync(DEFINITIONS_FILE, "utf-8");
  const newAvatars = [];

  for (const file of files) {
    const match = file.match(/^(Ch(\d+))/i);
    if (!match) continue;

    const id = match[1].toLowerCase(); // e.g. "ch01"
    const num = match[2]; // e.g. "01"

    if (existingContent.includes(`"${id}"`)) {
      console.log(`  Skipping ${id} — already registered`);
      continue;
    }

    const fbxPath = path.join(SOURCE_DIR, file).replace(/\\/g, "/");
    const glbFilename = `${id}.glb`;
    const glbPath = path.join(OUTPUT_DIR, glbFilename).replace(/\\/g, "/");

    console.log(`  Converting ${file} → ${glbFilename}...`);

    try {
      // FBX2glTF outputs to <input>_out/<input>.glb by default
      // Use --output to specify exact path
      execSync(
        `"${FBX2GLTF}" --binary --input "${fbxPath}" --output "${glbPath.replace('.glb', '')}"`,
        { stdio: "pipe", timeout: 30000 }
      );

      // FBX2glTF appends .glb automatically
      const actualPath = glbPath;
      if (!fs.existsSync(actualPath)) {
        // Check if it created the file without .glb extension
        console.log(`    ✗ Output file not found at ${actualPath}`);
        // List what was created
        const dir = path.dirname(glbPath);
        const created = fs.readdirSync(dir).filter(f => f.startsWith(id));
        console.log(`    Created files: ${created.join(", ")}`);
        continue;
      }

      const stats = fs.statSync(actualPath);
      console.log(`    ✓ ${(stats.size / 1024 / 1024).toFixed(1)} MB`);

      const name = CHARACTER_NAMES[id] || `Character ${num}`;
      newAvatars.push({ id, name, filename: glbFilename });
    } catch (err) {
      console.error(`    ✗ Failed: ${err.message?.split("\n")[0]}`);
    }
  }

  if (newAvatars.length === 0) {
    console.log("\nNo new avatars to register.");
    return;
  }

  // Update avatar-definitions.ts
  console.log(`\nRegistering ${newAvatars.length} new avatars...`);

  const entries = newAvatars.map(a =>
    `  {\n    id: "${a.id}",\n    name: "${a.name}",\n    modelPath: "/models/avatars/${a.filename}",\n    icon: "fa-person",\n    description: "Mixamo ${a.name}",\n  }`
  ).join(",\n");

  const closingBracket = existingContent.lastIndexOf("];");
  const before = existingContent.slice(0, closingBracket).trimEnd();
  const after = existingContent.slice(closingBracket);
  const comma = before.endsWith(",") ? "\n" : ",\n";
  const updated = before + comma + entries + "\n" + after;
  fs.writeFileSync(DEFINITIONS_FILE, updated);
  console.log(`  Updated avatar-definitions.ts`);

  // Update VillageWorld.ts AVATAR_MODELS array
  const villageContent = fs.readFileSync(VILLAGE_WORLD_FILE, "utf-8");
  const modelMatch = villageContent.match(/const AVATAR_MODELS = \[(.*?)\]/s);
  if (modelMatch) {
    const existingIds = modelMatch[1].match(/"[^"]+"/g) || [];
    const newIds = newAvatars.map(a => `"${a.id}"`);
    const allIds = [...new Set([...existingIds, ...newIds])];
    const newArray = `const AVATAR_MODELS = [${allIds.join(", ")}]`;
    const updatedVillage = villageContent.replace(
      /const AVATAR_MODELS = \[.*?\]/s,
      newArray
    );
    fs.writeFileSync(VILLAGE_WORLD_FILE, updatedVillage);
    console.log(`  Updated VillageWorld.ts with ${allIds.length} models`);
  }

  console.log(`\nDone! ${newAvatars.length} avatars converted and registered.`);
}

main();
