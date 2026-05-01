const fs = require("fs");
const path = require("path");

const specDir = "docs/superpowers/specs";
const specs = {};
function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walkDir(path.join(dir, entry.name));
    else if (entry.name.endsWith(".md")) {
      const subdir = path.relative(specDir, dir).replace(/\\/g, "/");
      let base = entry.name.replace(".md", "");
      if (base.endsWith("-design")) base = base.slice(0, -7);
      specs[base] = { subdir: subdir === "." ? "" : subdir, fname: entry.name };
    }
  }
}
walkDir(specDir);

const planDir = "docs/superpowers/plans";
const plans = {};
for (const f of fs.readdirSync(planDir)) {
  if (f.endsWith(".md")) {
    const base = f.replace(".md", "");
    plans[base] = f;
  }
}

const specMatched = new Set();
const planMatched = new Set();

// Pass 1: exact match
for (const slug of Object.keys(specs)) {
  if (plans[slug]) {
    specMatched.add(slug);
    planMatched.add(slug);
  }
}

// Pass 2: fuzzy match by date + word overlap
for (const slug of Object.keys(specs)) {
  if (specMatched.has(slug)) continue;
  const m = slug.match(/^(\d{4}-\d{2}-\d{2})-(.*)$/);
  if (!m) continue;
  const date = m[1];
  const topic = m[2];
  const twords = new Set(topic.split("-"));
  let best = null;
  let bestScore = 0;
  for (const pslug of Object.keys(plans)) {
    const pm = pslug.match(/^(\d{4}-\d{2}-\d{2})-(.*)$/);
    if (!pm) continue;
    if (pm[1] !== date) continue;
    const pwords = new Set(pm[2].split("-"));
    const overlap = [...twords].filter(w => pwords.has(w)).length;
    const minLen = Math.min(twords.size, pwords.size);
    if (overlap >= 2 && overlap >= minLen * 0.5) {
      const score = overlap / Math.max(twords.size, pwords.size);
      if (score > bestScore) {
        bestScore = score;
        best = pslug;
      }
    }
  }
  if (best && bestScore >= 0.4) {
    specMatched.add(slug);
    planMatched.add(best);
  }
}

// Output
const orphanPlans = Object.keys(plans).filter(p => !planMatched.has(p)).sort();
const orphanSpecs = Object.keys(specs).filter(s => !specMatched.has(s)).sort();

console.log("=== PLANS WITHOUT SPECS (" + orphanPlans.length + ") ===");
for (const pslug of orphanPlans) {
  console.log("  " + plans[pslug]);
}
console.log();
console.log("=== SPECS WITHOUT PLANS (" + orphanSpecs.length + ") ===");
for (const slug of orphanSpecs) {
  const info = specs[slug];
  const loc = info.subdir ? "[" + info.subdir + "] " : "";
  console.log("  " + loc + info.fname);
}

// Also show matched pairs for verification
console.log();
console.log("=== MATCHED PAIRS (" + specMatched.size + ") ===");
