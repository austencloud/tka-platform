# Olive Cloudbreak Gate 5 transition captures

Date: 2026-08-10

The production transition compositor was exercised with eight performers. Each
transition completed at the requested background, returned to the idle phase,
preserved all eight performers, and kept audio visibility aligned with the
destination environment.

| Transition | Duration | Captured phase | Evidence |
| --- | ---: | --- | --- |
| Cloudbreak to Autumn | 4,097 ms | waiting | [Capture](./seraphic-vault-gate5-cloudbreak-r1-transition-to-autumn.png) |
| Autumn to Cloudbreak | 1,030 ms | revealing | [Capture](./seraphic-vault-gate5-cloudbreak-r1-transition-from-autumn.png) |
| Cloudbreak to Void | 916 ms | revealing | [Capture](./seraphic-vault-gate5-cloudbreak-r1-transition-to-void.png) |
| Void to Cloudbreak | 798 ms | revealing | [Capture](./seraphic-vault-gate5-cloudbreak-r1-transition-from-void.png) |
| Cloudbreak to Ocean | 6,100 ms | waiting | [Capture](./seraphic-vault-gate5-cloudbreak-r1-transition-to-ocean.png) |
| Ocean to Cloudbreak | 2,706 ms | waiting | [Capture](./seraphic-vault-gate5-cloudbreak-r1-transition-from-ocean.png) |

The longer cold transitions are asset and shader preparation, not a forced
timeout. The readiness owner resets synchronously before the next scene mounts,
so cached ready signals cannot be erased by a queued microtask.

