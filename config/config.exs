import Config

alias CommandPalette.Test.Endpoint

if config_env() == :test do
  config :command_palette, Endpoint,
    secret_key_base: String.duplicate("a", 64),
    live_view: [signing_salt: "command_palette"],
    render_errors: [formats: [html: Endpoint]],
    server: false

  config :logger, level: :warning

  config :phoenix, :json_library, Jason
end
