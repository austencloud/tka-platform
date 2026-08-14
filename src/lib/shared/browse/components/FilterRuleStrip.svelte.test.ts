import { render } from "vitest-browser-svelte";
import { describe, expect, it } from "vitest";
import FilterRuleStrip from "./FilterRuleStrip.svelte";

describe("FilterRuleStrip read-only presentation", () => {
  it("keeps the saved labels, connective, colors, and search without edit controls", () => {
    render(FilterRuleStrip, {
      filters: [
        {
          key: "cap_type:component:rotated_halved",
          type: "cap_type",
          label: "Rotated (halved)",
          chipColor: "#36c3ff",
        },
        {
          key: "cap_type:component:rotated_quartered",
          type: "cap_type",
          label: "Rotated (quartered)",
          chipColor: "#36c3ff",
        },
        {
          key: "length",
          type: "length",
          label: "4 steps",
          chipColor: "#f59e0b",
        },
      ],
      connectives: { cap_type: "all" },
      searchQuery: "fire drums",
      interactive: false,
    });

    const strip = document.querySelector('[aria-label="Current rule"]');
    expect(strip).toHaveTextContent(
      "LOOPs: Rotated (halved) and Rotated (quartered) · Length: 4 steps · Search: fire drums"
    );
    expect(strip?.querySelectorAll("button")).toHaveLength(0);
    expect(strip?.querySelectorAll(".filter-chip.active")).toHaveLength(4);
  });
});
