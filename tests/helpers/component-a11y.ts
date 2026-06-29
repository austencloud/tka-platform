import axe from "axe-core";

const AAA_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag2aaa",
  "best-practice",
];

/**
 * Assert the rendered subtree has no axe accessibility violations (WCAG AAA).
 * `color-contrast` is disabled because isolated component tests lack the app's
 * theme variables; contrast is validated in-app / by the accessibility-auditor.
 * Pass `{ soft: true }` to log violations without failing (only while
 * remediating a known-dirty primitive).
 */
export async function expectNoA11yViolations(
  container: Element = document.body,
  opts: { soft?: boolean } = {}
): Promise<void> {
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: AAA_TAGS },
    rules: { "color-contrast": { enabled: false } },
  });
  if (results.violations.length === 0) return;

  const summary = results.violations
    .map(
      (v) =>
        `${v.id} (${v.impact ?? "n/a"}): ${v.nodes.length} node(s) — ${v.help}`
    )
    .join("\n");

  if (opts.soft) {
    console.warn(
      `[a11y soft] ${results.violations.length} violation(s):\n${summary}`
    );
    return;
  }
  throw new Error(
    `a11y violations (${results.violations.length}):\n${summary}`
  );
}
