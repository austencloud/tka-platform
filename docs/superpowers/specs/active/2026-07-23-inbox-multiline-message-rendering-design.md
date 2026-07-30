---
status: active
value: 3
effort: XS
remaining: "Commit 9dfe3bdb86 is present, and the shared bubble content path covers plain, group, edited, and attachment-caption text. Remaining: with explicit browser and messaging permission, verify those variants in a signed-in Inbox at narrow and wide widths, including escaped markup and compact previews."
depends_on: "external: signed-in Inbox verification requires explicit browser-control permission plus approval to send and edit test messages"
plan_path: ""
tags: ["inbox", "messaging", "css", "text-rendering"]
last_triaged: 2026-07-29
---

# Inbox Multiline Message Rendering: Design Spec

## Field report

Nick composed a message with paragraph breaks by using Shift+Enter. The saved
message appeared as one wall of text in the conversation.

The line breaks were not lost in transit. The observed Firestore message kept
the interior `\n\n` characters. This is a display defect.

## End-to-end trace

### Composer

`src/lib/shared/inbox/components/messages/MessageComposer.svelte` already
implements the intended keyboard contract:

- Enter without Shift sends or saves.
- Shift+Enter uses the textarea's native newline behavior.
- `sendMessage()` calls `messageText.trim()`.
- `saveEdit()` calls the same `trim()`.

`trim()` removes leading and trailing whitespace but preserves line breaks
inside the message. The composer then passes that string to
`messagingService.sendMessage()` or `messagingService.editMessage()`.

### Stored data

The field message retained its paragraph delimiters in Firestore. No storage
mapper or migration is needed.

### Bubble

`src/lib/shared/inbox/components/messages/MessageBubble.svelte` safely renders
the content through Svelte text interpolation:

```svelte
<p class="content">{message.content}</p>
```

The same `.content` class is used for:

- normal text messages;
- deleted-message text;
- image captions;
- sequence captions;
- feedback captions.

Its CSS includes wrapping for long words but no `white-space` rule. A paragraph
therefore uses the browser default `white-space: normal`, which collapses stored
newlines into ordinary spaces.

The app already renders the same data correctly in
`EditHistorySheet.svelte`:

```css
.version-content {
  white-space: pre-wrap;
  word-break: break-word;
}
```

## Design

Add one declaration to the existing scoped `.content` rule in
`MessageBubble.svelte`:

```css
.content {
  white-space: pre-wrap;
}
```

Keep the existing `word-break: break-word` and line height.

`pre-wrap` is the correct behavior for chat:

- newline characters create visible line breaks;
- a blank line made from two newline characters remains a paragraph gap;
- long lines still wrap to the bubble width;
- Svelte still escapes the content as text.

## Reuse decision

Reuse the exact `white-space: pre-wrap` rule from the Inbox edit-history
surface. No formatter, parser, message component, or dependency is needed.

Internal searches for `pre-wrap`, multiline chat output, and edit-history
rendering found the working Inbox rule and a matching TIKA conversation rule.
The browser's CSS text model already handles the desired output.

## Rejected approaches

Do not:

- replace newlines with `<br>` strings;
- use `{@html}`;
- add a Markdown parser;
- split the message into multiple paragraph components;
- normalize or rewrite stored messages;
- change Enter and Shift+Enter behavior;
- apply `pre-wrap` to compact reply previews or conversation-list excerpts.

String-to-HTML conversion would introduce an escaping boundary for a problem
CSS already solves. Reply previews and list excerpts are summaries, so they
should remain compact and use their existing truncation behavior.

## Acceptance criteria

- A single Shift+Enter displays as one visible line break.
- Two consecutive newline characters display as a blank line between
  paragraphs.
- New messages and edited messages render identically.
- Own, other-participant, and group bubbles use the same multiline behavior.
- Text attached to an image, sequence, or feedback card preserves line breaks.
- Long unbroken text still wraps within the bubble.
- Message text remains escaped. Markup typed by a user is shown as text.
- Existing reply previews and conversation-list previews remain compact.

## Verification

### Revalidation, 2026-07-29

- Commit `9dfe3bdb86` added `white-space: pre-wrap` to the existing
  `MessageBubble.svelte` content rule.
- The shared `bubbleContent` snippet applies that rule to plain messages,
  deleted text, group messages, and image, sequence, or feedback captions.
- Reply and conversation-list previews retain their separate `nowrap` rules.
- No Inbox tab was open in the connected signed-in Chrome session. Navigation,
  sending, and editing were not attempted without the required permission.
- The project check completed with 0 errors and 5 existing warnings.

This is visible CSS behavior. A unit test that searches the component source for
`pre-wrap` would duplicate the implementation without protecting any hidden
logic, so no new automated test is required.

After the edit:

1. run the project's Svelte and TypeScript check;
2. send `Line one`, Shift+Enter, `Line two`;
3. send two short paragraphs separated by a blank line;
4. edit the message and add another paragraph;
5. repeat with an attachment caption;
6. inspect own, received, and group-message layouts at narrow and wide widths;
7. type HTML-like text and confirm it is displayed literally.

The stored Firestore value should still contain the original newline
characters. The implementation must not introduce a data rewrite.

## Expected file change

- Edit
  `src/lib/shared/inbox/components/messages/MessageBubble.svelte`.

No new file, test fixture, storage migration, message schema change, or
dependency.

## Standards research

- [MDN: `white-space`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/white-space)
  defines `pre-wrap` as preserving source newlines and whitespace while still
  wrapping lines to fit.
- [W3C CSS Text Module Level 3](https://www.w3.org/TR/css-text-3/#white-space-property)
  defines how segment breaks and preserved whitespace participate in line
  wrapping.
