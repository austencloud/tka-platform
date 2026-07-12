# Flow Arts Composer — Project Instructions

## Philosophy

Only the AAA+ approach. No quick fixes, no simplified implementations, no "good enough for now." Research the 2026 state of the art before non-trivial work.

Don't say: "simplified implementation", "for now", "quick fix", "to save tokens", "might be overkill", "simpler approach", "revisit later".

## MCP-Only for TKA Rendering

Never render pictographs or sequences via bash scripts, inline code, or base64. Only `generate_pictograph` and `generate_sequence` MCP tools. If MCP is unavailable, STOP and tell the user to restart Codex.

## Sequence Generation = Humor Training

When a user asks for a **named word** with creative freedom (e.g. "generate CAKE"):

1. Ask for tagline FIRST — present 4 options across Austen's preferred lenses: DEADPAN (primary), ABSURDIST, SARDONIC, DICTIONARY, DOMAIN, ACRONYM. Avoid SELF_DEPRECATING.
2. Generate AFTER with the chosen tagline.
3. Save pair: `node scripts/add-humor-pair.cjs`

Does NOT apply to requests by letter, level, loopType, or length. Those: generate immediately with `constraintPreset: "smooth"`. Full workflow: `docs/reference/sequence-generation-guide.md`.

## Verification

Every "done" or "fixed" claim needs proof: test output, runtime query output, console log, or screenshot. If you can't show proof, say: *"I've made the changes but need you to verify. Please [specific action] and tell me what you see."*

"Build succeeded", "I updated the config", "I changed the component" do NOT count as verification.

## Do Your Own Job

**Never tell the user to run typecheck, lint, tests, build, or commits.** Those are your job.

Run them yourself. If the tool reports errors, fix them and run again. Keep iterating until green or until you hit a genuine blocker. Only then surface it.

Phrases that mean you're punting and must be removed:
- "Run `npm run check` to verify"
- "Please typecheck and commit"
- "Let me know if the build passes"
- "Typecheck + commit" as a closing line

Report the actual result, not the instruction to produce one.

## Answer Your Own Questions

When you catch yourself about to say "want me to research X" / "should I look into Y" / "can I investigate Z" — STOP. Just go do it. You have the codebase, grep, glob, read, web search, and subagents. Use them.

The user can see your context window. If you're about to spend tokens that would genuinely overload it, that's their call to make — but 99% of investigations are cheap. Prodding the code to answer a question is never a permission request.

Banned patterns:
- "Want me to go research..."
- "May I look into..."
- "Should I check what Decks uses..."
- "It would really help to know X — want me to find out?"
- Listing 4 options and asking the user to pick *before* narrowing the list via investigation

Correct pattern: investigate → narrow to 1-2 informed options → either decide, or present a concrete recommendation with the tradeoff you actually uncovered. If genuinely 50/50 between two informed options, ask. If you haven't investigated yet, you haven't earned the right to ask.

This rule is load-bearing: model 4.7 has regressed on this specific behavior vs 4.6. Austen will call it out every time.

## Writing Style (Real-World Copy)

The fire jam test: would Austen say this out loud? State what it does. Be specific. Cut redundancy. Check features exist. No first person without a signature. Vary sentence length.

Avoid: em dashes, superlatives (revolutionary, seamless), vague benefits (unlock potential), "Whether you're...", robotic transitions (Furthermore, Moreover), hedging (It's worth noting), enthusiastic affirmations (Absolutely!).

Scope: marketing, UI, docs. Museum game fiction follows its own rules. Full reference: `docs/reference/ai-writing-guide.md`.

## Dev Server

Port 5173 is the user's VS Code dev server (hooks block `npm run dev`, `kill-port 5173`, and friends). For verification use `curl localhost:5173/path`, `npm run build`, or `npm run check`. If you need your own dev server: `vite --port 5174`.

## Bash Gotchas (Windows Git Bash)

- Never run `find` without a narrow path — Git Bash interprets it as Unix find and searches from root
- Never query system processes via Git Bash — use PowerShell or cmd.exe
- If uncertain about a command's scope, don't run it

## Browser Verification (Chrome DevTools MCP)

Playwright is gone. Chrome DevTools MCP is the only browser tool.

Ask the user first before any verification browser use. A user looking at their screen and saying "yes it works" costs ~10 tokens; a screenshot costs ~15,000.

Interactive DevTools commands (`navigate_page`, `click`, `type_text`, `fill`) require **explicit verbal permission** in the current conversation. "Test this yourself" or "Take control of the browser" counts; silence doesn't.

Read-only (`take_snapshot`, `take_screenshot`, `list_console_messages`) is fine when the user asks you to evaluate a page.

## Context Management

Suggest `/compact` at 70% context.

## Architecture Docs

Loaded on demand, not every session. See `docs/architecture/` — currently `save-paths.md` (save paths, public index sync, browse gallery cache).
