# Ember Meshy R1 candidate decisions

Decision authority: museum tracker `ZSnkB98pb0wz6PO17XKp`

Comparison evidence:

- `ember-meshy-geometry-comparison.png`
- `ember-meshy-finalist-turntable.png`

All six geometry auditions were reviewed after local decimation to matched
budgets. Source models ranged from 1.89 to 1.99 million triangles, so none was
allowed to win on source density. Local decimation proved unsuitable for the
textured production sources because it tore the hero silhouette; all three
winners therefore received an official Meshy remesh before integration.

| Family                   | Selected   | Production budget | Why it advanced                                                                                                                                                                     |
| ------------------------ | ---------- | ----------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Columnar escarpment      | B          |  48,000 triangles | The asymmetrical shoulders, stepped fractures, buried base, and coherent reverse silhouette carry the selected Columnar Furnace language without rebuilding the R6 organ-pipe wall. |
| Collapsed lava bank      | B          |  28,000 triangles | The low continuous mass has the strongest bank profile and keeps a believable rubble toe from all four reviewed headings.                                                           |
| Obsidian fumarole talus  | B          |  32,000 triangles | The broken vent cluster and connected talus remain legible in silhouette without reading as a freestanding prop.                                                                    |
| Distant breached caldera | corrective |  36,000 triangles | The low broken rim and open throat replace the procedural vent pyramid that still read as a backdrop in the decisive runtime view.                                                  |

Candidates A were rejected after the matched plate. Hero A was more vertically
architectural, Lava Bank A had the weaker edge silhouette, and Fumarole A read
more like a central fantasy spire cluster. Rejected geometry is retained as
ignored raw source plus the committed comparison evidence; it receives no paid
texturing or runtime integration.

## Paid-task ledger

| Asset                 | Geometry task                          | Retexture task                         | Remesh task                            | Credits |
| --------------------- | -------------------------------------- | -------------------------------------- | -------------------------------------- | ------: |
| Hero B                | `01a04587-db17-7a2a-b386-849e70d03b4e` | `01a0459b-0657-711d-89d0-0aa73e15e5cb` | `01a045af-5015-7cb4-ac34-0d62f4269b67` |      35 |
| Lava Bank B           | `01a0458b-0cf6-7131-90ac-0c7b38dac384` | `01a045a0-4707-72e6-8e2f-ce95c2dabb61` | `01a045b2-f26d-772f-a92e-9bf36e3fc318` |      35 |
| Fumarole B            | `01a0458e-5a9d-7d9c-a115-d569ba60119a` | `01a045a5-a3d7-73a6-8530-eb42836c009f` | `01a045b6-292c-7930-bdd7-ad8a5222989d` |      35 |
| Distant caldera       | `01a045d9-7610-7858-bf2d-3caba206f23a` | `01a045db-a666-78ec-99a2-3195f6a55319` | `01a045e1-a103-7626-bff7-b62b29c74094` |      35 |
| Hero A, rejected      | `01a04586-20b5-7fbd-a086-c51b935f040f` | none                                   | none                                   |      20 |
| Lava Bank A, rejected | `01a04589-6ee7-7bf4-99c2-abc5cf8b5dec` | none                                   | none                                   |      20 |
| Fumarole A, rejected  | `01a0458c-a42c-7d04-8bcb-eea997a51b11` | none                                   | none                                   |      20 |

Total authorized spend: 200 of 240 credits. The remaining 40-credit reserve was
not spent. The corrective caldera chain was commissioned only after the live
runtime audit proved that the procedural distant vent still read as a pyramid.
