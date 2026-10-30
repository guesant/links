import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { clientScript } from './client-source.mjs';

const script = await clientScript('link-view');

function harness({ saved, blocked = false } = {}) {
  const root = {
    dataset: {},
  };

  const listeners = new Map();

  const writes = [];

  class HTMLInputElement {
    constructor(value, checked = false, matches = true) {
      Object.assign(this, {
        value,
        checked,
        matching: matches,
      });
    }

    matches() {
      return this.matching;
    }
  }

  const controls = [
    new HTMLInputElement('compact'),
    new HTMLInputElement('detailed'),
  ];

  runInNewContext(script, {
    HTMLInputElement,
    document: {
      documentElement: root,
      querySelectorAll: () => {
        return controls;
      },
      addEventListener: (name, callback) => {
        return listeners.set(name, callback);
      },
    },
    window: {
      localStorage: {
        getItem() {
          if (blocked) {
            throw new Error('Storage blocked');
          }

          return saved;
        },
        setItem(key, value) {
          if (blocked) {
            throw new Error('Storage blocked');
          }

          writes.push({
            key,
            value,
          });
        },
      },
    },
  });

  return {
    root,
    controls,
    writes,
    select(value, options = {}) {
      listeners.get('change')({
        target: new HTMLInputElement(
          value,
          options.checked ?? true,
          options.matching ?? true,
        ),
      });
    },
    ready: () => {
      return listeners.get('DOMContentLoaded')();
    },
  };
}

test('link display defaults to compact and ignores invalid saved values', () => {
  for (const saved of [
    undefined,
    '',
    'unknown',
    '<script>',
  ]) {
    const { root, controls, writes } = harness({
      saved,
    });

    assert.equal(root.dataset.linkView, 'compact');
    assert.equal(root.dataset.linkViewReady, 'true');
    assert.deepEqual(
      controls.map((entry) => {
        return entry.checked;
      }),
      [
        true,
        false,
      ],
    );
    assert.deepEqual(writes, []);
  }
});
test('saved detailed mode is applied before DOM readiness', () => {
  const { root, controls, ready } = harness({
    saved: 'detailed',
  });

  assert.equal(root.dataset.linkView, 'detailed');
  controls[1].checked = false;
  ready();
  assert.deepEqual(
    controls.map((entry) => {
      return entry.checked;
    }),
    [
      false,
      true,
    ],
  );
});
test('switching link display persists one global preference', () => {
  const { root, controls, select, writes } = harness();

  select('detailed');
  assert.equal(root.dataset.linkView, 'detailed');
  assert.deepEqual(
    controls.map((entry) => {
      return entry.checked;
    }),
    [
      false,
      true,
    ],
  );
  select('compact');
  assert.equal(root.dataset.linkView, 'compact');
  assert.deepEqual(writes, [
    {
      key: 'guesant-links-view',
      value: 'detailed',
    },
    {
      key: 'guesant-links-view',
      value: 'compact',
    },
  ]);
});
test('blocked storage does not prevent changing link display', () => {
  const { root, select } = harness({
    blocked: true,
  });

  assert.equal(root.dataset.linkView, 'compact');
  select('detailed');
  assert.equal(root.dataset.linkView, 'detailed');
});
test('unrelated controls, unchecked inputs and invalid modes are ignored', () => {
  const { root, select, writes } = harness();

  select('unexpected');
  select('detailed', {
    checked: false,
  });
  select('detailed', {
    matching: false,
  });
  assert.equal(root.dataset.linkView, 'compact');
  assert.deepEqual(writes, []);
});
