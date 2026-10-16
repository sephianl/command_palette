import { describe, expect, it } from "vitest";
import { keycaps, matches, parseChord, parseShortcut } from "../src/keys";

function key(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

describe("parseShortcut", () => {
  it("reads a sequence of chords", () => {
    expect(parseShortcut("g i")).toHaveLength(2);
    expect(parseShortcut("mod+shift+p")?.[0]).toMatchObject({
      mod: true,
      shift: true,
      key: "p",
    });
  });

  it("refuses an unknown modifier", () => {
    expect(parseChord("hyper+p")).toBeNull();
    expect(parseShortcut("g hyper+i")).toBeNull();
  });
});

describe("matches", () => {
  it("reads mod as Ctrl off Apple and ⌘ on it", () => {
    const [chord] = parseShortcut("mod+k")!;

    expect(
      matches(key({ code: "KeyK", key: "k", ctrlKey: true }), chord, false),
    ).toBe(true);
    expect(
      matches(key({ code: "KeyK", key: "k", metaKey: true }), chord, true),
    ).toBe(true);
    expect(
      matches(key({ code: "KeyK", key: "k", ctrlKey: true }), chord, true),
    ).toBe(false);
  });

  it("reads Ctrl+Space by the physical key", () => {
    const [chord] = parseShortcut("ctrl+space")!;

    expect(
      matches(
        key({ code: "Space", key: "Unidentified", ctrlKey: true }),
        chord,
        false,
      ),
    ).toBe(true);
  });

  it("needs no shift for a key shift types", () => {
    const [chord] = parseShortcut("?")!;

    expect(
      matches(key({ code: "Slash", key: "?", shiftKey: true }), chord, false),
    ).toBe(true);
  });

  it("refuses an extra modifier", () => {
    const [chord] = parseShortcut("g")!;

    expect(
      matches(key({ code: "KeyG", key: "g", ctrlKey: true }), chord, false),
    ).toBe(false);
  });
});

describe("keycaps", () => {
  it("shows the platform's symbols", () => {
    expect(keycaps("mod+shift+p", true)).toEqual([["⌘", "⇧", "P"]]);
    expect(keycaps("mod+shift+p", false)).toEqual([["Ctrl", "Shift", "P"]]);
    expect(keycaps("g i", false)).toEqual([["G"], ["I"]]);
  });
});
