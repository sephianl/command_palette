import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCommandPalette } from "../src/hook";
import type { Entry, SectionData } from "../src/types";

const SECTIONS: SectionData[] = [
  { k: "pages", l: "Pages" },
  { k: "depots", l: "Depots", i: "icon-depot" },
  { k: "orders", l: "Orders", i: "icon-order" },
  { k: "drivers", l: "Drivers", i: "icon-driver" },
  { k: "page", l: "This page" },
  { k: "fallback", i: "hero-magnifying-glass" },
];

const ORDER: Entry = {
  s: "orders",
  l: "AB123",
  p: "/map/2026-10-16/d1/r1/s1",
  x: "patch",
  d: "on map · AMS01",
  o: [
    { s: "orders", l: "Open in order list", p: "/orders/list?search=AB123" },
    { s: "orders", l: "Copy order id", w: "app:copy", v: { text: "AB123" } },
  ],
};

const ENTRIES: Entry[] = [
  { s: "pages", l: "Routes", p: "/routes", i: "icon-route", h: "g r" },
  { s: "pages", l: "Vehicles", p: "/vehicles/list", g: "Administration" },
  {
    s: "depots",
    l: "Switch depot",
    c: [
      { s: "depots", l: "Amsterdam", e: "select-depot", v: { id: "d1" } },
      { s: "depots", l: "Gent", e: "select-depot", v: { id: "d2" } },
    ],
  },
  { s: "page", l: "Reoptimize this route", e: "reoptimize", v: { id: "r1" } },
  { s: "page", l: "Delete this route", e: "delete", t: "danger" },
];

// The hook's methods are written against `this`, so a prototype-linked object
// stands in for what LiveView constructs at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestHook = any;

let hook: TestHook = null;

function mount(
  entries: unknown = ENTRIES,
  options = {},
  sections: unknown = SECTIONS,
): TestHook {
  const json = (value: unknown) =>
    typeof value === "string" ? value : JSON.stringify(value);

  document.body.innerHTML = `
    <div id="command-palette" hidden
         data-entries='${json(entries)}'
         data-sections='${json(sections)}'
         data-user-id="u1"
         data-opening-label="Opening…"
         data-shortcuts-label="Keyboard shortcuts">
      <div data-palette-backdrop></div>
      <span data-palette-crumb hidden></span>
      <input id="command-palette-input" />
      <ul id="command-palette-results"></ul>
      <p data-palette-empty hidden></p>
      <p data-palette-hint hidden></p>
      <span data-palette-key-actions hidden></span>
      <span data-palette-key-close></span>
      <span data-palette-key-back hidden></span>
    </div>`;

  const navigation = { navigate: vi.fn(), patch: vi.fn() };
  hook = Object.create(createCommandPalette(options));
  hook.el = document.getElementById("command-palette");
  hook.pushEvent = vi.fn();
  hook.navigation = navigation;
  hook.js = () => navigation;
  hook.handlers = {};
  hook.handleEvent = (event: string, callback: unknown) => {
    hook.handlers[event] = callback;
  };
  hook.mounted();
  return hook;
}

function type(palette: TestHook, query: string): void {
  palette.input.value = query;
  palette.input.dispatchEvent(new Event("input"));
}

function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(event);
  return event;
}

function reply(
  palette: TestHook,
  entries: Entry[],
  hint: string | null = null,
) {
  palette.seq = 1;
  palette.handlers["palette:results"]({ seq: 1, entries, hint });
}

const labels = (palette: TestHook): string[] =>
  palette.results.map((result: { entry: Entry }) => result.entry.l);

const highlighted = (palette: TestHook): string =>
  palette.results[palette.selected].entry.l;

const headings = (palette: TestHook): (string | null)[] =>
  [...palette.list.querySelectorAll('[role="presentation"]')].map(
    (node: Element) => node.textContent,
  );

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  if (hook) hook.destroyed();
  hook = null;
  vi.useRealTimers();
});

describe("opening and closing", () => {
  it("opens on Ctrl+K and closes on Escape", () => {
    const palette = mount();

    press("k", { code: "KeyK", ctrlKey: true });
    expect(palette.open).toBe(true);
    expect(palette.el.hidden).toBe(false);

    press("Escape");
    expect(palette.open).toBe(false);
    expect(palette.el.hidden).toBe(true);
  });

  it("opens on a shortcut the app chose instead", () => {
    const palette = mount(ENTRIES, { open: ["alt+p"] });

    press("k", { code: "KeyK", ctrlKey: true });
    expect(palette.open).toBe(false);

    press("p", { code: "KeyP", altKey: true });
    expect(palette.open).toBe(true);
  });

  it("opens, never toggles, from a button outside", () => {
    const palette = mount();
    window.dispatchEvent(new Event("phx:open-command-palette"));
    window.dispatchEvent(new Event("phx:open-command-palette"));

    expect(palette.open).toBe(true);
  });

  it("survives malformed attributes with an empty palette", () => {
    const palette = mount("{oops", {}, "[");
    palette.openPalette();

    expect(palette.results).toEqual([]);
    expect(palette.empty.hidden).toBe(false);
  });
});

describe("sections", () => {
  it("draw in the server's order, whatever the scores", () => {
    const palette = mount();
    palette.openPalette();

    expect(headings(palette)).toEqual(["Pages", "Depots", "This page"]);
    expect(labels(palette)).toEqual([
      "Routes",
      "Vehicles",
      "Switch depot",
      "Reoptimize this route",
      "Delete this route",
    ]);
  });

  it("put a row whose section the server did not list last", () => {
    const palette = mount([
      { s: "mystery", l: "Mystery", p: "/m" },
      { s: "pages", l: "Routes", p: "/routes" },
    ]);
    palette.openPalette();

    expect(labels(palette)).toEqual(["Routes", "Mystery"]);
  });

  it("give a row without an icon its section's", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "switch");

    expect(palette.list.querySelector(".cp-icon")?.className).toContain(
      "icon-depot",
    );
  });
});

describe("server results", () => {
  it("lead their section, and an exact hit takes the highlight", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "ab123");
    reply(palette, [ORDER]);

    expect(headings(palette)).toEqual(["Orders"]);
    expect(highlighted(palette)).toBe("AB123");
  });

  it("score a ranked hit, so a better local match keeps the highlight", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "amsterdam");
    reply(palette, [
      { s: "drivers", l: "Wissel chauffeur Amsterdam", p: "/u/2", r: true },
    ]);

    expect(labels(palette).slice(0, 2)).toEqual([
      "Amsterdam",
      "Wissel chauffeur Amsterdam",
    ]);
    expect(highlighted(palette)).toBe("Amsterdam");
  });

  it("drop a reply that answers an older query", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "ab123");
    palette.seq = 2;
    palette.handlers["palette:results"]({
      seq: 1,
      entries: [ORDER],
      hint: null,
    });

    expect(labels(palette)).not.toContain("AB123");
  });

  it("show the fallback only when nothing else matched", () => {
    const fallback: Entry = {
      s: "orders",
      l: "Search orders for “zzz”",
      p: "/orders?search=zzz",
      f: true,
    };
    const palette = mount();
    palette.openPalette();

    type(palette, "zzzqqq");
    reply(palette, [fallback]);
    expect(labels(palette)).toEqual(["Search orders for “zzz”"]);

    type(palette, "routes");
    reply(palette, [fallback]);
    expect(labels(palette)).toEqual(["Routes"]);
  });

  it("treat the app's own fallback rows like the search's", () => {
    const palette = mount([
      ...ENTRIES,
      { s: "page", l: "Ask support about it", e: "support", f: true },
    ]);
    palette.openPalette();

    type(palette, "routes");
    expect(labels(palette)).not.toContain("Ask support about it");

    type(palette, "zzzqqq");
    expect(labels(palette)).toEqual(["Ask support about it"]);
  });

  it("keep the hint even when nothing came back", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "zzzqqq");
    reply(palette, [], "No routes within 8 weeks");

    expect(palette.hint.hidden).toBe(false);
    expect(palette.hint.textContent).toBe("No routes within 8 weeks");
    expect(palette.empty.hidden).toBe(true);
  });

  it("are asked for once typing settles, and only from the top level", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "ab1");
    type(palette, "ab12");
    vi.advanceTimersByTime(200);

    expect(palette.pushEvent).toHaveBeenCalledTimes(1);
    expect(palette.pushEvent).toHaveBeenCalledWith("palette_search", {
      q: "ab12",
      seq: 1,
    });
  });

  it("are asked for a short query that is all digits", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "12");
    vi.advanceTimersByTime(200);

    expect(palette.pushEvent).toHaveBeenCalledWith("palette_search", {
      q: "12",
      seq: 1,
    });
  });
});

describe("row actions", () => {
  function onOrder(): TestHook {
    const palette = mount();
    palette.openPalette();
    type(palette, "ab123");
    reply(palette, [ORDER]);
    return palette;
  }

  it("show → in the footer only when the highlighted row has some", () => {
    const palette = onOrder();
    expect(palette.keyActions.hidden).toBe(false);

    type(palette, "vehicles");
    expect(palette.keyActions.hidden).toBe(true);
  });

  it("open on → with the caret at the end, titled with the row", () => {
    const palette = onOrder();
    press("ArrowRight");

    expect(labels(palette)).toEqual(["Open in order list", "Copy order id"]);
    expect(palette.crumb.hidden).toBe(false);
    expect(palette.crumb.textContent).toBe("AB123 ›");
    expect(palette.input.value).toBe("");
    expect(palette.keyBack.hidden).toBe(false);
    expect(palette.keyClose.hidden).toBe(true);
  });

  it("leave → to the caret when it is not at the end", () => {
    const palette = onOrder();
    palette.input.setSelectionRange(1, 1);
    const event = press("ArrowRight");

    expect(event.defaultPrevented).toBe(false);
    expect(palette.levels).toHaveLength(0);
  });

  it("go back on Escape, ← at the start, or Backspace in an empty box", () => {
    for (const key of ["Escape", "ArrowLeft", "Backspace"]) {
      const palette = onOrder();
      press("ArrowRight");
      palette.input.setSelectionRange(0, 0);
      press(key);

      expect(palette.levels).toHaveLength(0);
      expect(palette.open).toBe(true);
      expect(palette.input.value).toBe("ab123");
      hook.destroyed();
    }
  });

  it("open from the row's ⋯ button too", () => {
    const palette = onOrder();
    palette.list.querySelector("[data-palette-more]").click();

    expect(labels(palette)).toEqual(["Open in order list", "Copy order id"]);
  });

  it("filter in the browser, without asking the server", () => {
    const palette = onOrder();
    press("ArrowRight");
    type(palette, "copy");
    vi.advanceTimersByTime(200);

    expect(labels(palette)).toEqual(["Copy order id"]);
    expect(palette.pushEvent).not.toHaveBeenCalled();
  });

  it("run a window event and close", () => {
    const palette = onOrder();
    const listener = vi.fn();
    window.addEventListener("app:copy", listener);
    press("ArrowRight");
    type(palette, "copy");
    press("Enter");

    expect(listener.mock.calls[0][0].detail).toEqual({ text: "AB123" });
    expect(palette.open).toBe(false);
    window.removeEventListener("app:copy", listener);
  });
});

describe("children", () => {
  it("open on Enter, the row showing ›", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "switch");

    expect(palette.list.querySelector(".cp-chevron")).not.toBeNull();
    press("Enter");

    expect(labels(palette)).toEqual(["Amsterdam", "Gent"]);
    expect(palette.crumb.textContent).toBe("Switch depot ›");
  });

  it("are found from the top level under their parent's name", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "gent");

    expect(labels(palette)).toEqual(["Gent"]);
    expect(palette.list.textContent).toContain("Switch depot ›");
  });

  it("include a row's actions, at any depth, under the path to them", () => {
    const palette = mount([
      {
        s: "pages",
        l: "Routes",
        p: "/routes",
        o: [
          {
            s: "pages",
            l: "Planning",
            p: "/routes?tab=planning",
            o: [{ s: "pages", l: "Unplanned", p: "/routes?section=unplanned" }],
          },
        ],
      },
    ]);
    palette.openPalette();
    type(palette, "unplanned");

    expect(labels(palette)).toEqual(["Unplanned"]);
    expect(palette.list.textContent).toContain("Routes › Planning ›");
  });

  it("leave a nested row that is also a row of its own to that one", () => {
    const palette = mount([
      { s: "pages", l: "Drivers", p: "/users/list?tab=drivers" },
      {
        s: "pages",
        l: "Users",
        p: "/users/list",
        o: [{ s: "pages", l: "Drivers", p: "/users/list?tab=drivers" }],
      },
    ]);
    palette.openPalette();
    type(palette, "drivers");

    expect(labels(palette)).toEqual(["Drivers"]);
    expect(palette.list.textContent).not.toContain("Users ›");
  });

  it("keep the order they were given until something is typed", () => {
    window.localStorage.setItem(
      "command_palette:mru:u1",
      JSON.stringify({ "/b": { n: 9, t: Date.now() } }),
    );
    const palette = mount([
      {
        s: "pages",
        l: "Routes",
        p: "/routes",
        o: [
          { s: "pages", l: "A tab", p: "/a" },
          { s: "pages", l: "B tab", p: "/b" },
        ],
      },
    ]);
    palette.openPalette();
    press("ArrowRight");

    expect(labels(palette)).toEqual(["A tab", "B tab"]);
  });

  it("stay out of the list on an empty query", () => {
    const palette = mount();
    palette.openPalette();

    expect(labels(palette)).not.toContain("Gent");
  });
});

describe("running a row", () => {
  it("pushes the page's own event and closes", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "reopt");
    press("Enter");

    expect(palette.pushEvent).toHaveBeenCalledWith("reoptimize", { id: "r1" });
    expect(palette.open).toBe(false);
  });

  it("stays open with the row spinning until the page arrives", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "routes");
    press("Enter");

    expect(palette.navigation.navigate).toHaveBeenCalledWith("/routes");
    expect(palette.open).toBe(true);
    expect(palette.list.querySelector('[aria-busy="true"]')).not.toBeNull();

    window.dispatchEvent(
      new CustomEvent("phx:page-loading-stop", {
        detail: { kind: "redirect" },
      }),
    );
    expect(palette.open).toBe(false);
  });

  it("patches a patch link, holding the spinner back briefly", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "ab123");
    reply(palette, [ORDER]);
    press("Enter");

    expect(palette.navigation.patch).toHaveBeenCalledWith(ORDER.p);
    expect(palette.list.querySelector(".cp-spinner")).toBeNull();
    vi.advanceTimersByTime(120);
    expect(palette.list.querySelector(".cp-spinner")).not.toBeNull();
  });

  it("blocks a second Enter while one navigation runs", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "routes");
    press("Enter");
    press("ArrowDown");
    press("Enter");

    expect(palette.navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it("gives up rather than covering the page forever", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "routes");
    press("Enter");
    vi.advanceTimersByTime(15000);

    expect(palette.open).toBe(false);
  });

  it("remembers what was chosen, so it leads an empty query next time", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "vehic");
    press("Enter");
    palette.closePalette();
    palette.openPalette();

    expect(highlighted(palette)).toBe("Vehicles");
  });
});

describe("shortcuts", () => {
  it("run a row while the palette is closed", () => {
    const palette = mount();
    press("g", { code: "KeyG" });
    press("r", { code: "KeyR" });

    expect(palette.navigation.navigate).toHaveBeenCalledWith("/routes");
    expect(palette.open).toBe(false);
  });

  it("are not typed into a text field", () => {
    const palette = mount();
    const field = document.createElement("input");
    document.body.appendChild(field);
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "g", code: "KeyG", bubbles: true }),
    );
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "r", code: "KeyR", bubbles: true }),
    );

    expect(palette.navigation.navigate).not.toHaveBeenCalled();
  });

  it("forget a sequence left unfinished for too long", () => {
    const palette = mount();
    press("g", { code: "KeyG" });
    vi.setSystemTime(Date.now() + 1500);
    press("r", { code: "KeyR" });

    expect(palette.navigation.navigate).not.toHaveBeenCalled();
  });

  it("show as keycaps on the row", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "routes");

    expect(
      [...palette.list.querySelectorAll(".cp-key")].map(
        (key: Element) => key.textContent,
      ),
    ).toEqual(["G", "R"]);
  });
});

describe("the shortcut list", () => {
  it("opens on ? with every row that has a shortcut", () => {
    const palette = mount([
      ...ENTRIES,
      { s: "pages", l: "Orders", p: "/orders", h: "g o" },
    ]);
    press("?", { code: "Slash", shiftKey: true });

    expect(palette.open).toBe(true);
    expect(palette.crumb.textContent).toBe("Keyboard shortcuts ›");
    expect(labels(palette)).toEqual(["Routes", "Orders"]);
  });

  it("opens from inside the palette too, when the box is empty", () => {
    const palette = mount();
    palette.openPalette();
    press("?", { code: "Slash", shiftKey: true });

    expect(palette.crumb.textContent).toBe("Keyboard shortcuts ›");
  });

  it("leaves a ? typed after other text to the search", () => {
    const palette = mount();
    palette.openPalette();
    palette.input.value = "what";
    const event = press("?", { code: "Slash", shiftKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(palette.levels).toHaveLength(0);
  });

  it("stays out of the way while typing in a field", () => {
    const palette = mount();
    const field = document.createElement("input");
    document.body.appendChild(field);
    field.dispatchEvent(
      new KeyboardEvent("keydown", { key: "?", bubbles: true }),
    );

    expect(palette.open).toBe(false);
  });

  it("is off when the app gives it no title", () => {
    const palette = mount();
    delete palette.el.dataset.shortcutsLabel;
    press("?", { code: "Slash", shiftKey: true });

    expect(palette.open).toBe(false);
  });
});

describe("copying", () => {
  it("puts the text on the clipboard and closes", () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const palette = mount([{ s: "orders", l: "Copy order id", y: "AB123" }]);
    palette.openPalette();
    press("Enter");

    expect(writeText).toHaveBeenCalledWith("AB123");
    expect(palette.open).toBe(false);
  });
});

describe("drawing", () => {
  it("uses the app's classes", () => {
    const palette = mount(ENTRIES, {
      classes: { row: "px-2 rounded", rowActive: "bg-surface-selected" },
    });
    palette.openPalette();
    const first = palette.list.querySelector('[role="option"]');

    expect(first.className).toContain("px-2 rounded");
    expect(first.className).toContain("bg-surface-selected");
  });

  it("marks a destructive row", () => {
    const palette = mount();
    palette.openPalette();
    type(palette, "delete");

    expect(palette.list.querySelector('[role="option"]').className).toContain(
      "cp-row-danger",
    );
  });

  it("drops an icon name that would break out of its attribute", () => {
    const palette = mount([
      { s: "pages", l: "Routes", p: "/r", i: 'x" onmouseover="alert(1)' },
    ]);
    palette.openPalette();

    expect(palette.list.innerHTML).not.toContain("onmouseover");
  });

  it("moves the highlight without replacing the rows", () => {
    const palette = mount();
    palette.openPalette();
    const before = [...palette.list.querySelectorAll('[role="option"]')];
    press("ArrowDown");
    const after = [...palette.list.querySelectorAll('[role="option"]')];

    expect(after).toEqual(before);
    expect(after[1].getAttribute("aria-selected")).toBe("true");
  });
});
