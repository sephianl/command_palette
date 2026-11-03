# CommandPalette usage rules

A command palette (Ctrl+K) for Phoenix LiveView. An Elixir side (`CommandPalette.Entry`, `Section`, `Components`,
`Page`, `Search`, `LiveHook`) and a JS hook (`createCommandPalette`) shipped in the same dependency. These are the
rules that keep an integration correct, and the only place they are written down: `guides/getting-started.md` is a
worked integration that follows them, and `guides/behaviour.md` is what the people using the app see.

## Installing

- **Depend on it from GitHub, pinned to a tag**: `{:command_palette, github: "sephianl/command_palette", tag: "vX.Y.Z"}`.
  It is not on Hex.
- **Import the hook as `"command_palette"`**; it resolves through esbuild's `NODE_PATH` containing `deps/`, which
  Phoenix's default profile sets. Register it under the key `CommandPalette`, the `phx-hook` the component renders:
  `hooks: { CommandPalette: createCommandPalette({...}) }`.
- **`open:` replaces the default shortcuts** (Ctrl+K, ⌘K, Ctrl+Space); it does not add to them.

## Rendering

- **Render `CommandPalette.Components.command_palette/1` once, inside the layout a LiveView renders**, never in
  `root.html.heex`: the root layout is outside the LiveView, so the hook never mounts there.
- **Never render a page's own rows.** `CommandPalette.LiveHook` sends them when the palette opens, from
  `CommandPalette.Page.entries/1` or the search's `page_entries/1`. Passing them to the component makes every assign
  change the page makes rebuild and resend all of them, which on a page with large filters or frequent PubSub
  updates costs more than the page itself. Pass the component only rows that do not depend on the page: pages,
  commands, and every row with a `shortcut`, since shortcuts run while the palette is closed.
- **Every string is an attr** (`placeholder`, `label`, `empty`, `opening`, `run_hint`, `actions_hint`, `close_hint`,
  `back_hint`, optional `shortcuts_label`): the package has no gettext backend, so pass them translated.
- **Pass `user_id`** so recency is kept apart per person in a shared browser.
- **One palette per page**: the hook finds its parts by the component's `id`.

## Rows

- **Every row is a `%CommandPalette.Entry{}` with a `label` and a `section`.** Pages, page actions, commands and search
  hits differ only in `run` and `section`. A row needs a `run` unless it has `children`.
- **`run` is one of** `{:redirect, path}`, `{:patch, path}`, `{:event, name, params}` (pushed to the LiveView on screen),
  `{:dispatch, name, detail}` (a `CustomEvent` on `window`, `detail` in `event.detail`) or `{:copy, text}`.
- **An `{:event, ...}` row must be answered by the LiveView on screen.** For an event every page should answer, attach
  a `:handle_event` hook in an `on_mount` listed in every `live_session` that renders the palette; a LiveView without
  a matching clause crashes, as it would for a button.
- **Listen for a `{:dispatch, ...}` under an event name of your own**, never `phx:set-theme`: Phoenix 1.8's listener
  for that reads a `data-phx-theme` attribute, not `detail`. Its `setTheme` lives in `root.html.heex`'s inline script,
  so a theme listener goes there.
- **`palette_entries/1` needs a catch-all clause**: it runs on every render, before `mount` has assigned everything.
- **Prefer `actions` to a second row for the same thing**, and put the row's own destination first among them, so →
  lists every place the row leads to. "Open on map" and "Open in list" are one row with an action, not two rows.
- **`children` make a row a list** that Enter opens, when the row has no `run` of its own. Use them for a choice
  (themes, teams); use `actions` for more things to do with the row.
- **Give the label in other languages as `aliases`, not `keywords`.** Keywords and the `group` score at 0.6 of the
  label, so a page found by its name in another language would lose to a search hit that merely contains the word.
- **Use `mru_key` when the path holds a date or another volatile segment**, or recency forgets the row every day.
- **A `shortcut` runs only while the palette is closed** and focus is not in a text field. Give `shortcuts_label` to
  the component so `?` lists them; keep shortcuts unique.
- **`tone: :danger`** for a row that destroys something.

## Sections

- **Order sections in the list you pass to the component**; that list is the display order, and typing never changes
  it. A row whose `section` is not in it goes last, without a heading.
- **A section without a `label` draws no heading**, and a row without an `icon` takes its section's.
- **Add a `:fallback` section with an icon and no label** whenever any row is a `fallback: true`: fallback rows are
  always drawn there, whatever `section` they name.

## Server search

- **Implement `CommandPalette.Search`** and mount it with `{CommandPalette.LiveHook, MySearch}` in the `live_session`,
  after the hooks that assign what `context/1` reads.
- **Put what reads the socket in `context/1`, the lookup in `search/2`.** `search/2` runs in a task off the LiveView
  and never gets the socket; a newer query cancels an older one; a search that raises answers with nothing.
- **Return `{rows, hint}`**; the hint is a line under the list, shown even when nothing came back, or `nil`.
- **Leave exact hits unmarked and mark partial ones `ranked: true`.** An exact hit (a code) leads its section and takes
  the highlight; a ranked hit (part of a name) is scored against the query with the local rows, at 0.9 of their
  weight, so a better local match keeps the highlight.
- **Mark a row `fallback: true`** for what to offer when nothing matched, such as searching a list for the text. It
  shows only when no other row matched, local or remote, whether the search returned it or the component was given it.
- **A query reaches `search/2` at three characters, or when it is all digits.**

## Styling

- **Write row classes in the app's JS (`createCommandPalette({classes})`) and shell classes as component attrs**, never
  only in this package: Tailwind never scans `deps/`. Row classes merge over the defaults; a shell class attr replaces
  its part's default.
- **Never give the root, the crumb, the empty message or the hint a class that sets `display`**: they are hidden with
  the `hidden` attribute.
- **Or import `deps/command_palette/priv/static/command_palette.css`** with the other `@import` lines at the top of
  `app.css`, and theme it through the `--cp-*` custom properties.

## Testing

- **A page's rows are JSON in `#command-palette`'s `data-entries`**: assert on them with `LazyHTML` after `live/2`.
- **Drive the search with** `render_hook(view, "palette_search", %{"q" => query, "seq" => 1})` and
  `assert_push_event(view, "palette:results", %{seq: 1, entries: entries})`.
- **`search/2` is a plain function**: call it with what `context/1` returns and assert on the rows.
