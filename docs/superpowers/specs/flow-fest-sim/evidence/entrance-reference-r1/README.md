# Flow Fest entrance reference R1

**Status:** Superseded and rejected for placement. Retained only as failure
evidence.

This pass incorrectly treated the entrance as east-side geography and its
colored circles were diagnostic guesses, not registered locations. Nothing in
this folder is an authoritative coordinate source. Reality Lock R2 replaces it
with exact panorama metadata, the ODOT centerline, and the registered NAIP
junction.

The original pass compared four authored simulation views with observations
from the verified August 2024 Street View panorama, but then registered those
observations against the wrong side of the road.

Google imagery is inspected in its ordinary viewer and is not copied into this repository. The source-data manifest records the panorama identity, view headings, expected screen regions, and discrepancy notes. Every image under `frames/` is rendered by Flow Fest Sim.

## Registered capture routes

- `/test/flow-fest-sim?reference=entrance-front&branch=lower-tent`
- `/test/flow-fest-sim?reference=entrance-road-right&branch=lower-tent`
- `/test/flow-fest-sim?reference=entrance-road-left&branch=lower-tent`
- `/test/flow-fest-sim?reference=entrance-gatehouse-close&branch=lower-tent`

## Baseline findings

- No gatehouse, porch, vending machine, fence, gate sign, utility poles, wires, or road paint existed.
- The entrance read as an abstract path junction rather than a public road, broad gravel apron, and private camp drive.
- Nothing established the asymmetric Street View composition: modest gatehouse set back to the right of the drive, clean fence break, and longer road-right fence run.

Final verification data and capture paths are recorded after the four-view rerun.
