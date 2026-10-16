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
export declare const DEFAULT_CLASSES: Classes;
export declare function escapeHtml(text: string): string;
/**
 * Class names from the payload, kept only when they are plain class names:
 * they land in an attribute, so a quote must never get through.
 */
export declare function safeClasses(names: string | undefined): string;
export declare function highlight(label: string, ranges: [number, number][], markClass: string): string;
export declare function keycapsHtml(shortcut: string, apple: boolean, classes: Classes): string;
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
export declare function rowHtml(view: RowView, classes: Classes): string;
/**
 * A section's heading. Presentational rather than a `role="group"`: a flat
 * listbox keeps `aria-activedescendant` pointing straight at the options.
 */
export declare function headingHtml(label: string, classes: Classes): string;
