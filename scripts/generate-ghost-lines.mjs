#!/usr/bin/env node
/**
 * Widen the ghost presenter's voice — offline, once, not at the jam.
 * (spec: docs/superpowers/specs/2026-08-05-ghost-presence-design.md)
 *
 * The presenter runs unattended for hours in front of strangers. Its thoughts
 * come from small hand-written pools — two or three phrasings per intention —
 * so anyone watching for twenty minutes hears the same lines come round again,
 * and the whole thing collapses back into "it's a script." More phrasings is
 * the single cheapest fix, and writing eighty of them by hand is the kind of
 * job nobody finishes.
 *
 * So a model writes them, ONCE, offline, into a checked-in file. Consequences
 * that matter:
 *
 *   - No API key ships to the browser, and none is needed at the park.
 *   - No network call in the ghost's critical path, so the rhythm is untouched.
 *   - The tour stays reproducible from a seed: the pools are static data, and
 *     the seeded rng still picks from them.
 *   - If this script never runs again, the presenter is exactly as good as it
 *     is today — the generated pool is additive to the hand-written lines,
 *     never a replacement.
 *
 * Voice comes from mcp-server/src/core/humor-profile.json: 88 pairs of a line
 * Austen CHOSE and the lines he rejected alongside it, each tagged with a lens.
 * Those pairs are about sequence taglines, not ghost monologue — a different
 * job. What transfers is the voice and the lens taxonomy, and the rejects are
 * the more useful half: they show where the bar is, which no amount of "be
 * funny" in a prompt conveys.
 *
 * Usage:
 *   node scripts/generate-ghost-lines.mjs            # all slots
 *   node scripts/generate-ghost-lines.mjs play-it    # one slot, to iterate
 *   node scripts/generate-ghost-lines.mjs --dry-run  # print, don't write
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const PROFILE = path.join(ROOT, "mcp-server/src/core/humor-profile.json");
const OUT = path.join(
  ROOT,
  "src/lib/shared/attract/intentions/generated-lines.ts",
);

/**
 * Opus, not Haiku, and deliberately.
 *
 * This runs a few dozen times total, offline, so per-token cost is irrelevant
 * — and voice is the entire deliverable. Haiku is the right tier for the LIVE
 * contextual lines if that ever gets built (short output, tight prompt, cheap,
 * fast). It is the wrong tier for the one pass that decides how the character
 * sounds for the next four hours.
 */
const MODEL = "claude-opus-5";
/** Lines per slot. Enough that a 20-minute watch never hears a repeat. */
const PER_SLOT = 24;

// ---------------------------------------------------------------------------
// The slot catalogue
// ---------------------------------------------------------------------------

/**
 * One entry per place the ghost speaks.
 *
 * `target: true` means the line NAMES the control the ghost is about to press.
 * Those generate as templates containing exactly one `{target}` placeholder,
 * which the runtime substitutes with the label of the element the intention
 * already resolved. This is not a formatting nicety — it is what keeps the
 * thought and the action about the same thing. A generated line that hardcodes
 * a control name would re-create 3b912bbc97, where the ghost said "I wonder
 * what side by side is" and clicked something else. The validator below
 * rejects any target line without the placeholder, and a unit test enforces
 * the same rule against the committed file.
 */
const SLOTS = [
  // --- build ---
  {
    id: "filter-continuous",
    situation:
      "It is about to press a filter that narrows the available next moves to one kind of motion. It is curious what the app looks like with fewer options.",
    seeds: ["What if I only want the smooth ones?"],
  },
  {
    id: "fiddle-turns",
    situation:
      "It is about to add rotation to one of the props in the sequence it is building. Small tweak, immediate visible result.",
    seeds: ["What if this one spun more?"],
  },
  {
    id: "clear-and-restart",
    situation:
      "It has decided the sequence it built is not going anywhere and is about to wipe it and start over. Slightly bored, not upset.",
    mood: "bored",
    seeds: ["Let's start over."],
  },

  // --- playback ---
  {
    id: "pause-to-look",
    situation:
      "The sequence is playing and something in the middle caught its eye. It is about to freeze it to look closer.",
    mood: "unsure",
    seeds: ["Hold on, what is it doing there?", "Wait — freeze it there."],
  },
  {
    id: "scrub-back",
    situation:
      "It wants to see an earlier part of the sequence again. It is rewinding.",
    seeds: ["Let me see that bit again."],
  },
  {
    id: "try-practice",
    situation:
      "It is about to open practice mode, which turns on the camera and shows the viewer their own reflection next to the sequence.",
    mood: "delighted",
    seeds: ["Let's try this along with it.", "Can I do this with it?"],
  },
  {
    id: "can-it-see-me",
    kind: "reaction",
    situation:
      "The camera just came on and there is now a live mirror on screen. This lands AFTER it happened. It is a small startled realisation, not a warning.",
    mood: "delighted",
    seeds: ["Wait — can it see me?"],
  },
  {
    id: "leave-practice",
    situation: "It is done with the camera and closing practice mode.",
    seeds: ["Alright, back to it."],
  },

  // --- effects ---
  {
    id: "reject-effect",
    situation:
      "An effect is currently on the sequence and it has decided it does not like it. It is about to turn it off.",
    mood: "unsure",
    seeds: ["Hmm. No."],
  },
  {
    id: "tune-effect",
    situation:
      "An effect is on and it is about to adjust one of its settings to see what changes.",
    seeds: ["What does this knob do to it?"],
  },
  {
    id: "open-props",
    situation:
      "It is about to open the prop picker, which changes what the sequence is performed with — staves, fans, clubs.",
    seeds: ["What else can I hold?"],
  },

  // --- explore ---
  {
    id: "open-viewer",
    situation:
      "It is about to open the full sequence viewer, which is the big proper view of the thing it has been building.",
    mood: "delighted",
    seeds: ["Let's see this one properly."],
  },
  {
    id: "overwhelmed",
    situation:
      "There is a lot on screen. This is a passing reaction to density, said rarely — twice a session at most. It should read as amused, not defeated.",
    mood: "unsure",
    seeds: ["That's a lot of buttons."],
  },
  {
    id: "change-tab",
    situation: "It is switching to a different tab in the current module.",
    seeds: ["There's more in here.", "What's behind this tab?"],
  },
  {
    id: "dismiss-blocker",
    situation:
      "A tutorial prompt or tour has appeared over everything and it is about to skip it. Polite, brief, not annoyed.",
    mood: "unsure",
    seeds: ["Not right now, thanks."],
  },
  {
    id: "let-it-show-me",
    situation:
      "It is about to press something that makes the app do the work — generate or build something for it rather than doing it by hand.",
    mood: "delighted",
    seeds: ["Let's see what it comes up with."],
  },
  {
    id: "leave-viewer",
    situation:
      "It is closing the viewer and going back to whatever it was doing before.",
    seeds: ["Right — what else was there?"],
  },
  {
    id: "escape-room",
    situation:
      "It has run out of things to touch here and is leaving for another part of the app. Mildly bored. This is a room-change, not a complaint.",
    mood: "bored",
    seeds: ["Let's go back."],
  },
  {
    id: "browse-gallery",
    situation:
      "It is about to open the gallery of sequences other people have made and saved.",
    seeds: ["What has everyone else been making?"],
  },
  {
    id: "open-someone-elses",
    situation:
      "It is about to open a sequence somebody else built, from the gallery.",
    mood: "delighted",
    seeds: ["Let's have a look at this one."],
  },

  // --- invite (the takeover family — see intentions/invite.ts) ---
  {
    id: "offer-the-wheel",
    situation:
      "Said to the room, unprompted, while nothing much is happening. It is telling a stranger watching from across the room that they can take the laptop over whenever they like. This is an aside from something busy, never an announcement or a sales pitch. It must not sound like signage.",
    seeds: [
      "you can take this from me whenever you want",
      "this is yours if you want it — just touch something",
    ],
  },
  {
    id: "everything-is-live",
    situation:
      "Said to the room while resting. It is telling a stranger that the screen is a real working app, not a video loop playing on a laptop. Same aside register as above.",
    mood: "still",
    seeds: ["everything I press, you can press", "none of this is a video, by the way"],
  },
  {
    id: "point-it-out",
    target: true,
    situation:
      "It has hovered a specific control and deliberately NOT pressed it, so that a passerby has something concrete to finish. The line hands that control to them by name.",
    seeds: ["try {target} — go on, I'll wait", "{target}. that one's yours"],
  },
];

/*
 * Deliberately NOT in the catalogue: what-is-this-button, go-to-module,
 * try-prop, try-effect.
 *
 * Those route through monologueFor() in monologue.ts, which keys a line off the
 * SPECIFIC control — Mandala and Tunnel get different curiosities even though
 * they share a mechanism. That is a better mechanism than a generic pool, not a
 * worse one, and a slot here would flatten it back into one voice for every
 * button. Widening those means adding rows to that table, by hand, per control.
 */

// ---------------------------------------------------------------------------
// The prompt
// ---------------------------------------------------------------------------

/**
 * The rejected lines are the point.
 *
 * A prompt that only shows chosen lines teaches topic and register; it does not
 * teach where the bar is. Showing what got turned down next to what got kept —
 * on the same word, at the same moment — is the only cheap way to convey taste.
 */
function fewShot(profile) {
  return profile.trainingPairs
    .slice(0, 30)
    .map((pair) => {
      const rejects = (pair.rejected ?? [])
        .slice(0, 3)
        .map((r) => `  rejected (${r.lens}): ${r.text}`)
        .join("\n");
      return [
        `word: ${pair.word}`,
        `  CHOSE (${pair.selected.lens}): ${pair.selected.text}`,
        rejects,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function systemPrompt(profile) {
  const lenses = Object.entries(profile.lensDefinitions)
    .map(([name, def]) => `- ${name}: ${def}`)
    .join("\n");

  return `You write the inner monologue of a presence that explores a flow-arts
app by itself, on a laptop propped open at a flow jam, for hours, unattended.
People drift past. Some watch from across the room. It has no name, no face and
no body beyond a glowing dot, and everything anyone learns about who it is comes
from what it wonders about.

It is curious, not enthusiastic. It is looking at this app the way a person
looks at an instrument someone left out — poking, noticing, occasionally
delighted, occasionally bored. It never explains features, never sells anything,
never says what a thing is FOR. It says what it wants to see.

The person it is written for is Austen. Below are his own taglines for
sequences: the line he chose and the lines he rejected in the same sitting. That
is a different writing job from this one, so do not copy its subject matter —
what you are learning from it is the voice and the bar.

His lenses:
${lenses}

Primary lens: ${profile.summary.primary}. Secondary: ${profile.summary.secondary.join(", ")}.
Never use ${profile.summary.avoided.join(", ")}.

<examples>
${fewShot(profile)}
</examples>

Hard rules for the lines you write:

- SHORT. Most under eight words. These are read from across a room, in a
  bubble that clamps to two lines. A long line is a line nobody finishes.
- Speech, not captions. Would someone say this out loud, standing at a laptop?
- No feature names, no marketing, no explaining what something is for. "Let's
  see what it looks like in a tunnel" — never "let me show you the tunnel view".
- No enthusiasm words. No "amazing", "gorgeous", "beautiful", "love this",
  "so cool", and no exclamation marks.
- No em dashes as a tic (one is fine where a person would pause).
- It does not know it is a demo, does not know it is being watched, and never
  addresses "you" except in the lines explicitly marked as spoken to the room.
- Vary the shape: questions, fragments, flat statements, half-thoughts. Twenty
  lines that are all "I wonder what X does" is one line written twenty times.
- Never claim a fact about flow arts, the app, or what a control will do. It
  wonders; it does not assert.
- IT CANNOT SEE ANYONE. There is no camera pointed at the room, no presence
  detection, nothing. The laptop is usually alone. So never write a line that
  claims somebody is there or describes them: no "you've been standing there a
  while", no "you look like you know what you're doing", no "I can tell you
  want to". The room-facing lines are said to an EMPTY room that may or may not
  contain a person — an offer left out, not an observation of one.
- Never contradict the action it just took. If it pressed the button, the line
  cannot say the thing happened on its own.

Return ONLY a JSON array of strings. No prose, no keys, no markdown fence.`;
}

function slotPrompt(slot, n) {
  const targetRule = slot.target
    ? `\nThis line NAMES the control it is about to touch. Every line MUST contain the placeholder {target} exactly once — the app substitutes the real control name at runtime. Write around the placeholder so it reads naturally wherever the name lands. Do not invent control names.`
    : "";
  const moodRule = slot.mood ? `\nMood: ${slot.mood}.` : "";

  return `Situation: ${slot.situation}${moodRule}${targetRule}

Existing lines for this moment, which are the tone to match and NOT to repeat:
${slot.seeds.map((s) => `- ${s}`).join("\n")}

Write ${n} new lines for this exact moment. JSON array of strings only.`;
}

// ---------------------------------------------------------------------------
// Validation — cheaper to enforce here than to notice at a jam
// ---------------------------------------------------------------------------

const BANNED =
  /\b(amazing|gorgeous|stunning|beautiful|awesome|incredible|seamless|unlock|elevate|delve|dive in|let's dive|so cool|love this|check out)\b/i;

function validate(slot, lines) {
  const kept = [];
  const dropped = [];
  const seen = new Set(slot.seeds.map((s) => s.toLowerCase()));

  for (const raw of lines) {
    if (typeof raw !== "string") continue;
    const line = raw.trim();
    const reject = (why) => dropped.push({ line, why });

    if (!line) continue;
    if (seen.has(line.toLowerCase())) {
      reject("duplicate");
      continue;
    }
    // The bubble clamps at two lines; anything longer is silently truncated,
    // which reads as the ghost trailing off mid-thought.
    if (line.length > 78) {
      reject("too long");
      continue;
    }
    if (line.includes("!")) {
      reject("exclamation");
      continue;
    }
    if (BANNED.test(line)) {
      reject("ai-ism");
      continue;
    }
    // The invariant. A target line without its placeholder would hardcode a
    // control name and desync the thought from the press (3b912bbc97).
    const placeholders = (line.match(/\{target\}/g) ?? []).length;
    if (slot.target && placeholders !== 1) {
      reject("target placeholder must appear exactly once");
      continue;
    }
    if (!slot.target && placeholders > 0) {
      reject("placeholder in a non-target slot");
      continue;
    }
    seen.add(line.toLowerCase());
    kept.push(line);
  }
  return { kept, dropped };
}

// ---------------------------------------------------------------------------

function parseArray(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error(`no JSON array in: ${body.slice(0, 200)}`);
  return JSON.parse(body.slice(start, end + 1));
}

function emit(pools) {
  const entries = Object.entries(pools)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, lines]) => {
      const body = lines.map((l) => `    ${JSON.stringify(l)},`).join("\n");
      return `  ${JSON.stringify(id)}: [\n${body}\n  ],`;
    })
    .join("\n\n");

  return `/**
 * GENERATED — do not edit by hand.
 *
 * Regenerate with: node scripts/generate-ghost-lines.mjs
 * Voice source:    mcp-server/src/core/humor-profile.json
 * Spec:            docs/superpowers/specs/2026-08-05-ghost-presence-design.md
 *
 * The ghost presenter's thought pools. Hand-written lines live in the
 * intentions themselves and are ALWAYS included alongside these — this file
 * widens the pool, it never replaces it. Delete it and the presenter still
 * works, just with the repetition it had before.
 *
 * Lines containing {target} are templates: the runtime substitutes the label of
 * the control the intention already resolved, so the thought and the press stay
 * about the same thing. See helpers.ts \`voiced()\`, and the test that enforces
 * the placeholder rule.
 *
 * Austen's thumbs-down on any line here: delete it and regenerate, or drop it
 * straight out of the array — nothing else depends on the count.
 */

export const GENERATED_LINES: Record<string, readonly string[]> = {
${entries}
};
`;
}

// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const only = args.filter((a) => !a.startsWith("--"));
  const slots = only.length ? SLOTS.filter((s) => only.includes(s.id)) : SLOTS;

  if (!slots.length) {
    console.error(`No slot matched ${only.join(", ")}. Known slots:`);
    for (const s of SLOTS) console.error(`  ${s.id}`);
    process.exit(1);
  }

  const profile = JSON.parse(fs.readFileSync(PROFILE, "utf-8"));
  const client = new Anthropic();
  const system = systemPrompt(profile);

  // Carry forward any slot we're not regenerating, so a single-slot run is a
  // patch rather than a wipe.
  let pools = {};
  if (fs.existsSync(OUT) && only.length) {
    const prior = fs.readFileSync(OUT, "utf-8");
    const match = prior.match(/GENERATED_LINES[^=]*=\s*(\{[\s\S]*\});/);
    if (match) {
      try {
        pools = JSON.parse(match[1].replace(/,(\s*[}\]])/g, "$1"));
      } catch {
        console.warn("! could not read existing pools; regenerating only the named slots");
      }
    }
  }

  for (const slot of slots) {
    process.stdout.write(`${slot.id} … `);
    // Over-ask: validation throws some away, and a slot that comes back thin
    // is worse than one extra cheap call.
    const asked = Math.ceil(PER_SLOT * 1.6);
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: slotPrompt(slot, asked) }],
    });

    if (response.stop_reason === "refusal") {
      console.log("REFUSED — skipped");
      continue;
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const { kept, dropped } = validate(slot, parseArray(text));
    pools[slot.id] = kept.slice(0, PER_SLOT);
    console.log(
      `${pools[slot.id].length} kept` +
        (dropped.length ? `, ${dropped.length} dropped` : ""),
    );
    for (const d of dropped) console.log(`    ✗ ${d.why}: ${d.line}`);
  }

  const source = emit(pools);
  if (dryRun) {
    console.log("\n--- dry run, not written ---\n");
    console.log(source);
    return;
  }
  fs.writeFileSync(OUT, source);
  const total = Object.values(pools).reduce((n, l) => n + l.length, 0);
  console.log(`\nWrote ${total} lines across ${Object.keys(pools).length} slots`);
  console.log(path.relative(ROOT, OUT));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
