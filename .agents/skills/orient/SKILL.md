---
name: orient
description: Use when entering an unfamiliar TKA feature, module, route, service, or package; answering broad architecture questions; tracing ownership before a review, diagnosis, plan, or change; or when source reading is expanding faster than understanding.
---

# Orient

Build the smallest model. Never pursue arbitrary repository percentages
or pack the codebase.

## 1. Name the question

State the behavior or boundary. Classify the task:

- **Explain/review:** map and report.
- **Diagnose:** prove the cause; do not fix unless asked.
- **Change:** trace ownership, find reuse, implement, and verify.

Choose one feature, package, route, or behavior. "The whole repo" is not a scope.

## 2. Load the contract

Before source work, read completely:

1. Root `AGENTS.md` and matching `.claude/rules/*.md` files.
2. A closer `AGENTS.md`, if one exists.
3. The matching task or domain skill, if any.
4. One relevant architecture document, when available.

Do not read entire rule or architecture directories.

## 3. Make a cheap map

Use `rg --files` and targeted `rg -n` to locate:

- entry point;
- state/context owner;
- service or orchestrator;
- domain model and canonical package;
- persistence, network, or rendering boundary;
- direct tests;
- registrations, getters, and consumers.

Record working-tree state before change work.

## 4. Trace one real path

Follow one behavior end to end:

```text
entry -> state -> orchestration -> domain -> boundary -> test
```

Start with symbols and imports. Read a complete file only after establishing its
role. In large files, read the relevant symbol before expanding.

Use the `flow-arts` MCP for TKA domain facts. Source may show application usage;
it does not authorize domain claims from memory.

## 5. Keep an evidence ledger

Maintain this in working notes, never an automatic repo file:

```text
Confirmed: claim -> source, command, MCP result, or test
Inferred: interpretation -> evidence and uncertainty
Unknown: question -> cheapest next check
```

Comments, handoffs, and agent statements remain unconfirmed until checked against
current source or runtime evidence.

## 6. Protect context

- Prefer narrowing searches over full-file reads.
- Read at most five source files per expansion step, then summarize.
- Never concatenate large files into one tool response.
- Treat truncated output as unread.
- Treat counts and metrics as leads, not quality findings.
- Stop when ownership and the call path are proven.

## 7. Cross the change gate

Before new code, follow `never-hand-roll`: search internally by concept with at
least three terms, identify the behavior owner, check the ecosystem when the
work is shared infrastructure, then state whether the work reuses, extends,
composes, or creates.

Match verification to risk: focused tests for domain logic, runtime/emulator
evidence for persistence or auth, and permitted browser evidence for UI.

## Exit condition

Orientation is complete when this map is evidence-backed:

```text
Scope: <traced behavior>
Owner: <feature/package>
Path: <entry -> state -> service -> boundary>
Canon: <domain source or MCP tool>
Proof: <test/runtime/source evidence>
Risks: <specific seams>
Unknowns: <material unknowns only>
```

State sampling limits plainly. Never describe a structural survey as a code
audit or a sampled path as repository-wide behavior.
