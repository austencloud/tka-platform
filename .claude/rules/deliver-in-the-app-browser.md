---
paths:
  - "src/**/*"
---

# In-App Browser Delivery Contract

Apply this only when completed work has a real page or route for Austen to
review and the desktop app exposes an in-app browser.

- Integrate the verified task branch before delivery, then open the real
  `https://localhost:5173/<route>` surface in the in-app browser. A worktree
  server, test harness, screenshot, or diagnostic page is verification evidence,
  not the final destination.
- In Codex, use `open_in_codex` with a browser target. In another client, use its
  available in-app preview operation. Do not rely on obsolete tool names from
  historical plans.
- Confirm that the destination is rendering. If authentication, permissions, or
  a collapsed pane prevents rendering, open the closest real surface and state
  the limitation plainly.
- Include a clickable HTTPS link in the final message so the route remains
  recoverable after the browser card expires.
- Terminal-only sessions with no browser-pane capability provide the clickable
  link without pretending the pane was opened.

Do not open an in-app browser for documentation-only work, invisible backend
changes, or artifacts better delivered as files. Do not use delivery as a reason
to act in Austen's personal browser session or mutate external data.
