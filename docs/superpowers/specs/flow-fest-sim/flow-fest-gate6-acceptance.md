# Flow Fest Sim Gate 6 final acceptance

**Status:** Systems evidence retained; visual/geographic acceptance withdrawn

This package proves the journey, persistence, positioning, performance, and
responsive runtime that existed at the time of capture. It is not current
proof that the scene matches the campground. Reality Lock must re-verify every
location-dependent capture before this gate can return to review.

**Runtime:** `/test/flow-fest-sim?gate6=1`

**Evidence runtime:** `/test/flow-fest-sim?gate6=1&capture=1`

## Acceptance boundary

Gate 6 retains the approved one-metre DTM, registered routes, seven clearing
envelopes, collision host, 65-degree cameras, Thursday journey, third-person
electric unicycle, fire-jam interaction, persistence, and site-wide audio
owners. It adds field positioning at the existing player-stage seam. It does
not introduce another terrain, controller, collider, camera, journey, or audio
system.

The default Flow Fest route now opens as the final-acceptance build. A lower
tent run reaches the registered gate, camp, west parking, Middle Earth,
festival exit and re-entry, final camp return, and Friday morning. Reload
restores the exact camp coordinate `(286, -130)`, completed fire jam, journey
journal, and EUC state with zero measured position drift.

## Field positioning

The positioning owner converts WGS84 device fixes through the checked NAD83 /
UTM zone 16N frame (`EPSG:26916`) into the established x-east, y-up, z-south
world. The 86-sample rehearsal is derived from the exact lower-tent arrival and
return coordinates in `gate2-runtime-contract.json`. It carries no invented
vehicle timing.

Only fixes at or below 18 metres reported accuracy and younger than six
seconds may stage the player. A 45-metre accuracy diagnostic and a 30-second
stale diagnostic remain visible as held fixes without changing accepted
revision or player position. The full registered replay round-trips through
WGS84 with 0.000057 metre maximum error.

Live GPS is opt-in through `Use device GPS`. Device coordinates remain in the
browser session and are neither persisted nor uploaded by this feature. The
poor-accuracy and stale controls exist only on the capture route.

## Acceptance artifacts

- Acceptance composite: `./evidence/gate-6/gate6-acceptance-walk.mp4`
- Seven-viewport board: `./evidence/gate-6/gate6-viewport-evidence.png`
- GNSS rehearsal: `./evidence/gate-6/gate6-gnss-rehearsal-report.json`
- Regression report: `./evidence/gate-6/gate6-regression-report.json`
- Performance report: `./evidence/gate-6/gate6-performance-report.json`
- Runtime console: `./evidence/gate-6/gate6-runtime-console.json`
- Machine verifier: `./evidence/gate-6/gate6-verification.json`

The retained viewport set is 1920x1080, 2560x1440, 3840x2160, 1440x900,
820x1180, 960x412, and 375x812. The phone and short-landscape compositions
remove the long control rails and preserve the identity, GPS, EUC, objective,
and playable world without panel overlap.

## Verification contract

Gate 6 is ready for review only when all of these remain true:

1. The Gate 2 coordinate fingerprint and all source hashes match current
   bytes.
2. The acceptance state is complete, backtracking and re-entry are present,
   and reload position drift is zero.
3. WGS84/projected/world round trips stay below one millimetre.
4. Nominal replay fixes advance the existing player seam; poor and stale fixes
   do not.
5. Focused tests, project typecheck, runtime console, and the inherited measured
   WebGL envelope pass.
6. Every retained screenshot has its exact declared dimensions and is
   nonblank; the acceptance video is H.264 at 1920x1080 and at least 30 seconds.

Run `node scripts/geospatial/build_flow_fest_gate6_acceptance.mjs verify` to
check the Gate 6 package.

## Known limits

The acceptance video is a disclosed composite, not one uninterrupted
real-time drive. The GPS track is a deterministic registered-route rehearsal,
not a festival-day field recording. Final backpack-display performance, phone
radio behavior, battery life, thermals, and multipath remain hardware checks.
The bridge and permanent-structure footprints remain source-unlocked and
absent.
