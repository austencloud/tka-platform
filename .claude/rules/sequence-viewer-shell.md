---
paths:
  - "src/lib/shared/sequence-viewer/**/*"
  - "src/routes/sequence/**/*"
  - "src/routes/q/**/*"
---

# Sequence Viewer Shell Contract

`src/lib/shared/sequence-viewer/components/SequenceViewerShell.svelte` owns
viewer chrome, navigation, menus, rail, split layout, export panels, practice
controls, delete dialog, breakpoints, and shell styling.

Viewer hosts remain thin. They may own their wrapper, data bootstrap, close/back
routing, and host-specific funnels. They must not:

- rebuild shell chrome or import its internal presentation components;
- declare host-local `--theme-*` or `--semantic-*` values that shadow the theme;
- fork responsive or export-layout behavior;
- mount a second viewer on the `/q` ingress route.

Add a shell prop or fix the shell owner when a host needs new shared behavior.
`src/routes/q/[code]/QScanPage.svelte` may resolve a code, record physical-scan
attribution, cache a handoff, and route to `/sequence/[code]`; it does not render
the viewer.

Keep `tests/unit/sequence-viewer-shell-contract.test.ts` aligned with behavior,
not exact instruction prose. Do not loosen it to permit a forked host.
