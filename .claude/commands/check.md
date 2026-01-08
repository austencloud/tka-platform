---
description: Analyze TypeScript errors and determine optimal fix strategy
allowed-tools: Bash Read Edit Write Glob Grep Task TodoWrite
---

# TypeScript Error Analysis Command

Analyze all TypeScript errors in the project and automatically determine the best remediation approach based on error count and complexity.

## Workflow

1. **Run TypeScript compiler** to get all errors:

   ```bash
   npx tsc --noEmit
   ```

2. **Analyze the results** to determine:
   - Total error count
   - Error types and severity
   - Which files are affected
   - Whether errors are isolated or interconnected

3. **Automatically choose strategy** based on analysis:

   ### Single Session Fix (Recommended for: <10 simple errors)
   - All errors are in 1-3 files
   - Errors are straightforward (missing types, simple mismatches)
   - No cascading dependencies

   **Action:** Fix all errors in this session

   ### Multiple Subagents (Recommended for: 10-50 moderate errors)
   - Errors span multiple files but are independent
   - Can be parallelized by file or error type
   - Each subset is manageable in isolation

   **Action:** Launch Task agents in parallel, each handling a subset:
   - Group by file (e.g., "Fix errors in src/lib/features/animate/")
   - Group by type (e.g., "Fix all 'Property X does not exist' errors")
   - Use general-purpose agents for complex reasoning

   ### Multiple Claude Code Instances (Recommended for: >50 errors or complex cascades)
   - Ludicrous error count (50+)
   - Cascading type errors across modules
   - Requires architectural changes
   - Type system refactoring needed

   **Action:** Generate separate prompts for different Claude Code sessions:
   - Break down by module/feature area
   - Create priority order (fix foundation types first)
   - Provide specific, scoped prompts for each session
   - Output each prompt as a ready-to-paste instruction

## Decision Matrix

```
Errors < 10 + Simple       → Single Session
Errors 10-30 + Independent → 2-4 Subagents
Errors 30-50 + Moderate    → 4-8 Subagents
Errors > 50 OR Complex     → Multiple Sessions
```

## Output Format

After analysis, present:

1. **Error Summary:**
   - Total count
   - Breakdown by file/category
   - Severity assessment

2. **Recommended Strategy:** (Single/Subagents/Multiple Sessions)

3. **Rationale:** Why this approach?

4. **Action Plan:**
   - If Single Session: List of fixes to apply
   - If Subagents: Groups and what each will handle
   - If Multiple Sessions: Numbered prompts ready to paste into new instances

5. **Ask for confirmation** before proceeding

## Example Subagent Grouping

```
Group 1: Animation renderer errors (12 errors in src/lib/features/animate/services/)
Group 2: Feedback component errors (8 errors in src/lib/features/feedback/components/)
Group 3: Navigation state errors (5 errors in src/lib/shared/navigation/)
```

## Example Multi-Session Prompts

```
Session 1: "Fix type errors in animation rendering system (PixiAnimationRenderer, GifExportOrchestrator). Focus on IPixiAnimationRenderer interface and implementing types."

Session 2: "Fix type errors in feedback management system. Focus on feedback state management and component prop types."

Session 3: "Fix navigation and routing type errors. Focus on navigation state and coordinator types."
```

## Important Notes

- **Don't just count errors** - understand their nature
- **Check for cascades** - fixing one root cause might resolve many errors
- **Consider time zones** - some "50 errors" might be 5 root issues repeated
- **Prioritize strategically** - foundation types before consumers
- **Test after fixes** - ensure no runtime regressions
