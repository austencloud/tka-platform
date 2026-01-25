# Module Audit Protocol

When asked to "audit" a module or tab, follow this standardized protocol to evaluate across 8 dimensions and produce a graded scorecard.

---

## Phase 1: discovery

Before grading, understand what you're auditing:

1. **Read the entry component** and immediate children
2. **Map dependencies** - services, stores, external integrations
3. **Identify the component tree** - what renders what
4. **Note scope** - is this a single component, a tab, or an entire module?

---

## Phase 2: Grade Across 8 Dimensions

Each dimension is graded A+ through F. The goal is A+ across all dimensions.

### 1. Architecture (A+ = clean separation)

| Grade | Criteria |
|-------|----------|
| A+ | Single responsibility, clean service composition, proper DI |
| A | Minor coupling, but responsibilities clear |
| B | Some mixed concerns, could use extraction |
| C | Multiple responsibilities crammed together |
| F | God component, untestable, spaghetti |

**What to check:**
- Does each file do one thing? (see `code-style.md`)
- Are services properly extracted? (see `/monolith` command)
- Are services registered in ITI containers? (see `src/lib/shared/di/`)
- No barrel exports?

### 2. Code Quality (A+ = passes all project rules)

| Grade | Criteria |
|-------|----------|
| A+ | Strict types, correct naming, clean imports |
| A | Minor type looseness, but solid |
| B | Some `any` types, naming inconsistencies |
| C | Frequent type issues, poor naming |
| F | No types, "Service" suffixes, barrel imports |

**What to check:**
- TypeScript strictness (run `/check` if needed)
- Service naming conventions (see `service-naming.md`)
- Import hygiene - direct imports only (see `code-style.md`)

### 3. Svelte 5 Compliance (A+ = 100% modern patterns)

| Grade | Criteria |
|-------|----------|
| A+ | All runes, $props(), no legacy syntax |
| A | Runes used, minor legacy remnants |
| B | Mix of runes and legacy |
| C | Mostly legacy patterns |
| F | No runes, old reactive syntax |

**What to check:**
- Uses `$state`, `$derived`, `$effect` (not `let x = writable()`)
- Uses `$props()` with TypeScript interfaces
- Prefers `$derived` over `$effect` for computed values
- No `$:` reactive statements

### 4. Accessibility (A+ = exceeds AAA)

| Grade | Criteria |
|-------|----------|
| A+ | Exceeds AAA, 48px touch targets, 7:1 contrast |
| A | Meets AAA fully |
| B | Minor AAA gaps |
| C | Meets AA only |
| F | Accessibility violations |

**Delegate to:** `accessibility-auditor` agent for detailed analysis

**Key thresholds (our standards exceed AAA):**
- Touch targets: 48×48px minimum
- Color contrast: 7:1 normal text, 4.5:1 large text
- Motion: respects `prefers-reduced-motion`
- Focus: visible 2px+ indicators

### 5. UX States (A+ = all states handled gracefully)

| Grade | Criteria |
|-------|----------|
| A+ | Loading, error, empty, success states all polished |
| A | All states present, minor polish needed |
| B | Missing one state type |
| C | Only happy path handled |
| F | No state handling, raw errors exposed |

**What to check:**
- Loading state (skeleton, spinner, or progress)
- Error state (user-friendly message, recovery action)
- Empty state (helpful guidance, not just blank)
- Success feedback (confirmation of actions)
- Optimistic updates where appropriate

### 6. UI Consistency (A+ = follows styling.md exactly)

| Grade | Criteria |
|-------|----------|
| A+ | Theme variables, typography tokens, panel system |
| A | Minor deviations, but consistent |
| B | Some hardcoded values |
| C | Inconsistent with design system |
| F | Ignores design system entirely |

**What to check (see `styling.md`):**
- Uses `--theme-*` variables for colors
- Typography: minimum 12px (`--font-size-compact`), body 14px (`--font-size-min`)
- Panel backgrounds: `--theme-panel-bg`, `--theme-card-bg`
- No blur effects on content panels
- Container queries for responsive sizing

### 7. Performance (A+ = lean and fast)

| Grade | Criteria |
|-------|----------|
| A+ | No barrel imports, efficient renders, no leaks |
| A | Minor inefficiencies |
| B | Some unnecessary re-renders |
| C | Performance issues noticeable |
| F | Barrel imports, memory leaks, blocking operations |

**What to check:**
- No barrel/index.ts imports
- `$effect` cleanup functions where needed
- No blocking operations in render path
- Lazy loading for heavy components
- Event listener cleanup

### 8. Security (A+ = no vulnerabilities)

| Grade | Criteria |
|-------|----------|
| A+ | Input validated, XSS prevented, auth checked |
| A | Solid security, minor hardening possible |
| B | Some validation gaps |
| C | Security concerns present |
| F | XSS vulnerable, no input validation |

**What to check:**
- User input sanitized before display
- No `{@html}` with untrusted content
- Firebase security rules respected
- Auth checks where needed
- No secrets in client code

---

## Phase 3: Deliverable

After auditing, produce:

### 1. Scorecard

```
## Audit Scorecard: [Module/Tab Name]

| Dimension | Grade | Notes |
|-----------|-------|-------|
| Architecture | | |
| Code Quality | | |
| Svelte 5 | | |
| Accessibility | | |
| UX States | | |
| UI Consistency | | |
| Performance | | |
| Security | | |

**Overall: [Average Grade]**
```

### 2. Issues List (prioritized)

```
### Critical (blocks A grade)
- [issue]: [file:line] - [description]

### Serious (blocks A+ grade)
- [issue]: [file:line] - [description]

### Moderate (nice to fix)
- [issue]: [file:line] - [description]
```

### 3. Fix Plan

For each issue, provide:
- Specific file and location
- What to change
- Code snippet if helpful

---

## Audit Scope Guidelines

| Request | Scope |
|---------|-------|
| "Audit the Settings module" | All tabs, services, components in that module |
| "Audit the Props tab" | Just that tab component and its direct children |
| "Audit this component" | Single component focus |
| "Full audit" | Entire application (use subagents) |

---

## Integration with Existing Tools

- **Accessibility details**: Invoke `accessibility-auditor` agent
- **TypeScript errors**: Run `/check` command
- **Architecture issues**: Run `/monolith` command
- **Styling compliance**: Reference `styling.md` rules

This protocol ensures audits are consistent, thorough, and actionable.
