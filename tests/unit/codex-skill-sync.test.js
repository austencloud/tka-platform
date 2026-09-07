import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  adaptCodexMarkdown,
  collectExpectedOutputs,
  parseClaudeDocument,
  renderCodexAgent,
  renderCodexSkill,
  renderOpenAiYaml,
  synchronizeCodexSkills,
} from "../../scripts/sync-codex-skills.mjs";

const skillNames = ["audit", "fb", "museum", "screenshots"];

describe("Codex skill synchronization", () => {
  it("reads Claude frontmatter after a managed marker", () => {
    const parsed = parseClaudeDocument(
      `<!-- managed -->\n\n---\ndescription: Use when triaging feedback\nargument-hint: "[id]"\n---\n\n# Feedback`,
      "fb"
    );

    expect(parsed).toMatchObject({
      name: "fb",
      description: "Use when triaging feedback",
      argumentHint: "[id]",
      body: "# Feedback",
    });
  });

  it("renders standards-compliant skill frontmatter and native invocation", () => {
    const rendered = renderCodexSkill(
      `---\ndescription: Use when triaging with /fb\nargument-hint: "[id]"\n---\n\n# Feedback\n\n**Args:** \`$ARGUMENTS\`\n\nRun /fb list.`,
      "fb",
      skillNames
    );

    expect(rendered.content).toMatch(
      /^---\nname: fb\ndescription: Use when triaging with \$fb\n---/
    );
    expect(rendered.content).toContain("text after `$fb` as `<arguments>`");
    expect(rendered.content).toContain("Run $fb list.");
    expect(rendered.content).not.toContain("$ARGUMENTS");
    expect(rendered.content).not.toContain("argument-hint:");
  });

  it("adds UI metadata with explicit dollar invocation", () => {
    const yaml = renderOpenAiYaml({
      name: "fb",
      description: "Use when starting work from the feedback queue",
      body: "# Feedback Workflow",
    });

    expect(yaml).toContain('display_name: "Feedback Workflow"');
    expect(yaml).toContain("Use $fb");
  });

  it("normalizes workflow-first descriptions to trigger-only frontmatter", () => {
    const rendered = renderCodexSkill(
      `---\ndescription: Compose decks. Use when user wants a printable deck.\n---\n\n# Deck Release`,
      "release-deck",
      ["release-deck"]
    );

    expect(rendered.description).toBe(
      "Use when the user wants a printable deck."
    );
  });

  it("rewrites Claude tool and MCP vocabulary", () => {
    const adapted = adaptCodexMarkdown(
      "Use Glob + Grep + Read. Make ONE Bash call. Run mcp__tka-domain__get_term_definition.",
      {
        relativePath: "tika/SKILL.md",
        skillName: "tika",
        skillNames,
      }
    );

    expect(adapted).toContain(
      "file listing, repository search, and targeted reads"
    );
    expect(adapted).toContain("ONE shell call");
    expect(adapted).toContain("get_term_definition");
    expect(adapted).not.toContain("mcp__tka-domain__");
  });

  it("rewrites inherited Bash-only command examples for PowerShell", () => {
    const adapted = adaptCodexMarkdown(
      `# Changelog

\`\`\`bash
git tag -l "v*" --sort=-version:refname | head -1
git log $(git tag -l "v*" --sort=-version:refname | head -1)..HEAD --oneline --no-merges
\`\`\``,
      {
        relativePath: "changelog/SKILL.md",
        skillName: "changelog",
        skillNames,
      }
    );

    expect(adapted).toContain("```powershell");
    expect(adapted).toContain("Select-Object -First 1");
    expect(adapted).not.toContain("head -1");
    expect(adapted).not.toContain("git log $(");
  });

  it("converts Claude agent policy into Codex TOML", () => {
    const agent = renderCodexAgent(
      `---\nname: feedback-triager\ndescription: Use when running /fb\ntools: Bash, Read\nmodel: haiku\n---\n\nMake ONE BASH CALL.`,
      "feedback-triager",
      ["fb"]
    );

    expect(agent.content).toContain('model_reasoning_effort = "low"');
    expect(agent.content).not.toContain('sandbox_mode = "read-only"');
    expect(agent.content).toContain("Use when running $fb");
    expect(agent.content).toContain("ONE SHELL CALL");
  });

  it("keeps read-only evaluator agents sandboxed", () => {
    const agent = renderCodexAgent(
      `---\ndescription: Read-only audit evaluator\nallowed-tools: Read, Glob, Grep, Bash\n---\n\nGrade the evidence.`,
      "audit-evaluator",
      ["audit"]
    );

    expect(agent.content).toContain('sandbox_mode = "read-only"');
  });

  it("makes the TKA expert depend on current flow-arts MCP evidence", () => {
    const agent = renderCodexAgent(
      `---\nname: tka-domain-expert\ndescription: Use for TKA questions\ntools: Read\nmodel: sonnet\n---\n\nRemember the six letter types.`,
      "tka-domain-expert",
      []
    );

    expect(agent.content).toContain("MUST come from a `flow-arts` MCP call");
    expect(agent.content).toContain("generate_sequence");
    expect(agent.content).not.toContain("Remember the six letter types");
  });

  it("removes stale managed files, preserves Codex-only skills, and repairs entry casing", () => {
    const root = mkdtempSync(join(tmpdir(), "codex-skill-sync-"));
    try {
      const sourceDirectory = join(root, ".claude", "skills", "demo");
      mkdirSync(sourceDirectory, { recursive: true });
      mkdirSync(join(root, ".claude", "agents"), { recursive: true });
      writeFileSync(
        join(sourceDirectory, "SKILL.md"),
        "---\nname: demo\ndescription: Use when testing the Codex adapter\n---\n\n# Demo\n"
      );
      writeFileSync(join(sourceDirectory, "reference.md"), "# Reference\n");

      synchronizeCodexSkills({ root });

      const targetDirectory = join(root, ".agents", "skills", "demo");
      const targetEntry = join(targetDirectory, "SKILL.md");
      const lowercaseEntry = join(targetDirectory, "skill.md");
      const caseTemporary = join(targetDirectory, "entry-case.tmp");
      renameSync(targetEntry, caseTemporary);
      renameSync(caseTemporary, lowercaseEntry);
      unlinkSync(join(sourceDirectory, "reference.md"));

      const codexOnlyEntry = join(
        root,
        ".agents",
        "skills",
        "orient",
        "SKILL.md"
      );
      mkdirSync(join(root, ".agents", "skills", "orient"), { recursive: true });
      writeFileSync(codexOnlyEntry, "# Codex-only skill\n");

      const drift = synchronizeCodexSkills({ root, check: true });
      expect(drift.changed).toContain(".agents/skills/demo/SKILL.md");
      expect(drift.changed).toContain(".agents/skills/demo/reference.md");

      const repaired = synchronizeCodexSkills({ root });
      expect(repaired.removed).toContain(".agents/skills/demo/reference.md");
      expect(readdirSync(targetDirectory)).toContain("SKILL.md");
      expect(readdirSync(targetDirectory)).not.toContain("skill.md");
      expect(existsSync(codexOnlyEntry)).toBe(true);
      expect(synchronizeCodexSkills({ root, check: true }).changed).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses manifest paths outside the generated skill roots", () => {
    const root = mkdtempSync(join(tmpdir(), "codex-skill-sync-safety-"));
    try {
      const sourceDirectory = join(root, ".claude", "skills", "demo");
      mkdirSync(sourceDirectory, { recursive: true });
      mkdirSync(join(root, ".claude", "agents"), { recursive: true });
      mkdirSync(join(root, ".codex"), { recursive: true });
      writeFileSync(
        join(sourceDirectory, "SKILL.md"),
        "---\nname: demo\ndescription: Use when testing manifest safety\n---\n\n# Demo\n"
      );
      writeFileSync(
        join(root, ".codex", "claude-skill-sync-manifest.json"),
        JSON.stringify({ version: 1, paths: ["outside.txt"] })
      );

      expect(() => synchronizeCodexSkills({ root })).toThrow(
        "Refusing to manage a path outside Codex skill roots"
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps the checked-in Codex mirror synchronized", () => {
    expect(synchronizeCodexSkills({ check: true }).changed).toEqual([]);
  });

  it("covers every Claude skill and supporting agent", () => {
    const {
      expected,
      skillNames: discovered,
      agentCount,
    } = collectExpectedOutputs();
    const paths = [...expected.keys()].map((path) =>
      path.replaceAll("\\", "/")
    );

    expect(discovered.length).toBeGreaterThan(40);
    expect(agentCount).toBe(12);
    expect(
      paths.some((path) => path.endsWith("/.agents/skills/fb/SKILL.md"))
    ).toBe(true);
    expect(
      paths.some((path) => path.endsWith("/.agents/skills/skel2tka/SKILL.md"))
    ).toBe(true);
    expect(
      paths.some((path) => path.endsWith("/.codex/agents/audit-evaluator.toml"))
    ).toBe(true);
    expect(
      paths.some((path) => path.endsWith("/.codex/agents/audit-fixer.toml"))
    ).toBe(true);
    expect(
      paths.some((path) => path.endsWith("/.codex/agents/teacher.toml"))
    ).toBe(true);

    const corpus = [...expected.values()]
      .filter((content) => typeof content === "string")
      .join("\n");
    expect(corpus).not.toContain("```bash");
    expect(corpus).not.toContain("/dev/null");
    expect(corpus).not.toContain(" | head -1");
    expect(corpus).not.toContain("git log $(");
    expect(corpus).not.toContain('\nrm "');
    expect(corpus).not.toContain("`! powershell");

    const feedbackReference = [...expected].find(([path]) =>
      path
        .replaceAll("\\", "/")
        .endsWith("/.agents/skills/fb/workflow-reference.md")
    )[1];
    expect(feedbackReference).toContain("exactly one initial fetch command");
    expect(feedbackReference).not.toContain(
      "### Step 1: Check for in-progress items"
    );
  });
});
