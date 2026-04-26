const fs = require("fs");
const path = require("path");

const SPECS_DIR = path.join(__dirname, "..", "docs", "superpowers", "specs");
const PLANS_DIR = path.join(__dirname, "..", "docs", "superpowers", "plans");

const planFiles = [
  ...fs.readdirSync(path.join(PLANS_DIR, "backlog")).map((f) => `plans/backlog/${f}`),
  ...fs.readdirSync(path.join(PLANS_DIR, "active")).map((f) => `plans/active/${f}`),
];

function extractSlug(filename) {
  return filename
    .replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .replace(/-design\.md$/, "")
    .replace(/-scoping-memo\.md$/, "")
    .replace(/\.md$/, "");
}

function findMatchingPlan(specFilename) {
  const specSlug = extractSlug(specFilename);
  for (const planPath of planFiles) {
    const planFile = path.basename(planPath);
    const planSlug = extractSlug(planFile);
    if (
      specSlug === planSlug ||
      specSlug.startsWith(planSlug) ||
      planSlug.startsWith(specSlug)
    ) {
      return planPath;
    }
  }
  return "";
}

const fixups = {
  "2026-03-19-unified-create-tab-hints-design.md": {
    status: "backlog",
    value: 4,
    effort: "S",
    remaining: "Full build — contextual create tab instruction hints",
    remove: ["shipped"],
  },
  "2026-04-17-level-modal-redesign-design.md": {
    status: "backlog",
    value: 4,
    effort: "S",
    remaining: "Full build — level modal UI redesign",
    remove: ["shipped"],
  },
  "2026-03-31-effect-state-unification-design.md": {
    status: "backlog",
    value: 5,
    effort: "S",
    remaining: "Trail path into tipEffectMap, localStorage key cleanup",
    remove: ["shipped"],
  },
  "2026-03-17-create-offline-persistence-design.md": {
    status: "backlog",
    value: 4,
    effort: "S",
    remaining: "Verify offline save-to-library e2e",
    remove: ["shipped"],
  },
};

function processSpec(filepath) {
  const content = fs.readFileSync(filepath, "utf8");
  const filename = path.basename(filepath);

  if (!content.startsWith("---")) {
    console.log(`  SKIP (no frontmatter): ${filename}`);
    return;
  }

  const endIdx = content.indexOf("---", 3);
  if (endIdx === -1) return;

  const frontmatter = content.substring(3, endIdx).trim();
  const body = content.substring(endIdx + 3);

  const fields = {};
  const fieldOrder = [];

  for (const line of frontmatter.split("\n")) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const key = match[1];
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      fields[key] = val;
      fieldOrder.push(key);
    }
  }

  const fix = fixups[filename];
  if (fix) {
    if (fix.status) fields.status = fix.status;
    if (fix.value) fields.value = fix.value;
    if (fix.effort) fields.effort = fix.effort;
    if (fix.remaining) fields.remaining = fix.remaining;
    if (fix.remove) {
      for (const key of fix.remove) {
        delete fields[key];
      }
    }
    console.log(`  FIXED misplaced: ${filename}`);
  }

  delete fields.score;

  if (fields.blocked_by !== undefined) {
    fields.depends_on = fields.blocked_by;
    delete fields.blocked_by;
  }

  if (!fields.depends_on && fields.depends_on !== "") {
    fields.depends_on = "";
  }

  if (!fields.plan_path && fields.plan_path !== "") {
    fields.plan_path = findMatchingPlan(filename);
  }

  if (!fields.tags) {
    fields.tags = "[]";
  }

  const orderedKeys = [
    "status",
    "value",
    "effort",
    "remaining",
    "depends_on",
    "plan_path",
    "tags",
    "last_triaged",
  ];

  const lines = [];
  for (const key of orderedKeys) {
    if (fields[key] === undefined) continue;
    const val = fields[key];
    if (key === "tags") {
      lines.push(`tags: ${val === "[]" ? "[]" : val}`);
    } else if (key === "value" || key === "last_triaged") {
      lines.push(`${key}: ${val}`);
    } else if (typeof val === "string" && /[:#\[\]{}|>&*!?,]/.test(val)) {
      lines.push(`${key}: "${val}"`);
    } else if (val === "") {
      lines.push(`${key}: ""`);
    } else {
      lines.push(`${key}: ${val}`);
    }
  }

  const newContent = `---\n${lines.join("\n")}\n---${body}`;
  fs.writeFileSync(filepath, newContent, "utf8");
}

let count = 0;
for (const subdir of ["active", "backlog"]) {
  const dir = path.join(SPECS_DIR, subdir);
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    processSpec(path.join(dir, file));
    count++;
  }
}

console.log(`\nProcessed ${count} specs.`);
