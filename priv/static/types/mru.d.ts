import type { Mru } from "./types";
export declare function readMru(key: string): Mru;
/** Counts one more use of `row` and keeps only the most recent rows. */
export declare function recordUse(key: string, row: string, now: number): void;
