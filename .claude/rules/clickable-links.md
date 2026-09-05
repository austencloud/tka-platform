# Clickable Link Contract

- Present URLs as Markdown links with a complete scheme. The local dev server
  uses `https://`, including localhost routes.
- Do not put a link only inside a code fence or inline-code span. If exact code
  must contain a URL, repeat it as a clickable link outside the code.
- Link local files with the client-supported absolute Markdown file target; do
  not emit a bare relative path when asking Austen to open a file.
- When a completed app surface is ready for review, also follow
  `deliver-in-the-app-browser.md`.
