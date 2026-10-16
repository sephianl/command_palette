{
  pkgs,
  config,
  ...
}:

{
  process.managers.process-compose.tui.enable = false;
  cachix.enable = false;

  languages = {
    elixir = {
      enable = true;
      package = pkgs.beamPackages.elixir_1_19;
    };
    javascript = {
      enable = true;
      package = pkgs.nodejs_22;
      npm.enable = true;
    };
  };

  packages = with pkgs; [ inotify-tools ];

  git-hooks.hooks = {
    mix-format = {
      enable = !config.devenv.isTesting;
      name = "mix-format";
      files = ".ex[s]?$";
      entry = "mix format";
    };
    mix-check = {
      enable = !config.devenv.isTesting;
      name = "mix-check";
      entry = "mix check --no-retry";
      pass_filenames = false;
      stages = [ "pre-commit" ];
      files = ".ex[s]?$";
    };
    assets-check = {
      enable = !config.devenv.isTesting;
      name = "assets-check";
      entry = "npm run check";
      pass_filenames = false;
      stages = [ "pre-commit" ];
      files = "^(assets/|package\\.json)";
    };
    prettier = {
      enable = !config.devenv.isTesting;
      excludes = [
        "^\\.claude/"
        "^priv/static/"
      ];
    };
    nixfmt.enable = !config.devenv.isTesting;
  };
}
