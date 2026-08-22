# MCP Ground Truth — ENFORCED

TKA domain facts come from the Flow Arts Knowledge MCP server, never from
training data — the training data does not contain authoritative TKA data, and
hallucinated domain facts have cost hours of debugging. Any claim about
letters, VTG, positions, pictographs, terms, word feasibility, how a motion
looks or feels, or why an example teaches something requires an MCP call in the
current turn, or a direct quote of one made earlier in the same conversation.
Memory of prior conversations doesn't count. "Connective" lesson prose is not
exempt: if a sentence explains TKA, it is a domain claim.

| Claim type                                       | Tool                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| What a letter does (motion, grip, shift)         | `get_letter_explanation` / `get_alphabet_info`                             |
| Pictograph structure                             | `get_pictograph_data`                                                      |
| VTG pattern/shape/category meaning               | `get_vtg_pattern`, `get_vtg_shape`, `get_vtg_category`                     |
| Transition between letters or VTGs               | `get_vtg_transition` / `get_vtg_transition_between`                        |
| TKA term definition                              | `get_term_definition`                                                      |
| Deep topic (orientation algebra, base rotation…) | `get_domain_topic`                                                         |
| Which letters exist, by type/variation           | `list_available_letters`, `list_letter_variations`, `list_letters_by_type` |
| Word feasibility                                 | `analyze_word_feasibility`                                                 |
| Loop detection                                   | `detect_loop_pattern`                                                      |
| Shared behavior between letters                  | `compare_letters`                                                          |

Unsure which tool: `get_domain_topic` or `get_term_definition` — ~50-token
lookups. If the MCP server is unavailable: stop and tell Austen; don't
best-effort domain answers from memory.

## User-Facing TKA Copy Gate

Before editing educational or marketing copy that explains TKA:

1. Map every proposed explanatory sentence to evidence from a current-turn MCP
   result and, when the curriculum cites one, the canonical guide page.
2. Treat existing copy as untrusted. Its presence in the repository is not
   evidence that it is correct.
3. Flag any sentence about ease, feel, intuition, learning benefit, visual
   effect, or physical execution unless the evidence explicitly supports it.
   Do not invent these claims to make copy flow.
4. Show Austen the exact proposed explanation and wait for explicit approval
   before putting it in a component. Approval of the concept is not approval of
   a paraphrase; materially changed wording goes back through review.
5. Record Learn-lesson approvals in
   `docs/learn/copy-reviews/<concept-id>.md`, including the exact approved text,
   sources, approval date, and approval state.

Routine interface labels such as Back, Next, Retry, and question counts do not
need copy approval unless they contain a TKA claim.
