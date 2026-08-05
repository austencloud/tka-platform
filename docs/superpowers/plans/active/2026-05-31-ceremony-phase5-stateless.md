# Ceremony Phase 5 + 3 + C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dissolve ~118 stateless classes into function modules, retire ~10 type-only interfaces, and kebab-rename 173 residual PascalCase `.ts` files — all in the isolated clone `E:\tka-platform-ceremony`, keeping the existing test suite + `check` green throughout, with a branch that rebases cleanly onto a moving `main`.

**Architecture:** Refactor, not feature-build. There are no new behaviors to test-first; the **existing** vitest suite + `svelte-check` ARE the verification gate. Discipline = tiny per-module batches, each gated green before commit, `git fetch origin && git rebase origin/main` between batches. Mechanical rename (Phase C) is delivered as a re-runnable codemod so it re-applies on fresh `main` at merge time.

**Tech Stack:** pnpm 10.28 workspace, Svelte 5, TypeScript, vitest (`tests/config/vitest.config.ts`), svelte-check, ts-morph (inventory script), existing `scripts/ceremony-inventory.mjs` + `scripts/ceremony-flatten-kebab.cjs`.

---

## Conversion recipes (the deterministic core — referenced by every Phase-5 batch)

These are the exact transformations. A "candidate" is a class the inventory tags
`stateless`, `stateless-deps`, or `stateless-cache`.

### Recipe A — `stateless` (0 instance fields, 0 ctor params)

Before:
```ts
// foo-thing.ts
export class FooThing {
  doX(a: number): number { return a * 2; }
  doY(s: string): string { return s.trim(); }
}
// get-foo-thing.ts
let _i: FooThing | null = null;
export function getFooThing(): FooThing { return (_i ??= new FooThing()); }
```
After:
```ts
// foo-thing.ts
export function doX(a: number): number { return a * 2; }
export function doY(s: string): string { return s.trim(); }
```
- Delete `get-foo-thing.ts`.
- Rewrite consumers: `getFooThing().doX(1)` → `doX(1)`; import `{ doX } from '.../foo-thing'`.
- If methods call sibling methods (`this.doY()`), replace `this.` with a direct
  function call `doY()`.

### Recipe B — `stateless-deps` (only fields are other service singletons)

Before:
```ts
export class BarFlow {
  constructor(private readonly repo = getBarRepo()) {}
  load(id: string) { return this.repo.find(id); }
}
```
After:
```ts
export function load(id: string) { return getBarRepo().find(id); }
```
- Replace each `this.<dep>` with a call to that dep's singleton getter inside the
  function body. Delete the class + its getter; rewrite consumers as in Recipe A.

### Recipe C — `stateless-cache` (only fields are Map/Set caches)

Before:
```ts
export class Memoizer {
  private cache = new Map<string, Result>();
  get(k: string): Result { /* uses this.cache */ }
}
```
After:
```ts
const cache = new Map<string, Result>();   // module scope
export function get(k: string): Result { /* uses cache */ }
```
- Module-scoped cache var preserves singleton-cache semantics. Delete getter;
  rewrite consumers.

### KEEP UNTOUCHED
- `stateful` classes (real per-instance state).
- The 8 polymorphic interfaces (`ILOOPExecutor`, `ISubInterpreter`, `ILOOPDetector`,
  `IAsciiRenderer`, `IDirectRenderer`, `IEndpointDetector`, `IInputProvider`,
  `ITrailOverlayCanvas`) and their implementers, plus `IFeedbackTesterWorkflow`.
- Any candidate whose conversion changes a test result → revert, reclassify `stateful`.

### Per-batch verification (run after EVERY batch, before commit)
```bash
# in E:\tka-platform-ceremony
npx svelte-check --tsconfig ./tsconfig.json --compiler-warnings "state_referenced_locally:ignore" 2>&1 | tee /tmp/ck.log | tail -5
npm run test:ci -- run <touched test path glob>     # scoped to changed dirs
```
Commit only on: svelte-check error count == baseline (no NEW errors) AND scoped
tests green. Commit with explicit pathspec.

---

## Task 0: Green baseline

**Files:** none (measurement only).

- [ ] **Step 1: Confirm clone deps resolve**

Run: `cd /e/tka-platform-ceremony && node scripts/ceremony-inventory.mjs --help 2>&1 | head -2 || node -e "require('ts-morph');console.log('ts-morph OK')"`
Expected: no `MODULE_NOT_FOUND`.

- [ ] **Step 2: Capture svelte-check baseline error count**

Run: `npm run check > /tmp/baseline-check.log 2>&1; grep -cE "Error:" /tmp/baseline-check.log`
Record the number. This is the tolerance — conversions must not increase it.

- [ ] **Step 3: Capture vitest baseline**

Run: `npm run test:ci 2>&1 | tee /tmp/baseline-test.log | tail -15`
Record pass/fail tallies. Any pre-existing failures are noted and excluded from
"regression" judgments.

- [ ] **Step 4: Start incremental checker (background, leave running)**

Run: `npm run check:watch` (background terminal).

- [ ] **Step 5: Commit baseline note**

```bash
git commit --allow-empty -m "chore(ceremony): record Phase 5 green baseline (check=<N> errors, tests=<P> pass)"
```

## Task 1: Fresh inventory → batch manifest

**Files:** Create `scripts/ceremony-manifest.json` (regenerated), `scripts/ceremony-dry-run.md` (regenerated).

- [ ] **Step 1: Regenerate inventory against current post-flatten tree**

Run: `node scripts/ceremony-inventory.mjs`
Expected: writes a fresh manifest; summary prints `stateless`, `stateless-deps`,
`stateless-cache`, `stateful` counts.

- [ ] **Step 2: Extract the candidate list grouped by module**

Run:
```bash
node -e "
const m=require('./scripts/ceremony-manifest.json');
const out=[];
for(const [mod,files] of Object.entries(m.modules)){
  const c=files.filter(f=>/^stateless/.test(f.classification||''));
  if(c.length) out.push({mod, n:c.length, files:c.map(f=>({p:f.relativePath,cls:f.classification,consumers:f.consumerCount,getter:f.isGetter}))});
}
out.sort((a,b)=>a.n-b.n);
require('fs').writeFileSync('./scripts/phase5-batches.json',JSON.stringify(out,null,1));
console.log('modules with candidates:',out.length,'| total candidates:',out.reduce((s,x)=>s+x.n,0));
console.log('smallest 5:',out.slice(0,5).map(x=>x.mod+':'+x.n).join(', '));
"
```
Expected: `scripts/phase5-batches.json` written; candidate total ≈ 100–120.

- [ ] **Step 3: Review edge cases**

Run: `node -e "const m=require('./scripts/ceremony-manifest.json'); console.log(JSON.stringify(m.edgeCases,null,1).slice(0,2000))"`
Note any candidate flagged with dynamic import / stored-ref / passed-as-arg
consumers — those convert by hand, never blind-codemod.

- [ ] **Step 4: Commit the batch plan**

```bash
git add scripts/ceremony-manifest.json scripts/ceremony-dry-run.md scripts/phase5-batches.json
git commit -m "chore(ceremony): fresh post-flatten inventory + Phase 5 batch list" -- scripts/ceremony-manifest.json scripts/ceremony-dry-run.md scripts/phase5-batches.json
```

## Task 2..K: Phase 5 conversion, one module-batch per task

Iterate `scripts/phase5-batches.json` **smallest-module-first** (lowest blast radius
first builds confidence + the codemod patterns). For EACH module batch:

**Files:** Modify each candidate file in the module + delete its getter + modify each
consumer file (paths from the manifest `consumers[]`).

- [ ] **Step 1: Rebase onto latest main before touching the batch**

```bash
git fetch origin && git rebase origin/main
```
Expected: clean, or resolve small conflicts now.

- [ ] **Step 2: Convert each candidate in the module per Recipe A/B/C**

Apply the matching recipe (above) to each file. For each deleted getter, update every
consumer listed in the manifest.

- [ ] **Step 3: Type-gate the touched files**

Run: `grep -E "<module-path>" /tmp/ck.log` after `check:watch` settles, or a scoped
`npx svelte-check`. Expected: no NEW errors vs Task 0 baseline.

- [ ] **Step 4: Run scoped tests**

Run: `npm run test:ci -- run src/lib/**/<module>/**`
Expected: green (same pass set as baseline for that area).

- [ ] **Step 5: Commit the batch (explicit pathspec)**

```bash
git commit -m "refactor(ceremony): Phase 5 — <module> stateless classes → function modules" -- <exact changed paths>
```
If a conversion flips a test red and the cause is hidden statefulness → revert that
one file, leave the class, note it, continue.

## Task K+1: Phase 3 — type-only interfaces → types.ts

**Files:** the ~10 `I*.ts` files the inventory marks `typesOnlyContractDirs` /
0-implementation; their consuming module `types.ts`; all importers.

- [ ] **Step 1: Rebase** — `git fetch origin && git rebase origin/main`

- [ ] **Step 2: For each type-only `IFoo`** — move the interface body into the
  consuming module's `types.ts` as `Foo` (drop `I`), delete the `IFoo.ts`, rewrite
  imports `import type { IFoo }` → `import type { Foo }`.

- [ ] **Step 3: Type-gate** — no NEW svelte-check errors vs baseline.

- [ ] **Step 4: Scoped tests** — `npm run test:ci -- run <touched areas>` green.

- [ ] **Step 5: Commit** — `git commit -m "refactor(ceremony): Phase 3 — type-only interfaces into types.ts" -- <paths>`

## Task K+2: Phase C — residual kebab rename (codemod, LAST)

**Files:** up to 173 PascalCase `.ts` (exclude `.svelte`, keeper `I*.ts`, `*.test.ts`)
+ their importers; driven by `scripts/ceremony-flatten-kebab.cjs`.

- [ ] **Step 1: Rebase** — `git fetch origin && git rebase origin/main`

- [ ] **Step 2: Dry-run the codemod**

Run: `node scripts/ceremony-flatten-kebab.cjs --dry-run 2>&1 | tee /tmp/kebab-dry.md | tail -20`
(If the script lacks `--dry-run`, read it first and add one — do not run destructive.)
Expected: lists planned `git mv` + import rewrites; sanity-check no keeper `I*.ts`.

- [ ] **Step 3: Run the codemod**

Run: `node scripts/ceremony-flatten-kebab.cjs`
Expected: files renamed via `git mv`, imports rewritten.

- [ ] **Step 4: Full gate** — `npm run check` error count == baseline; `npm run test:ci` green.

- [ ] **Step 5: Verify zero residual**

Run: `find src -name "[A-Z]*.ts" ! -name "*.test.ts" ! -name "I[A-Z]*.ts" | wc -l`
Expected: `0` (or only deliberate keepers, enumerated).

- [ ] **Step 6: Commit** — `git commit -m "refactor(ceremony): Phase C — kebab-rename residual PascalCase .ts" -- <paths>`

## Task K+3: Handoff file

**Files:** Create
`docs/superpowers/handoffs/2026-05-31-ceremony-phase5-merge-handoff.md` in the
clone.

- [ ] **Step 1: Write the landing recipe**

Contents: branch name; "do not merge while user active"; sequence = (a) on fresh
`main`, re-run `node scripts/ceremony-flatten-kebab.cjs` for Phase C; (b) cherry-pick
/ rebase the Phase 5 + 3 semantic commits (`git log` range); (c) run `npm run check`
+ `npm run test:ci`; (d) the success-criteria checks. Include final metric deltas
(`implements I`, getter count, residual PascalCase).

- [ ] **Step 2: Final rebase + green proof**

```bash
git fetch origin && git rebase origin/main
npm run check > /tmp/final-check.log 2>&1; grep -cE "Error:" /tmp/final-check.log
npm run test:ci 2>&1 | tail -15
```

- [ ] **Step 3: Commit + report to user** —
  `git commit -m "docs(ceremony): landing recipe + final metrics" -- docs/superpowers/handoffs/2026-05-31-ceremony-phase5-merge-handoff.md`.
  Surface the branch and handoff link to the user; do not merge.

---

## Self-Review

**Spec coverage:** Phase 5 (Task 2..K, recipes A/B/C), Phase 3 (K+1), Phase C
(K+2), isolation + rebase-often (every task Step 1 + Task 0), merge-safety/handoff
(K+3), out-of-scope Phase 6 (omitted) — all spec sections mapped.

**Placeholder scan:** Recipes are concrete code; verification commands are exact.
`<module>`/`<paths>` are intentional per-batch substitutions filled from
`phase5-batches.json` at execution — not placeholders for unknown logic.

**Type consistency:** getter names follow the manifest's `isGetter` entries; recipe
function names mirror the original class methods 1:1, so consumer rewrites are
mechanical.

**Known dependency:** Task 0 Step 1 must pass (ts-morph resolves) or Task 1's
inventory can't run — pnpm install in the clone is the prerequisite.
