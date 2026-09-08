# Create and Construct startup audit

September 8, 2026. Baseline checkout: `cca82c61e7`.

The repeated loading screens follow real, separate dependency stages. The app
announces readiness before the selected feature has finished initializing. Some
waiting is also deliberate: the startup splash holds its completion message for
1,400 ms, then fades over 400 ms. These timers can overlap useful background work;
their sum is not a measured performance improvement.

This pass adds instrumentation and identifies changes to test next. It does not
claim that startup has become faster. Interactive browser tracing still requires
Austen's approval under the supplied browser rules. No authenticated session was
used, no production deployment occurred, and no customer data was changed.

## Evidence and limits

- Code paths were inspected from HTML startup through the application shell,
  module loading, Create initialization, Construct data and pictograph preparation.
- An HTTP GET of `https://tkaflowarts.com/create` returned 200 with 54,974 bytes of
  HTML. The production HTML contains the same 1,400 ms hold and 15,000 ms dismissal
  timer. This confirms deployed markup, not the timing of an actual browser run.
- The existing localhost server answered `/create` on IPv6 port 5173. Its process
  was left alone.
- Runtime cold/warm waterfalls, CPU attribution, visual completion and repeat-run
  percentiles remain unmeasured. Static analysis cannot establish which dependency
  dominates a particular device, account or network.

## Where the loading screens come from

| Stage                                  | What is actually complete                             | What can still be pending                                                 |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| HTML splash / mandala                  | Download progress estimate and shell checkpoints      | Authentication restoration, feature code, feature state, pictographs      |
| AppShellLoader                         | MainApplication's JavaScript import                   | MainApplication initialization and active feature import                  |
| “Loading Create…”                      | ModuleRenderer awaits CreateModule import             | Create initializer import, services, tab state, restored sequence/session |
| Create initialization placeholder      | Create services and persistence are being initialized | Construct options, prepared drawing assets, stable layout                 |
| Construct placeholders / blank content | Data or prepared options may exist                    | Layout settling, carousel bounds, grid SVG insertion, browser paint       |

The outer gate lives in `src/app.html`. `MainApplication.svelte` sends 100%
immediately on mount when a boot snapshot exists, or after its own settings and
workspace initialization otherwise. Neither branch waits for Construct.
`ModuleSkeleton.svelte` selects a second mandala with “Loading Create…”.

## Findings and recommended order

### 1. Readiness and completion reporting are misleading

`MainApplication.svelte` calls `__tkaLoadProgress(100, "Ready")` before child
feature readiness. `src/app.html` adds the 1,400 ms hold and 400 ms opacity
transition. It also force-dismisses at 15 seconds even if boot has not completed.
The percentage is an estimated byte budget followed by fixed checkpoints, not
measured completion of all work.

Previously, `ModuleRenderer.svelte` also called `signalReady(moduleName)` when the
module import resolved, before mounting its component. The profiler's three-second
summary timeout then caused later readiness signals to be discarded. This pass
corrects those measurement errors: import completion is named `chunk-ready`, and
late readiness remains in the export. The console table is labeled a snapshot.

Next: remove the completion-message hold, retire “Ready” until the current task is
usable, and give one stable loading presentation an accurate current-stage label.
Keep the shell usable while its content loads. A timeout should expose a recoverable
status, not imply success. Do not extend a blocking full-screen splash to wait for
all offscreen assets.

### 2. Create waits for more than the active Construct tab

`CreateModuleInitializer.initialize()` awaits the orchestrator and then a
`Promise.all` containing Construct, Generator, Assemble and default start-position
initialization. CreateModule separately awaits initializer code, restored sequence
state, autosave session resolution and recovered session metadata.

The parallel tab work is not four additive waits; the slowest promise determines
that group's completion. Its individual timings are now recorded. Next: use those
measurements to decide whether inactive tab initialization and session metadata can
move behind active-tab usability while preserving restoration and autosave identity.
`ApplicationInitializer.initialize()` itself only sets a flag, and the shell's
`loadSettings()` reads local storage. Their async names alone are not evidence of
expensive cloud operations.

### 3. Cold motion loading can repeat and does unnecessary candidate work

`CsvLoader.loadCsvData()` caches completed results but lacks a pending shared
promise. `MotionQueryHandler.ensureInitialized()` similarly checks an initialized
flag without coalescing concurrent initialization. Concurrent cold callers can
therefore repeat fetch/parse work. The static loader requests four datasets,
including optional Skewed and Trigrid. Optional request retries can still delay the
enclosing `Promise.all` even when Construct needs only the default dataset.

`getNextOptionsForSequence()` reconstructs every row in the selected grid dataset
before identifying connected candidates. `OptionLoader` then filters the results
again by start position. CSV failure retries include 200/400 ms backoff before the
IndexedDB fallback is attempted.

Next: coalesce initialization with clear-on-rejection promises; index parsed rows
by the necessary starting locations; construct only relevant candidates. Verify
option parity before combining the two filters, since they may enforce different
invariants. Record whether optional data is absent rather than treating it as a
complete dataset. Consider cache-first offline behavior separately from freshness.

### 4. Layout settling adds another gate after data preparation

`OptionPickerContent.svelte` hides its layout branches until `sizingStable` becomes
true. It polls for ancestor transitions and stable measurements, with a 1,500 ms
settle timeout. The mobile swipe layout also waits for usable bounds.
`PictographGrid.svelte` hides start choices for a fixed 200 ms stabilization period,
then fades them in. Start-position state also starts loading immediately, followed
by preference restoration that can independently request more loads and regenerate
advanced variations while simple mode is active.

Next: restore preferences before one canonical initial load; generate advanced
variations on demand. Preserve a stable skeleton or the previous frame while
settling. Start data preparation alongside the workspace transition and use the
existing geometry owner or transition completion signal where possible. Removing
settling without checking target positions could reintroduce moving click targets.

### 5. Prepared pictographs are not proof of visible, usable choices

`OptionPicker.isReady` means services have been wired. Its data-ready state and
`preparedOptions` precede the layout gate and GridSvg's asynchronous SVG load.
The direct option renderer does not aggregate a visible-card readiness callback.
PictographContainer has a separate readiness callback for start choices, but that
also must be interpreted alongside their hidden stabilization/fade.

Next: define task readiness as handlers available, active data restored, layout
committed, and the first visible choices painted or in an explicit usable error
state. Aggregate only visible choices. Use a browser trace/filmstrip to verify this
endpoint. Neither a prepared-data mark nor a requestAnimationFrame callback alone
proves that the browser has presented a complete frame to the user.

### 6. Deferred work may still compete with startup

The composition root schedules deferred registrations with a two-second idle
timeout. The layout separately schedules gallery/creator warming with a two-second
timeout and other work at idle. Deferred registrations import video/export and
feedback dependencies. An idle callback or its timeout does not establish that the
active feature is ready. Production preloads the active module; development
deliberately skips that preload and serves individual source modules.

Next: attribute contention in the trace before changing scheduling. Gate speculative
work on active-task readiness where appropriate, preserve demand-driven service
availability, and measure production separately from the Vite development graph.

## Instrumentation delivered

The existing `shared/analytics/boot-profiler.ts` remains the owner. Searches covered
boot/startup profiling, marks, readiness callbacks, loading gates and the canonical
capabilities index. This extends the existing capability rather than adding a
second profiler or analytics destination.

Enable `?profile=1` on a fresh load. In a browser console or the dedicated browser
tool, `window.__tkaBootProfile.report()` returns a JSON-serializable snapshot.
Existing `localStorage.bootProfile = "1"` also enables detailed profiling on reload.
No report is automatically uploaded or persisted. Resource URLs and error messages
are omitted; trace tools remain necessary for request identity and CPU stacks.

| Evidence                                                     | Meaning                                                                                                   |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `boot:splash:*`                                              | Checkpoints, ready announcement, hold end, timeout dismissal, DOM removal                                 |
| `imports`                                                    | Import issue through evaluation, including production preloads; overlapping durations must not be summed  |
| `module:*:chunk-ready`                                       | Feature code arrived, without a usability claim                                                           |
| `shell:ready-announced`                                      | Whether the shell used a snapshot or completed initialization                                             |
| `create:*` spans                                             | Activation, initializer import, orchestrator, individual tab initialization, sequence/session restoration |
| `csv:*` spans                                                | Load/cache source, static fetch/read, parsing                                                             |
| `construct:option-query`, `construct:option-filter`          | Candidate query/filter duration and counts                                                                |
| `construct:prepare`, `construct:options-prepared`            | Batch preparation and first completed prepared result                                                     |
| `construct:layout-settle`, `construct:layout-committed`      | Actual measured-layout commit, with timeout/cancellation detail                                           |
| `construct:start-grid-*`, `construct:start-pictograph-ready` | Start-grid stabilization/reveal and first child readiness callback                                        |
| `pictograph:grid-svg`                                        | Grid asset loading, including errors; not browser paint                                                   |

Detailed spans are opt-in and retain up to 1,000 attempts, with a dropped-attempt
counter. Each attempt has its own ID, so concurrency and retries remain visible.
An unfinished attempt has no end/outcome. Reset prevents an old callback from
completing a new run. Milestones retain their first occurrence for the document;
later navigation attempts are represented by spans rather than new boot milestones.
The export also includes available navigation/paint timings, up to 1,000 observed
long tasks and 2,000 resource entries, and existing Web Vitals. Browser buffers,
cross-origin timing restrictions and observer support can limit completeness.
Zero transfer size alone is not proof of a cache hit.

## Runtime pass still required

Capture each run from navigation until the first usable Construct choices, plus a
short window after that to expose competing background work. Preserve a raw Chrome
trace/filmstrip and profiler JSON with a run label, build revision, cache setup,
viewport, CPU/network settings and whether a service worker controlled the page.
Do not include tokens, private URLs or account/sequence contents in shared reports.

Compare these cases rather than pooling unlike loads:

1. Production, fresh guest context, empty Construct start choices.
2. Production, warm reload in that same context.
3. Local development, first module load and warm reload, reported separately.
4. With approved account access: restored draft with options, warm authenticated
   reload, and direct sequence link. Record tutorial/auth prompts as separate states.
5. Desktop and mobile viewport; normal connection and controlled slower network/CPU.
6. HTTP-cache cold versus application-storage cold, and service-worker-controlled
   versus uncontrolled. A hard reload alone does not clear all these caches.

Start with a small repeat set to locate stable bottlenecks. Use enough repeated
samples before publishing p50/p95; a single trace supports attribution, not a
population percentile. Collect baseline and changed runs under the same conditions.

Accept improvements only when they reduce navigation-to-task-ready or remove a
false completion transition without breaking restored state, option parity, retry
behavior, hit targets or layout stability. Measure first response to selecting an
option as well as the initial screen, so deferring work does not merely move the
same stall onto the first click.

## Verification

The focused profiler, existing Web Vitals and module-loading tests pass (10 tests).
They cover late readiness, concurrent spans, failures, cancellation/reset, bounded
collection, detached snapshots and opt-in behavior. The Svelte compiler successfully
parsed all eight changed Svelte components. Formatting and `git diff --check` pass.

`npm run check:tsc` completed with one application error, outside this change:
`src/lib/shared/3d/domain/build-for-effect.ts:104`, TS2367, comparing a narrowed
`"moon" | "pictograph" | "day"` union with `"flat-grip"`. That file is unchanged
from `main`. Ten dependency/workspace diagnostics are separately reported and
excluded by the repository's existing TypeScript gate. No changed TypeScript file
has a diagnostic. This is not a full Svelte type-check or runtime verification.

The failed type gate blocks integration under the repository contract. The task
branch and worktree are preserved. Browser timings and visual readiness remain
unverified pending browser approval.
