defmodule CommandPalette.LiveHook do
  @moduledoc """
  Answers the palette's searches for every LiveView of a `live_session`, so no LiveView handles them itself:

      live_session :default, on_mount: [MyAppWeb.UserAuth, {CommandPalette.LiveHook, MyAppWeb.PaletteSearch}] do

  List it after the hooks that assign what `c:CommandPalette.Search.context/1` reads.

  A query reaches `c:CommandPalette.Search.search/2` only when `searchable?/1` holds. The hook checks that here as well
  as in the browser, because the event comes from the browser and may say anything.

  It also answers the palette opening with the page's own rows: `c:CommandPalette.Search.page_entries/1`, or
  `CommandPalette.Page.entries/1` when the search leaves it out. They are built then rather than on every render: a
  render that carried them would rebuild and resend every row on each assign change the page makes.

  A newer query cancels the search of an older one rather than being throttled. A throttle drops a query that comes too
  soon, and the palette then never answers the latest text; the browser's debounce is what keeps the socket quiet.
  """

  import Phoenix.LiveView, only: [attach_hook: 4, cancel_async: 2, push_event: 3, put_private: 3, start_async: 3]

  alias CommandPalette.Page
  alias CommandPalette.Wire
  alias Phoenix.LiveView.Socket

  @min_length 3

  @spec on_mount(module(), map(), map(), Socket.t()) :: {:cont, Socket.t()}
  def on_mount(search, _params, _session, %Socket{} = socket) when is_atom(search) do
    socket =
      socket
      |> attach_hook(:command_palette_search, :handle_event, &handle_search(search, &1, &2, &3))
      |> attach_hook(:command_palette_reply, :handle_async, &handle_reply/3)

    {:cont, socket}
  end

  @doc """
  Whether a query is worth a search: at least #{@min_length} characters, or all digits, since a number such as a
  vehicle's is short and only ever matches exactly.
  """
  @spec searchable?(String.t()) :: boolean()
  def searchable?(query) when byte_size(query) >= @min_length, do: true
  def searchable?(query), do: String.match?(query, ~r/^\d+$/)

  defp handle_search(search, "palette_search", %{"q" => query, "seq" => seq}, socket) when is_binary(query) do
    query = String.trim(query)
    socket = cancel_async(socket, :command_palette_search)

    if searchable?(query) do
      context = search.context(socket)

      socket =
        socket
        |> put_private(:command_palette_seq, seq)
        |> start_async(:command_palette_search, fn -> {seq, search.search(query, context)} end)

      {:halt, socket}
    else
      {:halt, reply(socket, seq, [], nil)}
    end
  end

  defp handle_search(search, "palette_open", _params, socket),
    do: {:halt, %{entries: Wire.entries(page_entries(search, socket))}, socket}

  defp handle_search(_search, _event, _params, socket), do: {:cont, socket}

  defp page_entries(search, socket) do
    if Code.ensure_loaded?(search) and function_exported?(search, :page_entries, 1),
      do: search.page_entries(socket),
      else: Page.entries(Map.put(socket.assigns, :socket, socket))
  end

  defp handle_reply(:command_palette_search, {:ok, {seq, {entries, hint}}}, socket) do
    {:halt, reply(socket, seq, entries, hint)}
  end

  defp handle_reply(:command_palette_search, {:exit, {:shutdown, :cancel}}, socket), do: {:halt, socket}

  defp handle_reply(:command_palette_search, {:exit, _reason}, %Socket{private: %{command_palette_seq: seq}} = socket) do
    {:halt, reply(socket, seq, [], nil)}
  end

  defp handle_reply(_name, _result, socket), do: {:cont, socket}

  defp reply(socket, seq, entries, hint) do
    push_event(socket, "palette:results", %{seq: seq, entries: Wire.entries(entries), hint: hint})
  end
end
