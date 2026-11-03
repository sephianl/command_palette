import { SequenceTracker } from "./keys";
import type { Chord } from "./keys";
import type { Classes } from "./render";
import type { Entry, PreparedEntry, Result, SectionData } from "./types";
export interface Options {
    /** classes for what the hook draws; see `Classes` */
    classes?: Partial<Classes>;
    /** shortcuts that open the palette from anywhere */
    open?: string[];
    /** prefix of the localStorage key recency is kept under */
    storagePrefix?: string;
}
/**
 * Long enough to narrow a search, or all digits: a number such as a vehicle's
 * is short and only ever matches exactly. The server checks the same.
 */
export declare function searchable(query: string): boolean;
/** A row's actions or children, opened on top of the list it came from. */
interface Level {
    title: string;
    entries: PreparedEntry[];
    /** the query of the level below, given back when this one closes */
    query: string;
}
interface JSCommands {
    navigate(href: string): void;
    patch(href: string): void;
}
export interface PaletteHook {
    el: HTMLElement;
    pushEvent(event: string, payload: Record<string, unknown>, onReply?: (reply: never) => void): void;
    handleEvent(event: string, callback: (payload: never) => void): void;
    js(): JSCommands;
    classes: Classes;
    openChords: Chord[][];
    /** where recency is kept, apart for each person */
    storageKey(): string;
    apple: boolean;
    /** the page's own rows, asked for each time the palette opens */
    pageEntries: Entry[];
    entries: PreparedEntry[];
    nested: PreparedEntry[];
    parents: Map<Entry, string>;
    sectionOrder: SectionData[];
    remote: Result[];
    exact: Result[];
    hintText: string | null;
    levels: Level[];
    results: Result[];
    selected: number;
    resetSelection: boolean;
    open: boolean;
    usingMouse: boolean;
    lastFocused: HTMLElement | null;
    seq: number;
    searchTimer: ReturnType<typeof setTimeout> | null;
    navigating: string | null;
    spinnerShown: boolean;
    spinnerTimer: ReturnType<typeof setTimeout> | null;
    navigationTimer: ReturnType<typeof setTimeout> | null;
    tracker: SequenceTracker<Entry>;
    input: HTMLInputElement;
    list: HTMLUListElement;
    empty: HTMLElement;
    hint: HTMLElement;
    crumb: HTMLElement;
    keyActions: HTMLElement | null;
    keyClose: HTMLElement | null;
    keyBack: HTMLElement | null;
    onKeydown: (event: KeyboardEvent) => void;
    onPageLoadingStop: (event: Event) => void;
    onOpenRequest: () => void;
    mounted(): void;
    updated(): void;
    destroyed(): void;
    loadEntries(): void;
    shortcuts(): Array<{
        chords: Chord[];
        target: Entry;
    }>;
    openShortcuts(): void;
    keydownOpen(event: KeyboardEvent): void;
    keydownClosed(event: KeyboardEvent): void;
    scheduleSearch(): void;
    openPalette(): void;
    closePalette(): void;
    render(): void;
    renderChrome(): void;
    paintSelection(): void;
    move(delta: number): void;
    current(): Result | undefined;
    choose(key?: string): void;
    run(entry: Entry): void;
    openLevel(title: string, entries: Entry[]): void;
    back(): void;
    beginNavigating(key: string, kind: "patch" | "redirect"): void;
    stopNavigating(): void;
}
/**
 * The LiveView hook, configured. Register it under the name the component
 * renders, `phx-hook="CommandPalette"`:
 *
 *     hooks: { CommandPalette: createCommandPalette({ classes: { ... } }) }
 */
export declare function createCommandPalette(options?: Options): object;
export {};
