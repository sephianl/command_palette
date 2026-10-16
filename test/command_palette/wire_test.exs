defmodule CommandPalette.WireTest do
  use ExUnit.Case, async: true

  alias CommandPalette.Entry
  alias CommandPalette.Section
  alias CommandPalette.Wire

  defp entry(fields), do: struct!(Entry, Keyword.merge([label: "Routes", section: :pages], fields))

  describe "entry/1" do
    test "encodes a redirect as a bare path, label and section" do
      assert Wire.entry(entry(run: {:redirect, "/routes"})) == %{p: "/routes", l: "Routes", s: :pages}
    end

    test "marks a patch with its link kind" do
      assert Wire.entry(entry(run: {:patch, "/map"})) == %{p: "/map", l: "Routes", s: :pages, x: "patch"}
    end

    test "encodes an event without a path" do
      assert Wire.entry(entry(run: {:event, "reoptimize", %{"id" => "r1"}})) ==
               %{e: "reoptimize", v: %{"id" => "r1"}, l: "Routes", s: :pages}
    end

    test "encodes a window event apart from a LiveView one" do
      assert Wire.entry(entry(run: {:dispatch, "app:theme", %{theme: "dark"}})) ==
               %{w: "app:theme", v: %{theme: "dark"}, l: "Routes", s: :pages}
    end

    test "encodes a copy as the text to put on the clipboard" do
      assert Wire.entry(entry(run: {:copy, "AB123"})) == %{y: "AB123", l: "Routes", s: :pages}
    end

    test "carries every optional field under its own key" do
      encoded =
        Wire.entry(
          entry(
            run: {:redirect, "/routes"},
            group: "Administration",
            icon: "hero-map",
            keywords: "trips",
            aliases: "Ritten",
            detail: "13 August",
            mru_key: "routes",
            shortcut: "g r",
            tone: :danger,
            ranked: true,
            fallback: true
          )
        )

      assert %{
               g: "Administration",
               i: "hero-map",
               k: "trips",
               a: "Ritten",
               d: "13 August",
               m: "routes",
               h: "g r",
               t: :danger,
               r: true,
               f: true
             } = encoded
    end

    test "leaves out what carries no information" do
      assert [run: {:redirect, "/routes"}] |> entry() |> Wire.entry() |> Map.keys() |> Enum.sort() == [:l, :p, :s]
    end

    test "nests children and row actions as entries of their own" do
      encoded =
        Wire.entry(
          entry(
            run: {:redirect, "/order/1"},
            actions: [entry(label: "Copy order id", run: {:dispatch, "copy", %{text: "AB1"}})],
            children: [entry(label: "Gent", run: {:event, "depot", %{}})]
          )
        )

      assert %{o: [%{l: "Copy order id", w: "copy"}], c: [%{l: "Gent", e: "depot"}]} = encoded
    end

    test "lets a row with children go without a run of its own" do
      encoded = Wire.entry(entry(label: "Switch depot", children: [entry(run: {:redirect, "/a"})]))

      assert %{l: "Switch depot", c: [_child]} = encoded
      refute Map.has_key?(encoded, :p)
    end

    test "refuses a row that neither runs nor opens anything" do
      assert_raise ArgumentError, ~r/neither a run nor children/, fn -> Wire.entry(entry([])) end
    end
  end

  describe "section/1" do
    test "encodes a heading and an icon" do
      assert Wire.section(%Section{key: :drivers, label: "Drivers", icon: "icon-driver"}) ==
               %{k: :drivers, l: "Drivers", i: "icon-driver"}
    end

    test "leaves a section without a heading unlabelled" do
      assert Wire.section(%Section{key: :fallback, icon: "hero-magnifying-glass"}) ==
               %{k: :fallback, i: "hero-magnifying-glass"}
    end
  end

  test "encode/1 renders JSON the hook reads" do
    assert [entry(run: {:redirect, "/routes"})] |> Wire.entries() |> Wire.encode() |> Jason.decode!() ==
             [%{"p" => "/routes", "l" => "Routes", "s" => "pages"}]
  end
end
