defmodule CommandPalette.Section do
  @moduledoc """
  A heading rows are grouped under. The app passes its sections as a list, and the list's order is the order they are
  drawn in: what was typed never moves a section, it only orders the rows inside one.

  A section without a `label` draws no heading, for rows that stand in for an empty list rather than answer the query.
  A row without an icon of its own takes its section's.
  """

  @enforce_keys [:key]
  defstruct [:key, :label, :icon]

  @type t :: %__MODULE__{key: atom(), label: String.t() | nil, icon: String.t() | nil}
end
