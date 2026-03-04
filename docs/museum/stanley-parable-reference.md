# Stanley Parable — Reference & Design Lessons

> The Kinetic Archive is heavily inspired by The Stanley Parable's approach to narration,
> player agency, and constraint-driven design. This document captures the key sources,
> development philosophy, and applicable techniques.

---

## Primary Sources

### Interviews & Talks

| Source | URL | Key Content |
|--------|-----|-------------|
| Gamercamp 2013 | https://thatshelf.com/gamercamp-2013-the-stanley-parables-davey-wreden/ | Wreden's origin story, film school background, narrator born from limitation, "all endings valid" philosophy |
| Behind the Scenes | https://www.gamedeveloper.com/business/behind-the-scenes-with-i-the-stanley-parable-i- | "Players construct meaning from proximity," cut flowchart, Brighting "first take" casting |
| GDC: Never Trust First Idea | https://www.gamedeveloper.com/design/video-i-stanley-parable-i-s-wreden-on-never-trusting-your-first-idea | Pattern recognition in own work, iterating past first instincts |
| GDC: Choice in Game Design | https://www.gamedeveloper.com/design/video-i-the-stanley-parable-i-devs-analyze-choice-in-game-design | Expressive choice without challenge, negotiation between player and designer |
| Shacknews Interview | https://www.shacknews.com/article/70363/interview-davey-wreden-on-stanley-parable-remake-and-self-taught | "What if you could disobey the narrator?", organic character evolution, fun over pretension |
| William Pugh Interview | https://www.pcgamesn.com/the-stanley-parable/the-big-interview-william-pugh-closes-the-book-on-the-stanley-parable | Remote dev process, writing as self-discovery, post-success emotional toll |
| GDC Vault | https://www.gdcvault.com/play/1020637/The-Stanley-Parable-A-Negotiation | Full GDC 2014 talk video |

### Transcripts

| Source | URL | Content |
|--------|-----|---------|
| Fandom Wiki - All Endings | https://thestanleyparable.fandom.com/wiki/Category:Dialogue | Index of all 25+ ending transcripts |
| Fandom Wiki - Ultra Deluxe | https://thestanleyparable.fandom.com/wiki/Dialogue/Ultra_Deluxe | New content added in 2022 edition |
| Fandom Wiki - HD Remix | https://thestanleyparable.fandom.com/wiki/Dialogue/HD_Remix | Full 2013 edition transcript (large page) |
| GitHub - Raw Subtitles | https://github.com/akemin-dayo/Localization/blob/master/The%20Stanley%20Parable/subtitles_english.txt | Actual game data file, all dialogue lines |
| Settings Person | https://thestanleyparable.fandom.com/wiki/Settings_Person/Dialogue | Second voice character (Ultra Deluxe) |

---

## Development Philosophy

### How It Was Made

- **Wreden came from film school.** Not a level designer. Couldn't build environments. Made empty hallways + voiceover. The narrator IS the constraint solution.
- **Found Kevan Brighting via casting call.** "Danced around the room" when he heard the audition. Brighting recorded the entire original mod in one session, mostly first takes.
- **Wreden + Pugh worked remotely for 2 years.** Australia and UK. Dropbox files, 3hr/day Skype calls. Never met in person before launch. Wreden wrote script, Pugh built the game 10-16 hrs/day.
- **Ultra Deluxe script > entire original script.** New content alone was longer than the whole 2013 game.

### Core Principles (Applicable to TKA Museum)

1. **Constraint drives creativity.** The narrator exists because Wreden couldn't build elaborate levels. Our museum voice architecture exists because we're a solo developer building a walking sim. The voice carries the experience.

2. **Players construct meaning from proximity.** "All we have to do is give you enough content to work with and you'll do the work of connecting it all together for us." Put an Order plaque about "kinetic exposure symptoms" next to a Scribe note that says "Tuesday." The player builds the joke.

3. **No correct path.** All endings say something. The meaning is "something you personally had to construct" across all paths. Our sequential endings (Fear → Apathy → Heart) aren't choices — they're a linear tonal arc the player walks through.

4. **Never trust your first idea.** Pattern-recognize your instincts. An alien-shooting ending was cut because it was funny but tonally wrong.

5. **Did you have fun?** The only metric. Reject the "what is a game?" conversation. "Did it make you think? Did you enjoy yourself?"

6. **One voice, many registers.** Brighting plays: helpful guide, petty tyrant, philosopher, bureaucrat, comedian, antagonist. All one actor. The range IS the game.

### The Narrator as Instrument

| Ending | Register | Technique |
|--------|----------|-----------|
| Freedom | Genuine warmth, poetry | Sincerity without irony |
| Countdown | Bitter cruelty, taunting | Escalating hostility |
| Museum | Philosophical, existential | Breaking the fourth wall |
| Serious | Petty obsession (the tables!) | Bureaucratic absurdism |
| Broom Closet | Escalating insults | Reacting to player non-action |
| Confusion | Panicked incompetence | Narrator losing control |
| Zending | Vulnerability, pleading | Emotional exposure |
| Powerful | Deadpan devastation | Two sentences. Total. |
| Art | Corporate enthusiasm | 4 hours of pressing buttons |
| Skip Button | Reading real reviews | Meta-commentary eating itself |

---

## Mapping to The Kinetic Archive

### Two-Voice System = Narrator + Settings Person

Stanley Parable (2013): One voice (Narrator)
Ultra Deluxe (2022): Two voices (Narrator + Settings Person)

The Kinetic Archive: Two voices from the start:
- **Order Voice** = The institutional narrator. Clinical, reverential (cave), bureaucratic (later).
- **Scribe Annotator** = The Settings Person equivalent. Warm, corrective, amused.

### The Beat Skeleton Approach

Wreden's process: core structural beats first, then flesh out with voice work.
- Two doors = structural beat. Narrator's reaction = flesh.
- Control room = structural beat. Timer countdown = flesh.
- Museum ending's escape hall = structural beat. Philosophical monologue = flesh.

Our process should be identical:
- Each phase has 3-5 must-hit beats (what the player FEELS)
- Voice work is the flesh that makes each beat land
- Dialog writing is where the annotator character emerges naturally

---

*Created: 2026-03-01*
*Session: Stanley Parable Deep Dive — Beat Skeleton & Voice Architecture*
