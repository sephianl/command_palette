# Styling

The palette has two halves to style, and two ways to style them: your own classes (Tailwind, daisyUI, anything), or
the default stylesheet. Mixing is fine.

## Your own classes

**The shell** (overlay, panel, input, footer) is rendered by `CommandPalette.Components.command_palette/1`. Each part
takes a class attr: `class`, `backdrop_class`, `panel_class`, `search_class`, `crumb_class`, `input_class`,
`list_class`, `empty_class`, `hint_class`, `footer_class`, `key_class`. A given attr **replaces** that part's default
`cp-*` class.

**The rows** are drawn by the hook, so their classes are an option of `createCommandPalette({classes})`. The option is
**merged** over the defaults: give only the keys you want to change.

| Key                                         | On                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| `heading`                                   | a section heading                                                                   |
| `row`, `rowActive`, `rowInert`, `rowDanger` | the `<li>`, the highlighted one, the others while navigating, a `tone: :danger` row |
| `control`                                   | the link or button inside a row                                                     |
| `icon`, `label`, `mark`, `group`, `detail`  | the parts of a row; `mark` wraps the matched letters                                |
| `keys`, `key`                               | a shortcut's keycaps                                                                |
| `more`, `chevron`                           | the ⋯ of a row with actions, the › of a row with children                           |
| `spinner`                                   | the chosen row while its page loads                                                 |

Where these classes must be written, and which parts must not set `display`, is in
[Styling](../usage-rules.md#styling) in the usage rules. Text meant only for screen readers is hidden with an inline
style and needs no class.

## The default look

Import the stylesheet and leave the classes out:

```css
@import "../../deps/command_palette/priv/static/command_palette.css";
```

It styles the `cp-*` classes through custom properties (`--cp-surface`, `--cp-text`, `--cp-muted`, `--cp-border`,
`--cp-accent`, `--cp-active`, `--cp-danger`, `--cp-scrim`, `--cp-radius`, `--cp-width` …), light by default and dark
under `data-theme="dark"`, `.dark` or the system preference. Point them at your own tokens:

```css
:root {
  --cp-surface: var(--color-base-100);
  --cp-accent: var(--color-primary);
}
```

## Icons

An icon is a class name: `hero-*` from Phoenix's Heroicons plugin works as is, as does any class-based icon set. Like
the row classes, the names must appear somewhere Tailwind scans, which an `icon:` in your Elixir code does.
