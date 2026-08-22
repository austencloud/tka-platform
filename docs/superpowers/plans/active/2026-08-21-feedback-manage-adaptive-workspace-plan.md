# Feedback Manage Adaptive Workspace Plan

1. Add a pure container-size classifier for compact, queue, short-height,
   Kanban, and wide-Kanban modes. Cover every boundary with focused tests.
2. Extend the existing Kanban board state with the current mode and derive it
   from the board element's observed width and height.
3. Compose the existing filter bar above both presentations and make its
   desktop treatment container-responsive.
4. Turn the existing single-status view into the compact/medium workflow queue:
   top tabs below 600px, vertical rail from 600px, and explicit archived and
   deferred entry points.
5. Keep the four-lane drag/drop owner at 1320px and above. At 2600px, remove the
   lane cap and render two card tracks inside each lane.
6. Run the classifier tests and focused Svelte/TypeScript checks, then inspect
   all required viewports in the authenticated Chrome DevTools session. Iterate
   on measured overflow and screenshots until the composition is sound.

Risks: the filter bar was previously unmounted and its viewport media queries
could misclassify a Fold container; the board previously grouped unfiltered
items; and short-height layouts can lose too much height to stacked chrome.
Verification specifically targets those three seams.
