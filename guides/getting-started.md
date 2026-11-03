# Getting started

A complete integration into a Phoenix 1.8 app: function-component layouts, `phx.gen.auth`'s `current_scope`, esbuild
and Tailwind. The names (`MyApp`, `Orders`, `Customers`) are placeholders for your own. Every step follows a rule in
[Usage rules](../usage-rules.md), linked where it applies; read them before changing the shape.

## 1. The dependency

```elixir
# mix.exs
{:command_palette, github: "sephianl/command_palette", tag: "v0.1.0"}
```

The JavaScript ships inside it. Phoenix's esbuild profile already sets `NODE_PATH` to `deps/`, which is what lets
`import "command_palette"` resolve; keep that line if you have changed the profile:

```elixir
# config/config.exs, in the esbuild profile
env: %{"NODE_PATH" => [Path.expand("../deps", __DIR__), Mix.Project.build_path()]}
```

## 2. The hook and the look

```js
// assets/js/app.js
import { createCommandPalette } from "command_palette";

const liveSocket = new LiveSocket("/live", Socket, {
  params: { _csrf_token: csrfToken },
  hooks: { ...colocatedHooks, CommandPalette: createCommandPalette() },
});
```

```css
/* assets/css/app.css, with the other @import lines at the top */
@import "tailwindcss" source(none);
@import "../../deps/command_palette/priv/static/command_palette.css";
```

The default look is themed through `--cp-*` custom properties; [Styling](styling.md) shows how to use your own
classes instead. See [Installing](../usage-rules.md#installing) for the hook's key and the `open:` option.

## 3. The palette, in the layout

The layout renders the rows that do not depend on the page. The rows of the LiveView on screen arrive when the palette
opens, from `CommandPalette.LiveHook` ([Rendering](../usage-rules.md#rendering)), so the layout never passes them:

```elixir
# lib/my_app_web/components/layouts.ex
attr :flash, :map, required: true
attr :current_scope, :map, default: nil
slot :inner_block, required: true

def app(assigns) do
  ~H"""
  <main>{render_slot(@inner_block)}</main>
  <MyAppWeb.Palette.palette :if={@current_scope} current_scope={@current_scope} />
  <.flash_group flash={@flash} />
  """
end
```

The palette itself, with the app's pages, sections and strings in one place ([Rows](../usage-rules.md#rows),
[Sections](../usage-rules.md#sections)):

```elixir
defmodule MyAppWeb.Palette do
  use MyAppWeb, :html

  alias CommandPalette.{Entry, Section}

  attr :current_scope, :map, required: true

  def palette(assigns) do
    assigns = assign(assigns, :entries, pages() ++ commands())

    ~H"""
    <CommandPalette.Components.command_palette
      entries={@entries}
      sections={sections()}
      user_id={@current_scope.user.id}
      placeholder={gettext("Search…")}
      label={gettext("Search")}
      empty={gettext("Nothing matches")}
      opening={gettext("Opening…")}
      run_hint={gettext("Open")}
      actions_hint={gettext("Actions")}
      close_hint={gettext("Close")}
      back_hint={gettext("Back")}
      shortcuts_label={gettext("Keyboard shortcuts")}
    />
    """
  end

  defp sections do
    [
      %Section{key: :pages, label: gettext("Pages")},
      %Section{key: :orders, label: gettext("Orders"), icon: "hero-shopping-bag"},
      %Section{key: :customers, label: gettext("Customers"), icon: "hero-user"},
      %Section{key: :page, label: gettext("This page")},
      %Section{key: :commands, label: gettext("Commands")},
      %Section{key: :fallback, icon: "hero-magnifying-glass"}
    ]
  end

  defp pages do
    [
      %Entry{
        label: gettext("Orders"),
        section: :pages,
        icon: "hero-shopping-bag",
        run: {:redirect, ~p"/orders"},
        shortcut: "g o",
        actions: [
          %Entry{label: gettext("All orders"), section: :pages, run: {:redirect, ~p"/orders"}},
          %Entry{label: gettext("Open orders"), section: :pages, run: {:redirect, ~p"/orders?status=open"}},
          %Entry{label: gettext("Shipped orders"), section: :pages, run: {:redirect, ~p"/orders?status=shipped"}}
        ]
      },
      %Entry{label: gettext("Customers"), section: :pages, icon: "hero-user", run: {:redirect, ~p"/customers"}}
    ]
  end

  defp commands do
    [
      %Entry{
        label: gettext("Theme"),
        section: :commands,
        icon: "hero-swatch",
        children:
          for theme <- ~w(light dark system) do
            %Entry{label: theme, section: :commands, run: {:dispatch, "app:set-theme", %{theme: theme}}}
          end
      }
    ]
  end
end
```

The theme rows fire `app:set-theme` on `window`. Answer it next to Phoenix's own `phx:set-theme` listener in
`root.html.heex`'s inline script, where `setTheme` is defined:

```js
window.addEventListener("app:set-theme", (e) => setTheme(e.detail.theme));
```

## 4. A page's own rows

A LiveView offers rows for what it shows by implementing `CommandPalette.Page`, which gets the LiveView's assigns
each time the palette opens:

```elixir
defmodule MyAppWeb.OrderLive.Show do
  use MyAppWeb, :live_view
  @behaviour CommandPalette.Page

  @impl CommandPalette.Page
  def palette_entries(%{order: order}) do
    [
      %CommandPalette.Entry{label: gettext("Cancel this order"), section: :page, tone: :danger, run: {:event, "cancel", %{}}},
      %CommandPalette.Entry{label: gettext("Copy order number"), section: :page, run: {:copy, order.number}}
    ]
  end

  def palette_entries(_assigns), do: []

  @impl Phoenix.LiveView
  def handle_event("cancel", _params, socket), do: ...
end
```

An event every page should answer, such as switching team, is handled once in an `on_mount`:

```elixir
defmodule MyAppWeb.PaletteEvents do
  import Phoenix.LiveView

  def on_mount(:default, _params, _session, socket) do
    {:cont, attach_hook(socket, :palette_events, :handle_event, &handle/3)}
  end

  defp handle("switch-team", %{"id" => id}, socket), do: {:halt, push_navigate(socket, to: "/teams/#{id}")}
  defp handle(_event, _params, socket), do: {:cont, socket}
end
```

## 5. The server search

What a typed query finds on the server ([Server search](../usage-rules.md#server-search)): an order number is an exact
hit, a part of a customer's name a ranked one, and a fallback row offers searching the order list when nothing
matched.

```elixir
defmodule MyAppWeb.PaletteSearch do
  @behaviour CommandPalette.Search

  use Gettext, backend: MyAppWeb.Gettext

  alias CommandPalette.Entry

  @impl CommandPalette.Search
  def context(socket), do: socket.assigns.current_scope

  @impl CommandPalette.Search
  def search(query, scope) do
    orders = Enum.map(MyApp.Orders.by_number(scope, query), &order_row/1)
    customers = Enum.map(MyApp.Customers.search_name(scope, query), &customer_row/1)

    {orders ++ customers ++ [search_orders(query)], nil}
  end

  defp order_row(order) do
    open = {:redirect, "/orders/#{order.id}"}

    %Entry{
      label: order.number,
      section: :orders,
      detail: order.customer_name,
      run: open,
      actions: [
        %Entry{label: gettext("Open order"), section: :orders, run: open},
        %Entry{label: gettext("Copy order number"), section: :orders, run: {:copy, order.number}}
      ]
    }
  end

  defp customer_row(customer) do
    %Entry{label: customer.name, section: :customers, run: {:redirect, "/customers/#{customer.id}"}, ranked: true}
  end

  defp search_orders(query) do
    %Entry{
      label: gettext("Search orders for “%{query}”", query: query),
      section: :fallback,
      run: {:redirect, "/orders?" <> URI.encode_query(%{"search" => query})},
      fallback: true
    }
  end
end
```

Both hooks go in every `live_session` that renders the palette, after the one that assigns `current_scope`:

```elixir
# router.ex
live_session :require_authenticated_user,
  on_mount: [
    {MyAppWeb.UserAuth, :require_authenticated},
    MyAppWeb.PaletteEvents,
    {CommandPalette.LiveHook, MyAppWeb.PaletteSearch}
  ] do
```

## 6. A button that opens it

```heex
<button phx-click={CommandPalette.Components.open_palette()}>{gettext("Search")}</button>
```

## 7. Testing

```elixir
setup :register_and_log_in_user

test "offers cancelling the order", %{conn: conn, scope: scope} do
  order = order_fixture(scope)
  {:ok, _view, html} = live(conn, ~p"/orders/#{order}")

  [json] = html |> LazyHTML.from_fragment() |> LazyHTML.query("#command-palette") |> LazyHTML.attribute("data-entries")
  assert Enum.any?(Jason.decode!(json), &(&1["l"] == "Cancel this order"))
end

test "finds an order by its number", %{conn: conn, scope: scope} do
  order = order_fixture(scope)
  {:ok, view, _html} = live(conn, ~p"/orders/#{order}")

  render_hook(view, "palette_search", %{"q" => order.number, "seq" => 1})
  assert_push_event(view, "palette:results", %{seq: 1, entries: [%{l: _number} | _rest]})
end
```
