---
paths:
  - "src/**/*"
  - "packages/**/*"
  - "mcp-server/**/*"
  - "scripts/**/*"
  - "tests/**/*"
---

# Framework Research Contract

Before implementing framework-level infrastructure such as event handling,
raycasting, animation, physics, state coordination, or build tooling:

- inspect installed versions and existing repository owners;
- check current official framework and maintained extension documentation;
- prefer a supported capability over a parallel local implementation when it
  satisfies the product requirement;
- verify signatures, defaults, lifecycle behavior, and compatibility against
  the installed version; and
- if an approach fails for structural reasons, research alternatives before
  deepening it.

Research is proportional. Do not browse for stable local facts that the code or
installed package metadata answers directly.
