defmodule CommandPalette.Page do
  @moduledoc """
  What a LiveView offers in the palette while it is on screen: its own actions, which leave with it.

      @behaviour CommandPalette.Page

      @impl CommandPalette.Page
      def palette_entries(%{order: order}) do
        [%CommandPalette.Entry{label: "Cancel this order", section: :page, run: {:event, "cancel", %{}}}]
      end

  Collect them with `entries/1` in the LiveView's own render, from its `assigns`, and hand them to the layout:

      <Layouts.app flash={@flash} page_entries={CommandPalette.Page.entries(assigns)}>

  Only the LiveView's `assigns` carry what `palette_entries/1` reads: a Phoenix 1.8 layout is a function component
  that sees just the assigns it is given, and the `@socket` a template sees holds none of the page's. Reading `assigns`
  directly also makes LiveView re-evaluate the call on every render, so a row never outlives the state it came from.
  """

  alias CommandPalette.Entry
  alias Phoenix.LiveView.Socket

  @callback palette_entries(assigns :: map()) :: [Entry.t()]

  @doc """
  The entries the LiveView rendering `assigns` offers, or `[]` when it offers none or there is no LiveView at all, as
  on a controller-rendered page that shares the layout.
  """
  @spec entries(map()) :: [Entry.t()]
  def entries(%{socket: %Socket{view: view}} = assigns) when is_atom(view) and not is_nil(view) do
    if offers_entries?(view), do: view.palette_entries(assigns), else: []
  end

  def entries(_assigns), do: []

  defp offers_entries?(view), do: Code.ensure_loaded?(view) and function_exported?(view, :palette_entries, 1)
end
