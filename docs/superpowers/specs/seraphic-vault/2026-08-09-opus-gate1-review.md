# Opus 5 review: Seraphic Vault Phase 2 Gate 1

**Reviewed:** 2026-08-09

**Model:** `claude-opus-5`

**Effort:** low

**Verdict:** revise

## Finding

The four-platform idea remains sound, but the measured world positions do not
create four readable screen-space beats from the registered hero camera.

The Gate 1 projection report itself confirms the defect:

| Platform | Projected NDC `(x, y)` | Finding |
|---|---:|---|
| Broken Vigil | `(-0.548, -0.210)` | Shares the left column and deck-height band. |
| Twin Choir | `(0.479, -0.216)` | Shares the right column and deck-height band. |
| Eroded Halo | `(-0.587, -0.200)` | Lands almost directly behind Broken Vigil. |
| Cloud Crown | `(0.463, 0.117)` | Shares Twin Choir's column despite its higher placement. |

The original validator proved that all four platforms fit the frame and avoid
the central 20 percent. It did not require horizontal separation between
platform centers, meaningful vertical separation, or clearance from the outer
feather-arc silhouettes. The resulting section drawing shows a descending
world-space staircase that the camera compresses into a nearly flat line.

## Required Gate 1 revision

1. Author the four target placements in normalized device coordinates first.
2. Require at least `0.15` NDC separation between platform columns.
3. Require meaningful screen-height separation instead of world-height
   separation alone.
4. Protect the projected outer feather arcs in addition to the central sun band.
5. Back-solve world coordinates from the registered hero camera.
6. Prove the chosen portrait camera policy before Blender placement begins.

## Portrait concern

The current portrait preset deliberately widens vertical field of view to 68
degrees, so Opus's fixed-48-degree portrait calculation does not describe the
live review route exactly. The underlying warning remains valid: platform
visibility must be projected through the actual desktop, landscape-phone, and
portrait-phone camera presets before Gate 1 can pass.

## Gate-process verdict

The gate becomes useful once its automated checks validate what the registered
camera sees, not only world-space distances. Until those checks exist, the board
is attractive evidence with an incomplete spatial test.
