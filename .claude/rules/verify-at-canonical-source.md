---
paths:
  - "mcp-server/**/*"
  - "src/lib/shared/foundation/**/*"
  - "src/lib/shared/pictograph/**/*"
  - "src/lib/shared/notation/**/*"
---

# Canonical Domain Correction Contract

Before correcting TKA data:

1. identify and read the base source for the affected category;
2. verify the proposed value through the current MCP implementation;
3. trace the incorrect value to the derived consumer or extension;
4. fix the owning layer and add a focused regression check when the error could
   otherwise remain silent.

Do not infer base truth from an extension file or patch several downstream
consumers around one bad owner. If MCP output and the apparent base source
disagree, stop the correction and report the evidence instead of choosing one by
intuition.
