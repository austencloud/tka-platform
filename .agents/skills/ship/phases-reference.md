# Ship Readiness: Phases 5-8 Reference

When explicitly invoked, treat the text after `$ship` as `<arguments>`. Expected shape: `<feature-name>`.

## Phase 5: Code-Level Gap Analysis

For each confirmed flow, check these 6 dimensions:

### 1. Dead Ends
- Buttons/links with empty or no-op handlers
- Navigation entries pointing to missing components
- `TODO`, `FIXME`, `HACK` in handler code
- Event dispatches with no listeners
- onclick={() => {}} or onclick={undefined}

### 2. Missing States
- No loading indicator when data is being fetched
- No error display when operations fail
- Blank screen when collection is empty
- No feedback after user actions (save, delete, submit)

### 3. Flow Continuity
- Can user navigate forward through each step?
- Can user go back / recover from errors?
- Are there orphan screens (reachable but no way out)?
- Does the flow end with a clear completion state?

### 4. Integration Wiring
- Is the module in `moduleLoaders` in ModuleRenderer.svelte?
- Is it in `MODULE_DEFINITIONS` in module-definitions.ts?
- Do its services have singleton getters (`get*.ts` files in `src/lib/shared/`)?
- Are those getters importable and returning real instances?
- Can the feature actually be reached from the running app?

### 5. Data Pipeline
- Do services the UI calls actually exist (not just interfaces)?
- Do they return real data or throw "not implemented"?
- Is Firebase/API configuration in place?
- Are there hardcoded mock data arrays that should be real queries?

### 6. Visual Completeness
- Placeholder text ("Lorem ipsum", "TODO: description", "Placeholder")
- Missing or placeholder icons
- Unstyled raw HTML elements
- Console.log statements left in event handlers
- Commented-out UI sections

Collect every finding with: description, file:line, which flow it affects, severity.

**Severities:**
- **Blocker** -- User literally cannot complete the flow
- **Broken** -- User hits something obviously wrong
- **Incomplete** -- Feature works but is clearly unfinished

## Phase 6: Visual Inspection Walkthrough

After the code scan, walk the user through a visual inspection of each flow.

**For each flow:**

1. **Direct the user:** "Navigate to [specific location]. Tell me when you're there."
2. **Ask targeted questions** based on what you found in code:
   - Questions about things the code says should work: "You should see X. Is it there?"
   - Questions about things the code scan flagged: "Try clicking Y. What happens?"
   - Questions about states: "Is there a loading spinner while it loads, or does it just appear?"
3. **Record findings:** If the user reports something doesn't work that the code says should, add it as a gap (likely a runtime issue).

**Do NOT ask vague questions.** Every question should be specific and based on what you found in the code.

**Do NOT use Playwright.** The user navigates. You ask. They answer. This is the cheapest and most reliable verification.

## Phase 7: Gap Report

Consolidate all findings (code scan + visual inspection) into a single prioritized report:

```
## $ship <arguments> -- Gap Report

### Blockers (N)
1. [Description]
   File: [path:line]
   Flow: [which flow]
   Source: [code-scan | visual-inspection]

### Broken (N)
...

### Incomplete (N)
...

### Summary
- Total gaps: X
- Blockers: Y (must fix before shipping)
- Broken: Z (should fix before shipping)
- Incomplete: W (polish, can ship without but shouldn't)
```

## Phase 8: Transition to Implementation

After presenting the gap report, invoke the `writing-plans` skill to create an implementation plan that fixes gaps in priority order:

1. Blockers first (the feature literally doesn't work without these)
2. Broken second (users will hit these and be confused)
3. Incomplete last (polish and completeness)

The plan should reference specific gaps by number so progress can be tracked.

## Important Notes

- **Read every file.** Don't skim. A stub function looks fine from the import but is empty inside.
- **Think like a user.** Not "does this compile?" but "does this DO anything?"
- **The visual walkthrough is not optional.** Code analysis misses runtime issues, CSS problems, and data-dependent bugs.
- **Be specific in the gap report.** "Button doesn't work" is useless. "ExhibitCard onclick handler at line 42 calls showDetail() which is defined but has an empty body" is useful.
- **Don't grade code quality.** That's `$audit`. If the code is ugly but works, it ships. If it's beautiful but the button does nothing, it doesn't.
