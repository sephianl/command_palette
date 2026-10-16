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
/** How long the next chord of a sequence may take. */
export declare const SEQUENCE_MS = 1000;
export declare function parseChord(text: string): Chord | null;
export declare function parseShortcut(text: string): Chord[] | null;
export declare function isApple(): boolean;
export declare function matches(event: KeyboardEvent, chord: Chord, apple: boolean): boolean;
/** The keycaps a shortcut shows as, one array per chord. */
export declare function keycaps(shortcut: string, apple: boolean): string[][];
/** Typing into a field is never a shortcut. */
export declare function isTyping(target: EventTarget | null): boolean;
/**
 * Follows the chords pressed so far against every shortcut, so "g" waits for
 * the "i" of "g i" without firing a one-chord "g" that also exists -- the
 * longer sequence wins only if its next chord comes within `SEQUENCE_MS`.
 */
export declare class SequenceTracker<T> {
    private shortcuts;
    private apple;
    private pressed;
    private last;
    constructor(shortcuts: () => Array<{
        chords: Chord[];
        target: T;
    }>, apple: boolean);
    /** The target whose shortcut this key completes, or null. */
    press(event: KeyboardEvent, now: number): T | null;
    reset(): void;
}
