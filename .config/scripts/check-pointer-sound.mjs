import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";

const script = await readFile("src/assets/js/pointer-sound.js", "utf8");

function harness({
  unsupported = false,
  failedFetch = false,
  failedResume = false,
} = {}) {
  const state = {
    fetches: 0,
    contexts: 0,
    decodes: 0,
    resumes: 0,
    starts: 0,
    stops: 0,
    gains: [],
  };
  const listeners = new Map();
  class Element {
    constructor({
      interactive = true,
      disabled = false,
      inert = false,
      labelDisabled = false,
    } = {}) {
      Object.assign(this, { interactive, disabled, inert });
      this.control = { disabled: labelDisabled };
    }
    closest(selector) {
      return selector.startsWith("a[")
        ? this.interactive
          ? this
          : null
        : this.inert
          ? this
          : null;
    }
    matches() {
      return this.disabled;
    }
  }
  class AudioContext {
    constructor() {
      state.contexts++;
      this.state = "suspended";
      this.destination = {};
    }
    createGain() {
      const node = { gain: { value: 1 }, connect() {} };
      state.gains.push(node);
      return node;
    }
    async resume() {
      state.resumes++;
      if (failedResume) throw new Error("Audio blocked");
      await Promise.resolve();
      this.state = "running";
    }
    async decodeAudioData() {
      state.decodes++;
      return { duration: 0.365688 };
    }
    createBufferSource() {
      return {
        connect() {},
        disconnect() {},
        addEventListener() {},
        start() {
          state.starts++;
        },
        stop() {
          state.stops++;
        },
      };
    }
  }
  runInNewContext(script, {
    Element,
    window: unsupported ? {} : { AudioContext },
    document: {
      currentScript: {
        dataset: { pointerSound: "/prefix/audio/mouse-click.mp3" },
      },
      addEventListener(name, listener, options) {
        listeners.set(name, { listener, options });
      },
    },
    async fetch(url) {
      state.fetches++;
      assert.equal(url, "/prefix/audio/mouse-click.mp3");
      if (failedFetch) throw new Error("Offline");
      return {
        ok: true,
        async arrayBuffer() {
          return new ArrayBuffer(8);
        },
      };
    },
  });
  return {
    state,
    listeners,
    press: (event = {}, control = {}) =>
      listeners.get("pointerdown")?.listener({
        isTrusted: true,
        button: 0,
        isPrimary: true,
        target: new Element(control),
        ...event,
      }),
  };
}

test("pointer sound stays silent on load and starts quietly on pointerdown", async () => {
  const { state, listeners, press } = harness();
  assert.equal(state.fetches, 1);
  assert.equal(state.contexts, 0);
  assert.equal(state.starts, 0);
  assert.equal(listeners.size, 1);
  assert.equal(listeners.get("pointerdown").options.passive, true);
  assert.equal(listeners.get("pointerdown").options.capture, true);
  await press();
  assert.equal(state.starts, 1);
  assert.equal(state.resumes, 1);
  assert.equal(state.gains[0].gain.value, 0.04);
});
test("rapid pointer presses reuse the recording without stacking sound", async () => {
  const { state, press } = harness();
  for (let index = 0; index < 4; index++) await press();
  assert.equal(state.starts, 4);
  assert.equal(state.stops, 3);
  assert.equal(state.fetches, 1);
  assert.equal(state.contexts, 1);
  assert.equal(state.decodes, 1);
});
for (const [name, event, control] of [
  ["synthetic events", { isTrusted: false }, {}],
  ["secondary buttons", { button: 2 }, {}],
  ["secondary touches", { isPrimary: false }, {}],
  ["non-element targets", { target: null }, {}],
  ["noninteractive areas", {}, { interactive: false }],
  ["disabled controls", {}, { disabled: true }],
  ["inert or aria-disabled controls", {}, { inert: true }],
  ["labels for disabled inputs", {}, { labelDisabled: true }],
]) {
  test(`pointer sound ignores ${name}`, async () => {
    const { state, press } = harness();
    await press(event, control);
    assert.equal(state.contexts, 0);
    assert.equal(state.starts, 0);
  });
}
for (const options of [{ failedFetch: true }, { failedResume: true }]) {
  test(`pointer sound tolerates ${Object.keys(options)[0]}`, async () => {
    const { state, press } = harness(options);
    await assert.doesNotReject(press());
    assert.equal(state.starts, 0);
  });
}
test("pointer sound degrades silently without Web Audio", () => {
  const { state, listeners } = harness({ unsupported: true });
  assert.equal(state.fetches, 0);
  assert.equal(listeners.size, 0);
});
