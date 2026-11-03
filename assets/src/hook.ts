import {
  isApple,
  isTyping,
  matches,
  parseShortcut,
  SequenceTracker,
} from "./keys";
import type { Chord } from "./keys";
import { readMru, recordUse } from "./mru";
import { DEFAULT_CLASSES, headingHtml, rowHtml } from "./render";
import type { Classes, RowState } from "./render";
import { keyOf, prepare, search } from "./score";
import { bestIndex, sectionize } from "./sections";
import type { Entry, PreparedEntry, Result, SectionData } from "./types";

export interface Options {
  /** classes for what the hook draws; see `Classes` */
  classes?: Partial<Classes>;
  /** shortcuts that open the palette from anywhere */
  open?: string[];
  /** prefix of the localStorage key recency is kept under */
  storagePrefix?: string;
}

const DEFAULT_OPEN = ["mod+k", "ctrl+space"];

/**
 * Long enough that a patch which lands at once never flashes a spinner, short
 * enough that anything a person would call slow shows one.
 */
const SPINNER_DELAY_MS = 120;

/** A navigation that never reports back must not cover the page forever. */
const NAVIGATION_TIMEOUT_MS = 15000;

const SEARCH_DEBOUNCE_MS = 200;
const SEARCH_MIN_LENGTH = 3;

/**
 * Long enough to narrow a search, or all digits: a number such as a vehicle's
 * is short and only ever matches exactly. The server checks the same.
 */
export function searchable(query: string): boolean {
  return query.length >= SEARCH_MIN_LENGTH || /^\d+$/.test(query);
}

interface Reply {
  seq: number;
  entries: Entry[];
  hint: string | null;
}

interface PageReply {
  entries: Entry[];
}

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
  pushEvent(
    event: string,
    payload: Record<string, unknown>,
    onReply?: (reply: never) => void,
  ): void;
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
  shortcuts(): Array<{ chords: Chord[]; target: Entry }>;
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

function parseJson<T>(raw: string | undefined, empty: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : empty;
  } catch {
    return empty;
  }
}

function asResult(entry: Entry): Result {
  return { entry, score: 0, ranges: [] };
}

/**
 * Whether choosing a row opens its children rather than running it: only a
 * row with children and nothing of its own to do.
 */
function opensList(entry: Entry): boolean {
  return (
    (entry.c?.length ?? 0) > 0 &&
    !entry.p &&
    !entry.e &&
    !entry.w &&
    entry.y === undefined
  );
}

function flatten(entries: Entry[]): Entry[] {
  return entries.flatMap((entry) => [
    entry,
    ...flatten(entry.c ?? []),
    ...flatten(entry.o ?? []),
  ]);
}

function hookMethods(): Omit<
  PaletteHook,
  | "el"
  | "pushEvent"
  | "handleEvent"
  | "js"
  | "classes"
  | "openChords"
  | "storageKey"
  | "apple"
> &
  ThisType<PaletteHook> {
  return {
    mounted(this: PaletteHook) {
      this.input = this.el.querySelector<HTMLInputElement>(
        `#${this.el.id}-input`,
      )!;
      this.list = this.el.querySelector<HTMLUListElement>(
        `#${this.el.id}-results`,
      )!;
      this.empty = this.el.querySelector<HTMLElement>("[data-palette-empty]")!;
      this.hint = this.el.querySelector<HTMLElement>("[data-palette-hint]")!;
      this.crumb = this.el.querySelector<HTMLElement>("[data-palette-crumb]")!;
      this.keyActions = this.el.querySelector("[data-palette-key-actions]");
      this.keyClose = this.el.querySelector("[data-palette-key-close]");
      this.keyBack = this.el.querySelector("[data-palette-key-back]");

      this.pageEntries = [];
      this.remote = [];
      this.exact = [];
      this.hintText = null;
      this.levels = [];
      this.results = [];
      this.selected = 0;
      this.resetSelection = true;
      this.open = false;
      this.usingMouse = false;
      this.lastFocused = null;
      this.seq = 0;
      this.searchTimer = null;
      this.navigating = null;
      this.spinnerShown = false;
      this.spinnerTimer = null;
      this.navigationTimer = null;
      this.tracker = new SequenceTracker(() => this.shortcuts(), this.apple);

      this.loadEntries();

      // Replies are dropped unless they answer the latest query, so a slow one
      // never overwrites the results of a later keystroke; and dropped
      // mid-navigation, which would shift the rows under the spinner.
      this.handleEvent("palette:results", ({ seq, entries, hint }: Reply) => {
        if (seq !== this.seq || this.navigating !== null) return;
        this.remote = entries.map((entry) =>
          asResult(entry.f ? { ...entry, s: "fallback" } : entry),
        );
        this.hintText = hint || null;
        this.resetSelection = true;
        if (this.open) this.render();
      });

      // On window, so the shortcuts work wherever focus is; torn down in
      // destroyed(), since the hook remounts on every live navigation.
      this.onKeydown = (event: KeyboardEvent) => {
        if (event.isComposing) return;

        if (
          this.openChords.some(([chord]) => matches(event, chord, this.apple))
        ) {
          event.preventDefault();
          if (this.open) this.closePalette();
          else this.openPalette();
          return;
        }

        if (this.open) this.keydownOpen(event);
        else this.keydownClosed(event);
      };
      window.addEventListener("keydown", this.onKeydown, true);

      // The palette closes when the page it asked for is ready, not when the
      // choice was made. Only navigation kinds count: LiveView reports page
      // loading for form submits and clicks too.
      this.onPageLoadingStop = (event: Event) => {
        if (this.navigating === null) return;
        const kind = (event as CustomEvent).detail?.kind;
        if (kind === "patch" || kind === "redirect") this.closePalette();
      };
      window.addEventListener("phx:page-loading-stop", this.onPageLoadingStop);

      // A button elsewhere dispatches this rather than reaching into the hook.
      // Opening only: a button that closes what it appears to open is a trap.
      this.onOpenRequest = () => {
        if (!this.open) this.openPalette();
      };
      window.addEventListener("phx:open-command-palette", this.onOpenRequest);

      this.input.addEventListener("input", () => {
        this.resetSelection = true;
        this.scheduleSearch();
        this.render();
      });

      this.el
        .querySelector("[data-palette-backdrop]")
        ?.addEventListener("click", () => this.closePalette());

      this.list.addEventListener("mousemove", () => {
        this.usingMouse = true;
      });

      // Only the highlight moves on hover, never the rows: replacing the nodes
      // under the cursor re-fires this handler and severs the mousedown and
      // mouseup a click is made of.
      this.list.addEventListener("mouseover", (event) => {
        if (!this.usingMouse || this.navigating !== null) return;
        const item = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-index]",
        );
        if (!item) return;
        const next = Number(item.dataset.index);
        if (next === this.selected) return;
        this.selected = next;
        this.paintSelection();
      });

      this.list.addEventListener("click", (event) => {
        if (this.navigating !== null) return;
        const target = event.target as HTMLElement;
        const item = target.closest<HTMLElement>("[data-key]");
        if (!item?.dataset.key) return;

        // A modified click on a link opens it where the browser would.
        const mouse = event as MouseEvent;
        if (
          mouse.ctrlKey ||
          mouse.metaKey ||
          mouse.shiftKey ||
          mouse.button === 1
        ) {
          return;
        }

        event.preventDefault();
        if (target.closest("[data-palette-more]")) {
          const result = this.results.find(
            (row) => keyOf(row.entry) === item.dataset.key,
          );
          if (result?.entry.o) this.openLevel(result.entry.l, result.entry.o);
          return;
        }
        this.choose(item.dataset.key);
      });
    },

    updated(this: PaletteHook) {
      this.loadEntries();
      if (!this.open) return;
      // A patch of the root restores its server-rendered `hidden`, which would
      // strand the palette invisible while the hook believes it is open.
      this.el.hidden = false;
      this.render();
    },

    destroyed(this: PaletteHook) {
      window.removeEventListener("keydown", this.onKeydown, true);
      window.removeEventListener(
        "phx:page-loading-stop",
        this.onPageLoadingStop,
      );
      window.removeEventListener(
        "phx:open-command-palette",
        this.onOpenRequest,
      );
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.stopNavigating();
    },

    loadEntries(this: PaletteHook) {
      const entries = [
        ...parseJson<Entry[]>(this.el.dataset.entries, []),
        ...this.pageEntries,
      ];
      this.entries = prepare(entries);
      this.sectionOrder = parseJson<SectionData[]>(
        this.el.dataset.sections,
        [],
      );

      // What sits inside a row -- its children and its actions, at any depth --
      // is found from the top level too, under the path to it: "Gent" finds
      // "Switch depot › Gent", "planning" finds "Routes › Planning". A row that
      // is also a top-level row of its own is left to that one.
      this.parents = new Map();
      const top = new Set(entries.map(keyOf));
      const nested: Entry[] = [];
      const visit = (parent: Entry, path: string) => {
        for (const inner of [...(parent.c ?? []), ...(parent.o ?? [])]) {
          if (!top.has(keyOf(inner))) {
            this.parents.set(inner, path);
            nested.push(inner);
          }
          visit(inner, `${path} › ${inner.l}`);
        }
      };
      entries.forEach((entry) => visit(entry, entry.l));
      this.nested = prepare(nested);
    },

    shortcuts(this: PaletteHook) {
      return flatten(this.entries.map(({ entry }) => entry)).flatMap(
        (entry) => {
          const chords = entry.h ? parseShortcut(entry.h) : null;
          return chords ? [{ chords, target: entry }] : [];
        },
      );
    },

    /**
     * Every row with a shortcut, as a list: the keycaps on a row only say what
     * to press outside the palette, where letters are not typed into the box.
     */
    openShortcuts(this: PaletteHook) {
      this.openLevel(
        this.el.dataset.shortcutsLabel ?? "",
        this.shortcuts().map(({ target }) => target),
      );
    },

    keydownClosed(this: PaletteHook, event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;

      if (event.key === "?" && this.el.dataset.shortcutsLabel) {
        event.preventDefault();
        this.tracker.reset();
        this.openPalette();
        this.openShortcuts();
        return;
      }

      const entry = this.tracker.press(event, Date.now());
      if (!entry) return;

      event.preventDefault();
      if (opensList(entry)) {
        this.openPalette();
        this.openLevel(entry.l, entry.c!);
      } else {
        this.run(entry);
      }
    },

    keydownOpen(this: PaletteHook, event: KeyboardEvent) {
      // Every key but Escape is inert once a choice is committed, so a second
      // Enter cannot start a navigation on top of the one running.
      if (this.navigating !== null && event.key !== "Escape") {
        event.preventDefault();
        return;
      }

      const caret = this.input.selectionStart ?? this.input.value.length;
      const atEnd = caret === this.input.value.length;

      switch (event.key) {
        case "?":
          // A lone "?" finds nothing worth having, so in an empty box it asks
          // for the shortcuts instead.
          if (this.input.value !== "" || !this.el.dataset.shortcutsLabel)
            return;
          event.preventDefault();
          this.openShortcuts();
          break;
        case "Escape":
          // Stopped here so a modal behind the palette stays open.
          event.preventDefault();
          event.stopPropagation();
          if (this.levels.length > 0 && this.navigating === null) this.back();
          else this.closePalette();
          break;
        case "ArrowDown":
          event.preventDefault();
          this.move(1);
          break;
        case "ArrowUp":
          event.preventDefault();
          this.move(-1);
          break;
        case "ArrowRight": {
          const entry = this.current()?.entry;
          if (!atEnd || !entry?.o || entry.o.length === 0) return;
          event.preventDefault();
          this.openLevel(entry.l, entry.o);
          break;
        }
        case "ArrowLeft":
          if (this.levels.length === 0 || caret !== 0) return;
          event.preventDefault();
          this.back();
          break;
        case "Backspace":
          if (this.levels.length === 0 || this.input.value !== "") return;
          event.preventDefault();
          this.back();
          break;
        case "Home":
          event.preventDefault();
          this.move(-this.results.length);
          break;
        case "End":
          event.preventDefault();
          this.move(this.results.length);
          break;
        case "Enter":
          event.preventDefault();
          this.choose();
          break;
        case "Tab":
          // The dialog is modal and its rows are untabbable, so keeping focus
          // in the box is the whole focus trap.
          event.preventDefault();
          this.input.focus();
          break;
      }
    },

    /**
     * The server search is debounced and length-gated here as a courtesy to
     * the socket; the server checks both again. It runs only from the top
     * level: a row's actions and children are filtered in the browser.
     */
    scheduleSearch(this: PaletteHook) {
      if (this.searchTimer) clearTimeout(this.searchTimer);

      // Remote rows, the fallback and the hint all answer the query that
      // produced them, so none may outlive it: Enter would act on older text.
      this.remote = [];
      this.hintText = null;

      const query = this.input.value.trim();
      if (this.levels.length > 0 || !searchable(query)) return;

      this.searchTimer = setTimeout(() => {
        this.seq += 1;
        this.pushEvent("palette_search", { q: query, seq: this.seq });
      }, SEARCH_DEBOUNCE_MS);
    },

    openPalette(this: PaletteHook) {
      this.lastFocused = document.activeElement as HTMLElement | null;
      this.open = true;
      this.usingMouse = false;
      this.stopNavigating();
      this.levels = [];
      this.resetSelection = true;
      this.el.hidden = false;
      this.input.value = "";
      this.input.focus();
      this.render();

      // Asked for now rather than rendered with the page, which would rebuild
      // and resend every row on each update the page makes.
      this.pushEvent("palette_open", {}, ({ entries }: PageReply) => {
        if (!this.open) return;
        this.pageEntries = entries;
        this.loadEntries();
        this.render();
      });
    },

    closePalette(this: PaletteHook) {
      this.open = false;
      this.stopNavigating();
      this.el.hidden = true;
      this.input.value = "";
      this.levels = [];
      // Dropped with the query that produced them, so reopening never shows
      // results for something typed minutes ago.
      this.remote = [];
      this.hintText = null;
      this.pageEntries = [];
      this.loadEntries();
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = null;
      this.tracker.reset();
      this.lastFocused?.focus();
      this.lastFocused = null;
    },

    render(this: PaletteHook) {
      const mru = readMru(this.storageKey());
      const query = this.input.value;
      const level = this.levels[this.levels.length - 1];

      let sections;
      if (level) {
        this.exact = [];
        // Until something is typed a level keeps the order it was given --
        // a page's tabs as the page shows them -- rather than recency's.
        sections = [
          {
            key: "",
            rows:
              query.trim() === ""
                ? level.entries.map(({ entry }) => asResult(entry))
                : search(query, level.entries, mru),
          },
        ];
      } else {
        // Exact server hits lead their section: the local scorer has nothing
        // to say about a code it has never seen. Ranked hits -- a fragment of a
        // name -- are scored like local rows, which orders them within their
        // section and lets a better local match take the highlight.
        this.exact = this.remote.filter(({ entry }) => !entry.f && !entry.r);
        const ranked = prepare(
          this.remote.filter(({ entry }) => entry.r).map(({ entry }) => entry),
        );
        const local = (
          query.trim() === "" ? this.entries : [...this.entries, ...this.nested]
        ).filter(({ entry }) => !entry.f);
        const found = [
          ...this.exact,
          ...search(query, [...local, ...ranked], mru),
        ];
        // A fallback, the app's or the search's, stands in for an empty list
        // and never sits beside a real answer.
        const fallbacks = [
          ...this.remote.filter(({ entry }) => entry.f),
          ...this.entries
            .filter(({ entry }) => entry.f)
            .map(({ entry }) => asResult({ ...entry, s: "fallback" })),
        ];
        const rows = found.length > 0 ? found : fallbacks;
        sections = sectionize(rows, this.sectionOrder);
      }

      this.results = sections.flatMap((section) => section.rows);
      this.renderChrome();

      if (this.results.length === 0) {
        this.selected = 0;
        this.resetSelection = false;
        this.list.innerHTML = "";
        // A hint is the more specific answer, so it stands in for the empty
        // message rather than stacking above it.
        this.empty.hidden = Boolean(this.hintText);
        this.input.removeAttribute("aria-activedescendant");
        if (this.keyActions) this.keyActions.hidden = true;
        return;
      }

      this.empty.hidden = true;
      if (this.resetSelection) {
        this.selected = bestIndex(this.results, this.exact);
        this.resetSelection = false;
      }
      this.selected = Math.max(
        0,
        Math.min(this.selected, this.results.length - 1),
      );

      const busy = this.navigating;
      const icons = new Map(this.sectionOrder.map((data) => [data.k, data.i]));
      let index = 0;

      this.list.innerHTML = sections
        .map((section) => {
          const label = "data" in section ? section.data?.l : undefined;
          const heading = label ? headingHtml(label, this.classes) : "";
          return (
            heading +
            section.rows
              .map((result) => {
                const key = keyOf(result.entry);
                const chosen = key === busy;
                const state: RowState =
                  busy === null ? "idle" : chosen ? "busy" : "inert";
                const html = rowHtml(
                  {
                    id: `${this.el.id}-option-${index}`,
                    index,
                    key,
                    entry: result.entry,
                    ranges: result.ranges,
                    parent: level ? undefined : this.parents.get(result.entry),
                    icon: result.entry.i ?? icons.get(result.entry.s),
                    active: index === this.selected,
                    state,
                    spinner:
                      chosen && this.spinnerShown
                        ? (this.el.dataset.openingLabel ?? "")
                        : null,
                    apple: this.apple,
                  },
                  this.classes,
                );
                index += 1;
                return html;
              })
              .join("")
          );
        })
        .join("");

      this.paintSelection();
    },

    renderChrome(this: PaletteHook) {
      const level = this.levels[this.levels.length - 1];
      this.crumb.hidden = !level;
      this.crumb.textContent = level ? `${level.title} ›` : "";

      this.hint.textContent = this.hintText ?? "";
      this.hint.hidden = !this.hintText;

      if (this.keyClose) this.keyClose.hidden = Boolean(level);
      if (this.keyBack) this.keyBack.hidden = !level;

      // Re-asserted on every render: a live patch restores the server's markup.
      if (this.navigating === null) this.el.removeAttribute("aria-busy");
      else this.el.setAttribute("aria-busy", "true");
    },

    /**
     * Moves the highlight over the rows on screen, leaving the nodes in place:
     * selection changes far outnumber list changes, and rebuilding the list
     * under the pointer breaks clicking.
     */
    paintSelection(this: PaletteHook) {
      const rows = this.list.querySelectorAll<HTMLElement>("[data-index]");
      if (rows.length === 0) return;

      this.selected = Math.max(0, Math.min(this.selected, rows.length - 1));
      const active = this.classes.rowActive.split(/\s+/).filter(Boolean);

      rows.forEach((row, index) => {
        const on = index === this.selected;
        row.setAttribute("aria-selected", String(on));
        active.forEach((name) => row.classList.toggle(name, on));
      });

      const current = rows[this.selected];
      this.input.setAttribute("aria-activedescendant", current.id);
      current.scrollIntoView?.({ block: "nearest" });

      const entry = this.current()?.entry;
      if (this.keyActions)
        this.keyActions.hidden = !(entry?.o && entry.o.length > 0);
    },

    move(this: PaletteHook, delta: number) {
      if (this.results.length === 0) return;
      this.usingMouse = false;
      this.selected = Math.max(
        0,
        Math.min(this.selected + delta, this.results.length - 1),
      );
      this.paintSelection();
    },

    current(this: PaletteHook) {
      return this.results[this.selected];
    },

    /**
     * Commits a row by its stable key, never its position: recording the use
     * re-sorts the list, so a position captured before would point at a
     * neighbour by the time the row runs.
     */
    choose(this: PaletteHook, key?: string) {
      if (this.navigating !== null) return;
      const chosenKey =
        key ?? (this.current() ? keyOf(this.current()!.entry) : undefined);
      const result = this.results.find((row) => keyOf(row.entry) === chosenKey);
      if (!result) return;

      const { entry } = result;
      if (opensList(entry)) {
        this.openLevel(entry.l, entry.c!);
        return;
      }
      this.run(entry);
    },

    run(this: PaletteHook, entry: Entry) {
      const key = keyOf(entry);
      recordUse(this.storageKey(), key, Date.now());

      if (entry.e) {
        // An event has no page to wait for: the page handles it in place.
        this.closePalette();
        this.pushEvent(entry.e, entry.v ?? {});
        return;
      }

      if (entry.w) {
        this.closePalette();
        window.dispatchEvent(
          new CustomEvent(entry.w, { detail: entry.v ?? {} }),
        );
        return;
      }

      if (entry.y !== undefined) {
        this.closePalette();
        // Unavailable outside a secure context; copying is a convenience, so a
        // refusal is dropped rather than surfaced.
        navigator.clipboard?.writeText(entry.y).catch(() => undefined);
        return;
      }

      if (!entry.p) return;

      const kind = entry.x === "patch" ? "patch" : "redirect";
      if (!this.open) {
        this.js()[kind === "patch" ? "patch" : "navigate"](entry.p);
        return;
      }

      // The row the person committed to is the one that spins, and the
      // palette stays open until the page it asked for has arrived.
      this.beginNavigating(key, kind);
      this.js()[kind === "patch" ? "patch" : "navigate"](entry.p);
    },

    openLevel(this: PaletteHook, title: string, entries: Entry[]) {
      this.levels.push({
        title,
        entries: prepare(entries),
        query: this.input.value,
      });
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.input.value = "";
      this.resetSelection = true;
      this.render();
    },

    back(this: PaletteHook) {
      const level = this.levels.pop();
      if (!level) return;
      this.input.value = level.query;
      this.resetSelection = true;
      this.render();
    },

    beginNavigating(
      this: PaletteHook,
      key: string,
      kind: "patch" | "redirect",
    ) {
      this.navigating = key;

      // Only a patch waits for the spinner. A redirect tears this hook down as
      // it starts, so a timer would never fire -- and a redirect is a full
      // mount, with no instant case to protect from flashing.
      this.spinnerShown = kind === "redirect";
      this.render();

      if (kind === "patch") {
        this.spinnerTimer = setTimeout(() => {
          this.spinnerShown = true;
          this.render();
        }, SPINNER_DELAY_MS);
      }

      this.navigationTimer = setTimeout(
        () => this.closePalette(),
        NAVIGATION_TIMEOUT_MS,
      );
    },

    stopNavigating(this: PaletteHook) {
      this.navigating = null;
      this.spinnerShown = false;
      this.el.removeAttribute("aria-busy");
      if (this.spinnerTimer) clearTimeout(this.spinnerTimer);
      if (this.navigationTimer) clearTimeout(this.navigationTimer);
      this.spinnerTimer = null;
      this.navigationTimer = null;
    },
  } as never;
}

/**
 * The LiveView hook, configured. Register it under the name the component
 * renders, `phx-hook="CommandPalette"`:
 *
 *     hooks: { CommandPalette: createCommandPalette({ classes: { ... } }) }
 */
export function createCommandPalette(options: Options = {}): object {
  const classes = { ...DEFAULT_CLASSES, ...options.classes };
  const openChords = (options.open ?? DEFAULT_OPEN)
    .map(parseShortcut)
    .filter((chords): chords is Chord[] => chords !== null);
  const prefix = options.storagePrefix ?? "command_palette:mru";

  return {
    ...hookMethods(),
    classes,
    openChords,
    apple: isApple(),
    storageKey(this: PaletteHook) {
      return `${prefix}:${this.el.dataset.userId || "anonymous"}`;
    },
  };
}
