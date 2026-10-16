# What a person sees

The palette as the people using your app meet it. How to build each part is in
[Getting started](getting-started.md), and the rules for it in [Usage rules](../usage-rules.md).

## Opening and closing

- **Ctrl+K / ⌘K, or Ctrl+Space** opens it from anywhere; the app chooses the keys with the hook's `open:` option.
- **A button** outside it opens it with `CommandPalette.Components.open_palette/0`.
- **Esc** closes it, or goes back one level inside a row's actions or children.
- After choosing a row that leads to another page, it **stays open with the row spinning** until that page has
  arrived, and gives up after 15 s. A second Enter does nothing meanwhile.

## Finding things

- **Every word of the query must match**, each on its own, letters in order: "rep jan" finds "January report". A run
  of letters, the start of the label and the start of a word count for more.
- **The label in other languages** (`aliases`) counts as the label, so a page is found by its name in any language.
- **Sections stay in the order the app gave**; typing never moves a section, it only orders the rows inside one.
- **Server results** arrive once typing settles for 200 ms: an exact hit (a code) leads its section and takes the
  highlight, a part of a name competes with the rest.
- **A hint line** under the list says what the search left out, even when it found nothing.
- **A fallback row** appears only when nothing else matched, such as "Search orders for …".
- **Recency**: what a person chooses often and lately comes first, fading over about two weeks, kept per person in
  the browser.

## Moving and choosing

- **↑ / ↓** move, **Home / End** jump, **Enter** runs the highlighted row.
- **→**, with the caret at the end of the box, opens the highlighted row's **actions**; the footer shows → only when
  there are some, and the row's **⋯** does the same with the mouse.
- **A row with ›** has **children**: Enter opens them as a list of their own, when the row has no `run` of its own;
  a row with both runs on Enter, and its children are still found from the top level by name.
- **← at the start of the box, Backspace in an empty box, or Esc** go back a level.
- From the top level a query also finds **rows inside children and actions**, at any depth, under the path to them:
  "monthly" finds "Reports › Monthly". A nested row that is also a row of its own shows once.
- Inside a level the list **keeps the order the app gave** until something is typed.
- **Ctrl/⌘-click** a row that leads to a page opens it in a new tab.

## Shortcuts

- **A row can have a shortcut** (`"g o"`, `"mod+shift+p"`). It runs **while the palette is closed**, never while focus
  is in a text field; inside the palette the keycaps only say what to press, since letters go into the box.
- **?** lists every row with a shortcut, on a page outside a text field or in the palette with an empty box, when the
  component is given a `shortcuts_label`. The footer says so.

## Looks

- **The footer** shows the keys that work right now: ↵, → when the row has actions, Esc to close or go back, ? for
  the shortcuts.
- **Icons** per row, or the row's section's icon when it has none.
- **A danger tone** for a row that destroys something.
