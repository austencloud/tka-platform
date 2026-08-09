# URL state

The address bar is part of application state. A parameter belongs there only when it supports reload, sharing, browser history, or an external handoff.

## State channels

| Channel         | Use                                                          | Owner                                      |
| --------------- | ------------------------------------------------------------ | ------------------------------------------ |
| Path            | Current module, section, and stable resource identity        | `navigation-coordinator.svelte.ts`         |
| Query           | Shareable state, route-scoped state, and one-time handoffs   | The feature listed below                   |
| Hash            | In-page anchors                                              | The current page                           |
| `App.PageState` | Client history metadata that does not belong in a copied URL | The feature that creates the history entry |
| Session storage | Short-lived payloads too large or private for the URL        | The handoff service                        |

## Parameter ownership

| Parameters                                                                            | Lifetime                                                 | Owner                                         |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| `open`                                                                                | Shareable sequence deep link                             | `DeepLinker` reads it; `URLSyncer` updates it |
| `v`                                                                                   | Shareable sequence viewer code                           | Sequence viewer overlay state                 |
| `sheet`, `spotlight`, `animSeqId`, `animSpeed`, `animPlaying`, `animStep`, `animGrid` | Shareable overlay state                                  | `sheet-router.ts`                             |
| `scan`                                                                                | `/browse/library` handoff                                | Browse module                                 |
| `handoff`                                                                             | `/compose` handoff                                       | Compose module                                |
| `feedback`, `openFeedback`                                                            | `/feedback` selection                                    | Feedback state                                |
| `room`                                                                                | `/museum` room                                           | Museum module                                 |
| `seq`, `filter`                                                                       | LOOP labeler selection                                   | LOOP labeler navigator                        |
| `pending`                                                                             | Viewer authentication handoff                            | Auth action queue                             |
| `from`, `code`                                                                        | Scan attribution, consumed once                          | Scan attribution                              |
| `fresh`                                                                               | Cache-busting reload marker, consumed once               | Recovery bootstrap                            |
| Firebase email-link parameters                                                        | Authentication handoff, consumed once                    | Email-link completion                         |
| `section`                                                                             | Legacy route input, consumed during canonical navigation | Navigation coordinator                        |

Parameters created only for an external URL, such as OAuth fields, worker cache keys, physical card IDs, and asset URLs, are not current-page state.

## Mutation contract

Current-page URL changes go through `url-state.ts`.

- Existing path, query, and hash values stay intact unless the caller owns and changes them.
- Existing `App.PageState` stays intact unless the caller explicitly removes a key.
- Route navigation calls `pruneParamsForNavigation` before writing the next history entry.
- Unknown parameters survive navigation. This protects authentication callbacks and links introduced by newer deployments.
- Hard recovery reloads may use `window.location.replace` because they must fetch a new document. Normal client navigation uses SvelteKit history functions.

## History rules

- Moving to another module or section pushes an entry.
- Updating high-frequency state replaces the current entry.
- Opening a sheet or spotlight pushes an entry marked with `urlOverlay`.
- Closing an overlay created in the current session returns through browser history.
- Closing a directly loaded overlay replaces the current URL with its clean form.
- Consuming a one-time parameter replaces the current entry.

These rules keep copied links meaningful and prevent Back from landing on an identical clean page.
