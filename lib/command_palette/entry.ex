defmodule CommandPalette.Entry do
  @moduledoc """
  One row of the palette, whatever it is: a page, an action the page on screen offers, an app-wide command or a search
  hit. Rows differ in what they do (`run`) and where they sit (`section`), never in their type, so the palette has one
  encoder and one set of rules.

  `run` is a tagged tuple rather than a set of nullable fields, so a row is never both a destination and an event:

    * `{:redirect, path}` -- live redirect, remounting the target LiveView
    * `{:patch, path}` -- live patch, for a URL the page on screen handles in `handle_params/3`
    * `{:event, name, params}` -- pushed to the LiveView on screen under its own event name
    * `{:dispatch, name, detail}` -- a `CustomEvent` on `window`, for what lives outside LiveView (a theme toggle)
    * `{:copy, text}` -- puts `text` on the clipboard

  A row with `children` is a list of its own: Enter opens it, and it needs no `run`. `actions` are the other things to
  do with a row, opened with →, while Enter still runs the row itself.

  `ranked` marks a search hit that matched only part of the query. The palette scores it against what was typed, at a
  discount, instead of leading its section with it as an exact hit. `fallback` marks a row shown only when nothing else
  matched, such as searching the page for the text; it is drawn in the `:fallback` section whatever `section` says.
  """

  @enforce_keys [:label, :section]
  defstruct [
    :label,
    :section,
    :run,
    :group,
    :icon,
    :keywords,
    :aliases,
    :detail,
    :mru_key,
    :shortcut,
    :tone,
    children: [],
    actions: [],
    ranked: false,
    fallback: false
  ]

  @type run ::
          {:redirect, String.t()}
          | {:patch, String.t()}
          | {:event, String.t(), map()}
          | {:dispatch, String.t(), map()}
          | {:copy, String.t()}

  @type t :: %__MODULE__{
          label: String.t(),
          section: atom(),
          run: run() | nil,
          group: String.t() | nil,
          icon: String.t() | nil,
          keywords: String.t() | nil,
          aliases: String.t() | nil,
          detail: String.t() | nil,
          mru_key: String.t() | nil,
          shortcut: String.t() | nil,
          tone: :danger | nil,
          children: [t()],
          actions: [t()],
          ranked: boolean(),
          fallback: boolean()
        }
end
