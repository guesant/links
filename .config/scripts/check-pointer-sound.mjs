import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const script = await readFile('src/assets/js/pointer-sound.js', 'utf8');

function harness({
  unsupported = false,
  failedFetch = false,
  failedResume = false,
  delayed = false,
} = {}) {
  const state = { starts: [], stops: 0, decodes: 0, fetches: 0, gains: [] };

  const listeners = new Map();

  let context;

  let finish;

  let now = 0;

  let timerId = 0;

  const timers = new Map();

  const advance = (duration) => {
    now += duration;

    for (const [id, timer] of timers) {
      if (timer.at <= now) {
        timers.delete(id);
        timer.callback();
      }
    }
  };

  const pending = delayed
    ? new Promise((resolve) => {
        finish = resolve;
      })
    : Promise.resolve();

  class AudioContext {
    constructor() {
      context = this;
      this.state = 'suspended';
      this.destination = {};
    }

    createGain() {
      const gain = { gain: { value: 1 }, connect() {} };

      state.gains.push(gain);

      return gain;
    }

    async resume() {
      if (failedResume) throw new Error('Blocked');

      await Promise.resolve();
      this.state = 'running';
    }

    async decodeAudioData(bytes) {
      state.decodes++;

      return bytes;
    }

    createBufferSource() {
      return {
        connect() {},
        disconnect() {},
        addEventListener() {},
        start() {
          state.starts.push(this.buffer);
        },
        stop() {
          state.stops++;
        },
      };
    }
  }

  const document = {
    hidden: false,
    currentScript: {
      dataset: {
        pointerPress: '/prefix/press.wav',
        pointerRelease: '/prefix/release.wav',
      },
    },
    addEventListener(name, listener, options) {
      listeners.set(name, { listener, options });
    },
  };

  runInNewContext(script, {
    performance: { now: () => now },
    setTimeout(callback, delay) {
      const id = ++timerId;

      timers.set(id, { callback, at: now + delay });

      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    document,
    window: {
      ...(unsupported ? {} : { AudioContext }),
      addEventListener(name, listener) {
        listeners.set(name, { listener });
      },
    },
    async fetch(url, options) {
      state.fetches++;
      assert.equal(options.priority, 'low');
      await pending;

      if (failedFetch) throw new Error('Offline');

      return {
        ok: true,
        async arrayBuffer() {
          return url;
        },
      };
    },
  });

  const emit = (name, overrides = {}, elapsed = 100) => {
    advance(elapsed);

    return listeners.get(name)?.listener({
      isTrusted: true,
      pointerType: 'mouse',
      button: 0,
      pointerId: 1,
      ...overrides,
    });
  };

  const flush = async () => {
    for (let i = 0; i < 16; i++) await Promise.resolve();
  };

  return {
    state,
    document,
    listeners,
    emit,
    flush,
    finish,
    advance,
    ready: async () => {
      await flush();

      if (context) context.state = 'running';
    },
  };
}

test('pointer audio prepares two buffers silently and preserves quiet gain', async () => {
  const h = harness();

  await h.ready();
  assert.equal(h.state.fetches, 2);
  assert.equal(h.state.decodes, 2);
  assert.equal(h.state.starts.length, 0);
  assert.equal(h.state.gains[0].gain.value, 0.04);

  for (const name of ['pointerdown', 'pointerup', 'pointercancel']) {
    assert.equal(h.listeners.get(name).options.capture, true);
    assert.equal(h.listeners.get(name).options.passive, true);
  }
});
test('global mouse presses and matching releases play distinct recordings', async () => {
  const h = harness();

  await h.ready();
  h.emit('pointerup');
  assert.equal(h.state.starts.length, 0);
  h.emit('pointerdown', { target: null });
  h.emit('pointerup', { pointerId: 2 });
  assert.equal(h.state.starts.length, 1);
  h.emit('pointerup');
  h.emit('pointerup');
  assert.deepEqual(h.state.starts, [
    '/prefix/press.wav',
    '/prefix/release.wav',
  ]);
});
test('quick release waits until eighty milliseconds after press', async () => {
  const h = harness();

  await h.ready();
  h.emit('pointerdown');
  h.emit('pointerup', {}, 10);
  assert.equal(h.state.starts.length, 1);
  h.advance(69);
  assert.equal(h.state.starts.length, 1);
  h.advance(1);
  assert.equal(h.state.starts.length, 2);
});

for (const name of [
  'pointerdown',
  'pointercancel',
  'blur',
  'visibilitychange',
]) {
  test('pending release is cancelled by ' + name, async () => {
    const h = harness();

    await h.ready();
    h.emit('pointerdown');
    h.emit('pointerup', {}, 5);
    h.document.hidden = true;
    h.emit(name, {}, 5);

    const count = h.state.starts.length;

    h.advance(100);
    assert.equal(h.state.starts.length, count);
  });
}

test('rapid clicks reuse buffers without stacking', async () => {
  const h = harness();

  await h.ready();

  for (let i = 0; i < 4; i++) {
    h.emit('pointerdown');
    h.emit('pointerup');
  }

  assert.equal(h.state.starts.length, 8);
  assert.equal(h.state.stops, 7);
  assert.equal(h.state.decodes, 2);
});

for (const event of [
  { isTrusted: false },
  { button: 2 },
  { pointerType: 'touch' },
  { pointerType: 'pen' },
]) {
  test('pointer audio ignores ' + JSON.stringify(event), async () => {
    const h = harness();

    await h.ready();
    h.emit('pointerdown', event);
    h.emit('pointerup', event);
    assert.equal(h.state.starts.length, 0);
  });
}

for (const name of ['pointercancel', 'blur', 'visibilitychange']) {
  test('pointer audio clears pairing on ' + name, async () => {
    const h = harness();

    await h.ready();
    h.emit('pointerdown');
    h.document.hidden = true;
    h.emit(name);
    h.emit('pointerup');
    assert.equal(h.state.starts.length, 1);
    assert.equal(h.state.stops, 1);
  });
}

test('loading never queues stale presses or releases', async () => {
  const h = harness({ delayed: true });

  h.emit('pointerdown');
  h.emit('pointerup');
  h.finish();
  await h.flush();
  assert.equal(h.state.starts.length, 0);
  h.emit('pointerdown');
  h.emit('pointerup');
  assert.equal(h.state.starts.length, 2);
});

for (const options of [
  { failedFetch: true },
  { failedResume: true },
  { unsupported: true },
]) {
  test('pointer audio fails silently ' + JSON.stringify(options), async () => {
    const h = harness(options);

    await h.flush();
    h.emit('pointerdown');
    h.emit('pointerup');
    await h.flush();
    assert.equal(h.state.starts.length, 0);
  });
}

test('WAV cuts have short distinct PCM recordings', async () => {
  const recordings = await Promise.all(
    ['press', 'release'].map(async (name) => {
      const bytes = await readFile('src/assets/audio/mouse-' + name + '.wav');

      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
      assert(bytes.length > 5000 && bytes.length < 20000);

      return bytes;
    }),
  );

  assert.notDeepEqual(recordings[0], recordings[1]);
});
