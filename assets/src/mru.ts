import type { Mru } from "./types";

const LIMIT = 40;

export function readMru(key: string): Mru {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "{}") as Mru;
  } catch {
    return {};
  }
}

/** Counts one more use of `row` and keeps only the most recent rows. */
export function recordUse(key: string, row: string, now: number): void {
  const mru = readMru(key);
  const record = mru[row];
  mru[row] = { n: (record?.n || 0) + 1, t: now };

  try {
    window.localStorage.setItem(key, JSON.stringify(prune(mru)));
  } catch {
    /* private mode, quota -- recency is a nicety, never a failure */
  }
}

function prune(mru: Mru): Mru {
  const rows = Object.keys(mru);
  if (rows.length <= LIMIT) return mru;

  const kept = rows.sort((a, b) => mru[b].t - mru[a].t).slice(0, LIMIT);
  return Object.fromEntries(kept.map((row) => [row, mru[row]]));
}
