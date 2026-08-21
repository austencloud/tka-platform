# Composer Presentation Mockup Handoff

## Mission

Take the approved direction at `https://localhost:5173/composer/mockup` through
one more honest product pass. Preserve the compact story, TKA visual language,
responsive composition, and use of real product surfaces. Correct the 3D demo,
prove manual composing, and remove the remaining places where the interface or
copy promises more than the demonstration does.

The current public `/composer` page is not the target until Austen approves the
revised mockup. Do not change the shared launchpad, `SiteHeader`, or `SiteFooter`.

## Done: verified

### Mockup baseline

- Commit `2c432e6d6e` (`feat(composer): add honest presentation mockup`) contains
  the unlisted mockup route, its noindex route configuration, the route-local
  presentation guardrails, and the generated-sequence handoff callback.
- `src/routes/(public)/composer/mockup/+page.svelte` returns HTTP 200 from the
  existing HTTPS development server.
- Its SSR head sets the canonical URL to `https://tkaflowarts.com/composer` and
  requests `noindex, nofollow` through the shared SEO component.
- The working route carries one sequence from the opening player into the real
  generator, tunnel, and 3D demonstrations.
- The current public `src/routes/(public)/composer/+page.svelte` was not changed.
- The shared launchpad, `SiteHeader`, and `SiteFooter` were not changed.

### Responsive evidence

The mockup was inspected at all requested CSS viewports. No horizontal overflow
was found.

| Viewport    | Observed result                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 375 x 667   | Product, both actions, guest condition, and the start of the real player appear in the opening screen. 3D steps aside. About 7.4 screens total. |
| 960 x 412   | Title, actions, and working player appear immediately. 3D steps aside. About 9.6 short screens.                                                 |
| 820 x 1180  | The opening and asymmetric story hold without overflow. The tunnel and 3D pair is dense and needs another typography/control pass.              |
| 1440 x 900  | Strong split opening and making section. The opening extends roughly 16px below the first viewport.                                             |
| 1920 x 1080 | Opening fits almost exactly. About 4.6 screens total.                                                                                           |
| 2560 x 1440 | The composition uses roughly 2205px and reveals the next story beat. About 3.7 screens total.                                                   |
| 3840 x 2160 | The composition grows to roughly 2552px instead of becoming a narrow center strip. About 2.5 screens total.                                     |

The 3D scene loaded at desktop and 4K sizes with no browser console errors or
warnings in the verification pass. That load proof does not validate the scene
buttons, inherited viewer state, or every control.

### Static checks

- Prettier passed for the mockup route and presentation guardrails.
- Stylelint passed for the new Svelte page.
- `git diff --check` passed for the focused Composer changes.
- `pnpm run check:fast` reported 430 pre-existing diagnostics elsewhere in the
  shared dirty checkout and no diagnostic for the mockup files.

## Believed done: unverified

- The generator's `onGenerated` callback is wired to carry the newly generated
  sequence into later demonstrations. It was not proven by a complete browser
  click-through from Generate to Tunnel and 3D.
- The working player, tunnel, and 3D components all receive the same sequence
  value. A frame-level proof that every surface visibly changed after generation
  was not recorded.
- The tunnel remains responsive and functional in the known viewports. Its
  unusually large accessibility tree was reported by the audit and was not
  traced to an exact internal node owner.
- The public copy passed the repository AI-wording scan. Visual repetition still
  needs a human silhouette read after the next layout change.

## In flight

- Repository: `E:\tka-platform`.
- Branch: `main`.
- Mockup baseline commit: `2c432e6d6e`.
- Commit `1d0318bbc1` (`docs(composer): ground claims and direct 3d showcase`)
  contains the evidence-backed truth matrix, its guardrail link, and the draft
  3D film direction.
- At the start of this handoff, local `main` was already ahead of `origin/main`
  by the unrelated commit `5876b38d84` before the Composer baseline was saved.
  Do not push that unrelated commit as part of Composer work without checking
  with its owner.
- The shared index contains staged deletions under the Lab and landing-preview
  features from other work. Do not reset, clean, stage broadly, or include them
  in a Composer commit.

## Adversarial audit: what holds weight

The fresh read-only audit graded the mockup B overall. Its most important
conclusion is sound: iterate this structure rather than restarting, but do not
promote the current 3D embed or current authoring story.

| Audit argument                                       | Independent judgment                          | Reason                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The 3D scene buttons use the wrong state owner       | Accept fully                                  | The demo writes the old global 2D background setting while the renderer reads the viewer's environment. The selected label can change without the world changing.                                                                                                                                                       |
| Persisted 3D setup leaks into the mockup             | Accept fully                                  | The demo creates an unseeded persistent viewer. The audit observed Solo selected while a group remained in the scene.                                                                                                                                                                                                   |
| The page does not prove manual composing             | Accept fully                                  | The only live authoring action is a fixed random generator. “Build” is described but not demonstrated.                                                                                                                                                                                                                  |
| The generator lets visitors set movement choices     | Accept fully as a contradiction               | `ComposerGenerateDemo.svelte` exposes one Generate button and hardcodes the recipe. The copy must change or real choices must appear.                                                                                                                                                                                   |
| 3D accessibility is weaker than the rest of the page | Accept, scoped                                | The canvas lacks a useful alternate description, a nested SVG carries invalid ARIA, the accessibility tree contains large empty regions, and the small segmented controls use 44px targets instead of the project's 48px standard. Some fixes may belong to shared owners and must be reported rather than edited here. |
| The prop statement is honest but visually unproved   | Accept                                        | Every major demonstration uses staffs. One real prop change would prove a distinctive capability without adding a catalogue.                                                                                                                                                                                            |
| The page should use a directed 3D film               | Accept as the stronger presentation direction | The existing 3D engine can show much more than four labels and performer counts. A baked film reduces visitor work while a repaired live viewer remains proof.                                                                                                                                                          |
| The opening is irredeemably generic                  | Accept partly                                 | The large centered phone title, paired actions, purple glow, and closing CTA use familiar landing-page grammar. The real player, Fraunces, pictographs, and asymmetric desktop composition keep it recognizably TKA. Refine the opening and remove the redundant closing band; do not restart.                          |
| The generator failure message lies                   | Accept                                        | Chunk, network, and generation failures all become “That draw came up empty.”                                                                                                                                                                                                                                           |
| The page wastes large screens                        | Reject                                        | The measured 2560 and 3840 compositions use the available width well without inflating prose.                                                                                                                                                                                                                           |
| The page is too quiet                                | Treat as taste                                | The shorter page and quiet transitions support the requested focus. Add visual proof where it matters instead of restoring a feature wall.                                                                                                                                                                              |

## Loose ends, ranked

### 1. Isolate and repair the 3D demonstration

Owner:
`src/routes/(public)/composer/_components/Composer3DViewerDemo.svelte`.

- Remove `settingsService` and every snapshot, write, and restore of the global
  2D background.
- Construct `createViewer3DState` with a complete demonstration seed. Include a
  known environment, 3D mode, one known performer snapshot, staff defaults,
  known effect toggles, a line formation, empty planes, and fixed scene-feature
  choices. A seed with only an environment still allows omitted fields to fall
  through to saved viewer values.
- Send scene changes to `viewer.setEnvironmentId`.
- Use the current scene-environment identifiers instead of presenting the old
  2D background setting as the source of truth.
- Let `Environment3D.svelte` perform its existing cover-and-reveal transition.
  Do not add a second crossfade owner.
- Keep the public demo deterministic. Performer count, selection, camera, props,
  effects, and environment must start the same way for every visitor.
- Raise the segmented controls to the project touch-target standard and give the
  live scene a useful text alternative.

Prove this against a browser profile with an eight-performer saved scene and
non-default effects. The mockup must still open as one performer with the known
look. Click every scene and confirm both the selected state and rendered world.
Confirm the account's saved 2D background and 3D setup are unchanged after
leaving the page.

### 2. Prove composing, not only generation

Owners:
`src/routes/(public)/composer/mockup/+page.svelte` and the existing route-local
construction demonstration under
`src/routes/(public)/composer/_sections/ConstructSection.svelte`.

Add one small real composition gesture before or beside generation. A visitor
should be able to choose or replace a beat and see the notation and animation
respond. The full editor still belongs at `/create`.

Investigate reuse from `ConstructSection.svelte` and the canonical Create
workspace before creating another editor. The goal is not a second mini app. It
is one undeniable proof that Composer writes choreography beat by beat.

The changed sequence should continue into the tunnel and repaired 3D demo just
as a generated sequence does.

### 3. Make the generator claim match the interaction

Owner:
`src/routes/(public)/composer/_components/ComposerGenerateDemo.svelte`.

Either expose a small, real choice that affects the generation request or say
plainly that this button draws another sequence from one prepared recipe. Do not
display controls that are decorative or disconnected.

Separate “no valid draw” from a load or engine failure. Cancel delayed idle work
when the component unmounts, and prefer viewport activation over unconditional
below-fold activation.

### 4. Prove one prop change

Use one current supported prop visual in a real player or 3D shot. A small
staff-to-club, staff-to-fan, or staff-to-triad comparison would substantiate the
existing prop caveat. Do not imply that the movement model transfers to every
prop or that the enum is a catalogue of shipped visuals.

The approved 3D showcase film may eventually carry this proof. The mockup does
not need both a new prop interaction and a film if the film is already approved
and present.

### 5. Reduce the remaining landing-page defaults

- Keep the first-screen product definition, real player, and clear action.
- Test a less centered phone composition before changing the strong desktop
  split.
- Vary or remove the repeated “Make / Change / Keep” headline grammar.
- Remove the rounded closing CTA band if the last story beat can lead directly
  to the existing shared footer action.
- Preserve the current quiet pacing and asymmetric demonstrations.

### 6. Address accessibility findings within scope

- Give the 3D demonstration a concise accessible description and announce
  loading or unavailability once.
- Mark genuinely decorative visual internals as decorative at the closest
  valid owner. Do not hide interactive or informative notation.
- Trace the invalid SVG ARIA and large empty tree to the exact shared component.
  If the fix belongs outside `src/routes/(public)/composer/**`, report the file
  and desired correction to its owner rather than editing it.
- Re-run Lighthouse only after the real 3D scene has mounted. A skeleton-only
  result is not evidence.

### 7. Keep the truth ledger current

Use `src/routes/(public)/composer/feature-truth-matrix.md` as the source for
public claims. It records released, internal/beta, incomplete, and unavailable
features with code-path evidence.

The most important exclusions are the personalized following feed, three
distinct Train mode behaviors, QR on every export, full movement equivalence
across props, and production-film controls that do not exist yet.

## Decisions already made

- Austen considers the general concept sound and the current mockup a strong
  direction.
- The redesign edits the established TKA visual language. It does not replace
  the cosmic field, Fraunces display type, pictographs, prop colors, app
  surfaces, or restrained motion with a new marketing theme.
- The page is a focused product story, not a long catalogue.
- Real working demonstrations outrank decorative feature cards.
- One sequence travels through the page to create continuity.
- Feature copy follows the four-state truth matrix. Registry entries do not
  prove shipment.
- 3D is omitted on unsupported or small viewports rather than squeezed into a
  poor experience.
- The 3D film and the live viewer have different jobs. The film shows range. A
  small repaired viewer proves the engine is live. The full Studio remains the
  place for detailed control.
- No shared navigation file changes during this work.

## Desired navigation changes, reported separately

No shared navigation change is required for the next mockup iteration.

- `SiteHeader` already links “Composer” to `/composer` and its app action to
  `/create`.
- `SiteFooter` already carries the same public-page and app destinations.
- The approved mockup's primary action may remain `/create`; Browse and Library
  links remain page-local.
- If the 3D film gains “Open 3D Studio,” add it inside the Composer presentation
  and send it to the current Stage scene destination with the existing account
  boundary. Do not add another shared header item.
- The shared launchpad does not need a new tile or label for this iteration.

If a later owner wants to change any of those shared destinations, report the
exact proposed label and target to the shared-navigation owner first.

## Verification plan

1. Add focused state tests proving a complete seed ignores an existing saved
   eight-performer scene and that scene choices update the viewer environment
   without touching app settings.
2. Interact through one manual beat change and one generation. Confirm the
   opening player or carried sequence, tunnel, and 3D scene all receive the new
   sequence.
3. Mount the real 3D scene, exercise all scene and performer controls, leave the
   route, and compare the visitor's saved 2D and 3D settings before and after.
4. Run the seven-view visual sweep at 375, 960 x 412, tablet, 1440, 1920, 2560,
   and 3840. Inspect the first screen, manual edit, generator result, tunnel/3D
   transition, and ending rather than taking random screenshots.
5. Repeat with reduced motion, keyboard-only input, WebGL2 unavailable, 3D
   viewport below the gate, generator no-result, generator load failure, and a
   failed lazy demo import.
6. Run an accessibility tree inspection and Lighthouse after 3D settles. Verify
   48px targets, valid SVG ARIA, a useful canvas description, visible focus, and
   no repeated empty announcements.
7. Run focused formatting, style, type, and unit checks. Attribute any global
   failure to exact files and do not absorb unrelated shared-checkout errors.
8. Run the repository AI-bust scan, then perform the silhouette, heading, swap,
   product, fire-jam, and viewport reads in `presentation-guardrails.md`.

## Gotchas

- The known 3D defect is a state-ownership error. Styling the transition will
  not fix it.
- `createViewer3DState({ environmentId: ... })` stops writes but does not by
  itself replace every omitted persisted field. Supply the complete demo seed.
- The environment renderer already owns reduced-motion-aware movement between
  worlds.
- Port 5173 is the user's HTTPS development server. Do not start, stop, restart,
  or kill it. Use `https://localhost:5173`.
- The mockup is deliberately unlisted and noindex. Do not replace `/composer`
  until Austen explicitly approves the promotion.
- The current checkout is shared and dirty. Commit only explicit Composer or
  handoff paths. Never stage or clean broadly.
- Do not edit shared navigation, header, footer, or launchpad files in this
  assignment.
- Do not claim games, Train, Stage, a following feed, or a prop just because it
  appears in a registry. Trace it through the mounted component and behavior
  path recorded in the truth matrix.
