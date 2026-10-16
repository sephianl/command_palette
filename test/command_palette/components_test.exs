defmodule CommandPalette.ComponentsTest do
  use ExUnit.Case, async: true

  import Phoenix.Component, only: [sigil_H: 2]
  import Phoenix.LiveViewTest, only: [rendered_to_string: 1]

  alias CommandPalette.Components
  alias CommandPalette.Entry
  alias CommandPalette.Section

  @strings %{
    placeholder: "Search…",
    label: "Search pages",
    empty: "Nothing matches",
    opening: "Opening…",
    run_hint: "Run",
    actions_hint: "Actions",
    close_hint: "Close",
    back_hint: "Back"
  }

  defp render(assigns) do
    assigns =
      Map.merge(
        %{
          entries: [%Entry{label: "Routes", section: :pages, run: {:redirect, "/routes"}}],
          sections: [%Section{key: :pages, label: "Pages"}, %Section{key: :drivers, label: "Drivers"}],
          extra: []
        },
        assigns
      )

    {:ok, document} =
      Floki.parse_document(
        rendered_to_string(~H"""
        <Components.command_palette entries={@entries} sections={@sections} user_id="u1" {@strings} {@attrs}>
          <:footer :for={text <- @extra}>{text}</:footer>
        </Components.command_palette>
        """)
      )

    document
  end

  defp palette(attrs \\ %{}, extra \\ []), do: render(%{strings: @strings, attrs: attrs, extra: extra})

  defp attribute(document, selector, name), do: document |> Floki.attribute(selector, name) |> List.first()

  test "ships the entries and sections as the JSON the hook reads, sections in order" do
    document = palette()

    assert document |> attribute("#command-palette", "data-entries") |> Jason.decode!() ==
             [%{"l" => "Routes", "p" => "/routes", "s" => "pages"}]

    assert document |> attribute("#command-palette", "data-sections") |> Jason.decode!() ==
             [%{"k" => "pages", "l" => "Pages"}, %{"k" => "drivers", "l" => "Drivers"}]
  end

  test "is a modal dialog whose input controls the listbox" do
    document = palette()

    assert attribute(document, "#command-palette", "role") == "dialog"
    assert attribute(document, "#command-palette", "aria-modal") == "true"
    assert attribute(document, "#command-palette-input", "aria-controls") == "command-palette-results"
    assert attribute(document, "#command-palette-results", "role") == "listbox"
    assert attribute(document, "#command-palette-results", "phx-update") == "ignore"
  end

  test "takes every string from the app" do
    text = Floki.text(palette())

    for word <- ["Search pages", "Nothing matches", "Run", "Actions", "Close", "Back"], do: assert(text =~ word)
    assert attribute(palette(), "#command-palette-input", "placeholder") == "Search…"
  end

  test "falls back to the default stylesheet's classes" do
    assert attribute(palette(), "#command-palette-input", "class") == "cp-input"
  end

  test "uses the app's classes when given" do
    assert attribute(palette(%{input_class: "w-full border-0"}), "#command-palette-input", "class") ==
             "w-full border-0"
  end

  test "renders the footer slot ahead of the key hints" do
    assert %{} |> palette(["Open from anywhere"]) |> Floki.text() =~ "Open from anywhere"
  end

  test "open_palette/0 dispatches the event the hook listens for" do
    assert inspect(Components.open_palette()) =~ "phx:open-command-palette"
  end
end
