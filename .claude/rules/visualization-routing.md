---
paths:
  - "src/**/*"
  - "docs/**/*"
---

# Visualization Routing

Choose the lowest-cost medium that answers the actual design question.

| Question                                          | Medium                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Existing UI composition or styling                | Real Svelte components in an existing or focused `src/routes/test/*` route          |
| Several variants of one parameter                 | Playground skill when available                                                     |
| Greenfield layout with no reusable components     | Throwaway HTML sketch or visual companion                                           |
| Architecture, state machine, or data relationship | Diagram or interactive artifact                                                     |
| Visual effect tuning                              | Stable effect-specific test route with real renderer, props, playback, and controls |

Search for an existing route and primitives first. Do not hand-roll a low-fidelity
mock of a surface that already renders. A test route is a development surface,
not the final delivery destination; follow `deliver-in-the-app-browser.md` when
the completed work has a real route for Austen to review.
