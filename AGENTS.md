# Workflow Orchestration

## 1. Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately -- don't keep pushing

## 2. Subagent Delegation

- Delegate when the answer is much smaller than what must be read; keep architecture, decisions and user interaction in the main context
- One task per subagent, run in parallel when independent

| Trigger                           | Subagent             | Why                                                                                      |
| --------------------------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| Run/debug tests                   | Bash (default)       | `mix test path/file.exs 2>&1 \| tail -20` — cheap pass/fail check without agent overhead |
| Read a consuming app              | `Explore` (built-in) | Keeps the app's code out of the main context                                             |
| Explore unfamiliar codebase areas | `Explore` (built-in) | Fast read-only search                                                                    |

## 3. Verification Before Done

- Never mark a task complete without proving it works
- Self-review your own diff before presenting -- fix minor issues (unused params, scattered logic, naming) before they stack up
- Ask yourself: "Would a staff engineer approve this?"

## 4. Demand Elegance (When It Matters)

- If a fix feels hacky or wrong, pause and reconsider the approach
- Skip this for simple, obvious fixes -- don't over-engineer

## 5. Design for the Ideal

- Start from the perfect end-state, then figure out how to implement it -- not the other way around

# Testing

- **Default to Bash for test runs** -- `mix test path/to/test.exs 2>&1 | tail -20`; read more only to diagnose
- **The JS side has its own suite** -- `npm test`, `npm run typecheck` and `npm run lint`, or all three as `npm run check`
- **Scope test runs to what changed**: run only the affected file(s), not the whole suite
- For "does it compile", run `mix compile --warnings-as-errors`

# The two halves

- `lib/` is the Elixir side: the `Entry` struct, the wire format, the `on_mount` hook and the component
- `assets/src/` is the TypeScript hook. `npm run build` bundles it into `priv/static/command_palette.mjs` and its `.d.ts`. The bundle is committed and CI fails when it does not match the source, so **rebuild after every change to `assets/src/`**
- The wire format is the contract between the two. A key is added in `CommandPalette.Wire`, `assets/src/types.ts` and `guides/wire-format.md` together, never in one alone
- The package knows no app: no gettext backend, no `current_user`, no domain section names. What an app supplies arrives as an attr, a callback or a hook option

# Code Style

- Run `mix check` for the full quality suite (compiler warnings, dialyzer, credo, sobelow, styler, the asset checks)
- No inline comments; a moduledoc says why the module exists
- Prettier formats TypeScript and Markdown on commit

# Releasing

The package is not on Hex; apps depend on it from GitHub, pinned to a tag, so a release is a tag:

1. `mix check` passes and `npm run build` leaves `priv/static` unchanged
2. Bump `@version` in `mix.exs` and `version` in `package.json` together
3. Move the CHANGELOG's entries under `## x.y.z (date)`
4. Commit, then the maintainer tags `vx.y.z` and pushes the tag; the apps bump their `tag:`

Never push or tag from an agent session: publishing is the maintainer's.

# Key Reference

- `usage-rules.md` and the guides in `guides/` are the contract with apps: change them with the behaviour they
  describe. A rule is written once, in `usage-rules.md`; the guides show it and link to it
- `assets/test/regression.test.ts` pins the behaviour of the palette this package was extracted from; a failure there
  is a regression unless the change is meant, and then the test changes with a note why
