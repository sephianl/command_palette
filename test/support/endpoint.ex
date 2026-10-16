defmodule CommandPalette.Test.Endpoint do
  @moduledoc false
  use Phoenix.Endpoint, otp_app: :command_palette

  socket("/live", Phoenix.LiveView.Socket)
end
