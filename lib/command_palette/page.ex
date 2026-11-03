defmodule CommandPalette.Page do
  @moduledoc """
  What a LiveView offers in the palette while it is on screen: its own actions, which leave with it.

      @behaviour CommandPalette.Page

      @impl CommandPalette.Page
      def palette_entries(%{order: order}) do
        [%CommandPalette.Entry{label: "Cancel this order", section: :page, run: {:event, "cancel", %{}}}]
      end

  `CommandPalette.LiveHook` collects them with `entries/1` from the LiveView's assigns each time the palette opens, so
  a row is as fresh as the opening. Do not pass them to the component: a render that carries them rebuilds and resends
  every row on each assign change the page makes.
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
