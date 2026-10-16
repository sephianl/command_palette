# Used by "mix format"
[
  plugins: [Styler, Phoenix.LiveView.HTMLFormatter],
  import_deps: [:phoenix, :phoenix_live_view],
  line_length: 120,
  inputs: ["*.{heex,ex,exs}", "{mix,.formatter,.check,.credo}.exs", "{config,lib,test}/**/*.{heex,ex,exs}"]
]
