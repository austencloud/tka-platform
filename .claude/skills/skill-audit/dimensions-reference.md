# Skill Audit: Dimension Criteria

Detailed PASS / WARN / FAIL criteria for each audit dimension.

---

## D1 Frontmatter

| Grade | Criteria |
|-------|----------|
| PASS | Has `---` block with only `name` + `description` fields. Name is letters/numbers/hyphens only. Under 1024 chars total. |
| WARN | Extra fields present but harmless. |
| FAIL | Missing frontmatter, invalid name chars, or over 1024 chars. |

## D2 Description

| Grade | Criteria |
|-------|----------|
| PASS | Starts with "Use when...", describes triggering conditions only (not workflow), third person, under 500 chars, includes concrete symptoms/situations. |
| WARN | Correct format but vague triggers or missing concrete situations. |
| FAIL | Describes WHAT the skill does instead of WHEN to load it. Missing "Use when..." opener. |

Key test: does it say WHEN to load or WHAT it does? Only WHEN is correct.

## D3 Structure

| Grade | Criteria |
|-------|----------|
| PASS | Has 1-2 sentence overview, actionable content (not just philosophy), scope limits or "when NOT to use". Flowcharts only for non-obvious decisions. |
| WARN | Missing scope limits or overview is too long. |
| FAIL | No actionable content, pure philosophy, or missing overview entirely. |

## D4 Token Efficiency

| Grade | Criteria |
|-------|----------|
| PASS | Always-loaded: <200 words. On-demand: <500 words. |
| WARN | Always-loaded: 200-400. On-demand: 500-800. |
| FAIL | Always-loaded: >400. On-demand: >800. Heavy reference should split main (<500) from reference files. |

## D5 CSO (Commandability, Searchability, Observability)

| Grade | Criteria |
|-------|----------|
| PASS | Name is verb-first or descriptive. Keywords match likely search terms. Cross-references use skill names not `@` links. |
| WARN | Name is acceptable but keywords could be broader. |
| FAIL | Name is generic (e.g., "helper"), no searchable keywords, uses `@` links. |

## D6 Anti-Patterns

Any found = FAIL. Check for:

- Narrative storytelling
- Multi-language examples
- Generic labels (step1, helper2)
- Code in flowcharts
- Blacklisted words: tapestry, leverage, delve, seamlessly
- Sycophantic openers

## D7 Actionability

| Grade | Criteria |
|-------|----------|
| PASS | Steps are concrete and executable (not "consider doing X"). Rules distinguish MUST from SHOULD. Exit criteria defined. |
| WARN | Mostly concrete but some vague steps or missing exit criteria. |
| FAIL | Steps are advisory ("consider", "think about"), no MUST/SHOULD distinction, no exit criteria. |
