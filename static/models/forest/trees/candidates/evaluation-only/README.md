# SpeedTree White Oak evaluation candidate

This folder contains a private comparison candidate derived from the SpeedTree
White Oak in NVIDIA's Open Research Content Archive.

- Source: https://developer.nvidia.com/orca/speedtree
- Author: SpeedTree
- License: CC BY-NC-SA 3.0
- Production status: **not approved for commercial distribution**

The candidate exists only to prove or reject the SpeedTree authoring pipeline
against the current Meshy oak. Do not promote or ship it. A winning result must
be recreated from a commercially licensed SpeedTree Games source.

The runtime evaluation build intentionally keeps foliage diffuse atlases as
PNG. A generic glTF optimization pass damaged the source foliage UV/card layout
in Chromium. Opaque and normal maps remain compressed. See the pilot verdict in
`docs/superpowers/specs/moonlit-firefly-forest/evidence/speedtree-pilot/`.

Revision 97 failed the live Forest composition gate. The broad crown, exposed
roots, and one repeated silhouette overwhelmed the authored clearing. Austen
rejected the purchase path on 2026-08-10. The runtime override has been removed;
these files remain evaluation evidence only.
