/**
 * One row as the server encodes it (`CommandPalette.Wire`). Keys that carry
 * no information are left out, so every key but `l` and `s` is optional.
 */
export interface Entry {
  /** label */
  l: string;
  /** section key */
  s: string;
  /** path, for a redirect or a patch */
  p?: string;
  /** link kind: "patch", or absent for a redirect */
  x?: string;
  /** LiveView event name */
  e?: string;
  /** window event name */
  w?: string;
  /** text to put on the clipboard */
  y?: string;
  /** event params, or a window event's detail */
  v?: Record<string, unknown>;
  /** group, the muted text after the label */
  g?: string;
  /** icon class; absent on a row that takes its section's */
  i?: string;
  /** keywords, space separated */
  k?: string;
  /** the label in the app's other languages, scored as the label */
  a?: string;
  /** trailing detail */
  d?: string;
  /** recency key, when the path is too volatile to remember a row by */
  m?: string;
  /** shortcut: chords separated by spaces, e.g. "g i" or "mod+shift+p" */
  h?: string;
  /** tone: "danger" */
  t?: string;
  /** children: the list this row opens */
  c?: Entry[];
  /** row actions, under → */
  o?: Entry[];
  /** a search hit that matched only part of the query */
  r?: boolean;
  /** shown only when nothing else matches */
  f?: boolean;
}

/** A section as the server encodes it, in the order sections are drawn. */
export interface SectionData {
  /** key, matching an entry's `s` */
  k: string;
  /** heading; a section without one draws none */
  l?: string;
  /** icon for its rows that have none */
  i?: string;
}

/** An entry with its fields normalized once, at load, rather than per keystroke. */
export interface PreparedEntry {
  entry: Entry;
  label: string;
  group: string;
  keywords: string;
  aliases: string;
}

export interface Result {
  entry: Entry;
  score: number;
  /** [start, end) ranges into entry.l, empty when the label itself did not match */
  ranges: [number, number][];
}

export interface MruRecord {
  /** times chosen */
  n: number;
  /** last chosen, epoch ms */
  t: number;
}

export type Mru = Record<string, MruRecord>;
