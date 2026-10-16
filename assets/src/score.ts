import type { Entry, Mru, MruRecord, PreparedEntry, Result } from "./types";

/**
 * What the palette remembers a row as. A path with a volatile segment -- one
 * that embeds today's date -- sends an explicit `m`, so recency survives it.
 */
export function keyOf(entry: Entry): string {
  return entry.m ?? entry.p ?? entry.e ?? entry.w ?? entry.y ?? entry.l;
}

const SEPARATORS = new Set([" ", "-", "_", "/", ".", ",", "(", ")", "?", "="]);

const MATCH = 4;
const BONUS_START = 10;
const BONUS_BOUNDARY = 8;
const BONUS_CAMEL = 6;
const BONUS_CONSECUTIVE = 6;
const PENALTY_GAP_START = -3;
const PENALTY_GAP_EXTEND = -1;
const PENALTY_LENGTH = 0.1;

const WEIGHT_LABEL = 1;
const WEIGHT_GROUP = 0.6;
const WEIGHT_KEYWORDS = 0.6;

/** Recency half-life. Beyond this a frequently used row stops winning ties. */
const MRU_DECAY_DAYS = 14;
const MRU_MAX_COUNT = 10;
const MRU_WEIGHT = 2;

/**
 * Handicap on a ranked server hit. A driver named "Wissel chauffeur Amsterdam"
 * matches "amsterdam" nearly as well as the Amsterdam depot does, but the
 * depot is what someone typing a place name is after. A weight rather than a
 * flat penalty, so a short query that names a person outright still finds
 * them above a page it only scatters across.
 */
const WEIGHT_RANKED = 0.9;

const DAY_MS = 86_400_000;

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function prepare(entries: Entry[]): PreparedEntry[] {
  return entries.map((entry) => ({
    entry,
    label: normalize(entry.l),
    group: entry.g ? normalize(entry.g) : "",
    keywords: entry.k ? normalize(entry.k) : "",
    aliases: entry.a ? normalize(entry.a) : "",
  }));
}

/**
 * Cheap rejection before the scoring pass. Most rows fail this on any query
 * longer than a character or two, which is what keeps filtering off the
 * critical path.
 */
function isSubsequence(query: string, text: string): boolean {
  let q = 0;
  for (let i = 0; i < text.length && q < query.length; i++) {
    if (text[i] === query[q]) q++;
  }
  return q === query.length;
}

function charBonus(original: string, lower: string, i: number): number {
  if (i === 0) return BONUS_START;
  const prev = original[i - 1];
  if (SEPARATORS.has(prev)) return BONUS_BOUNDARY;
  if (prev === lower[i - 1] && original[i] !== lower[i]) return BONUS_CAMEL;
  return 0;
}

function gapPenalty(gap: number): number {
  return PENALTY_GAP_START + PENALTY_GAP_EXTEND * (gap - 1);
}

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
export function scoreField(
  query: string,
  original: string,
  lower: string,
): FieldMatch | null {
  const m = query.length;
  const n = lower.length;

  if (m === 0 || m > n) return null;
  if (!isSubsequence(query, lower)) return null;

  const NEG = -Infinity;
  let prev = new Float64Array(n).fill(NEG);
  const parents: Int32Array[] = [];

  for (let j = 0; j < n; j++) {
    if (lower[j] === query[0]) prev[j] = MATCH + charBonus(original, lower, j);
  }

  for (let i = 1; i < m; i++) {
    const curr = new Float64Array(n).fill(NEG);
    const parent = new Int32Array(n).fill(-1);

    for (let j = i; j < n; j++) {
      if (lower[j] !== query[i]) continue;

      let best = NEG;
      let bestK = -1;
      for (let k = i - 1; k < j; k++) {
        if (prev[k] === NEG) continue;
        const adjacency =
          k === j - 1 ? BONUS_CONSECUTIVE : gapPenalty(j - k - 1);
        const candidate = prev[k] + adjacency;
        if (candidate > best) {
          best = candidate;
          bestK = k;
        }
      }

      if (bestK !== -1) {
        curr[j] = best + MATCH + charBonus(original, lower, j);
        parent[j] = bestK;
      }
    }

    parents.push(parent);
    prev = curr;
  }

  let best = NEG;
  let end = -1;
  for (let j = 0; j < n; j++) {
    if (prev[j] > best) {
      best = prev[j];
      end = j;
    }
  }
  if (end === -1) return null;

  const indices: number[] = [end];
  let j = end;
  for (let i = parents.length - 1; i >= 0; i--) {
    j = parents[i][j];
    indices.push(j);
  }
  indices.reverse();

  return { score: best - n * PENALTY_LENGTH, ranges: toRanges(indices) };
}

function toRanges(indices: number[]): [number, number][] {
  const ranges: [number, number][] = [];
  for (const i of indices) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === i) last[1] = i + 1;
    else ranges.push([i, i + 1]);
  }
  return ranges;
}

/** Overlapping or touching ranges from several terms, folded into one set. */
function mergeRanges(ranges: [number, number][]): [number, number][] {
  if (ranges.length <= 1) return ranges;

  const sorted = ranges
    .map(([start, end]): [number, number] => [start, end])
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [sorted[0]];

  for (const [start, end] of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  return merged;
}

export function mruBonus(record: MruRecord | undefined, now: number): number {
  if (!record) return 0;
  const ageDays = Math.max(0, (now - record.t) / DAY_MS);
  const decay = Math.exp(-ageDays / MRU_DECAY_DAYS);
  return Math.min(record.n, MRU_MAX_COUNT) * MRU_WEIGHT * decay;
}

/**
 * The best one term does against a row, across its fields. The label in the
 * app's other languages is still the row's name, so it scores as the label;
 * only the label's own match is highlighted, since it is the text on screen.
 */
function scoreTerm(term: string, prepared: PreparedEntry): FieldMatch | null {
  const { entry } = prepared;

  const label = scoreField(term, entry.l, prepared.label);
  const group = prepared.group
    ? scoreField(term, entry.g!, prepared.group)
    : null;
  const keywords = prepared.keywords
    ? scoreField(term, entry.k!, prepared.keywords)
    : null;
  const aliases = prepared.aliases
    ? scoreField(term, entry.a!, prepared.aliases)
    : null;

  const score = Math.max(
    label ? label.score * WEIGHT_LABEL : -Infinity,
    group ? group.score * WEIGHT_GROUP : -Infinity,
    keywords ? keywords.score * WEIGHT_KEYWORDS : -Infinity,
    aliases ? aliases.score * WEIGHT_LABEL : -Infinity,
  );

  return score === -Infinity
    ? null
    : { score, ranges: label ? label.ranges : [] };
}

/**
 * Terms are matched one at a time and every one must land somewhere, rather
 * than the query being matched whole with its spaces as literal characters.
 * Whole-query matching makes a space something the text has to contain in the
 * right place, so "sf ord" found "Transferorders" but not "Inkomende orders",
 * where the same two fragments sit either side of the wrong gap. Terms may
 * land in different fields, which lets a query name a thing and qualify it in
 * one breath.
 */
export function scoreEntry(
  terms: string[],
  prepared: PreparedEntry,
  mru: Mru,
  now: number,
): Result | null {
  const { entry } = prepared;

  let score = 0;
  let ranges: [number, number][] = [];

  for (const term of terms) {
    const match = scoreTerm(term, prepared);
    if (!match) return null;

    score += match.score;
    ranges = ranges.concat(match.ranges);
  }

  return {
    entry,
    score:
      score * (entry.r ? WEIGHT_RANKED : 1) + mruBonus(mru[keyOf(entry)], now),
    ranges: mergeRanges(ranges),
  };
}

export function terms(query: string): string[] {
  return normalize(query.trim()).split(/\s+/).filter(Boolean);
}

/**
 * An empty query lists recently used rows first, then the order the server
 * gave -- the palette should open onto something useful, not an empty box.
 */
export function search(
  query: string,
  entries: PreparedEntry[],
  mru: Mru = {},
  now: number = Date.now(),
): Result[] {
  const typed = terms(query);

  if (typed.length === 0) {
    return entries
      .map((prepared, index) => ({
        entry: prepared.entry,
        score: mruBonus(mru[keyOf(prepared.entry)], now) - index * 0.001,
        ranges: [] as [number, number][],
      }))
      .sort((a, b) => b.score - a.score);
  }

  const results: Result[] = [];
  for (const prepared of entries) {
    const result = scoreEntry(typed, prepared, mru, now);
    if (result) results.push(result);
  }

  return results.sort(
    (a, b) => b.score - a.score || a.entry.l.length - b.entry.l.length,
  );
}
