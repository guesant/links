import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { clientScript } from './client-source.mjs';

const script = await clientScript('interface');

function harness({
  current = 'minecraft',
  reduced = false,
  href = 'https://guesant.net/pt-br/career/?x=1#skills',
} = {}) {
  const events = new Map();

  const biosEvents = new Map();

  const timers = new Map();

  const state = {
    bootCount: 0,
    bootFocusCount: 0,
    writes: [],
    replaced: [],
    assigned: [],
  };

  const browserLocation = {
    href,
    assign(value) {
      state.assigned.push(value);
    },
  };

  const postLines = [
    1,
    4,
    8,
    11,
    13,
    15,
    17,
  ].map((biosStep) => {
    return {
      dataset: {
        biosStep: String(biosStep),
      },
      hidden: true,
    };
  });

  const bootLine = {
    hidden: true,
  };

  const progress = {
    textContent: '',
  };

  const root = {
    dataset: {
      theme: 'light',
      motion: 'on',
      interface: current,
    },
  };

  let identifier = 0;

  class HTMLInputElement {
    constructor(value) {
      this.value = value;
      this.checked = true;

      const resolveInterfaceUrl = () => {
        if (value === 'terminal') {
          return 'https://guesant.net/pt-br/terminal/career/';
        }

        return 'https://guesant.net/pt-br/career/';
      };

      this.dataset = {
        interfaceUrl: resolveInterfaceUrl(),
      };
    }

    matches(selector) {
      return selector === '[data-interface-option]';
    }
  }

  class HTMLElement {
    constructor() {
      this.isConnected = true;
    }

    closest() {
      return null;
    }

    focus() {}
  }

  const bios = {
    open: false,
    focus() {
      state.bootFocusCount++;
    },
    showModal() {
      this.open = true;
      state.bootCount++;
    },
    close() {
      this.open = false;
    },
    querySelector(selector) {
      if (selector === '[data-bios-interface]') {
        return {
          textContent: '',
        };
      }

      if (selector === '[data-bios-boot-line]') {
        return bootLine;
      }

      if (selector === '[data-bios-progress]') {
        return progress;
      }

      return {
        addEventListener: (_, callback) => {
          return biosEvents.set('skip', callback);
        },
      };
    },
    querySelectorAll(selector) {
      if (selector === '[data-bios-step]') {
        return postLines;
      }

      return [];
    },
    addEventListener(name, callback) {
      biosEvents.set(name, callback);
    },
  };

  const document = {
    documentElement: root,
    activeElement: null,
    querySelector(selector) {
      if (selector === '#bios-dialog') {
        return bios;
      }

      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'dialog[open]' && bios.open) {
        return [
          bios,
        ];
      }

      return [];
    },
    addEventListener(name, callback) {
      events.set(name, [
        ...(events.get(name) || []),
        callback,
      ]);
    },
  };

  runInNewContext(script, {
    document,
    HTMLInputElement,
    HTMLElement,
    Element: HTMLElement,
    URL,
    location: browserLocation,
    history: {
      replaceState(_, __, value) {
        state.replaced.push(value);
      },
    },
    matchMedia: () => {
      return {
        matches: reduced,
      };
    },
    setTimeout(callback, delay) {
      assert.equal(delay, 80);

      const id = ++identifier;

      timers.set(id, callback);

      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });

  const emit = (name, event = {}) => {
    for (const callback of events.get(name) || []) {
      callback(event);
    }
  };

  emit('DOMContentLoaded');

  return {
    root,
    state,
    bios,
    select(value) {
      emit('change', {
        target: new HTMLInputElement(value),
      });
    },
    finish() {
      for (const [
        id,
        callback,
      ] of timers) {
        timers.delete(id);
        callback();
      }
    },
    clearBootMarker() {
      const url = new URL(browserLocation.href);

      url.searchParams.delete('lobby-boot');
      browserLocation.href = url.href;
    },
    skip() {
      biosEvents.get('skip')();
    },
    tick() {
      const [
        id,
        callback,
      ] = timers.entries().next().value;

      timers.delete(id);
      callback();
    },
    postLines,
    bootLine,
    progress,
    escape() {
      biosEvents.get('cancel')({
        preventDefault() {},
      });
    },
  };
}

test('interface route is independent from appearance and stored preferences', () => {
  const h = harness({
    current: 'terminal',
  });

  assert.equal(h.root.dataset.interface, 'terminal');
  assert.equal(h.root.dataset.theme, 'light');
  assert.equal(h.state.bootCount, 0);
});
test('BIOS reveals the mock POST progressively after opening the Terminal route', () => {
  const h = harness({
    current: 'terminal',
    href: 'https://guesant.net/pt-br/terminal/career/?lobby-boot=1#skills',
  });

  assert.equal(h.state.bootCount, 1);
  assert.equal(h.state.bootFocusCount, 1);
  h.tick();
  assert.equal(h.postLines[0].hidden, false);
  assert.equal(h.postLines[1].hidden, true);
  h.skip();
  assert.equal(h.bios.open, false);
});
test('switching interfaces navigates to the matching route and boots Terminal once', () => {
  const h = harness();

  h.select('terminal');
  assert.equal(h.state.bootCount, 0);
  assert.equal(
    h.state.assigned[0],
    'https://guesant.net/pt-br/terminal/career/?x=1&lobby-boot=1#skills',
  );

  const terminal = harness({
    current: 'terminal',
    href: 'https://guesant.net/pt-br/terminal/career/?x=1&lobby-boot=1#skills',
  });

  assert.equal(terminal.state.bootCount, 1);
  terminal.finish();
  assert.equal(terminal.bios.open, false);
  terminal.clearBootMarker();
  terminal.select('terminal');
  assert.equal(terminal.state.assigned.length, 0);
  terminal.select('minecraft');
  assert.equal(
    terminal.state.assigned[0],
    'https://guesant.net/pt-br/career/?x=1#skills',
  );
  assert.equal(terminal.state.bootCount, 1);
});
test('Reboot consumes its marker once and preserves Terminal route, query and hash', () => {
  const h = harness({
    current: 'terminal',
    href: 'https://guesant.net/pt-br/terminal/career/?x=1&lobby-boot=1#skills',
  });

  assert.equal(h.state.bootCount, 1);
  assert.equal(h.root.dataset.interface, 'terminal');
  assert.equal(
    h.state.replaced[0],
    'https://guesant.net/pt-br/terminal/career/?x=1#skills',
  );
});

for (const method of [
  'skip',
  'escape',
]) {
  test(`BIOS ${method} cancels its timer`, () => {
    const h = harness({
      current: 'terminal',
      href: 'https://guesant.net/pt-br/terminal/?lobby-boot=1',
    });

    assert.equal(h.state.bootCount, 1);
    h[method]();
    h.finish();
    assert.equal(h.bios.open, false);
  });
}

test('reduced motion skips BIOS waiting on a Terminal route', () => {
  const h = harness({
    current: 'terminal',
    reduced: true,
    href: 'https://guesant.net/pt-br/terminal/?lobby-boot=1',
  });

  assert.equal(h.root.dataset.interface, 'terminal');
  assert.equal(h.state.bootCount, 0);
});
