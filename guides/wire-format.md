# Wire format

**You never write these.** They are the field names of the JSON the server sends the browser: the Elixir side builds
them from `%CommandPalette.Entry{}` and `%CommandPalette.Section{}`, and the hook reads them. Read this page when
debugging what `data-entries` holds, or when adding a field to the package. The keys a person presses are in
[What a person sees](behaviour.md).

`CommandPalette.Wire` encodes rows and sections as JSON with single-letter keys, leaving out every key that carries
no information; the hook declares the same shape in `assets/src/types.ts`. A key is added in both places and here,
never in one alone, and no letter ever changes meaning.

## A row (`data-entries`, and the `entries` of a search reply)

| Key | Meaning                                                           |
| --- | ----------------------------------------------------------------- |
| `l` | label                                                             |
| `s` | section key                                                       |
| `p` | path, for a redirect or a patch                                   |
| `x` | `"patch"` for a patch; absent for a redirect                      |
| `e` | LiveView event name                                               |
| `w` | window event name                                                 |
| `v` | the event's params, or the window event's detail                  |
| `y` | text to put on the clipboard                                      |
| `g` | group, the muted text after the label                             |
| `i` | icon class                                                        |
| `k` | keywords                                                          |
| `a` | the label in the app's other languages, scored as the label       |
| `d` | trailing detail                                                   |
| `m` | recency key, when the path is too volatile to remember the row by |
| `h` | shortcut, e.g. `"g i"`                                            |
| `t` | tone: `"danger"`                                                  |
| `c` | children: rows this row opens as a list                           |
| `o` | row actions: rows under →                                         |
| `r` | ranked: a search hit that matched only part of the query          |
| `f` | fallback: shown only when nothing else matches                    |

## A section (`data-sections`, in display order)

| Key | Meaning                          |
| --- | -------------------------------- |
| `k` | key, matching a row's `s`        |
| `l` | heading; absent draws none       |
| `i` | icon for its rows that have none |

## Events

- The hook pushes `palette_search` with `%{"q" => query, "seq" => seq}`.
- `CommandPalette.LiveHook` answers with `palette:results`: `%{seq: seq, entries: [row], hint: string | nil}`. The
  hook drops a reply whose `seq` is not its latest.
- On opening, the hook pushes `palette_open` with `%{}`. `CommandPalette.LiveHook` replies `%{entries: [row]}`, the
  page's own rows, which the hook draws with `data-entries` until the palette closes. A reply that arrives after the
  palette closed is dropped.
- `phx:open-command-palette` on `window` opens the palette.
