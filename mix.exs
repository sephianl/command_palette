defmodule CommandPalette.MixProject do
  use Mix.Project

  @version "0.2.0"
  @github_url "https://github.com/sephianl/command_palette"

  def project do
    [
      app: :command_palette,
      version: @version,
      elixir: "~> 1.15",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      aliases: aliases(),
      description: "A command palette for Phoenix LiveView: sections, fuzzy search, server search and recency.",
      package: package(),

      # Docs
      name: "CommandPalette",
      docs: docs(),
      source_url: @github_url,

      # Dialyzer
      dialyzer: [plt_add_apps: [:mix]]
    ]
  end

  def application do
    [extra_applications: [:logger]]
  end

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      {:phoenix_live_view, "~> 1.1"},
      {:jason, "~> 1.4"},

      # Testing
      {:lazy_html, ">= 0.1.0", only: :test},
      {:floki, "~> 0.38", only: :test},

      # Mix check
      {:ex_check, "~> 0.16.0", only: [:dev, :test], runtime: false},
      # Static code analysis
      {:credo, ">= 0.0.0", only: [:dev, :test], runtime: false},
      {:sephia_credo, "~> 0.8", only: [:dev, :test], runtime: false},
      {:ex_slop, "~> 0.4", only: [:dev, :test], runtime: false},
      {:ex_dna, "~> 1.5", only: [:dev, :test], runtime: false},
      {:dialyxir, ">= 0.0.0", only: [:dev, :test], runtime: false},
      {:ex_doc, ">= 0.0.0", only: [:dev, :test], runtime: false},
      {:sobelow, ">= 0.0.0", only: [:dev, :test], runtime: false},
      {:mix_audit, ">= 0.0.0", only: [:dev, :test], runtime: false},

      # Formatting
      {:styler, "~> 1.4", only: [:dev, :test], runtime: false}
    ]
  end

  defp aliases do
    ["assets.build": ["cmd npm run build"], "hex.publish": ["assets.build", "hex.publish"]]
  end

  defp package do
    [
      maintainers: ["Sephia"],
      licenses: ["MIT"],
      links: %{"GitHub" => @github_url, "Changelog" => "#{@github_url}/blob/main/CHANGELOG.md"},
      files:
        ~w(lib priv/static assets/src package.json mix.exs .formatter.exs README.md LICENSE CHANGELOG.md usage-rules.md guides)
    ]
  end

  defp docs do
    [
      main: "readme",
      source_url: @github_url,
      source_ref: "v#{@version}",
      extras: [
        {"README.md", title: "Overview"},
        "guides/getting-started.md",
        {"usage-rules.md", title: "Usage rules"},
        "guides/behaviour.md",
        "guides/styling.md",
        "guides/wire-format.md",
        "CHANGELOG.md"
      ],
      groups_for_extras: [
        Guides: ["guides/getting-started.md", "usage-rules.md", ~r"guides/"],
        About: ["CHANGELOG.md"]
      ],
      groups_for_modules: [
        Rows: [CommandPalette.Entry, CommandPalette.Section],
        LiveView: [CommandPalette.LiveHook, CommandPalette.Search, CommandPalette.Page, CommandPalette.Components],
        Internals: [CommandPalette.Wire]
      ]
    ]
  end
end
