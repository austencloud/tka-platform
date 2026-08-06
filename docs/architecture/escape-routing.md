# Escape routing

Escape closes or cancels one active layer at a time. It is a dismissal contract,
not a generic Back command.

## Ownership order

1. Browser fullscreen and a focused input or popup keep the first Escape press.
2. The most recently opened registered modal or drawer claims the key.
3. A visible page-level `data-escape-shortcut` target may claim it.
4. With no owner, the app leaves Escape untouched.

A layer with `closeOnEscape={false}` still claims the key. It blocks the page
behind it without closing. The shared shortcut only calls the owning
component's existing callback, so focus restoration and close animations stay
with that component.

## Surface contract

`BaseModal` and `Drawer` register automatically while open. Independent page
views can put `data-escape-shortcut` on their existing close, cancel, or back
button. Use `data-escape-shortcut-scope` around nested views when focus should
choose between multiple visible targets.

A focused widget that handles its own temporary state can use
`data-escape-shortcut-local`. Inputs, expanded controls, menus, listboxes,
trees, comboboxes, and non-modal dialogs already defer automatically.

The global registration prevents the default and stops propagation only when
an owner exists. This guarantees that one Escape press never closes two layers.
