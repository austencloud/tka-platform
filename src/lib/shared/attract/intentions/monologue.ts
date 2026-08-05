/**
 * What a person would be thinking when they reach for a particular control.
 *
 * Austen, watching a tour (2026-08-05): *"He sure does say that's a lot of
 * buttons pretty often. Let's make it so he doesn't really do that and before he
 * clicks something let's have him process what he's about to click."*
 *
 * The old thoughts were written per INTENTION, so every effect chip got the same
 * line and every rail item got "What does X do?". The interesting unit is not
 * the intention, it is the CONTROL: pressing Mandala and pressing Tunnel are
 * different curiosities that happen to share a mechanism. So the vocabulary is
 * keyed by kind, with per-label overrides for the controls whose identity a
 * person would actually have an opinion about.
 *
 * Every line here is a MOTIVE — the reason to press it — not a description of
 * the button. "I want to see it from the inside" beats "Open Tunnel view".
 *
 * Lines are drawn with the seeded rng, so a replayed seed replays the monologue.
 */

import type { GhostKind } from "../domain/annotations";
import type { GhostContext } from "../domain/intention";

/**
 * Controls worth their own voice, matched on the label case-insensitively. These
 * are the ones a passerby can see the point of — the viewer's content modes, the
 * named effects, the props.
 */
const BY_LABEL: Record<string, string[]> = {
  // Viewer content rail
  "side by side": [
    "Can I watch both at once?",
    "I want to see them next to each other.",
  ],
  "2d animation": ["Just the clean version, no depth.", "Back to the flat one."],
  "3d animation": [
    "What does this look like in three dimensions?",
    "I want to walk around it.",
  ],
  card: ["Could I hold this in my hand?", "What does it look like as a card?"],
  mandala: [
    "What does the whole thing look like as one picture?",
    "All of it at once, as a shape.",
  ],
  tunnel: ["I want to see it from the inside.", "What's it like looking down it?"],
  playback: ["Let me get at the playback controls.", "How do I drive this?"],
  props: ["What else could I be spinning?", "Let's change what's in my hands."],
  display: ["What can I turn on and off here?", "Let me see the display options."],

  // Props
  staff: ["Staves are what this was built for.", "Back to staves."],
  fan: ["Fans would show the sweep better.", "What about fans?"],
  club: ["Clubs have a different weight to them.", "Let's try clubs."],
  buugeng: ["Buugeng do that overlapping thing.", "What about buugeng?"],
  sword: ["A sword is just a very confident staff.", "Let's try a sword."],
  hoop: ["Hoops read completely differently.", "What about hoops?"],
  triad: ["Triads, then.", "Let's see triads."],

  // Effects worth naming
  fire: ["Fire. Obviously fire.", "Let's set it on fire."],
  trails: ["I want to see the path it draws.", "Show me where the ends went."],
  ink: ["Like it's painting the air.", "Let's make it draw."],
  goo: ["What does it look like thick and slow?", "Something gooier."],
  ghost: ["I want to see where it just was.", "Leave a trace behind it."],
  led: ["Make it glow like an LED.", "What about lights?"],
  sparkles: ["A bit of sparkle can't hurt.", "Let's make it glitter."],
  smoke: ["Something softer, like smoke.", "What about smoke?"],
  petals: ["Petals would be pretty.", "Let's try petals."],
  bloom: ["I want it to glow around the edges.", "Something with bloom."],
  zap: ["Something electric.", "Let's make it crackle."],
  bubbles: ["Bubbles, why not.", "What about bubbles?"],
  silk: ["Something that flows like silk.", "Let's try silk."],
  coal: ["Like it's burning down to embers.", "Something smouldering."],
  pulse: ["Make it breathe with the beat.", "Something that pulses."],
  animal: ["What on earth does animal do?", "I have to know what this one is."],

  // Tempo
  slow: ["Slower. I want to see the hands.", "Too fast — let's slow it down."],
  med: ["Somewhere in the middle.", "A normal speed."],
  fast: ["Faster — what does that feel like?", "Let's see it up to speed."],

  // Blockers / plumbing
  "skip for now": ["Not right now, thanks.", "I'd rather just poke around."],
  skip: ["I'll figure it out myself.", "Not the guided version."],
  mirror: [
    "Wait — can it see me?",
    "Let's put me behind it.",
    "I want to try this along with it.",
  ],
  practice: ["Can I do this with it?", "Let me try it myself."],
  stop: ["Alright, that's enough of that.", "Back to the sequence."],
};

/**
 * Fallback by role, for the controls whose specific identity does not matter —
 * one of forty option cards, an anonymous chip. `{label}` interpolates.
 */
const BY_KIND: Partial<Record<GhostKind, string[]>> = {
  option: [
    "{label} could work next.",
    "What if {label} came next?",
    "Let's try {label} here.",
    "{label} looks like it fits.",
  ],
  "start-position": [
    "Let's start from {label}.",
    "{label} is a good place to begin.",
    "I'll open with {label}.",
  ],
  effect: ["What does {label} do to it?", "Let's try {label}.", "{label}, then."],
  "effect-param": ["A little more of that.", "What if I nudge this?"],
  prop: ["What if these were {label}?", "Let's put {label} in its hands."],
  tempo: ["What about {label}?", "Let's try it {label}."],
  curio: [
    "What does {label} do?",
    "I've not pressed {label} yet.",
    "{label}. No idea what that is.",
    "Let's find out what {label} is.",
  ],
  "gallery-item": [
    "Somebody else made this one.",
    "Let's look at this one properly.",
    "What did they come up with?",
  ],
  viewer: ["Let's see this properly.", "I want a better look at it."],
  play: ["Let's see it move.", "Now watch."],
  clear: ["Let's try something completely different.", "Scrap it and start over."],
  confirm: ["Yes, get rid of it.", "Go on then."],
  dismiss: ["Not right now, thanks.", "I'd rather just look around."],
  "close-overlay": ["Right — what else was there?", "Enough of that."],
  turn: ["What if this hand turned instead?", "Let's add a turn here."],
  "option-filter": [
    "I wonder if anything continues from this.",
    "Let's narrow it down.",
  ],
  "nav-module": ["I haven't looked at {label} yet.", "What's in {label}?"],
  stage: ["…", "That's rather nice."],
};

/** Strip the punctuation and boilerplate a label picks up from UI copy. */
function tidy(label: string): string {
  return label
    .replace(/\.\s*Hold to preview\.?/i, "")
    .replace(/^Select\s+/i, "")
    .replace(/^(Switch to|Show|Open|Go to)\s+/i, "")
    .trim();
}

/**
 * The line the ghost thinks before pressing `target`. Falls back through
 * label-specific → kind-generic → a plain honest line, so a control nobody has
 * written a motive for still gets something a person might say.
 */
export function monologueFor(
  kind: GhostKind,
  target: HTMLElement | null,
  ctx: GhostContext,
  fallback: string,
): string {
  const label = tidy(
    target?.getAttribute("data-ghost-label") ??
      target?.getAttribute("aria-label") ??
      target?.textContent ??
      "",
  );

  const specific = label ? BY_LABEL[label.toLowerCase()] : undefined;
  const generic = BY_KIND[kind];
  const pool = specific ?? generic;
  if (!pool?.length) return fallback;

  const line = ctx.rng.pick(pool) ?? fallback;
  // A `{label}` line with no label to put in it would read as a template bug.
  if (line.includes("{label}")) {
    return label ? line.replaceAll("{label}", label) : fallback;
  }
  return line;
}
