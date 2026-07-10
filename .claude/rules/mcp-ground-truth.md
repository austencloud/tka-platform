# MCP Ground Truth — ENFORCED

## The Problem This Solves

Claude hallucinates TKA domain facts (letter behaviors, VTG patterns, position definitions, pictograph details) from its training data instead of calling the Flow Arts Knowledge MCP server that contains the actual authoritative data. Austen's feedback: *"it's like it's making up shit. I've received so many more hallucinations in the last day than in the last two months combined."*

## The Rule

For ANY claim about TKA domain data, you MUST call an MCP tool first. Do not generate from memory.

### Claims that REQUIRE an MCP call before you state them

| Claim type | Required tool |
|---|---|
| What a letter does (motion, grip, shift) | `get_letter_explanation` or `get_alphabet_info` |
| How a pictograph is structured | `get_pictograph_data` |
| What a VTG pattern/shape/category means | `get_vtg_pattern`, `get_vtg_shape`, `get_vtg_category` |
| Transition between two letters or VTGs | `get_vtg_transition` or `get_vtg_transition_between` |
| Definition of a TKA term | `get_term_definition` |
| Deep domain topic (orientation algebra, base rotation, etc.) | `get_domain_topic` |
| What letters exist, by type or variation | `list_available_letters`, `list_letter_variations`, `list_letters_by_type` |
| Feasibility of a word | `analyze_word_feasibility` |
| Whether a sequence loops | `detect_loop_pattern` |
| Whether two letters share behavior | `compare_letters` |

### Forbidden without an MCP call

- "Letter X does Y" (even if you're confident)
- "Sigma-dash is a Type 3..." (call `get_letter_explanation` first)
- "At position beta, the hands..." (call `get_position_info` or `get_pictograph_data`)
- Any factual statement about the alphabet, VTG system, positions, or pictographs

### When you don't know which tool

Call `get_domain_topic` with a relevant topic keyword, or `get_term_definition` with the term. These are cheap lookups (~50 tokens). Hallucinating a wrong fact costs Austen an hour of debugging.

## What counts as grounded

- You called an MCP tool in the current turn and are quoting its output
- You're pasting a direct quote from a previous MCP tool call in the same conversation
- You're saying "I don't know — let me check" and then calling the tool

Memory of prior conversations doesn't count. The training data does not contain authoritative TKA data.

## Fallback

If the MCP server is unavailable: STOP and tell Austen. Do not guess. Do not "best effort." Say: *"Flow Arts Knowledge MCP is unavailable. I can't answer TKA domain questions without it. Please restart Claude Code or confirm the server is running."*
