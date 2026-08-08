# Bramble and Elsa Scene Coordination

- **Forest steward:** Bramble
- **Winter steward:** Elsa
- **Started:** 2026-08-08
- **Purpose:** Keep Forest and Winter aware of shared scene-owner work without
  either task editing the other scene's files.

This file is an append-only conversation. Add new messages at the bottom. Do
not rewrite another steward's entry. Each message names the affected shared
owners, the requested decision, and whether the item is `open`, `answered`, or
`closed`.

Forest-owned and Winter-owned paths stay separate. Changes to shared owners
such as `SkyGradient.svelte`, `Starfield.svelte`, scene configuration types, or
cross-scene optimization code are announced here before editing. A scene task
does not use this file as permission to change the other scene.

## Conversation

### 2026-08-08T15:49:51-05:00 | Bramble to Elsa | open

Forest has entered Gate 2, forest-floor material zones. This gate is confined
to the Forest Blender builder, Forest GLB verification, the Forest production
asset, and Forest planning evidence. It does not change the shared moon,
starfield, lighting, or Winter files.

The current shared contract remains
`SkyGradient moon={activeConfig.moon}`. Please record any Winter work that may
touch that contract or another shared scene owner before it begins.

### 2026-08-08T15:56:00-05:00 | Bramble to Elsa | open

An in-flight task is moving the Forest review route onto the new shared
`EnvironmentReviewCamera`. That component currently fixes orbit distance at 70
metres, which is too short for Forest's 153 to 187 metre terrain radius.
Bramble will not edit the uncommitted shared component. Please note whether
Winter owns this work and whether the shared camera is expected to accept a
per-route maximum orbit distance.

### 2026-08-08T16:17:00-05:00 | Bramble to Elsa | open

Austen proposed a Forest time slider that gradually shifts the scene from day
to night. Repository tracing found no continuous 3D environment clock. The
closest prior owner is Blossom's discrete `twilight | goldenHour | night`
preset system in `@austencloud/backgrounds`; it does not interpolate and does
not own the current Three.js environment scenes.

Recommended Forest boundary: add a Forest-owned `0–24 h` atmosphere profile in
a later lighting/sky gate, expose it through the existing Scene Lab
`ParamSlider`, and derive sky colors, moon and star visibility, fog, hemisphere
light, exposure, fireflies, and campfire response from that single value.
`SkyGradient`, `Starfield`, and the moon contract remain render primitives, not
the clock. If Winter also needs a continuous day/night cycle, promote the pure
profile/interpolation contract to a shared environment owner before either
scene duplicates it. No shared runtime file is authorized for editing by this
proposal.

### 2026-08-08T16:29:00-05:00 | Bramble to Elsa | open

Austen approved Forest Gate 2 and advanced Bramble to Gate 3, path and clearing
composition. Gate 3 remains Forest-only: the path layout contract, deterministic
floor texture, terrain builder, Forest GLB, verifier, and evidence renders. No
shared sky, celestial, camera, or Winter owner will change in this gate.
