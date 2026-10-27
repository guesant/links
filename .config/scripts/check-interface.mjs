import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
const script = await readFile("src/assets/js/interface.js", "utf8");
function harness({
  saved,
  blocked = false,
  reduced = false,
  href = "https://guesant.net/pt-br/career/?x=1#skills",
} = {}) {
  const events = new Map();
  const biosEvents = new Map();
  const timers = new Map();
  const state = { bootCount: 0, writes: [], replaced: [], assigned: [] };
  const root = { dataset: { theme: "light", motion: "on" } };
  let identifier = 0;
  class HTMLInputElement {
    constructor(value) {
      this.value = value;
      this.checked = true;
    }
    matches(selector) {
      return selector === "[data-interface-option]";
    }
  }
  const bios = {
    open: false,
    showModal() {
      this.open = true;
      state.bootCount++;
    },
    close() {
      this.open = false;
    },
    querySelector(selector) {
      return selector === "[data-bios-interface]"
        ? { textContent: "" }
        : {
            addEventListener: (_, callback) => biosEvents.set("skip", callback),
          };
    },
    addEventListener(name, callback) {
      biosEvents.set(name, callback);
    },
  };
  const document = {
    documentElement: root,
    activeElement: null,
    querySelector(selector) {
      return selector === "#bios-dialog" ? bios : null;
    },
    querySelectorAll(selector) {
      return selector === "dialog[open]" && bios.open ? [bios] : [];
    },
    addEventListener(name, callback) {
      events.set(name, [...(events.get(name) || []), callback]);
    },
  };
  runInNewContext(script, {
    document,
    HTMLInputElement,
    URL,
    location: {
      href,
      assign(value) {
        state.assigned.push(value);
      },
    },
    history: {
      replaceState(_, __, value) {
        state.replaced.push(value);
      },
    },
    localStorage: {
      getItem() {
        if (blocked) throw Error("Blocked");
        return saved;
      },
      setItem(key, value) {
        if (blocked) throw Error("Blocked");
        state.writes.push([key, value]);
      },
    },
    matchMedia: () => ({ matches: reduced }),
    setTimeout(callback, delay) {
      assert.equal(delay, 2000);
      const id = ++identifier;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });
  const emit = (name, event = {}) => {
    for (const callback of events.get(name) || []) callback(event);
  };
  emit("DOMContentLoaded");
  return {
    root,
    state,
    bios,
    select(value) {
      emit("change", { target: new HTMLInputElement(value) });
    },
    finish() {
      for (const [id, callback] of timers) {
        timers.delete(id);
        callback();
      }
    },
    skip() {
      biosEvents.get("skip")();
    },
    escape() {
      biosEvents.get("cancel")({ preventDefault() {} });
    },
  };
}
test("interface restores separately from appearance without repeating BIOS", () => {
  const h = harness({ saved: "terminal" });
  assert.equal(h.root.dataset.interface, "terminal");
  assert.equal(h.root.dataset.theme, "light");
  assert.equal(h.state.bootCount, 0);
});
test("switching into Terminal boots once and persists", () => {
  const h = harness();
  h.select("terminal");
  assert.equal(h.state.bootCount, 1);
  assert.equal(h.bios.open, true);
  h.finish();
  assert.equal(h.bios.open, false);
  h.select("terminal");
  assert.equal(h.state.bootCount, 1);
  h.select("minecraft");
  assert.equal(h.state.bootCount, 1);
  assert.equal(h.state.writes.at(-1)[1], "minecraft");
});
test("Reboot consumes its marker once and preserves route, query and hash", () => {
  const h = harness({
    href: "https://guesant.net/pt-br/career/?x=1&lobby-boot=1#skills",
  });
  assert.equal(h.state.bootCount, 1);
  assert.equal(h.root.dataset.interface, "minecraft");
  assert.equal(
    h.state.replaced[0],
    "https://guesant.net/pt-br/career/?x=1#skills",
  );
});
for (const method of ["skip", "escape"])
  test(`BIOS ${method} cancels its timer`, () => {
    const h = harness();
    h.select("terminal");
    h[method]();
    h.finish();
    assert.equal(h.bios.open, false);
  });
test("reduced motion skips waiting and blocked storage does not block selection", () => {
  const h = harness({ reduced: true, blocked: true });
  h.select("terminal");
  assert.equal(h.root.dataset.interface, "terminal");
  assert.equal(h.state.bootCount, 0);
});
