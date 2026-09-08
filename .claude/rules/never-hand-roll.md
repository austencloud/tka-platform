---
paths:
  - "src/**/*"
  - "packages/**/*"
  - "mcp-server/**/*"
  - "scripts/**/*"
  - "tests/**/*"
---

# One Capability, One Owner

A component is a file boundary; a capability is behavior the product offers.
New presentations may compose existing behavior but must not become another
implementation of validation, state transitions, algorithms, accessibility,
keyboard behavior, or domain constants already owned elsewhere.

Before creating shared behavior:

1. Search by meaning using names, synonyms, user-facing labels, state fields,
   and callbacks.
2. Read the closest implementation and one real consumer. Search
   `docs/architecture/canonical-capabilities.md` for a recorded owner.
3. Choose and state the relationship:
   - reuse the existing capability;
   - extend its owner;
   - compose it in a new presentation;
   - create a genuinely new capability with a named owner and a clear boundary.

The second use of feature-local behavior triggers an ownership decision. A third
parallel implementation is not allowed unless the differing interaction model
is recorded in the capability index or a focused contract.

New feature components, business logic, art, meshes, textures, scenes,
animations, shaders, and effects remain valid when they are genuinely new. They
still reuse shared loaders, render loops, controls, state, accessibility, and
domain infrastructure.

Research maintained framework or package support before building commodity or
specialized infrastructure such as drag and drop, popovers, timelines,
raycasting, physics, parsing, encoding, authentication, or build tooling.

A spec or implementation that creates shared behavior records its search terms,
closest matches, selected owner, and reuse/extend/compose/create decision. Do
not invent an owner to satisfy the form.
