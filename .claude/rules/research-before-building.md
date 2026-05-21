# Research Before Building — ENFORCED

## The Problem This Solves

Claude hand-rolled a 175-line ManualRaycaster component with timing bugs, wrong canvas binding, and hours of debugging — when Threlte ships `interactivity()`, a one-line plugin that does the same thing natively. This pattern repeats: Claude assumes its training data is current, skips web research, and builds infrastructure the framework already provides.

Austen's feedback: *"you shouldn't be pretending like you know more than you know you should always ask the Internet unless you're like 95 plus percent sure that what you're doing is going to work perfectly... this is code it changes every couple of months there's some new repository some new fancy shiny thing that works better than the previous one so you can't fucking rely on your training data"*

## The Rule

Before implementing ANY technical solution that involves:
- Event handling, input detection, raycasting
- Animation, transitions, physics
- State management patterns
- Component architecture patterns
- Build tooling, bundling, deployment
- Any "plumbing" that a mature framework likely provides

You MUST:

1. **Search the web** for `[framework] [feature] [current year]` — e.g. "threlte interactivity 2026"
2. **Check the framework's extras/plugins package** — `@threlte/extras`, `@react-three/drei`, etc.
3. **Check context7 MCP** for current framework documentation
4. **Only then decide** whether to hand-roll or use the built-in

## The confidence threshold

- Below 95% confident it will work perfectly on first try → web search first
- Below 99% confident it's the most modern approach → web search first
- If the first attempt doesn't work → STOP and web search before attempt two

## Forbidden

- Writing >20 lines of infrastructure code without having searched for a built-in equivalent
- Debugging a hand-rolled solution for more than one attempt without researching alternatives
- Saying "I'll implement a custom [X]" without evidence that the framework lacks [X]
- Trusting training data about framework APIs, plugin availability, or recommended patterns

## The test

Before writing infrastructure code, answer: "Would a senior developer who uses this framework daily already know about a built-in for this?" If the answer is probably yes, search before building.
