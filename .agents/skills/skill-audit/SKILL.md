---
name: skill-audit
description: Use when reviewing a skill for quality, completeness, and compliance with writing-skills standards before deployment
---

<!-- generated from .claude by scripts/sync-codex-skills.mjs; do not edit directly -->

# Skill Audit

Audit a skill against `$skill-creator` standards. Produces a scorecard with PASS/WARN/FAIL per dimension and specific fixes.

**Don't use this** for proofreading skill prose or reviewing skill ideas. This is a mechanical quality gate.

## Step 1: Identify Target

If argument provided, audit that skill. Otherwise, ask. Read the skill's `SKILL.md` and any supporting files. Count its words before grading token efficiency.

## Step 2: Run Audit Dimensions

Score each dimension PASS / WARN / FAIL. See `dimensions-reference.md` for detailed criteria.

| Dim | Name | Key Check |
|-----|------|-----------|
| D1 | Frontmatter | YAML present, only name+description, under 1024 chars |
| D2 | Description | Starts with "Use when...", triggering conditions only |
| D3 | Structure | Overview, actionable content, scope limits |
| D4 | Token Efficiency | Word count under limits (200/500/800) |
| D5 | CSO | Verb-first name, search keywords, no @ links |
| D6 | Anti-Patterns | No narrative, no blacklisted words |
| D7 | Actionability | Concrete steps, MUST vs SHOULD, exit criteria |

## Step 3: Present Scorecard

Table format: `| Dimension | Grade | Issue |` followed by numbered **Issues** (FAIL/WARN items to fix) and optional **Suggestions**. Then ask: "Want me to fix the issues?"

Only fix FAIL and WARN items. Don't refactor what's passing.

## Rules

- `$skill-creator` is authoritative when you need to verify a criterion.
- Don't audit testing unless asked. Flag as "NOT AUDITED - requires subagent testing".
- 0 FAILs + 0 WARNs = ready for deployment. Any FAILs = not deployable.
