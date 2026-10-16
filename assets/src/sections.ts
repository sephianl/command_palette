import type { Result, SectionData } from "./types";

export interface Section {
  key: string;
  /** the server's description; absent for a key it did not list */
  data?: SectionData;
  rows: Result[];
}

/**
 * Rows grouped by section, the sections in the order the server listed them
 * and empty ones dropped. A section never moves because of what was typed, so
 * a row sits in the same place every time it is looked for; input order is
 * kept inside a section, so the scorer's ranking survives the grouping. A row
 * whose section the server did not list goes last rather than disappearing.
 */
export function sectionize(rows: Result[], order: SectionData[]): Section[] {
  const sections = new Map<string, Section>(
    order.map((data) => [data.k, { key: data.k, data, rows: [] }]),
  );

  for (const row of rows) {
    const key = row.entry.s;
    const section = sections.get(key) ?? { key, rows: [] };
    section.rows.push(row);
    sections.set(key, section);
  }

  return [...sections.values()].filter((section) => section.rows.length > 0);
}

/**
 * Where the highlight starts. With fixed sections the first row is only the
 * best answer in the first section that has one, so Enter would take a driver
 * whose name happens to contain "Amsterdam" over the Amsterdam depot.
 *
 * An exact server hit outranks anything scored here: it matched a code the
 * local scorer has never seen.
 */
export function bestIndex(rows: Result[], exact: Result[]): number {
  const leading = rows.findIndex((row) => exact.includes(row));
  if (leading !== -1) return leading;

  let best = 0;
  for (let index = 1; index < rows.length; index++) {
    if (rows[index].score > rows[best].score) best = index;
  }
  return best;
}
