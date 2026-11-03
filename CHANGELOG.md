# Changelog

## 0.2.0 (2026-11-03)

### Changed

- **A page's own rows arrive when the palette opens.** The hook pushes `palette_open` and `CommandPalette.LiveHook`
  replies with `CommandPalette.Page.entries/1`, or with the search's new optional `page_entries/1` for an app that adds
  rows of its own around them. Rendered with the page, they were rebuilt and resent on every assign change, which on a
  page with large filters and frequent PubSub updates cost more than the page itself.

### Upgrading

- Stop passing `CommandPalette.Page.entries(assigns)` (or rows built from the page's assigns) to the component: give it
  only rows that do not depend on the page, and every row with a `shortcut`. Move app-specific page rows into
  `c:CommandPalette.Search.page_entries/1`.

## 0.1.0 (2026-10-16)

The first release: the palette Sephia's apps each kept their own copy of, extracted into one package.

### Added

- **One row type for everything.** `CommandPalette.Entry` covers pages, a page's own actions, app-wide commands and
  search hits alike; they differ only in `run` (redirect, patch, LiveView event, window event, copy) and `section`.
- **Sections in the app's order.** The component takes an ordered list of `CommandPalette.Section`s; what is typed never
  moves a section, it only orders the rows inside one. A row without an icon takes its section's.
- **Fuzzy search by words**, each word matched on its own, with the label in the app's other languages (`aliases`)
  scored as the label and recency per person.
- **Server search off the LiveView process.** `CommandPalette.Search` is mounted with `CommandPalette.LiveHook`; a
  newer query cancels an older one, a crashed search answers with nothing, and a hint line can say what the search
  left out. Exact hits lead their section and take the highlight; `ranked: true` hits compete with local rows.
- **Row actions and sub-lists.** → (or a row's ⋯) opens its `actions`, Enter opens a row's `children`; ←, Backspace or
  Escape go back. From the top level a query also finds rows inside lists and actions, under the path to them.
- **Shortcuts on rows** (`"g i"`, `"mod+shift+p"`), shown as keycaps and run while the palette is closed. `?` lists
  them all when the component is given a `shortcuts_label`.
- **Stays open with a spinner** until the page a row leads to has arrived, and blocks a second Enter meanwhile.
- **A footer** with the keys that work right now: ↵, → when the row has actions, Esc to close or go back, ? for the
  shortcuts.
- **Styled by the app.** Every class the hook draws comes from `createCommandPalette({classes})`, every shell part
  takes a class attr; without them, `priv/static/command_palette.css` styles the `cp-*` classes through `--cp-*`
  custom properties, light and dark.
- **Docs**: `usage-rules.md`, the rules for an integration, and four guides (getting started, behaviour, styling,
  wire format).
