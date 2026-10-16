import { describe, expect, it } from "vitest";
import { bestIndex, sectionize } from "../src/sections";
import type { Section } from "../src/sections";
import type { Result, SectionData } from "../src/types";

const ORDER: SectionData[] = [
  { k: "pages", l: "Pages" },
  { k: "depots", l: "Depots" },
  { k: "orders", l: "Orders" },
  { k: "drivers", l: "Drivers" },
  { k: "page", l: "This page" },
];

function row(s: string, label: string, score = 0): Result {
  return { entry: { l: label, s }, score, ranges: [] };
}

function keys(sections: Section[]): string[] {
  return sections.map((section) => section.key);
}

function labels(sections: Section[]): string[] {
  return sections.flatMap((section) => section.rows.map((r) => r.entry.l));
}

describe("sectionize", () => {
  it("draws the sections in the server's order, whatever order the rows arrive in", () => {
    const sections = sectionize(
      [
        row("drivers", "Vic Hendriks"),
        row("page", "Reoptimize this route"),
        row("orders", "AB123"),
        row("depots", "Gent"),
        row("pages", "Vehicles"),
      ],
      ORDER,
    );

    expect(keys(sections)).toEqual([
      "pages",
      "depots",
      "orders",
      "drivers",
      "page",
    ]);
  });

  it("leaves out a section nothing matched", () => {
    expect(keys(sectionize([row("pages", "Vehicles")], ORDER))).toEqual([
      "pages",
    ]);
  });

  it("keeps the scorer's ranking within a section", () => {
    const sections = sectionize(
      [row("pages", "Vehicles", 20), row("pages", "Routes", 10)],
      ORDER,
    );

    expect(labels(sections)).toEqual(["Vehicles", "Routes"]);
  });

  it("never mixes a higher-scoring row into an earlier section", () => {
    const sections = sectionize(
      [
        row("drivers", "Wissel chauffeur Amsterdam", 99),
        row("depots", "Amsterdam", 1),
      ],
      ORDER,
    );

    expect(labels(sections)).toEqual([
      "Amsterdam",
      "Wissel chauffeur Amsterdam",
    ]);
  });

  it("puts a section the server did not list after the listed ones", () => {
    const sections = sectionize(
      [row("mystery", "Mystery"), row("page", "Reoptimize")],
      ORDER,
    );

    expect(keys(sections)).toEqual(["page", "mystery"]);
  });
});

describe("bestIndex", () => {
  it("highlights the best row, not the first one", () => {
    const rows = [row("pages", "Vehicles", 10), row("drivers", "Vic", 99)];

    expect(bestIndex(rows, [])).toBe(1);
  });

  it("prefers an exact server hit over anything scored locally", () => {
    const hit = row("routes", "AMS01");
    const rows = [row("depots", "Amsterdam", 99), hit];

    expect(bestIndex(rows, [hit])).toBe(1);
  });

  it("keeps the earlier row when two score the same", () => {
    const rows = [row("pages", "Routes", 5), row("depots", "Gent", 5)];

    expect(bestIndex(rows, [])).toBe(0);
  });
});
