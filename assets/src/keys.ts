/**
 * Shortcuts: one chord ("mod+k") or a sequence of chords ("g i"), pressed one
 * after the other. `mod` is ⌘ on Apple devices and Ctrl elsewhere.
 */
export interface Chord {
  mod: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

const NAMED: Record<string, string> = {
  enter: "Enter",
  escape: "Escape",
  esc: "Escape",
  space: "Space",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  home: "Home",
  end: "End",
};

/** How long the next chord of a sequence may take. */
export const SEQUENCE_MS = 1000;

export function parseChord(text: string): Chord | null {
  const parts = text.toLowerCase().split("+").filter(Boolean);
  const key = parts.pop();
  if (!key) return null;

  const chord: Chord = {
    mod: false,
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    key: NAMED[key] ?? key,
  };

  for (const part of parts) {
    if (part === "mod") chord.mod = true;
    else if (part === "ctrl") chord.ctrl = true;
    else if (part === "alt" || part === "option") chord.alt = true;
    else if (part === "shift") chord.shift = true;
    else if (part === "meta" || part === "cmd") chord.meta = true;
    else return null;
  }

  return chord;
}

export function parseShortcut(text: string): Chord[] | null {
  const chords = text.trim().split(/\s+/).filter(Boolean).map(parseChord);
  if (chords.length === 0 || chords.some((chord) => chord === null)) {
    return null;
  }
  return chords as Chord[];
}

export function isApple(): boolean {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad|ipod/i.test(platform ?? "");
}

/**
 * The key a chord names, read from the physical key for letters, digits and
 * space -- layout- and modifier-independent, where `event.key` reports
 * Ctrl+Space inconsistently -- and from `event.key` for everything else.
 */
function pressed(event: KeyboardEvent): string {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(event.code)) return event.code.slice(5);
  if (event.code === "Space") return "Space";
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

export function matches(
  event: KeyboardEvent,
  chord: Chord,
  apple: boolean,
): boolean {
  const ctrl = chord.ctrl || (chord.mod && !apple);
  const meta = chord.meta || (chord.mod && apple);
  const printable = chord.key.length === 1 && !/[a-z0-9]/.test(chord.key);

  return (
    pressed(event) === chord.key &&
    event.ctrlKey === ctrl &&
    event.metaKey === meta &&
    event.altKey === chord.alt &&
    (printable || event.shiftKey === chord.shift)
  );
}

/** The keycaps a shortcut shows as, one array per chord. */
export function keycaps(shortcut: string, apple: boolean): string[][] {
  return (parseShortcut(shortcut) ?? []).map((chord) => {
    const caps: string[] = [];
    if (chord.mod) caps.push(apple ? "⌘" : "Ctrl");
    if (chord.ctrl) caps.push(apple ? "⌃" : "Ctrl");
    if (chord.alt) caps.push(apple ? "⌥" : "Alt");
    if (chord.shift) caps.push(apple ? "⇧" : "Shift");
    if (chord.meta) caps.push(apple ? "⌘" : "Meta");
    caps.push(chord.key.length === 1 ? chord.key.toUpperCase() : chord.key);
    return caps;
  });
}

/** Typing into a field is never a shortcut. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/**
 * Follows the chords pressed so far against every shortcut, so "g" waits for
 * the "i" of "g i" without firing a one-chord "g" that also exists -- the
 * longer sequence wins only if its next chord comes within `SEQUENCE_MS`.
 */
export class SequenceTracker<T> {
  private pressed: KeyboardEvent[] = [];
  private last = 0;

  constructor(
    private shortcuts: () => Array<{ chords: Chord[]; target: T }>,
    private apple: boolean,
  ) {}

  /** The target whose shortcut this key completes, or null. */
  press(event: KeyboardEvent, now: number): T | null {
    if (now - this.last > SEQUENCE_MS) this.pressed = [];
    this.last = now;
    this.pressed.push(event);

    const typed = this.pressed;
    const candidates = this.shortcuts().filter(
      ({ chords }) =>
        chords.length >= typed.length &&
        typed.every((key, index) => matches(key, chords[index], this.apple)),
    );

    if (candidates.length === 0) {
      this.pressed = [];
      return null;
    }

    const complete = candidates.find(
      ({ chords }) => chords.length === typed.length,
    );
    if (complete && candidates.length === 1) {
      this.pressed = [];
      return complete.target;
    }

    return null;
  }

  reset(): void {
    this.pressed = [];
  }
}
