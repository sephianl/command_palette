defmodule CommandPalette.Components do
  @moduledoc """
  The palette's markup. Render `command_palette/1` once, in the layout every LiveView shares; the hook draws the rows
  into it.

  Every string is an attr because the package has no gettext backend: pass the app's own translations. Every part takes
  a class, so the shell looks like the app; leave them out to get the `cp-*` classes of the default stylesheet,
  `priv/static/command_palette.css`.
  """

  use Phoenix.Component

  alias CommandPalette.Wire
  alias Phoenix.LiveView.JS

  attr :id, :string, default: "command-palette", doc: "the hook finds its parts by it; render one palette per page"
  attr :entries, :list, required: true, doc: "`CommandPalette.Entry` structs: pages, page actions, commands"
  attr :sections, :list, required: true, doc: "`CommandPalette.Section` structs, in the order they are drawn"
  attr :user_id, :any, default: nil, doc: "keeps each person's recency apart in the browser"

  attr :placeholder, :string, required: true
  attr :label, :string, required: true, doc: "the dialog's accessible name"
  attr :empty, :string, required: true, doc: "shown when nothing matches"
  attr :opening, :string, required: true, doc: "told to a screen reader while a chosen row is opening"

  attr :shortcuts_label, :string,
    default: nil,
    doc: "the title of the list `?` opens, of every row with a shortcut; leave it out to keep `?` for the page"

  attr :run_hint, :string, required: true, doc: "the footer's word for Enter"
  attr :actions_hint, :string, required: true, doc: "the footer's word for →, shown when the row has actions"
  attr :close_hint, :string, required: true, doc: "the footer's word for Escape at the top level"
  attr :back_hint, :string, required: true, doc: "the footer's word for Escape inside a row's actions or children"

  attr :class, :string, default: "cp-root"
  attr :backdrop_class, :string, default: "cp-backdrop"
  attr :panel_class, :string, default: "cp-panel"
  attr :search_class, :string, default: "cp-search"
  attr :crumb_class, :string, default: "cp-crumb"
  attr :input_class, :string, default: "cp-input"
  attr :list_class, :string, default: "cp-list"
  attr :empty_class, :string, default: "cp-empty"
  attr :hint_class, :string, default: "cp-hint"
  attr :footer_class, :string, default: "cp-footer"
  attr :key_class, :string, default: "cp-key"

  slot :footer, doc: "extra content at the start of the footer, before the key hints"

  @spec command_palette(map()) :: Phoenix.LiveView.Rendered.t()
  def command_palette(assigns) do
    assigns =
      assigns
      |> assign(:entries_json, assigns.entries |> Wire.entries() |> Wire.encode())
      |> assign(:sections_json, assigns.sections |> Enum.map(&Wire.section/1) |> Wire.encode())

    ~H"""
    <div
      id={@id}
      phx-hook="CommandPalette"
      data-entries={@entries_json}
      data-sections={@sections_json}
      data-user-id={@user_id}
      data-opening-label={@opening}
      data-shortcuts-label={@shortcuts_label}
      class={@class}
      hidden
      role="dialog"
      aria-modal="true"
      aria-labelledby={"#{@id}-label"}
    >
      <div class={@backdrop_class} data-palette-backdrop></div>
      <div class={@panel_class}>
        <label id={"#{@id}-label"} for={"#{@id}-input"} style={visually_hidden()}>{@label}</label>
        <div class={@search_class}>
          <span class={@crumb_class} data-palette-crumb hidden></span>
          <input
            id={"#{@id}-input"}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={"#{@id}-results"}
            aria-autocomplete="list"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            placeholder={@placeholder}
            class={@input_class}
          />
        </div>
        <ul id={"#{@id}-results"} role="listbox" phx-update="ignore" aria-label={@label} class={@list_class}></ul>
        <p class={@empty_class} data-palette-empty hidden>{@empty}</p>
        <p class={@hint_class} data-palette-hint hidden></p>
        <div class={@footer_class}>
          {render_slot(@footer)}
          <span><kbd class={@key_class}>↵</kbd> {@run_hint}</span>
          <span data-palette-key-actions hidden><kbd class={@key_class}>→</kbd> {@actions_hint}</span>
          <span data-palette-key-close><kbd class={@key_class}>Esc</kbd> {@close_hint}</span>
          <span data-palette-key-back hidden><kbd class={@key_class}>Esc</kbd> {@back_hint}</span>
          <span :if={@shortcuts_label}><kbd class={@key_class}>?</kbd> {@shortcuts_label}</span>
        </div>
      </div>
    </div>
    """
  end

  defp visually_hidden,
    do: "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap"

  @doc "Opens the palette, for a button outside it: `<button phx-click={CommandPalette.Components.open_palette()}>`."
  def open_palette, do: JS.dispatch("phx:open-command-palette")
end
