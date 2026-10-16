import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { build } from "esbuild";

await build({
  entryPoints: ["assets/src/index.ts"],
  bundle: true,
  format: "esm",
  target: "es2020",
  outfile: "priv/static/command_palette.mjs",
  legalComments: "none",
});

rmSync("priv/static/types", { recursive: true, force: true });
execFileSync(
  "npx",
  [
    "tsc",
    "--declaration",
    "--emitDeclarationOnly",
    "--noEmit",
    "false",
    "--rootDir",
    "assets/src",
    "--outDir",
    "priv/static/types",
    "assets/src/index.ts",
    "--target",
    "ES2020",
    "--module",
    "ESNext",
    "--moduleResolution",
    "Bundler",
    "--lib",
    "ES2020,DOM,DOM.Iterable",
    "--strict",
    "--skipLibCheck",
  ],
  { stdio: "inherit" },
);
