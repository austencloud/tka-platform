# Profile as a Stage — Feedback Ledger

Every piece of direction Austen has given on this feature, in his terms, so a
later session does not re-derive it or re-ask. Live surface:
`/creators/[id]` (UserProfilePanel → ProfileStage). Harness: `/test/profile-stage`.

Design doc: `2026-07-26-profile-as-stage-design.md`.
Original handoff: `2026-07-26-profile-as-stage-handoff.md`.

---

## Settled — do not relitigate

| # | Direction | Status |
|---|---|---|
| 1 | Every artifact renders in ITS OWN medium. A sequence animates, a scene loads the real 3D viewer, a mandala draws from steps. Not one card front for all. | Shipped |
| 2 | The landing-page composite is the baseline sequence presenter: animation canvas with the pictograph strip below it. | Shipped |
| 3 | Hovering a sequence shows the static choreo card so the whole thing can be read at once. | Shipped |
| 4 | Autoplay must never STEAL access to the choreo card. "I have no way to actually go back to the card because it's automatically made itself play the animation." | Shipped (hover reveal) |
| 5 | Do NOT dim or quiet the loading placeholder. "I'd rather not make the placeholder stop shouting." | Honoured |
| 6 | Warm the cache, keep it warm, warm in the background where possible. | Largely moot — mandalas render from steps, no cache |
| 7 | Consolidate rather than patch the same bug twice. "consolidate, obv" | Applied (one hydrator, one `engineAlignScale`) |
| 8 | Big mandalas, filling their whole square. "I really love the big ass mandalas and I like them taking up their whole square." | Honoured EXCEPT the animation overlay, which must register with the trail (~61%) |
| 9 | The mandala overlay must match the path the prop actually traces. | Shipped — `engineAlignScale` |
| 10 | One width per page. No dead rail at 4K. | Shipped on the stage; **the live panel still caps at 1920px** |
| 11 | Band chrome must ride the same type ramp as the tiles it labels. | Shipped |
| 12 | **The word belongs in a header on top of each artifact, for every medium — not a caption at the bottom left.** The animation canvas already has this header; build the same one around all the others. Portrait tiles are fine. | In progress |

## Standing process direction

- **Always give clickable links.** `https://` even for localhost; `file://` with
  absolute forward-slash paths for local files.
- **Do the work, don't describe it.** Describing a migration instead of doing it
  drew "??? it's not different."
- **Don't plead low context.** "you're all whiny because you don't have enough
  context ... I think you'll be fine." Compact and continue.
- **Screenshot your own work** before reporting a visual change.

## Open

1. **Live panel width** — `.profile-layout` caps at `max-width: 1920px`, leaving
   540px dead rail each side at a 3000px viewport, under a comment claiming to be
   "4K-first". Product decision; awaiting Austen's call.
2. **`ProfileShowcase.svelte` / `ProfileTabs.svelte`** are unreferenced by
   UserProfilePanel now. Not deleted — every other consumer must be checked first.
3. **Black quads in the 3D scene preview** — particle sprites failing to texture.
   Lead: `reference_render_context_registry_async_init`.
4. **Archive virtualisation** — `archiveCap` (120 of 505) is a stopgap.
5. **Stored 3D-scene names are wrong in Firestore** — "FΨFΨFΨFΨ — 3D scene".
   ArtifactTile simplifies per token at render time; the data still wants a repair.
6. **Collection `visibility` field + rules, pin/unpin UI** — never started; the
   Showcase is auto-picked because `PinnedItem` exists but nothing writes it.
