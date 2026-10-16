defmodule CommandPalette.PageTest do
  use ExUnit.Case, async: true

  alias CommandPalette.Page
  alias CommandPalette.Test.Live
  alias Phoenix.LiveView.Socket

  test "returns the entries the LiveView on screen offers" do
    assert [%{label: "Reoptimize"}] = Page.entries(%{socket: %Socket{view: Live}})
  end

  test "returns nothing for a LiveView that offers none" do
    assert Page.entries(%{socket: %Socket{view: CommandPalette.Test.Endpoint}}) == []
  end

  test "returns nothing without a LiveView" do
    assert Page.entries(%{}) == []
  end
end
