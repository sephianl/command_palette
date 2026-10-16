import type { Entry, Mru, MruRecord, PreparedEntry, Result } from "./types";
/**
 * What the palette remembers a row as. A path with a volatile segment -- one
 * that embeds today's date -- sends an explicit `m`, so recency survives it.
 */
export declare function keyOf(entry: Entry): string;
export declare function normalize(text: string): string;
export declare function prepare(entries: Entry[]): PreparedEntry[];
interface FieldMatch {
    score: number;
    ranges: [number, number][];
}
/**
 * Subsequence match scored by *how* it matched: runs of adjacent characters
 * and hits on word boundaries beat scattered ones. Exhaustive rather than
 * greedy, so "cc" prefers "Company Configurations" over the first two c's it
 * stumbles across. Cheap enough at this size not to be worth approximating.
 *
 * `original` drives the boundary and camelCase bonuses; `lower` must be its
 * normalized form and is what actually gets matched.
 */
export declare function scoreField(query: string, original: string, lower: string): FieldMatch | null;
export declare function mruBonus(record: MruRecord | undefined, now: number): number;
/**
 * Terms are matched one at a time and every one must land somewhere, rather
 * than the query being matched whole with its spaces as literal characters.
 * Whole-query matching makes a space something the text has to contain in the
 * right place, so "sf ord" found "Transferorders" but not "Inkomende orders",
 * where the same two fragments sit either side of the wrong gap. Terms may
 * land in different fields, which lets a query name a thing and qualify it in
 * one breath.
 */
export declare function scoreEntry(terms: string[], prepared: PreparedEntry, mru: Mru, now: number): Result | null;
export declare function terms(query: string): string[];
/**
 * An empty query lists recently used rows first, then the order the server
 * gave -- the palette should open onto something useful, not an empty box.
 */
export declare function search(query: string, entries: PreparedEntry[], mru?: Mru, now?: number): Result[];
export {};
