defmodule CommandPalette do
  @moduledoc """
  A command palette (Ctrl+K) for Phoenix LiveView.

  An app describes its rows as `CommandPalette.Entry` structs, groups them into `CommandPalette.Section`s, renders
  `CommandPalette.Components.command_palette/1` once in its layout and answers searches with a
  `CommandPalette.Search` module mounted through `CommandPalette.LiveHook`. Everything that is about the app's domain
  stays in the app; this package is the palette itself.
  """
end
