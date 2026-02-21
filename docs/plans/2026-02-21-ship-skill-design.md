# `/ship` Skill Design

**Date:** 2026-02-21
**Purpose:** Assess user-facing production readiness of a feature/module

## What It Is

`/ship` takes a feature name, analyzes whether a real user can use it end-to-end, and produces a prioritized gap list with an implementation plan to close the gaps.

**Distinct from:**
- `/audit` -- grades code quality (architecture, Svelte 5 compliance, accessibility thresholds)
- `/release` -- packages completed work into a versioned release
- `/ship` -- answers: "Can a user actually use this feature without hitting a wall?"

## Invocation

```
/ship museum
/ship compose
/ship settings/visibility
```

Argument: a feature/module name, resolved to a directory path via module definitions and feature directory structure.

## Execution Model

Single-pass deep scan. One agent holds the full feature context to catch cross-component issues (a button that fires an event to a handler that calls a service that doesn't exist).

## Phases

### Phase 1: Structural Scan

Read the feature's component tree, event handlers, navigation config, DI registrations, and route definitions. Build a map of what exists:
- Components and their parent-child relationships
- Event handlers and what they call
- Services registered in DI
- Navigation/module definition entries
- Data flow (what loads data, what consumes it)

### Phase 2: Flow Inference

From the structure, infer user flows. Present them as numbered steps:

```
Flow 1: Enter Museum
  User clicks Museum tab -> MuseumModule loads -> exhibits render

Flow 2: Browse Exhibits
  User sees exhibit list -> scrolls/filters -> clicks an exhibit

Flow 3: View Exhibit Detail
  Exhibit detail opens -> 3D scene loads -> user interacts
```

### Phase 3: Flow Confirmation

Present inferred flows to the user. Ask:
- "Is this what the feature should do?"
- "Anything missing?"
- "Anything not in scope yet?"

User can add flows, remove flows, or confirm.

### Phase 4: Code-Level Gap Analysis

Check each confirmed flow against 6 dimensions:

**1. Dead Ends** -- Buttons/links that go nowhere, empty click handlers, navigation to missing components.

**2. Missing States** -- No loading indicator, no error handling the user would see, blank screen when data is empty.

**3. Flow Continuity** -- Can the user get from A to B to C? Back buttons? Error recovery? Clear path forward at every screen?

**4. Integration Wiring** -- Is it in moduleLoaders? Module definitions? Navigation? DI container? Can it actually be reached?

**5. Data Pipeline** -- Do the services the UI calls exist and return real data? Or are they stubs/TODOs?

**6. Visual Completeness** -- Placeholder text ("Lorem ipsum", "TODO"), missing icons, unstyled raw HTML, components that render but look unfinished.

### Phase 5: Visual Inspection Walkthrough

After the code scan, walk the user through a visual inspection:

1. Tell the user exactly where to navigate: "Go to the Museum tab. Tell me when you're there."
2. At each screen, ask targeted questions based on code findings:
   - "You should see a list of exhibits. Are they rendering with thumbnails?"
   - "Click the first exhibit. Does a detail view open?"
   - "Try scrolling to the bottom. Loading indicator or does it cut off?"
3. User answers get folded into the gap list. If the code says something is wired up but the user reports it doesn't work, that's a runtime gap.
4. Continue until all confirmed flows are walked.

### Phase 6: Gap Report

Consolidate code-found gaps + visually-confirmed gaps into a prioritized list:

```
## /ship museum -- Gap Report

### Blockers (3)
1. ExhibitDetail click handler is a no-op -- user can't view exhibits
   File: src/lib/features/museum/components/ExhibitCard.svelte:42
   Flow: View Exhibit Detail

2. MuseumModule not in moduleLoaders -- can't reach from nav
   File: src/lib/shared/modules/ModuleRenderer.svelte
   Flow: Enter Museum

### Broken (2)
4. Exhibit list shows raw JSON when data loads
   File: src/lib/features/museum/components/ExhibitList.svelte:18
   Flow: Browse Exhibits

### Incomplete (4)
6. Loading state is raw "Loading..." text, no spinner
   File: src/lib/features/museum/MuseumModule.svelte:55
   Flow: Enter Museum
```

Severities:
- **Blocker** -- User literally cannot complete the flow
- **Broken** -- User hits something obviously wrong (error, blank screen, dead button)
- **Incomplete** -- Feature works but is clearly unfinished (placeholder text, missing polish)

### Phase 7: Transition to Implementation

Invoke `writing-plans` skill to create an implementation plan that fixes gaps in priority order (blockers first, then broken, then incomplete).

## Skill File Location

`.claude/skills/ship/SKILL.md`

## Key Principles

- User-facing readiness, not code quality
- Infer flows from code, but verify with the human
- Always include visual walkthrough -- static analysis can't catch runtime issues
- Gap report is the artifact; implementation plan is the next step
- One pass, full context, no fragmented agents
