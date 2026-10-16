// The tests of the palette this package was extracted from, ported so the
// package provably keeps the behaviour that palette shipped with. Test names
// and the intent of every assertion are the original's; only the wiring
// follows the package's API.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCommandPalette } from "../src/hook";
import type { Entry, SectionData } from "../src/types";

const ENTRIES: Entry[] = [
  { s: "pages", p: "/routes", l: "Routes", g: "" },
  { s: "pages", p: "/vehicles/list", l: "Vehicles", g: "Administration" },
];

const ACTIONS: Entry[] = [
  {
    s: "depots",
    p: "/map/2026-08-13/d2",
    l: "Gent",
    g: "Switch depot",
    m: "depot:d2",
    x: "patch",
  },
  {
    s: "page",
    e: "reoptimize_route",
    v: { route_id: "r1" },
    l: "Reoptimize this route",
    g: "Route",
  },
];

const SECTIONS: SectionData[] = [
  { k: "pages", l: "Pages" },
  { k: "depots", l: "Depots", i: "icon-depot" },
  { k: "orders", l: "Orders", i: "icon-order" },
  { k: "drivers", l: "Drivers", i: "icon-driver" },
  { k: "routes", l: "Routes", i: "icon-route_count" },
  { k: "page", l: "This page" },
  { k: "fallback", i: "hero-magnifying-glass" },
];

// The hook's methods are written against `this`, so a prototype-linked object
// stands in for what LiveView constructs at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestHook = any;

let hook: TestHook = null;

function mount(
  entries: unknown = [...ENTRIES, ...ACTIONS],
  sections: unknown = SECTIONS,
): TestHook {
  const json = (value: unknown) =>
    typeof value === "string" ? value : JSON.stringify(value);

  document.body.innerHTML = `
    <div id="command-palette" hidden
         data-entries='${json(entries)}'
         data-sections='${json(sections)}'
         data-user-id="u1"
         data-opening-label="Opening…">
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
  hook = Object.create(createCommandPalette());
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

function labelsOf(results: { entry: Entry }[]): string[] {
  return results.map((result) => result.entry.l);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  if (hook) hook.destroyed();
  hook = null;
  vi.useRealTimers();
});

describe("loadEntries", () => {
  it("lists navigation entries ahead of contextual actions", () => {
    expect(labelsOf(mount().entries)).toEqual([
      "Routes",
      "Vehicles",
      "Gent",
      "Reoptimize this route",
    ]);
  });

  it("survives a malformed payload rather than breaking the palette", () => {
    expect(labelsOf(mount("{oops", "[").entries)).toEqual([]);
  });

  // Adapted: entries and actions now share one attribute, so the payload that
  // can break on its own is the sections list.
  it("keeps the entries when only the sections payload is broken", () => {
    const palette = mount([...ENTRIES, ...ACTIONS], "nonsense");
    palette.openPalette();

    expect(labelsOf(palette.entries)).toEqual([
      "Routes",
      "Vehicles",
      "Gent",
      "Reoptimize this route",
    ]);
    expect(labelsOf(palette.results)).toEqual([
      "Routes",
      "Vehicles",
      "Gent",
      "Reoptimize this route",
    ]);
  });
});

describe("rendering a result row", () => {
  function renderQuery(query: string): HTMLElement {
    const palette = mount();
    palette.openPalette();
    palette.input.value = query;
    palette.render();
    return palette.list;
  }

  it("renders a patch action as an anchor LiveView will live-patch", () => {
    const anchor = renderQuery("Gent").querySelector("a");

    expect(anchor?.getAttribute("href")).toBe("/map/2026-08-13/d2");
    expect(anchor?.getAttribute("data-phx-link")).toBe("patch");
  });

  it("renders an ordinary entry as a redirecting anchor", () => {
    const anchor = renderQuery("routes").querySelector("a");

    expect(anchor?.getAttribute("data-phx-link")).toBe("redirect");
  });

  it("keeps a partly highlighted label in one flex item, so its spaces survive", () => {
    const palette = mount([
      {
        s: "pages",
        p: "/orders/list?planning=delegated",
        l: "Delegated orders",
        g: "",
      },
    ]);
    palette.openPalette();
    palette.input.value = "delegated";
    palette.render();

    const label = palette.list.querySelector("a > span:not([aria-hidden])")!;

    expect(label.querySelector("mark")?.textContent).toBe("Delegated");
    expect(label.textContent).toBe("Delegated orders");
  });

  it("renders an event action as a button, having nowhere to link to", () => {
    const list = renderQuery("reopt");

    expect(list.querySelector("button")).not.toBeNull();
    expect(list.querySelector("a")).toBeNull();
  });

  it("renders the trailing detail, which is what tells repeated labels apart", () => {
    const palette = mount();
    palette.openPalette();
    palette.seq = 1;
    palette.handlers["palette:results"]({
      seq: 1,
      entries: [
        {
          s: "routes",
          p: "/map/2027-03-17/d1/r1",
          l: "AB312",
          g: "Route",
          d: "17 March",
        },
      ],
      hint: null,
    });

    expect(palette.list.textContent).toContain("17 March");
  });

  it("escapes the detail rather than trusting the payload", () => {
    const palette = mount();
    palette.openPalette();
    palette.seq = 1;
    palette.handlers["palette:results"]({
      seq: 1,
      entries: [
        { s: "routes", p: "/x", l: "AB312", g: "Route", d: "<img src=x>" },
      ],
      hint: null,
    });

    expect(palette.list.querySelector("img")).toBeNull();
  });
});

describe("the hint line", () => {
  // A query no local entry matches, so the results really are empty. An empty
  // query lists everything, which would leave the empty branch untested.
  function reply(hint: string | null, entries: Entry[] = []): TestHook {
    const palette = mount();
    palette.openPalette();
    palette.input.value = "zzqqxx";
    palette.seq = 1;
    palette.handlers["palette:results"]({ seq: 1, entries, hint });
    return palette;
  }

  it("speaks even when the search found nothing to show", () => {
    const palette = reply("No routes within 8 weeks of 10 March · 1 outside");

    expect(palette.hint.hidden).toBe(false);
    expect(palette.hint.textContent).toBe(
      "No routes within 8 weeks of 10 March · 1 outside",
    );
  });

  it("stands in for the generic empty message rather than stacking above it", () => {
    const palette = reply("Within 8 weeks of 10 March · 2 outside");

    expect(palette.empty.hidden).toBe(true);
  });

  it("leaves the empty message alone when there is nothing to add", () => {
    const palette = reply(null);

    expect(palette.empty.hidden).toBe(false);
    expect(palette.hint.hidden).toBe(true);
  });

  it("goes away as soon as the query changes, having explained the old one", () => {
    const palette = reply("Within 8 weeks of 10 March");

    type(palette, "zzqqxxy");

    expect(palette.hint.hidden).toBe(true);
  });

  it("goes away on close, so it never explains a query from minutes ago", () => {
    const palette = reply("Within 8 weeks of 10 March");
    palette.closePalette();

    expect(palette.hintText).toBeNull();
  });
});

describe("the search fallback", () => {
  const FALLBACK: Entry = {
    s: "page",
    p: "/orders/list?search=zzqqxx",
    l: "Search for “zzqqxx”",
    g: "Search this page",
    x: "patch",
    f: true,
  };

  function reply(query: string, entries: Entry[]): TestHook {
    const palette = mount();
    palette.openPalette();
    palette.input.value = query;
    palette.seq = 1;
    palette.handlers["palette:results"]({ seq: 1, entries, hint: null });
    return palette;
  }

  it("stands in when nothing else matches", () => {
    const palette = reply("zzqqxx", [FALLBACK]);

    expect(labelsOf(palette.results)).toEqual(["Search for “zzqqxx”"]);
  });

  it("stays out of the way when a local entry matches", () => {
    const palette = reply("vehic", [FALLBACK]);

    expect(labelsOf(palette.results)).toEqual(["Vehicles"]);
  });

  it("stays out of the way when the server found something", () => {
    const hit: Entry = { s: "routes", p: "/map/x", l: "AB312", g: "Route" };
    const palette = reply("zzqqxx", [FALLBACK, hit]);

    expect(labelsOf(palette.results)).toEqual(["AB312"]);
  });

  it("renders as a live patch of the current page", () => {
    const anchor = reply("zzqqxx", [FALLBACK]).list.querySelector("a");

    expect(anchor?.getAttribute("href")).toBe("/orders/list?search=zzqqxx");
    expect(anchor?.getAttribute("data-phx-link")).toBe("patch");
  });

  it("hides the empty message, since there is something to choose", () => {
    const palette = reply("zzqqxx", [FALLBACK]);

    expect(palette.empty.hidden).toBe(true);
  });

  it("goes the moment the query changes, so Enter never searches for older text", () => {
    const palette = reply("zzqqxx", [FALLBACK]);

    type(palette, "zzqqxxy");

    expect(palette.results).toEqual([]);
  });
});

describe("ranked server hits", () => {
  const DEPOT: Entry = {
    p: "/map/2026-08-13/d1",
    l: "Amsterdam",
    g: "Switch depot",
    m: "depot:d1",
    x: "patch",
    s: "depots",
  };
  const DRIVER: Entry = {
    p: "/user/u2/edit",
    l: "Wissel chauffeur Amsterdam",
    g: "Driver",
    s: "drivers",
    r: true,
  };
  const ROUTE: Entry = { p: "/map/x", l: "AMS01", g: "Route", s: "routes" };

  function reply(query: string, entries: Entry[]): TestHook {
    const palette = mount([...ENTRIES, DEPOT]);
    palette.openPalette();
    palette.input.value = query;
    palette.seq = 1;
    palette.handlers["palette:results"]({ seq: 1, entries, hint: null });
    return palette;
  }

  function highlighted(palette: TestHook): string {
    return palette.results[palette.selected].entry.l;
  }

  it("sit in their own section, below the depot they only partly match", () => {
    const palette = reply("amsterdam", [DRIVER]);

    expect(labelsOf(palette.results)).toEqual([
      "Amsterdam",
      "Wissel chauffeur Amsterdam",
    ]);
  });

  it("take the highlight from a page the query only scatters across", () => {
    const driver: Entry = {
      p: "/user/u3/edit",
      l: "Vic Hendriks",
      g: "Driver",
      s: "drivers",
      r: true,
    };
    const palette = reply("vic", [driver]);

    expect(labelsOf(palette.results)).toEqual(["Vehicles", "Vic Hendriks"]);
    expect(highlighted(palette)).toBe("Vic Hendriks");
  });

  it("leave the highlight on an exact id match, wherever its section is", () => {
    const palette = reply("amsterdam", [DRIVER, ROUTE]);

    expect(labelsOf(palette.results)).toEqual([
      "Amsterdam",
      "Wissel chauffeur Amsterdam",
      "AMS01",
    ]);
    expect(highlighted(palette)).toBe("AMS01");
  });
});

describe("row icons", () => {
  function iconOfRow(entry: Entry, actions: Entry[] = []): string | undefined {
    const palette = mount([entry, ...actions]);
    palette.openPalette();
    palette.input.value = entry.l;
    palette.render();
    return palette.list.querySelector('[role="option"] [aria-hidden="true"]')
      ?.className;
  }

  it("show a page's own icon", () => {
    expect(
      iconOfRow({
        s: "pages",
        p: "/routes",
        l: "Routes",
        g: "",
        i: "hero-map",
      }),
    ).toContain("hero-map");
  });

  it("fall back to their section's icon", () => {
    const palette = mount([]);
    palette.openPalette();
    palette.input.value = "wissel";
    palette.seq = 1;
    palette.handlers["palette:results"]({
      seq: 1,
      entries: [
        { p: "/user/u2/edit", l: "Wissel", g: "Driver", s: "drivers", r: true },
      ],
      hint: null,
    });

    expect(
      palette.list.querySelector('[role="option"] [aria-hidden="true"]')
        ?.className,
    ).toContain("icon-driver");
  });

  // Adapted: the slot is the package's `cp-icon` class, where the original sized it
  // with `w-4` inline.
  it("keep an empty slot when there is no icon, so labels stay aligned", () => {
    const className = iconOfRow({ s: "pages", p: "/x", l: "Routes", g: "" });

    expect(className).toContain("cp-icon");
    expect(className).not.toMatch(/\b(hero|icon)-/);
  });

  // Adapted: any plain class name is an icon now, not only the hero-/icon-
  // families, so only a name that would break out of its attribute is refused.
  it("refuse a name that would break out of its attribute, keeping a plain one", () => {
    const unsafe = iconOfRow({
      s: "pages",
      p: "/x",
      l: "Routes",
      g: "",
      i: 'x" onmouseover="alert(1)',
    });
    expect(unsafe).not.toContain("onmouseover");

    const plain = iconOfRow({
      s: "pages",
      p: "/x",
      l: "Routes",
      g: "",
      i: "fa-solid",
    });
    expect(plain).toContain("fa-solid");
  });
});

describe("the sidebar's search button", () => {
  it("opens the palette", () => {
    const palette = mount();

    window.dispatchEvent(new Event("phx:open-command-palette"));

    expect(palette.open).toBe(true);
  });

  it("never closes it, even when already open", () => {
    const palette = mount();
    palette.openPalette();

    window.dispatchEvent(new Event("phx:open-command-palette"));

    expect(palette.open).toBe(true);
  });
});

describe("sections", () => {
  it("draw pages, then depots, orders and drivers, whatever the scores", () => {
    const palette = mount([
      { s: "pages", p: "/depots", l: "Amsterdam depots", g: "" },
      {
        e: "nav-select-depot",
        l: "Amsterdam",
        g: "Switch depot",
        s: "depots",
      },
    ]);
    palette.openPalette();
    palette.input.value = "amsterdam";
    palette.seq = 1;
    palette.handlers["palette:results"]({
      seq: 1,
      entries: [
        {
          p: "/user/u2/edit",
          l: "Wissel chauffeur Amsterdam",
          g: "Driver",
          s: "drivers",
          r: true,
        },
        { p: "/map/o", l: "AMSTERDAM-1", g: "Order", s: "orders" },
      ],
      hint: null,
    });

    const headings = [
      ...palette.list.querySelectorAll('[role="presentation"]'),
    ].map((heading: Element) => heading.textContent);

    expect(headings).toEqual(["Pages", "Depots", "Orders", "Drivers"]);
  });

  it("keep what only this page offers below them", () => {
    const palette = mount();
    palette.openPalette();
    palette.render();

    expect(labelsOf(palette.results)).toEqual([
      "Routes",
      "Vehicles",
      "Gent",
      "Reoptimize this route",
    ]);
  });
});

describe("choose", () => {
  function chooseFirst(query: string): TestHook {
    const palette = mount();
    palette.openPalette();
    palette.input.value = query;
    palette.render();
    palette.choose();
    return palette;
  }

  it("pushes the page's own event name for an event action", () => {
    const palette = chooseFirst("reopt");

    expect(palette.pushEvent).toHaveBeenCalledWith("reoptimize_route", {
      route_id: "r1",
    });
  });

  it("does not push an event for a navigation entry", () => {
    expect(chooseFirst("routes").pushEvent).not.toHaveBeenCalled();
  });

  it("records recency under the explicit key, not the volatile path", () => {
    chooseFirst("Gent");

    const mru = JSON.parse(
      window.localStorage.getItem("command_palette:mru:u1")!,
    );
    expect(Object.keys(mru)).toEqual(["depot:d2"]);
  });
});

describe("moving the highlight", () => {
  function options(palette: TestHook): HTMLElement[] {
    return [...palette.list.querySelectorAll('[role="option"]')];
  }

  it("repaints on hover without replacing the row nodes", () => {
    const palette = mount();
    palette.openPalette();
    palette.render();
    palette.usingMouse = true;

    const [first, second] = options(palette);

    second.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));

    // Same nodes, only the highlight moved: a rebuild here would sever the
    // mousedown/mouseup a click is made of and leave the rows unclickable.
    expect(options(palette)[0]).toBe(first);
    expect(options(palette)[1]).toBe(second);
    expect(first.getAttribute("aria-selected")).toBe("false");
    expect(second.getAttribute("aria-selected")).toBe("true");
    expect(second.className).toContain("cp-row-active");
  });

  it("repaints on arrow navigation without replacing the row nodes", () => {
    const palette = mount();
    palette.openPalette();
    palette.render();

    const rows = options(palette);

    palette.move(1);

    expect(options(palette)).toEqual(rows);
    expect(rows[1].getAttribute("aria-selected")).toBe("true");
  });
});

describe("navigating to a chosen result", () => {
  // An empty query lists every entry, so there are neighbouring rows to assert
  // are disabled. Row 0 is the "Routes" link, row 2 the "Gent" patch action,
  // row 3 the event action.
  function commit(query = ""): TestHook {
    const palette = mount();
    palette.openPalette();
    palette.input.value = query;
    palette.render();
    palette.choose();
    return palette;
  }

  function pageLoadingStop(kind: string): void {
    window.dispatchEvent(
      new CustomEvent("phx:page-loading-stop", { detail: { kind } }),
    );
  }

  it("stays open, since closing on Enter is what left the user with nothing", () => {
    const palette = commit();

    expect(palette.open).toBe(true);
    expect(palette.el.hidden).toBe(false);
    expect(palette.el.getAttribute("aria-busy")).toBe("true");
    expect(palette.navigation.navigate).toHaveBeenCalledWith("/routes");
  });

  it("holds the spinner back on a patch, so an instant one never flashes", () => {
    const palette = commit("gent");

    expect(palette.navigation.patch).toHaveBeenCalledWith("/map/2026-08-13/d2");
    expect(palette.list.querySelector(".cp-spinner")).toBeNull();

    vi.advanceTimersByTime(120);

    expect(palette.list.querySelector(".cp-spinner")).not.toBeNull();
  });

  it("spins straight away on a redirect, which never gets to run a timer", () => {
    const palette = commit("routes");

    expect(palette.list.querySelector(".cp-spinner")).not.toBeNull();
  });

  // LiveView destroys the outgoing view as the redirect starts and only swaps
  // its DOM in when the new one joins, so the spinner has to already be there
  // and has to keep turning with no hook behind it.
  it("leaves the spinner on screen once LiveView tears the hook down", () => {
    const palette = commit("routes");

    palette.destroyed();

    expect(palette.list.querySelector(".cp-spinner")).not.toBeNull();
  });

  it("names what it is opening, which a spinner alone does not", () => {
    const palette = commit();
    vi.advanceTimersByTime(120);

    // Adapted: the spoken text is hidden with an inline style, not a class.
    expect(palette.list.querySelector('span[style*="clip"]')?.textContent).toBe(
      "Opening…",
    );
  });

  // Adapted: the original put `pointer-events-none` on every control; the package
  // marks each other row's <li> with its `cp-row-inert` class instead.
  it("disables every row, so a second Enter cannot stack a navigation", () => {
    const palette = commit();
    const rows = palette.list.querySelectorAll('[role="option"]');

    expect(rows.length).toBeGreaterThan(1);
    rows.forEach((row: Element, index: number) => {
      if (index === 0) return;
      expect(row.className).toContain("cp-row-inert");
    });

    // Busy, not disabled: it is the row doing the work. Row 3 is the event
    // action, which renders as a button rather than an anchor.
    expect(
      palette.list
        .querySelector('[data-index="0"] a')
        ?.getAttribute("aria-busy"),
    ).toBe("true");
    expect(
      palette.list
        .querySelector('[data-index="2"] a')
        ?.getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      palette.list
        .querySelector('[data-index="3"] button')
        ?.getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("ignores a second choice while one is already in flight", () => {
    const palette = commit();
    palette.selected = 1;
    palette.choose();

    expect(palette.navigating).toBe("/routes");
    expect(palette.navigation.navigate).toHaveBeenCalledTimes(1);
  });

  // Choosing bumps the row's recency, and the re-render that begins navigation
  // re-sorts on that bump -- floating the chosen row to the top of its
  // section. A commit keyed to a position would then click whatever entry
  // inherited the old slot.
  it("commits the row the user chose even when its bump re-sorts the list", () => {
    const palette = mount();
    palette.openPalette();
    palette.render();

    const vehicles = palette.results.findIndex(
      (result: { entry: Entry }) => result.entry.l === "Vehicles",
    );

    palette.selected = vehicles;
    palette.choose();

    // Vehicles has moved above Routes, so its old slot now holds another
    // entry -- yet the busy row and the navigation are still Vehicles.
    expect(labelsOf(palette.results)[vehicles - 1]).toBe("Vehicles");
    expect(palette.navigating).toBe("/vehicles/list");
    expect(palette.navigation.navigate).toHaveBeenCalledWith("/vehicles/list");
    const busy = palette.list.querySelector('[aria-busy="true"]');
    expect(busy?.closest("[data-key]")?.getAttribute("data-key")).toBe(
      "/vehicles/list",
    );
  });

  it("closes once the page it asked for is ready", () => {
    const palette = commit();

    pageLoadingStop("redirect");

    expect(palette.open).toBe(false);
    expect(palette.navigating).toBeNull();
  });

  it("ignores page loading that is not a navigation", () => {
    const palette = commit();

    pageLoadingStop("element");

    expect(palette.open).toBe(true);
  });

  it("gives up rather than covering the page forever", () => {
    const palette = commit();

    vi.advanceTimersByTime(15000);

    expect(palette.open).toBe(false);
  });

  it("keeps the spinner on the row the user chose when a reply lands late", () => {
    const palette = commit();
    palette.seq = 1;
    palette.handlers["palette:results"]({
      seq: 1,
      entries: [{ s: "orders", p: "/late", l: "Late hit", g: "Order" }],
      hint: null,
    });

    expect(palette.remote).toEqual([]);
    expect(labelsOf(palette.results)[0]).toBe("Routes");
  });

  it("still closes immediately for an event action, having nothing to await", () => {
    const palette = commit("reopt");

    expect(palette.open).toBe(false);
    expect(palette.pushEvent).toHaveBeenCalledWith("reoptimize_route", {
      route_id: "r1",
    });
  });
});

describe("resource search", () => {
  it("searches once typing settles, not once per keystroke", () => {
    const palette = mount();
    palette.input.value = "3SA";
    palette.scheduleSearch();
    palette.input.value = "3SAB";
    palette.scheduleSearch();
    vi.advanceTimersByTime(200);

    expect(palette.pushEvent).toHaveBeenCalledTimes(1);
    expect(palette.pushEvent).toHaveBeenCalledWith("palette_search", {
      q: "3SAB",
      seq: 1,
    });
  });

  it("stays off the socket below the minimum query length", () => {
    const palette = mount();
    palette.input.value = "3S";
    palette.scheduleSearch();
    vi.advanceTimersByTime(500);

    expect(palette.pushEvent).not.toHaveBeenCalled();
  });

  it("searches a short vehicle number, which is all digits", () => {
    const palette = mount();
    palette.input.value = "17";
    palette.scheduleSearch();
    vi.advanceTimersByTime(200);

    expect(palette.pushEvent).toHaveBeenCalledWith("palette_search", {
      q: "17",
      seq: 1,
    });
  });

  it("discards a reply that answers an earlier query", () => {
    const palette = mount();
    palette.seq = 5;

    palette.handlers["palette:results"]({
      seq: 4,
      entries: [{ s: "orders", p: "/stale", l: "Stale", g: "Order" }],
    });

    expect(palette.remote).toEqual([]);
  });

  it("keeps a reply that answers the current query", () => {
    const palette = mount();
    palette.seq = 5;

    palette.handlers["palette:results"]({
      seq: 5,
      entries: [{ s: "orders", p: "/fresh", l: "3SABC123", g: "Order" }],
    });

    expect(labelsOf(palette.remote)).toEqual(["3SABC123"]);
  });

  it("drops remote hits on close, so reopening never shows a stale query's results", () => {
    const palette = mount();
    palette.openPalette();
    palette.seq = 1;
    palette.handlers["palette:results"]({
      seq: 1,
      entries: [{ s: "orders", p: "/fresh", l: "3SABC123", g: "Order" }],
    });
    palette.closePalette();

    expect(palette.remote).toEqual([]);
  });
});
