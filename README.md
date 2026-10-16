# CommandPalette

A command palette (Ctrl+K) for Phoenix LiveView, extracted from the palettes in Sephia's own apps so a change lands
once and ships to all of them.

- **Rows in sections the app orders**, say pages, orders, customers. Typing never moves a section, it only orders the
  rows inside one.
- **Fuzzy search by words**, with the label in other languages scored as the label, and recency per person.
- **Server search off the LiveView process.** A newer query cancels an older one, and a hint line can say what the
  search left out.
- **Row actions and sub-lists.** → opens a row's own actions and Enter opens a row with children; ← or Backspace goes
  back.
- **Shortcuts on rows** (`"g r"`, `"mod+shift+p"`), shown as keycaps.
- **Stays open with a spinner** until the page a row leads to has arrived.
- **Styled by the app.** Every class the hook draws comes from the app's own JS, or from the default stylesheet.

## Install

It is not on Hex. Depend on it from GitHub, pinned to a tag:

```elixir
{:command_palette, github: "sephianl/command_palette", tag: "v0.1.0"}
```

The JavaScript comes with it: `import { createCommandPalette } from "command_palette"` resolves through the
`NODE_PATH=deps` that Phoenix's esbuild profile already sets.

To test a local checkout instead, point the dependency at it, e.g. with an environment variable:

```elixir
defp command_palette do
  case System.get_env("COMMAND_PALETTE_PATH") do
    nil -> {:command_palette, github: "sephianl/command_palette", tag: "v0.1.0"}
    path -> {:command_palette, path: path}
  end
end
```

A path dependency is not copied into `deps/`, so add its parent directory to esbuild's `NODE_PATH` while the variable
is set. `guides/getting-started.md` walks through the rest: the hook, the component and the search.

## Develop

```sh
direnv allow          # devenv: Elixir and Node
mix deps.get && npm install
mix test && npm run check
npm run build         # after every change to assets/src: the bundle is committed
mix check             # the full gate, as CI runs it
```

## Docs

`mix docs` builds them locally. Start with [Getting started](guides/getting-started.md), a worked integration, and
keep [Usage rules](usage-rules.md) at hand: they are the rules it follows, and what an agent working in your app
should read. [What a person sees](guides/behaviour.md) is the palette from the side of the people using your app.
