defmodule CommandPalette.Test.LookupFailed do
  @moduledoc false
  defexception message: "the lookup failed"
end

defmodule CommandPalette.Test.Search do
  @moduledoc false
  @behaviour CommandPalette.Search

  alias CommandPalette.Entry

  @impl CommandPalette.Search
  def context(socket), do: socket.assigns.test_pid

  @impl CommandPalette.Search
  def search("boom", _test_pid), do: raise(CommandPalette.Test.LookupFailed)

  def search("slow" <> _rest = query, test_pid) do
    send(test_pid, {:searching, query, self()})

    receive do
      :release -> {[hit(query)], nil}
    end
  end

  def search(query, test_pid) do
    send(test_pid, {:searched, query})
    {[hit(query)], "hint for #{query}"}
  end

  defp hit(query), do: %Entry{label: "Hit for #{query}", section: :results, run: {:redirect, "/#{query}"}}
end
