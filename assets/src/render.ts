import { keycaps } from "./keys";
import type { Entry } from "./types";

/**
 * The classes of everything the hook draws. They are written in the app's own
 * JS, where its CSS tooling sees them: Tailwind never scans `deps/`, so a
 * class named only inside this package would never be generated.
 */
export interface Classes {
  heading: string;
  row: string;
  rowActive: string;
  rowInert: string;
  rowDanger: string;
  control: string;
  icon: string;
  label: string;
  mark: string;
  group: string;
  detail: string;
  keys: string;
  key: string;
  more: string;
  chevron: string;
  spinner: string;
}

export const DEFAULT_CLASSES: Classes = {
  heading: "cp-heading",
  row: "cp-row",
  rowActive: "cp-row-active",
  rowInert: "cp-row-inert",
  rowDanger: "cp-row-danger",
  control: "cp-control",
  icon: "cp-icon",
  label: "cp-label",
  mark: "cp-mark",
  group: "cp-group",
  detail: "cp-detail",
  keys: "cp-keys",
  key: "cp-key",
  more: "cp-more",
  chevron: "cp-chevron",
  spinner: "cp-spinner",
};

/**
 * Read to a screen reader, never drawn: inline rather than a class, so it
 * holds whatever stylesheet the app does or does not load.
 */
const VISUALLY_HIDDEN =
  "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Class names from the payload, kept only when they are plain class names:
 * they land in an attribute, so a quote must never get through.
 */
export function safeClasses(names: string | undefined): string {
  if (!names) return "";
  return names
    .split(/\s+/)
    .filter((name) => /^[A-Za-z][\w:/.[\]-]*$/.test(name))
    .join(" ");
}

export function highlight(
  label: string,
  ranges: [number, number][],
  markClass: string,
): string {
  let html = "";
  let cursor = 0;
  for (const [start, end] of ranges) {
    html += escapeHtml(label.slice(cursor, start));
    html += `<mark class="${markClass}">${escapeHtml(label.slice(start, end))}</mark>`;
    cursor = end;
  }
  return html + escapeHtml(label.slice(cursor));
}

export function keycapsHtml(
  shortcut: string,
  apple: boolean,
  classes: Classes,
): string {
  const chords = keycaps(shortcut, apple)
    .map((caps) =>
      caps
        .map((cap) => `<kbd class="${classes.key}">${escapeHtml(cap)}</kbd>`)
        .join(""),
    )
    .join(" ");
  return `<span class="${classes.keys}" aria-hidden="true">${chords}</span>`;
}

export type RowState = "idle" | "busy" | "inert";

export interface RowView {
  id: string;
  index: number;
  key: string;
  entry: Entry;
  ranges: [number, number][];
  /** the label of the row this one sits under, when found from the top level */
  parent?: string;
  icon?: string;
  active: boolean;
  state: RowState;
  spinner: string | null;
  apple: boolean;
}

/**
 * One option. A row with a destination is a real link, so a modified click
 * still opens it in a new tab; everything else is a button. The link kind is
 * matched against the two LiveView understands rather than interpolated.
 */
export function rowHtml(view: RowView, classes: Classes): string {
  const { entry } = view;
  const icon = `<span class="${classes.icon} ${safeClasses(view.icon)}" aria-hidden="true"></span>`;
  const parent = view.parent
    ? `<span class="${classes.group}">${escapeHtml(view.parent)} ›</span> `
    : "";
  const label = `<span class="${classes.label}">${parent}${highlight(entry.l, view.ranges, classes.mark)}</span>`;
  const group = entry.g
    ? `<span class="${classes.group}">${escapeHtml(entry.g)}</span>`
    : "";
  const shortcut = entry.h ? keycapsHtml(entry.h, view.apple, classes) : "";
  const trailing =
    view.spinner !== null
      ? `<span class="${classes.spinner}" aria-hidden="true"></span><span style="${VISUALLY_HIDDEN}">${escapeHtml(view.spinner)}</span>`
      : entry.d
        ? `<span class="${classes.detail}">${escapeHtml(entry.d)}</span>`
        : "";
  const more =
    entry.o && entry.o.length > 0
      ? `<span class="${classes.more}" data-palette-more aria-hidden="true">⋯</span>`
      : "";
  const chevron =
    entry.c && entry.c.length > 0
      ? `<span class="${classes.chevron}" aria-hidden="true">›</span>`
      : "";

  const body = `${icon}${label}${group}${trailing}${shortcut}${more}${chevron}`;
  const flag =
    view.state === "busy"
      ? ' aria-busy="true"'
      : view.state === "inert"
        ? ' aria-disabled="true"'
        : "";
  const control = entry.p
    ? `<a href="${escapeHtml(entry.p)}" data-phx-link="${entry.x === "patch" ? "patch" : "redirect"}" data-phx-link-state="push" tabindex="-1"${flag} class="${classes.control}">${body}</a>`
    : `<button type="button" tabindex="-1"${flag} class="${classes.control}">${body}</button>`;

  const rowClasses = [
    classes.row,
    view.active ? classes.rowActive : "",
    view.state === "inert" ? classes.rowInert : "",
    entry.t === "danger" ? classes.rowDanger : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<li id="${view.id}" role="option" aria-selected="${view.active}" data-index="${view.index}" data-key="${escapeHtml(view.key)}" class="${rowClasses}">${control}</li>`;
}

/**
 * A section's heading. Presentational rather than a `role="group"`: a flat
 * listbox keeps `aria-activedescendant` pointing straight at the options.
 */
export function headingHtml(label: string, classes: Classes): string {
  return `<li role="presentation" class="${classes.heading}">${escapeHtml(label)}</li>`;
}
