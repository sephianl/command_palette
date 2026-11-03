defmodule CommandPalette.Search do
  @moduledoc """
  Where an app plugs its domain into the palette: what a typed query finds on the server.

  It is two callbacks because the search runs off the LiveView process, so a slow lookup never blocks the page and a
  newer query can cancel an older one. `context/1` runs in the LiveView and picks out what the search needs -- the
  actor, the date the page is on, whether results should patch or redirect. `search/2` gets only that, never the
  socket.

  The hint is a line the palette shows under the results, and it survives an empty list: "No routes within 8 weeks of
  10 March" is the whole answer when nothing came back.
  """

  alias CommandPalette.Entry
  alias Phoenix.LiveView.Socket

  @callback context(Socket.t()) :: term()
  @callback search(query :: String.t(), context :: term()) :: {[Entry.t()], hint :: String.t() | nil}

  @doc """
  The rows the page on screen offers, sent when the palette opens. Leave it out to offer `CommandPalette.Page.entries/1`
  alone; implement it when the app adds rows of its own around them. It runs in the LiveView.
  """
  @callback page_entries(Socket.t()) :: [Entry.t()]

  @optional_callbacks page_entries: 1
end
