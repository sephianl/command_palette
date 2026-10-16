defmodule CommandPalette.LiveHookTest do
  use ExUnit.Case, async: true

  import Phoenix.ConnTest
  import Phoenix.LiveViewTest

  alias CommandPalette.LiveHook

  @endpoint CommandPalette.Test.Endpoint

  defp search(view, query, seq), do: render_hook(view, "palette_search", %{"q" => query, "seq" => seq})

  defp page_rows(view) do
    view
    |> render()
    |> LazyHTML.from_fragment()
    |> LazyHTML.query("#command-palette")
    |> LazyHTML.attribute("data-entries")
    |> hd()
    |> Jason.decode!()
  end

  describe "on a mounted LiveView" do
    setup do
      {:ok, view, _html} = live_isolated(build_conn(), CommandPalette.Test.Live, session: %{"test_pid" => self()})
      %{view: view}
    end

    test "replies with the search's entries and hint, echoing the query's seq", %{view: view} do
      search(view, "AB123", 7)

      assert_push_event(view, "palette:results", %{seq: 7, entries: [%{l: "Hit for AB123", p: "/AB123"}], hint: hint})
      assert hint == "hint for AB123"
    end

    test "answers a short query with nothing, without searching", %{view: view} do
      search(view, "ab", 1)

      assert_push_event(view, "palette:results", %{seq: 1, entries: [], hint: nil})
      refute_received {:searched, _query}
    end

    test "searches a short query that is all digits", %{view: view} do
      search(view, " 12 ", 1)

      assert_push_event(view, "palette:results", %{seq: 1, entries: [%{l: "Hit for 12"}]})
      assert_received {:searched, "12"}
    end

    test "lets a newer query cancel the search of an older one", %{view: view} do
      search(view, "slow one", 1)
      assert_receive {:searching, "slow one", older}
      ref = Process.monitor(older)

      search(view, "fast", 2)
      send(older, :release)

      assert_receive {:DOWN, ^ref, :process, ^older, _reason}
      assert_push_event(view, "palette:results", %{seq: 2, entries: [%{l: "Hit for fast"}]})
      refute_push_event(view, "palette:results", %{seq: 1})
    end

    test "answers a search that crashed with nothing, rather than leaving the palette waiting", %{view: view} do
      ExUnit.CaptureLog.capture_log(fn ->
        search(view, "boom", 3)
        assert_push_event(view, "palette:results", %{seq: 3, entries: [], hint: nil})
      end)
    end

    test "draws the page's own rows from its assigns, and follows them as they change", %{view: view} do
      assert [%{"l" => "Reoptimize", "d" => "0"}] = page_rows(view)

      render_hook(view, "bump", %{})

      assert [%{"l" => "Reoptimize", "d" => "1"}] = page_rows(view)
    end

    test "passes every other event on to the LiveView", %{view: view} do
      render_hook(view, "own_event", %{})

      assert_received :own_event
    end
  end

  describe "searchable?/1" do
    test "needs three characters, unless the query is all digits" do
      assert LiveHook.searchable?("abc")
      refute LiveHook.searchable?("ab")
      assert LiveHook.searchable?("7")
      refute LiveHook.searchable?("")
    end
  end
end
