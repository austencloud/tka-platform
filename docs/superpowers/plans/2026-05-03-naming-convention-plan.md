# Naming Convention Enforcement — Implementation Plan

Date: 2026-05-03
Spec: `docs/specs/naming-convention-enforcement.md`
Scope: Phase A only (lint rule). Renames happen during ceremony retirement, not here.

## Context

- ESLint flat config at `eslint.config.js` (ESLint 9, `tseslint.config()`)
- `eslint-plugin-check-file` is NOT installed
- `.svelte` files are globally ignored from ESLint (only `.ts` linted)
- 2,831 PascalCase `.ts` files currently exist (the "legacy" set)

## Tasks

### Task 1: Install eslint-plugin-check-file

```bash
npm install -D eslint-plugin-check-file
```

Verify: `node -e "require('eslint-plugin-check-file')"` exits 0.

### Task 2: Add filename-naming-convention rule to eslint.config.js

Add to `eslint.config.js`:

```js
import checkFile from "eslint-plugin-check-file";
```

Then add a new config block AFTER the main TypeScript config:

```js
// Enforce kebab-case filenames for .ts files
{
  files: ["**/*.ts"],
  plugins: {
    "check-file": checkFile,
  },
  rules: {
    "check-file/filename-naming-convention": [
      "error",
      {
        "**/*.ts": "KEBAB_CASE",
        "**/*.svelte.ts": "KEBAB_CASE",
      },
      { ignoreMiddleExtensions: true },
    ],
  },
},
```

Notes:
- `ignoreMiddleExtensions: true` makes `arena-state.svelte.ts` check only the `arena-state` part
- `.svelte` files are already globally ignored so no PascalCase conflict
- SvelteKit route files (`+page.ts`, `+server.ts`, `+layout.ts`) start with `+` which is not alphabetic — check-file's KEBAB_CASE allows these since the pattern match is on the filename stem

### Task 3: Establish baseline violation count

Run ESLint with only the check-file rule active to count current violations:

```bash
npx eslint --no-eslintrc -c eslint-naming-only.config.js "src/**/*.ts" 2>&1 | grep -c "filename-naming-convention"
```

Or simpler — just run full lint and count:

```bash
npx eslint "src/**/*.ts" 2>&1 | grep -c "check-file/filename-naming-convention"
```

Record this number in `docs/specs/naming-convention-enforcement.md` under a new `## Baseline` section. Expected: ~2,831 + 179 (PascalCase + camelCase) = ~3,010 violations.

### Task 4: Downgrade rule to "warn" for existing files

Since 3,000+ violations would block all linting, the practical approach:

Set the rule to `"warn"` (not `"error"`) so it:
- Shows up in editor (yellow squiggles on bad filenames)
- Appears in lint output (trackable count)
- Does NOT block CI or pre-commit hooks

Once ceremony retirement brings violations below ~50, flip to `"error"` and fix the stragglers.

**Alternative:** Use `"error"` but add an `.eslintignore`-style override for `src/lib/features/*/services/implementations/**` (where most PascalCase files live). This is more surgical but harder to maintain as files move.

Recommendation: `"warn"` is simpler and matches the spec's "no new violations" intent — any new file created in PascalCase gets a visible warning immediately.

### Task 5: Verify rule catches new violations

Create a temporary test file:

```bash
echo "export const x = 1;" > src/lib/TestViolation.ts
npx eslint src/lib/TestViolation.ts
# Should show: warning/error for filename-naming-convention
rm src/lib/TestViolation.ts
```

## Definition of Done

- [ ] `eslint-plugin-check-file` in devDependencies
- [ ] Rule active in `eslint.config.js` (as "warn")
- [ ] `npx eslint src/lib/TestFile.ts` flags the filename
- [ ] Baseline violation count recorded in the spec
- [ ] No changes to existing file names (ceremony retirement handles that)

## Estimated Effort

~15 minutes of Claude execution time. 2-3 files touched (`package.json`, `eslint.config.js`, spec doc).
