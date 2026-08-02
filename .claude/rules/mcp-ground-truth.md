# MCP Ground Truth — ENFORCED

TKA domain facts come from the Flow Arts Knowledge MCP server, never from
training data — the training data does not contain authoritative TKA data, and
hallucinated domain facts have cost hours of debugging. Any claim about
letters, VTG, positions, pictographs, terms, or word feasibility requires an
MCP call in the current turn, or a direct quote of one made earlier in the
same conversation. Memory of prior conversations doesn't count.

| Claim type | Tool |
|---|---|
| What a letter does (motion, grip, shift) | `get_letter_explanation` / `get_alphabet_info` |
| Pictograph structure | `get_pictograph_data` |
| VTG pattern/shape/category meaning | `get_vtg_pattern`, `get_vtg_shape`, `get_vtg_category` |
| Transition between letters or VTGs | `get_vtg_transition` / `get_vtg_transition_between` |
| TKA term definition | `get_term_definition` |
| Deep topic (orientation algebra, base rotation…) | `get_domain_topic` |
| Which letters exist, by type/variation | `list_available_letters`, `list_letter_variations`, `list_letters_by_type` |
| Word feasibility | `analyze_word_feasibility` |
| Loop detection | `detect_loop_pattern` |
| Shared behavior between letters | `compare_letters` |

Unsure which tool: `get_domain_topic` or `get_term_definition` — ~50-token
lookups. If the MCP server is unavailable: stop and tell Austen; don't
best-effort domain answers from memory.
