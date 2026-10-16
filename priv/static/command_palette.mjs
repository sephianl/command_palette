// assets/src/keys.ts
var NAMED = {
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
  end: "End"
};
var SEQUENCE_MS = 1e3;
function parseChord(text) {
  const parts = text.toLowerCase().split("+").filter(Boolean);
  const key = parts.pop();
  if (!key) return null;
  const chord = {
    mod: false,
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    key: NAMED[key] ?? key
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
function parseShortcut(text) {
  const chords = text.trim().split(/\s+/).filter(Boolean).map(parseChord);
  if (chords.length === 0 || chords.some((chord) => chord === null)) {
    return null;
  }
  return chords;
}
function isApple() {
  const platform = navigator.userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad|ipod/i.test(platform ?? "");
}
function pressed(event) {
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(event.code)) return event.code.slice(5);
  if (event.code === "Space") return "Space";
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}
function matches(event, chord, apple) {
  const ctrl = chord.ctrl || chord.mod && !apple;
  const meta = chord.meta || chord.mod && apple;
  const printable = chord.key.length === 1 && !/[a-z0-9]/.test(chord.key);
  return pressed(event) === chord.key && event.ctrlKey === ctrl && event.metaKey === meta && event.altKey === chord.alt && (printable || event.shiftKey === chord.shift);
}
function keycaps(shortcut, apple) {
  return (parseShortcut(shortcut) ?? []).map((chord) => {
    const caps = [];
    if (chord.mod) caps.push(apple ? "\u2318" : "Ctrl");
    if (chord.ctrl) caps.push(apple ? "\u2303" : "Ctrl");
    if (chord.alt) caps.push(apple ? "\u2325" : "Alt");
    if (chord.shift) caps.push(apple ? "\u21E7" : "Shift");
    if (chord.meta) caps.push(apple ? "\u2318" : "Meta");
    caps.push(chord.key.length === 1 ? chord.key.toUpperCase() : chord.key);
    return caps;
  });
}
function isTyping(target) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
var SequenceTracker = class {
  constructor(shortcuts, apple) {
    this.shortcuts = shortcuts;
    this.apple = apple;
    this.pressed = [];
    this.last = 0;
  }
  /** The target whose shortcut this key completes, or null. */
  press(event, now) {
    if (now - this.last > SEQUENCE_MS) this.pressed = [];
    this.last = now;
    this.pressed.push(event);
    const typed = this.pressed;
    const candidates = this.shortcuts().filter(
      ({ chords }) => chords.length >= typed.length && typed.every((key, index) => matches(key, chords[index], this.apple))
    );
    if (candidates.length === 0) {
      this.pressed = [];
      return null;
    }
    const complete = candidates.find(
      ({ chords }) => chords.length === typed.length
    );
    if (complete && candidates.length === 1) {
      this.pressed = [];
      return complete.target;
    }
    return null;
  }
  reset() {
    this.pressed = [];
  }
};

// assets/src/mru.ts
var LIMIT = 40;
function readMru(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}
function recordUse(key, row, now) {
  const mru = readMru(key);
  const record = mru[row];
  mru[row] = { n: (record?.n || 0) + 1, t: now };
  try {
    window.localStorage.setItem(key, JSON.stringify(prune(mru)));
  } catch {
  }
}
function prune(mru) {
  const rows = Object.keys(mru);
  if (rows.length <= LIMIT) return mru;
  const kept = rows.sort((a, b) => mru[b].t - mru[a].t).slice(0, LIMIT);
  return Object.fromEntries(kept.map((row) => [row, mru[row]]));
}

// assets/src/render.ts
var DEFAULT_CLASSES = {
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
  spinner: "cp-spinner"
};
var VISUALLY_HIDDEN = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function safeClasses(names) {
  if (!names) return "";
  return names.split(/\s+/).filter((name) => /^[A-Za-z][\w:/.[\]-]*$/.test(name)).join(" ");
}
function highlight(label, ranges, markClass) {
  let html = "";
  let cursor = 0;
  for (const [start, end] of ranges) {
    html += escapeHtml(label.slice(cursor, start));
    html += `<mark class="${markClass}">${escapeHtml(label.slice(start, end))}</mark>`;
    cursor = end;
  }
  return html + escapeHtml(label.slice(cursor));
}
function keycapsHtml(shortcut, apple, classes) {
  const chords = keycaps(shortcut, apple).map(
    (caps) => caps.map((cap) => `<kbd class="${classes.key}">${escapeHtml(cap)}</kbd>`).join("")
  ).join(" ");
  return `<span class="${classes.keys}" aria-hidden="true">${chords}</span>`;
}
function rowHtml(view, classes) {
  const { entry } = view;
  const icon = `<span class="${classes.icon} ${safeClasses(view.icon)}" aria-hidden="true"></span>`;
  const parent = view.parent ? `<span class="${classes.group}">${escapeHtml(view.parent)} \u203A</span> ` : "";
  const label = `<span class="${classes.label}">${parent}${highlight(entry.l, view.ranges, classes.mark)}</span>`;
  const group = entry.g ? `<span class="${classes.group}">${escapeHtml(entry.g)}</span>` : "";
  const shortcut = entry.h ? keycapsHtml(entry.h, view.apple, classes) : "";
  const trailing = view.spinner !== null ? `<span class="${classes.spinner}" aria-hidden="true"></span><span style="${VISUALLY_HIDDEN}">${escapeHtml(view.spinner)}</span>` : entry.d ? `<span class="${classes.detail}">${escapeHtml(entry.d)}</span>` : "";
  const more = entry.o && entry.o.length > 0 ? `<span class="${classes.more}" data-palette-more aria-hidden="true">\u22EF</span>` : "";
  const chevron = entry.c && entry.c.length > 0 ? `<span class="${classes.chevron}" aria-hidden="true">\u203A</span>` : "";
  const body = `${icon}${label}${group}${trailing}${shortcut}${more}${chevron}`;
  const flag = view.state === "busy" ? ' aria-busy="true"' : view.state === "inert" ? ' aria-disabled="true"' : "";
  const control = entry.p ? `<a href="${escapeHtml(entry.p)}" data-phx-link="${entry.x === "patch" ? "patch" : "redirect"}" data-phx-link-state="push" tabindex="-1"${flag} class="${classes.control}">${body}</a>` : `<button type="button" tabindex="-1"${flag} class="${classes.control}">${body}</button>`;
  const rowClasses = [
    classes.row,
    view.active ? classes.rowActive : "",
    view.state === "inert" ? classes.rowInert : "",
    entry.t === "danger" ? classes.rowDanger : ""
  ].filter(Boolean).join(" ");
  return `<li id="${view.id}" role="option" aria-selected="${view.active}" data-index="${view.index}" data-key="${escapeHtml(view.key)}" class="${rowClasses}">${control}</li>`;
}
function headingHtml(label, classes) {
  return `<li role="presentation" class="${classes.heading}">${escapeHtml(label)}</li>`;
}

// assets/src/score.ts
function keyOf(entry) {
  return entry.m ?? entry.p ?? entry.e ?? entry.w ?? entry.y ?? entry.l;
}
var SEPARATORS = /* @__PURE__ */ new Set([" ", "-", "_", "/", ".", ",", "(", ")", "?", "="]);
var MATCH = 4;
var BONUS_START = 10;
var BONUS_BOUNDARY = 8;
var BONUS_CAMEL = 6;
var BONUS_CONSECUTIVE = 6;
var PENALTY_GAP_START = -3;
var PENALTY_GAP_EXTEND = -1;
var PENALTY_LENGTH = 0.1;
var WEIGHT_LABEL = 1;
var WEIGHT_GROUP = 0.6;
var WEIGHT_KEYWORDS = 0.6;
var MRU_DECAY_DAYS = 14;
var MRU_MAX_COUNT = 10;
var MRU_WEIGHT = 2;
var WEIGHT_RANKED = 0.9;
var DAY_MS = 864e5;
function normalize(text) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
function prepare(entries) {
  return entries.map((entry) => ({
    entry,
    label: normalize(entry.l),
    group: entry.g ? normalize(entry.g) : "",
    keywords: entry.k ? normalize(entry.k) : "",
    aliases: entry.a ? normalize(entry.a) : ""
  }));
}
function isSubsequence(query, text) {
  let q = 0;
  for (let i = 0; i < text.length && q < query.length; i++) {
    if (text[i] === query[q]) q++;
  }
  return q === query.length;
}
function charBonus(original, lower, i) {
  if (i === 0) return BONUS_START;
  const prev = original[i - 1];
  if (SEPARATORS.has(prev)) return BONUS_BOUNDARY;
  if (prev === lower[i - 1] && original[i] !== lower[i]) return BONUS_CAMEL;
  return 0;
}
function gapPenalty(gap) {
  return PENALTY_GAP_START + PENALTY_GAP_EXTEND * (gap - 1);
}
function scoreField(query, original, lower) {
  const m = query.length;
  const n = lower.length;
  if (m === 0 || m > n) return null;
  if (!isSubsequence(query, lower)) return null;
  const NEG = -Infinity;
  let prev = new Float64Array(n).fill(NEG);
  const parents = [];
  for (let j2 = 0; j2 < n; j2++) {
    if (lower[j2] === query[0]) prev[j2] = MATCH + charBonus(original, lower, j2);
  }
  for (let i = 1; i < m; i++) {
    const curr = new Float64Array(n).fill(NEG);
    const parent = new Int32Array(n).fill(-1);
    for (let j2 = i; j2 < n; j2++) {
      if (lower[j2] !== query[i]) continue;
      let best2 = NEG;
      let bestK = -1;
      for (let k = i - 1; k < j2; k++) {
        if (prev[k] === NEG) continue;
        const adjacency = k === j2 - 1 ? BONUS_CONSECUTIVE : gapPenalty(j2 - k - 1);
        const candidate = prev[k] + adjacency;
        if (candidate > best2) {
          best2 = candidate;
          bestK = k;
        }
      }
      if (bestK !== -1) {
        curr[j2] = best2 + MATCH + charBonus(original, lower, j2);
        parent[j2] = bestK;
      }
    }
    parents.push(parent);
    prev = curr;
  }
  let best = NEG;
  let end = -1;
  for (let j2 = 0; j2 < n; j2++) {
    if (prev[j2] > best) {
      best = prev[j2];
      end = j2;
    }
  }
  if (end === -1) return null;
  const indices = [end];
  let j = end;
  for (let i = parents.length - 1; i >= 0; i--) {
    j = parents[i][j];
    indices.push(j);
  }
  indices.reverse();
  return { score: best - n * PENALTY_LENGTH, ranges: toRanges(indices) };
}
function toRanges(indices) {
  const ranges = [];
  for (const i of indices) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === i) last[1] = i + 1;
    else ranges.push([i, i + 1]);
  }
  return ranges;
}
function mergeRanges(ranges) {
  if (ranges.length <= 1) return ranges;
  const sorted = ranges.map(([start, end]) => [start, end]).sort((a, b) => a[0] - b[0]);
  const merged = [sorted[0]];
  for (const [start, end] of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}
function mruBonus(record, now) {
  if (!record) return 0;
  const ageDays = Math.max(0, (now - record.t) / DAY_MS);
  const decay = Math.exp(-ageDays / MRU_DECAY_DAYS);
  return Math.min(record.n, MRU_MAX_COUNT) * MRU_WEIGHT * decay;
}
function scoreTerm(term, prepared) {
  const { entry } = prepared;
  const label = scoreField(term, entry.l, prepared.label);
  const group = prepared.group ? scoreField(term, entry.g, prepared.group) : null;
  const keywords = prepared.keywords ? scoreField(term, entry.k, prepared.keywords) : null;
  const aliases = prepared.aliases ? scoreField(term, entry.a, prepared.aliases) : null;
  const score = Math.max(
    label ? label.score * WEIGHT_LABEL : -Infinity,
    group ? group.score * WEIGHT_GROUP : -Infinity,
    keywords ? keywords.score * WEIGHT_KEYWORDS : -Infinity,
    aliases ? aliases.score * WEIGHT_LABEL : -Infinity
  );
  return score === -Infinity ? null : { score, ranges: label ? label.ranges : [] };
}
function scoreEntry(terms2, prepared, mru, now) {
  const { entry } = prepared;
  let score = 0;
  let ranges = [];
  for (const term of terms2) {
    const match = scoreTerm(term, prepared);
    if (!match) return null;
    score += match.score;
    ranges = ranges.concat(match.ranges);
  }
  return {
    entry,
    score: score * (entry.r ? WEIGHT_RANKED : 1) + mruBonus(mru[keyOf(entry)], now),
    ranges: mergeRanges(ranges)
  };
}
function terms(query) {
  return normalize(query.trim()).split(/\s+/).filter(Boolean);
}
function search(query, entries, mru = {}, now = Date.now()) {
  const typed = terms(query);
  if (typed.length === 0) {
    return entries.map((prepared, index) => ({
      entry: prepared.entry,
      score: mruBonus(mru[keyOf(prepared.entry)], now) - index * 1e-3,
      ranges: []
    })).sort((a, b) => b.score - a.score);
  }
  const results = [];
  for (const prepared of entries) {
    const result = scoreEntry(typed, prepared, mru, now);
    if (result) results.push(result);
  }
  return results.sort(
    (a, b) => b.score - a.score || a.entry.l.length - b.entry.l.length
  );
}

// assets/src/sections.ts
function sectionize(rows, order) {
  const sections = new Map(
    order.map((data) => [data.k, { key: data.k, data, rows: [] }])
  );
  for (const row of rows) {
    const key = row.entry.s;
    const section = sections.get(key) ?? { key, rows: [] };
    section.rows.push(row);
    sections.set(key, section);
  }
  return [...sections.values()].filter((section) => section.rows.length > 0);
}
function bestIndex(rows, exact) {
  const leading = rows.findIndex((row) => exact.includes(row));
  if (leading !== -1) return leading;
  let best = 0;
  for (let index = 1; index < rows.length; index++) {
    if (rows[index].score > rows[best].score) best = index;
  }
  return best;
}

// assets/src/hook.ts
var DEFAULT_OPEN = ["mod+k", "ctrl+space"];
var SPINNER_DELAY_MS = 120;
var NAVIGATION_TIMEOUT_MS = 15e3;
var SEARCH_DEBOUNCE_MS = 200;
var SEARCH_MIN_LENGTH = 3;
function searchable(query) {
  return query.length >= SEARCH_MIN_LENGTH || /^\d+$/.test(query);
}
function parseJson(raw, empty) {
  try {
    return raw ? JSON.parse(raw) : empty;
  } catch {
    return empty;
  }
}
function asResult(entry) {
  return { entry, score: 0, ranges: [] };
}
function opensList(entry) {
  return (entry.c?.length ?? 0) > 0 && !entry.p && !entry.e && !entry.w && entry.y === void 0;
}
function flatten(entries) {
  return entries.flatMap((entry) => [
    entry,
    ...flatten(entry.c ?? []),
    ...flatten(entry.o ?? [])
  ]);
}
function hookMethods() {
  return {
    mounted() {
      this.input = this.el.querySelector(
        `#${this.el.id}-input`
      );
      this.list = this.el.querySelector(
        `#${this.el.id}-results`
      );
      this.empty = this.el.querySelector("[data-palette-empty]");
      this.hint = this.el.querySelector("[data-palette-hint]");
      this.crumb = this.el.querySelector("[data-palette-crumb]");
      this.keyActions = this.el.querySelector("[data-palette-key-actions]");
      this.keyClose = this.el.querySelector("[data-palette-key-close]");
      this.keyBack = this.el.querySelector("[data-palette-key-back]");
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
      this.handleEvent("palette:results", ({ seq, entries, hint }) => {
        if (seq !== this.seq || this.navigating !== null) return;
        this.remote = entries.map(
          (entry) => asResult(entry.f ? { ...entry, s: "fallback" } : entry)
        );
        this.hintText = hint || null;
        this.resetSelection = true;
        if (this.open) this.render();
      });
      this.onKeydown = (event) => {
        if (event.isComposing) return;
        if (this.openChords.some(([chord]) => matches(event, chord, this.apple))) {
          event.preventDefault();
          if (this.open) this.closePalette();
          else this.openPalette();
          return;
        }
        if (this.open) this.keydownOpen(event);
        else this.keydownClosed(event);
      };
      window.addEventListener("keydown", this.onKeydown, true);
      this.onPageLoadingStop = (event) => {
        if (this.navigating === null) return;
        const kind = event.detail?.kind;
        if (kind === "patch" || kind === "redirect") this.closePalette();
      };
      window.addEventListener("phx:page-loading-stop", this.onPageLoadingStop);
      this.onOpenRequest = () => {
        if (!this.open) this.openPalette();
      };
      window.addEventListener("phx:open-command-palette", this.onOpenRequest);
      this.input.addEventListener("input", () => {
        this.resetSelection = true;
        this.scheduleSearch();
        this.render();
      });
      this.el.querySelector("[data-palette-backdrop]")?.addEventListener("click", () => this.closePalette());
      this.list.addEventListener("mousemove", () => {
        this.usingMouse = true;
      });
      this.list.addEventListener("mouseover", (event) => {
        if (!this.usingMouse || this.navigating !== null) return;
        const item = event.target.closest(
          "[data-index]"
        );
        if (!item) return;
        const next = Number(item.dataset.index);
        if (next === this.selected) return;
        this.selected = next;
        this.paintSelection();
      });
      this.list.addEventListener("click", (event) => {
        if (this.navigating !== null) return;
        const target = event.target;
        const item = target.closest("[data-key]");
        if (!item?.dataset.key) return;
        const mouse = event;
        if (mouse.ctrlKey || mouse.metaKey || mouse.shiftKey || mouse.button === 1) {
          return;
        }
        event.preventDefault();
        if (target.closest("[data-palette-more]")) {
          const result = this.results.find(
            (row) => keyOf(row.entry) === item.dataset.key
          );
          if (result?.entry.o) this.openLevel(result.entry.l, result.entry.o);
          return;
        }
        this.choose(item.dataset.key);
      });
    },
    updated() {
      this.loadEntries();
      if (!this.open) return;
      this.el.hidden = false;
      this.render();
    },
    destroyed() {
      window.removeEventListener("keydown", this.onKeydown, true);
      window.removeEventListener(
        "phx:page-loading-stop",
        this.onPageLoadingStop
      );
      window.removeEventListener(
        "phx:open-command-palette",
        this.onOpenRequest
      );
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.stopNavigating();
    },
    loadEntries() {
      const entries = parseJson(this.el.dataset.entries, []);
      this.entries = prepare(entries);
      this.sectionOrder = parseJson(
        this.el.dataset.sections,
        []
      );
      this.parents = /* @__PURE__ */ new Map();
      const top = new Set(entries.map(keyOf));
      const nested = [];
      const visit = (parent, path) => {
        for (const inner of [...parent.c ?? [], ...parent.o ?? []]) {
          if (!top.has(keyOf(inner))) {
            this.parents.set(inner, path);
            nested.push(inner);
          }
          visit(inner, `${path} \u203A ${inner.l}`);
        }
      };
      entries.forEach((entry) => visit(entry, entry.l));
      this.nested = prepare(nested);
    },
    shortcuts() {
      return flatten(this.entries.map(({ entry }) => entry)).flatMap(
        (entry) => {
          const chords = entry.h ? parseShortcut(entry.h) : null;
          return chords ? [{ chords, target: entry }] : [];
        }
      );
    },
    /**
     * Every row with a shortcut, as a list: the keycaps on a row only say what
     * to press outside the palette, where letters are not typed into the box.
     */
    openShortcuts() {
      this.openLevel(
        this.el.dataset.shortcutsLabel ?? "",
        this.shortcuts().map(({ target }) => target)
      );
    },
    keydownClosed(event) {
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
        this.openLevel(entry.l, entry.c);
      } else {
        this.run(entry);
      }
    },
    keydownOpen(event) {
      if (this.navigating !== null && event.key !== "Escape") {
        event.preventDefault();
        return;
      }
      const caret = this.input.selectionStart ?? this.input.value.length;
      const atEnd = caret === this.input.value.length;
      switch (event.key) {
        case "?":
          if (this.input.value !== "" || !this.el.dataset.shortcutsLabel)
            return;
          event.preventDefault();
          this.openShortcuts();
          break;
        case "Escape":
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
    scheduleSearch() {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.remote = [];
      this.hintText = null;
      const query = this.input.value.trim();
      if (this.levels.length > 0 || !searchable(query)) return;
      this.searchTimer = setTimeout(() => {
        this.seq += 1;
        this.pushEvent("palette_search", { q: query, seq: this.seq });
      }, SEARCH_DEBOUNCE_MS);
    },
    openPalette() {
      this.lastFocused = document.activeElement;
      this.open = true;
      this.usingMouse = false;
      this.stopNavigating();
      this.levels = [];
      this.resetSelection = true;
      this.el.hidden = false;
      this.input.value = "";
      this.input.focus();
      this.render();
    },
    closePalette() {
      this.open = false;
      this.stopNavigating();
      this.el.hidden = true;
      this.input.value = "";
      this.levels = [];
      this.remote = [];
      this.hintText = null;
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = null;
      this.tracker.reset();
      this.lastFocused?.focus();
      this.lastFocused = null;
    },
    render() {
      const mru = readMru(this.storageKey());
      const query = this.input.value;
      const level = this.levels[this.levels.length - 1];
      let sections;
      if (level) {
        this.exact = [];
        sections = [
          {
            key: "",
            rows: query.trim() === "" ? level.entries.map(({ entry }) => asResult(entry)) : search(query, level.entries, mru)
          }
        ];
      } else {
        this.exact = this.remote.filter(({ entry }) => !entry.f && !entry.r);
        const ranked = prepare(
          this.remote.filter(({ entry }) => entry.r).map(({ entry }) => entry)
        );
        const local = (query.trim() === "" ? this.entries : [...this.entries, ...this.nested]).filter(({ entry }) => !entry.f);
        const found = [
          ...this.exact,
          ...search(query, [...local, ...ranked], mru)
        ];
        const fallbacks = [
          ...this.remote.filter(({ entry }) => entry.f),
          ...this.entries.filter(({ entry }) => entry.f).map(({ entry }) => asResult({ ...entry, s: "fallback" }))
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
        Math.min(this.selected, this.results.length - 1)
      );
      const busy = this.navigating;
      const icons = new Map(this.sectionOrder.map((data) => [data.k, data.i]));
      let index = 0;
      this.list.innerHTML = sections.map((section) => {
        const label = "data" in section ? section.data?.l : void 0;
        const heading = label ? headingHtml(label, this.classes) : "";
        return heading + section.rows.map((result) => {
          const key = keyOf(result.entry);
          const chosen = key === busy;
          const state = busy === null ? "idle" : chosen ? "busy" : "inert";
          const html = rowHtml(
            {
              id: `${this.el.id}-option-${index}`,
              index,
              key,
              entry: result.entry,
              ranges: result.ranges,
              parent: level ? void 0 : this.parents.get(result.entry),
              icon: result.entry.i ?? icons.get(result.entry.s),
              active: index === this.selected,
              state,
              spinner: chosen && this.spinnerShown ? this.el.dataset.openingLabel ?? "" : null,
              apple: this.apple
            },
            this.classes
          );
          index += 1;
          return html;
        }).join("");
      }).join("");
      this.paintSelection();
    },
    renderChrome() {
      const level = this.levels[this.levels.length - 1];
      this.crumb.hidden = !level;
      this.crumb.textContent = level ? `${level.title} \u203A` : "";
      this.hint.textContent = this.hintText ?? "";
      this.hint.hidden = !this.hintText;
      if (this.keyClose) this.keyClose.hidden = Boolean(level);
      if (this.keyBack) this.keyBack.hidden = !level;
      if (this.navigating === null) this.el.removeAttribute("aria-busy");
      else this.el.setAttribute("aria-busy", "true");
    },
    /**
     * Moves the highlight over the rows on screen, leaving the nodes in place:
     * selection changes far outnumber list changes, and rebuilding the list
     * under the pointer breaks clicking.
     */
    paintSelection() {
      const rows = this.list.querySelectorAll("[data-index]");
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
    move(delta) {
      if (this.results.length === 0) return;
      this.usingMouse = false;
      this.selected = Math.max(
        0,
        Math.min(this.selected + delta, this.results.length - 1)
      );
      this.paintSelection();
    },
    current() {
      return this.results[this.selected];
    },
    /**
     * Commits a row by its stable key, never its position: recording the use
     * re-sorts the list, so a position captured before would point at a
     * neighbour by the time the row runs.
     */
    choose(key) {
      if (this.navigating !== null) return;
      const chosenKey = key ?? (this.current() ? keyOf(this.current().entry) : void 0);
      const result = this.results.find((row) => keyOf(row.entry) === chosenKey);
      if (!result) return;
      const { entry } = result;
      if (opensList(entry)) {
        this.openLevel(entry.l, entry.c);
        return;
      }
      this.run(entry);
    },
    run(entry) {
      const key = keyOf(entry);
      recordUse(this.storageKey(), key, Date.now());
      if (entry.e) {
        this.closePalette();
        this.pushEvent(entry.e, entry.v ?? {});
        return;
      }
      if (entry.w) {
        this.closePalette();
        window.dispatchEvent(
          new CustomEvent(entry.w, { detail: entry.v ?? {} })
        );
        return;
      }
      if (entry.y !== void 0) {
        this.closePalette();
        navigator.clipboard?.writeText(entry.y).catch(() => void 0);
        return;
      }
      if (!entry.p) return;
      const kind = entry.x === "patch" ? "patch" : "redirect";
      if (!this.open) {
        this.js()[kind === "patch" ? "patch" : "navigate"](entry.p);
        return;
      }
      this.beginNavigating(key, kind);
      this.js()[kind === "patch" ? "patch" : "navigate"](entry.p);
    },
    openLevel(title, entries) {
      this.levels.push({
        title,
        entries: prepare(entries),
        query: this.input.value
      });
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.input.value = "";
      this.resetSelection = true;
      this.render();
    },
    back() {
      const level = this.levels.pop();
      if (!level) return;
      this.input.value = level.query;
      this.resetSelection = true;
      this.render();
    },
    beginNavigating(key, kind) {
      this.navigating = key;
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
        NAVIGATION_TIMEOUT_MS
      );
    },
    stopNavigating() {
      this.navigating = null;
      this.spinnerShown = false;
      this.el.removeAttribute("aria-busy");
      if (this.spinnerTimer) clearTimeout(this.spinnerTimer);
      if (this.navigationTimer) clearTimeout(this.navigationTimer);
      this.spinnerTimer = null;
      this.navigationTimer = null;
    }
  };
}
function createCommandPalette(options = {}) {
  const classes = { ...DEFAULT_CLASSES, ...options.classes };
  const openChords = (options.open ?? DEFAULT_OPEN).map(parseShortcut).filter((chords) => chords !== null);
  const prefix = options.storagePrefix ?? "command_palette:mru";
  return {
    ...hookMethods(),
    classes,
    openChords,
    apple: isApple(),
    storageKey() {
      return `${prefix}:${this.el.dataset.userId || "anonymous"}`;
    }
  };
}
export {
  DEFAULT_CLASSES,
  createCommandPalette,
  searchable
};
