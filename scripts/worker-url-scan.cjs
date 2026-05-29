const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = process.cwd().replace(/\\/g, "/");
const files = execSync('git ls-files "src/**/*.ts" "src/**/*.svelte"', {
  encoding: "utf8",
  maxBuffer: 1 << 28,
})
  .split("\n")
  .filter(Boolean);

const re =
  /new URL\(\s*["']([^"']+\.worker\.ts)["']\s*,\s*import\.meta\.url\s*\)/g;

const probs = [];
for (const f of files) {
  let src;
  try {
    src = fs.readFileSync(path.join(root, f), "utf8");
  } catch {
    continue;
  }
  let m;
  while ((m = re.exec(src))) {
    const spec = m[1];
    const target = path.join(path.dirname(path.join(root, f)), spec);
    if (!fs.existsSync(target)) {
      probs.push({
        f,
        spec,
        resolved: path.relative(root, target).replace(/\\/g, "/"),
      });
    }
  }
}

if (!probs.length) console.log("ALL WORKER URLS RESOLVE");
else {
  console.log("BROKEN WORKER URLS (" + probs.length + "):");
  for (const p of probs)
    console.log(`  ${p.f}\n    new URL("${p.spec}")\n    -> ${p.resolved} (MISSING)\n`);
}
