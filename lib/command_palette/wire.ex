defmodule CommandPalette.Wire do
  @moduledoc """
  The JSON the hook reads: entries and sections as maps with single-letter keys, leaving out every key that carries no
  information. The entries ship with every render of the layout, so their size is paid on each page load.

  This module is the only place that knows the alphabet; `guides/wire-format.md` lists it, and the hook's
  `assets/src/types.ts` declares it.
  """

  alias CommandPalette.Entry
  alias CommandPalette.Section

  @spec entries([Entry.t()]) :: [map()]
  def entries(entries), do: Enum.map(entries, &entry/1)

  @spec entry(Entry.t()) :: map()
  def entry(%Entry{} = entry) do
    entry
    |> run_payload()
    |> Map.merge(%{l: entry.label, s: entry.section})
    |> put_optional(:g, entry.group)
    |> put_optional(:i, entry.icon)
    |> put_optional(:k, entry.keywords)
    |> put_optional(:a, entry.aliases)
    |> put_optional(:d, entry.detail)
    |> put_optional(:m, entry.mru_key)
    |> put_optional(:h, entry.shortcut)
    |> put_optional(:t, entry.tone)
    |> put_nested(:c, entry.children)
    |> put_nested(:o, entry.actions)
    |> put_flag(:r, entry.ranked)
    |> put_flag(:f, entry.fallback)
  end

  @spec section(Section.t()) :: map()
  def section(%Section{key: key, label: label, icon: icon}) do
    %{k: key}
    |> put_optional(:l, label)
    |> put_optional(:i, icon)
  end

  @spec encode(term()) :: String.t()
  def encode(payload), do: Jason.encode!(payload)

  defp run_payload(%Entry{run: {:redirect, path}}), do: %{p: path}
  defp run_payload(%Entry{run: {:patch, path}}), do: %{p: path, x: "patch"}
  defp run_payload(%Entry{run: {:event, name, params}}), do: %{e: name, v: params}
  defp run_payload(%Entry{run: {:dispatch, name, detail}}), do: %{w: name, v: detail}
  defp run_payload(%Entry{run: {:copy, text}}), do: %{y: text}
  defp run_payload(%Entry{run: nil, children: [_child | _rest]}), do: %{}

  defp run_payload(%Entry{label: label}) do
    raise ArgumentError, "palette entry #{inspect(label)} has neither a run nor children, so choosing it does nothing"
  end

  defp put_optional(payload, _key, nil), do: payload
  defp put_optional(payload, key, value), do: Map.put(payload, key, value)

  defp put_nested(payload, _key, []), do: payload
  defp put_nested(payload, key, entries), do: Map.put(payload, key, entries(entries))

  defp put_flag(payload, key, true), do: Map.put(payload, key, true)
  defp put_flag(payload, _key, false), do: payload
end
