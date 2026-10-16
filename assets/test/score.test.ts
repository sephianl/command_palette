import { describe, expect, it } from "vitest";
import {
  keyOf,
  mruBonus,
  normalize,
  prepare,
  scoreField,
  search,
} from "../src/score";
import type { Entry } from "../src/types";

const NOW = 1_755_091_200_000;

const ENTRIES: Entry[] = [
  { s: "pages", p: "/", l: "Map", g: "" },
  { s: "pages", p: "/routes", l: "Routes", g: "" },
  { s: "pages", p: "/overview", l: "Overview", g: "" },
  { s: "pages", p: "/orders/list", l: "Orders", g: "" },
  { s: "pages", p: "/parcels/list", l: "Parcels", g: "" },
  { s: "pages", p: "/vehicles/list", l: "Vehicles", g: "Administration" },
  {
    s: "pages",
    p: "/vehicletypes/list",
    l: "Vehicle Types",
    g: "Administration",
  },
  {
    s: "pages",
    p: "/company/config",
    l: "Company configurations",
    g: "Administration",
  },
  { s: "pages", p: "/users/list", l: "Users", g: "Administration" },
  { s: "pages", p: "/upload_file", l: "Upload file", g: "Intake" },
];

const prepared = prepare(ENTRIES);

function top(query: string, limit = 1): string[] {
  return search(query, prepared, {}, NOW)
    .slice(0, limit)
    .map((result) => result.entry.l);
}

describe("normalize", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalize("Réordered")).toBe("reordered");
    expect(normalize("VOERTUIGEN")).toBe("voertuigen");
  });
});

describe("scoreField", () => {
  it("returns null when the query is not a subsequence", () => {
    expect(scoreField("xyz", "Routes", "routes")).toBeNull();
  });

  it("returns null when the query is longer than the text", () => {
    expect(scoreField("routestoolong", "Routes", "routes")).toBeNull();
  });

  it("reports the matched ranges, merging adjacent characters", () => {
    const match = scoreField("rou", "Routes", "routes");
    expect(match?.ranges).toEqual([[0, 3]]);
  });

  it("reports split ranges for a scattered match", () => {
    const match = scoreField("uf", "Upload file", "upload file");
    expect(match?.ranges).toEqual([
      [0, 1],
      [7, 8],
    ]);
  });

  it("scores a prefix match above a mid-word match", () => {
    const prefix = scoreField("or", "Orders", "orders")!;
    const middle = scoreField("or", "Vendor", "vendor")!;
    expect(prefix.score).toBeGreaterThan(middle.score);
  });

  it("scores consecutive characters above scattered ones", () => {
    const consecutive = scoreField("com", "Company", "company")!;
    const scattered = scoreField(
      "com",
      "Curious Omen Mist",
      "curious omen mist",
    )!;
    expect(consecutive.score).toBeGreaterThan(scattered.score);
  });

  it("prefers word boundaries, picking the second word's initial", () => {
    const match = scoreField(
      "cc",
      "Company configurations",
      "company configurations",
    );
    expect(match?.ranges).toEqual([
      [0, 1],
      [8, 9],
    ]);
  });
});

describe("search", () => {
  it("ranks an exact prefix first", () => {
    expect(top("rou")).toEqual(["Routes"]);
    expect(top("over")).toEqual(["Overview"]);
    expect(top("parc")).toEqual(["Parcels"]);
  });

  it("matches initials across words", () => {
    expect(top("cc")).toEqual(["Company configurations"]);
  });

  it("handles abbreviated queries", () => {
    expect(top("ovw")).toEqual(["Overview"]);
    expect(top("veh")).toEqual(["Vehicles"]);
  });

  it("prefers the shorter label when both match a prefix", () => {
    expect(top("vehicle")).toEqual(["Vehicles"]);
  });

  it("excludes entries the query cannot match", () => {
    const labels = search("zzzz", prepared, {}, NOW);
    expect(labels).toEqual([]);
  });

  it("matches on the group when the label does not", () => {
    const labels = search("admin", prepared, {}, NOW).map((r) => r.entry.l);
    expect(labels).toContain("Vehicles");
    expect(labels).not.toContain("Map");
  });

  it("matches on keywords when supplied", () => {
    const withKeywords = prepare([
      {
        s: "pages",
        p: "/vehicles/list",
        l: "Vehicles",
        g: "",
        k: "voertuigen",
      },
    ]);
    expect(search("voert", withKeywords, {}, NOW)).toHaveLength(1);
  });

  it("scores the label in another language as a label, not a keyword", () => {
    const [page, driver] = search(
      "driver",
      prepare([
        {
          s: "pages",
          p: "/users/list?tab=drivers",
          l: "Chauffeurs",
          g: "",
          a: "Drivers",
        },
        {
          s: "pages",
          p: "/user/u1/edit",
          l: "Amsterdam Driver",
          g: "Chauffeur",
          r: true,
        },
      ]),
      {},
      NOW,
    );

    expect(page.entry.l).toBe("Chauffeurs");
    expect(page.score).toBeGreaterThan(driver.score);
  });

  it("matches every word of the query on its own, wherever it lands", () => {
    const [hit] = search(
      "ams wis",
      prepare([
        { s: "drivers", p: "/u/1", l: "Wissel chauffeur Amsterdam" },
        { s: "pages", p: "/w", l: "Wissel" },
      ]),
      {},
      NOW,
    );

    expect(hit.entry.l).toBe("Wissel chauffeur Amsterdam");
    expect(hit.ranges).toEqual([
      [0, 3],
      [17, 20],
    ]);
  });

  it("drops a row one word of the query cannot match", () => {
    expect(top("vehic zzz")).toEqual([]);
  });

  it("discounts a ranked hit against the same row unranked", () => {
    const row: Entry = { s: "drivers", p: "/u/1", l: "Vic Hendriks" };
    const [plain] = search("vic", prepare([row]), {}, NOW);
    const [ranked] = search("vic", prepare([{ ...row, r: true }]), {}, NOW);

    expect(ranked.score).toBeCloseTo(plain.score * 0.9);
  });

  it("ignores keywords when absent, without erroring", () => {
    expect(search("voert", prepared, {}, NOW)).toEqual([]);
  });

  it("returns empty-query results in registry order", () => {
    const labels = search("", prepared, {}, NOW).map((r) => r.entry.l);
    expect(labels.slice(0, 3)).toEqual(["Map", "Routes", "Overview"]);
  });

  it("floats recently used entries to the top of an empty query", () => {
    const mru = { "/users/list": { n: 5, t: NOW } };
    const labels = search("", prepared, mru, NOW).map((r) => r.entry.l);
    expect(labels[0]).toBe("Users");
  });

  it("breaks ties by recency without overriding a clearly better match", () => {
    const mru = { "/parcels/list": { n: 10, t: NOW } };
    expect(top("rou")).toEqual(["Routes"]);
    expect(search("rou", prepared, mru, NOW)[0].entry.l).toBe("Routes");
  });

  it("trims whitespace around the query", () => {
    expect(top("  rou  ")).toEqual(["Routes"]);
  });
});

describe("mruBonus", () => {
  it("is zero for an unseen entry", () => {
    expect(mruBonus(undefined, NOW)).toBe(0);
  });

  it("decays with age", () => {
    const fresh = mruBonus({ n: 5, t: NOW }, NOW);
    const old = mruBonus({ n: 5, t: NOW - 30 * 86_400_000 }, NOW);
    expect(fresh).toBeGreaterThan(old);
    expect(old).toBeGreaterThan(0);
  });

  it("saturates so a single entry cannot dominate forever", () => {
    const many = mruBonus({ n: 1000, t: NOW }, NOW);
    const ten = mruBonus({ n: 10, t: NOW }, NOW);
    expect(many).toBe(ten);
  });
});

describe("keyOf", () => {
  it("uses the path when no recency key is given", () => {
    expect(keyOf({ s: "pages", p: "/routes", l: "Routes" })).toBe("/routes");
  });

  it("prefers an explicit recency key over a volatile path", () => {
    const antwerp: Entry = {
      s: "depots",
      p: "/map/2026-08-13/abc",
      l: "Antwerpen",
      m: "depot:abc",
    };
    expect(keyOf(antwerp)).toBe("depot:abc");
    expect(keyOf({ ...antwerp, p: "/map/2026-08-14/abc" })).toBe("depot:abc");
  });

  it("falls back to the event name for a pathless action", () => {
    expect(keyOf({ s: "page", e: "reoptimize_route", l: "Reoptimize" })).toBe(
      "reoptimize_route",
    );
  });

  it("falls back to the window event name for a dispatching row", () => {
    expect(keyOf({ s: "commands", w: "app:theme", l: "Dark theme" })).toBe(
      "app:theme",
    );
  });
});

describe("contextual actions", () => {
  const ACTIONS: Entry[] = [
    {
      s: "depots",
      p: "/map/2026-08-13/abc",
      l: "Antwerpen",
      g: "Switch depot",
      m: "depot:abc",
    },
    {
      s: "pages",
      p: "/map/2026-08-13/def",
      l: "Gent",
      g: "Switch depot",
      m: "depot:def",
    },
    {
      s: "page",
      e: "reoptimize_route",
      v: { route_id: "r1" },
      l: "Reoptimize this route",
      g: "Route",
    },
  ];

  const withActions = prepare([...ACTIONS, ...ENTRIES]);

  function best(query: string, mru = {}): string {
    return search(query, withActions, mru, NOW)[0].entry.l;
  }

  it("matches an action by its label", () => {
    expect(best("antw")).toBe("Antwerpen");
  });

  it("matches an action by its group", () => {
    const labels = search("switch depot", withActions, {}, NOW)
      .slice(0, 2)
      .map((result) => result.entry.l)
      .sort();
    expect(labels).toEqual(["Antwerpen", "Gent"]);
  });

  it("leads with actions on an empty query", () => {
    expect(search("", withActions, {}, NOW)[0].entry.l).toBe("Antwerpen");
  });

  it("carries recency across a changed date via the recency key", () => {
    const mru = { "depot:def": { n: 8, t: NOW } };
    const tomorrow = prepare(
      ACTIONS.map((action) =>
        action.p
          ? { ...action, p: action.p.replace("08-13", "08-14") }
          : action,
      ),
    );
    expect(search("", tomorrow, mru, NOW)[0].entry.l).toBe("Gent");
  });

  it("scores a pathless event action like any other entry", () => {
    expect(best("reopt")).toBe("Reoptimize this route");
  });
});
