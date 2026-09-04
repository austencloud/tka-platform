---
paths:
  - "src/lib/shared/3d/**/*"
  - "src/lib/features/stage/**/*"
---

# 3D Character Terminology — ENFORCED

The 3D product uses two distinct nouns:

- **Performer** is the choreographic role: a cast member, rail item, timeline
  lane, formation member, or directed part.
- **Character** is the visible 3D body/model assigned to that performer.

User-facing copy, product-owned state, new schemas, and product component names
must use `character`, `characterId`, `CharacterId`, and `Character3D` for the
visible model. Asset IDs such as `ch01` remain stable; they are identifiers, not
abbreviations shown to users.

`Avatar` is allowed only at a boundary that already owns that vocabulary:

1. the historical `@austencloud/scene-3d` API;
2. explicit legacy-data import and migration;
3. account/profile images or player-controlled game avatars; and
4. third-party asset paths that cannot be renamed safely.

Map the scene package through
`src/lib/shared/3d/domain/character-model.ts`. Do not spread package-level
`Avatar3D`, `AvatarId`, catalog, or loader names into product code. A legacy
schema may accept `avatarId`, but the normalized value and every newly written
version use `characterId`.

Do not replace **Performer** with **Character** on timelines, formations, cast
controls, or choreography. A performer can change characters without changing
their choreographic identity. Natural product copy follows that relationship:
“Performer 2 uses character Remy.”
