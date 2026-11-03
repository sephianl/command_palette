defmodule CommandPalette.Test.PagedSearch do
  @moduledoc false
  @behaviour CommandPalette.Search

  alias CommandPalette.Entry

  @impl CommandPalette.Search
  def context(_socket), do: nil

  @impl CommandPalette.Search
  def search(_query, _context), do: {[], nil}

  @impl CommandPalette.Search
  def page_entries(socket) do
    [%Entry{label: "Switch depot", section: :page, detail: socket.assigns.depot, run: {:event, "switch", %{}}}]
  end
end

defmodule CommandPalette.Test.PagedLive do
  @moduledoc false
  use Phoenix.LiveView

  alias CommandPalette.Components
  alias CommandPalette.Section

  on_mount({CommandPalette.LiveHook, CommandPalette.Test.PagedSearch})

  @impl Phoenix.LiveView
  def mount(_params, _session, socket), do: {:ok, assign(socket, :depot, "Gent")}

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <Components.command_palette
      entries={[]}
      sections={[%Section{key: :page, label: "This page"}]}
      placeholder="Search"
      label="Search"
      empty="Nothing"
      opening="Opening"
      run_hint="Open"
      actions_hint="Actions"
      close_hint="Close"
      back_hint="Back"
    />
    """
  end
end
