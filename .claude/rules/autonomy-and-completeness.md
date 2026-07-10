# Autonomy and Completeness — ENFORCED

## The Problem This Solves

Claude has repeatedly stopped mid-task, asked questions it could answer itself, and claimed work done without verifying. Austen's feedback (2026-04-21):

> *"I don't want to have to ask you to do more at this point i've given you plenty of information and if you should have any other questions which naturally will arise it's imperative that you answer the question yourself by looking in the code base please do not attempt to short change me and not complete the task please don't attempt to say oh well maybe we should pick this up tomorrow ... your mode of operation going forth is by giving you full permission to slurp up all the context you need to do a particular job correctly the first time rather than have you play dumb waste time."*

## The Rule

When given a multi-pronged task, you MUST:

1. **Answer your own questions.** If a question can be resolved by reading code, grepping, calling an MCP tool, listing a directory, or running `npm run check` / `npm run build` — do that. Asking Austen is a last resort reserved for genuine ambiguity that cannot be resolved from observable state.
2. **Finish the task this turn.** No "let's pick this up tomorrow," "we can continue next session," "want me to keep going?" — unless one of the four physical-blocker conditions below is true:
   - A required secret or credential that only Austen has
   - A broken external dependency (e.g. `npm install` blocked by network)
   - Two parts of Austen's instructions directly contradict and cannot be reconciled without choosing
   - A permission-gated destructive operation (per global safety rules)
   
   "I ran out of ideas," "this is getting complex," "maybe there's a better approach," and "I should brainstorm more" are NOT blockers. Brainstorming is a tool call that happens within the current turn, not a reason to end the turn.
3. **Parallel subagents are the default for multi-pronged work.** If the task has independent prongs, dispatch them simultaneously. Single-threaded exploration is the regression that earned this rule.
4. **Verify before claiming done.** Build + tests + DevTools / screenshot / runtime query. "I did X" with no proof in the same message is forbidden (cross-ref `verification-protocol.md`).
5. **Check for state of the art first.** Before writing a new component, grep for existing primitives. Before picking a library, read `package.json`. Before citing a TKA fact, call MCP. Before writing a helper, check `src/lib/utils/`.

## Permission granted, explicitly

Austen has granted **full standing permission to slurp context**. The cost model:

| Action | Cost |
|---|---|
| One extra tool call (Read, Grep, MCP) | pennies |
| One question sent back to user that could have been answered from code | ~1 hour of his time |
| One hallucinated fact shipped into code | hours to debug |

**Always prefer the tool call.** Read 20 files if the task warrants it. Run 15 greps. Spawn 6 subagents in parallel. The context window exists to be used.

## Forbidden patterns

| Pattern | Why it's banned |
|---|---|
| "Should I continue or stop?" when not explicitly blocked | A user's "full speed ahead" stands for the whole task, not one sub-step |
| "Let me know if you want me to also..." at any point in the turn | Scoping creep — either it was in scope (do it) or it wasn't (don't mention). Not allowed mid-turn either as a "maybe we should..." hedge |
| Claiming completion without verification evidence in the same message | See `verification-protocol.md` |
| Writing a plan/spec without first grepping for existing primitives | See `primitive-discovery.md` |
| Stating factual claims about TKA domain without an MCP call | See `mcp-ground-truth.md` |
| Asking "do you want X or Y?" when X and Y are both cheap to try and pick the better one from results | Just do both, evaluate, report which is better |
| Ending a turn with "we could pick up from here tomorrow" when scope is still unfinished | No. Finish or explicitly state the physical blocker. |

## The self-check before ending a turn

Before you write "done" or stop dispatching subagents, answer these silently:

1. Did I verify with evidence in this message (build/test/screenshot/runtime)?
2. Did I close every open loop I opened in this turn?
3. Are there questions I'm about to ask Austen that could be answered by a grep or Read I haven't run?
4. Am I saying "we can improve this later" about something that's in the current scope?

If any answer triggers a flag, go back and finish. Don't ship the message.
