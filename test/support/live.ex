defmodule CommandPalette.Test.Live do
  @moduledoc false
  @behaviour CommandPalette.Page

  use Phoenix.LiveView

  alias CommandPalette.Components
  alias CommandPalette.Entry
  alias CommandPalette.Section

  on_mount({CommandPalette.LiveHook, CommandPalette.Test.Search})

  @impl Phoenix.LiveView
  def mount(_params, %{"test_pid" => test_pid}, socket) do
    {:ok, socket |> assign(:test_pid, test_pid) |> assign(:count, 0)}
  end

  @impl Phoenix.LiveView
  def render(assigns) do
    ~H"""
    <div>page</div>
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

  @impl Phoenix.LiveView
  def handle_event("own_event", _params, socket) do
    send(socket.assigns.test_pid, :own_event)
    {:noreply, socket}
  end

  def handle_event("bump", _params, socket), do: {:noreply, update(socket, :count, &(&1 + 1))}

  @impl CommandPalette.Page
  def palette_entries(%{count: count}), do: [reoptimize(count)]
  def palette_entries(_assigns), do: [reoptimize(0)]

  defp reoptimize(count) do
    %Entry{label: "Reoptimize", section: :page, detail: to_string(count), run: {:event, "own_event", %{}}}
  end
end
