import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyTransientFailures } from './verify-links.mjs';

const url = 'https://example.org/rate-limited';

const report = (code) => {
  return {
    errors: 1,
    error_map: { input: [{ url, status: { code } }] },
  };
};

test('successful link reports need no retry', async () => {
  assert.deepEqual(await verifyTransientFailures({ errors: 0 }), []);
});

test('a rate limit requires an independently successful GET', async () => {
  const calls = [];

  const verified = await verifyTransientFailures(
    report(429),
    async (url, options) => {
      calls.push({ url, method: options.method });

      return new Response(null, { status: 200 });
    },
  );

  assert.deepEqual(calls, [{ url, method: 'GET' }]);
  assert.deepEqual(verified, [{ url, status: 200, method: 'GET' }]);
});

for (const code of [404, 429, 503]) {
  test(`a rate-limit retry rejects HTTP ${code}`, async () => {
    await assert.rejects(
      verifyTransientFailures(report(429), async () => {
        return new Response(null, { status: code });
      }),
      new RegExp(`HTTP ${code}`),
    );
  });
}

test('404 failures are never bypassed by retries', async () => {
  let called = false;

  await assert.rejects(
    verifyTransientFailures(report(404), async () => {
      called = true;

      return new Response(null, { status: 200 });
    }),
  );
  assert.equal(called, false);
});

for (const code of [500, 502, 503, 504]) {
  test(`HTTP ${code} requires a successful independent confirmation`, async () => {
    const verified = await verifyTransientFailures(report(code), async () => {
      return new Response(null, { status: 200 });
    });

    assert.deepEqual(verified, [{ url, status: 200, method: 'GET' }]);
  });
}

test('repeated localized links produce a single retry', async () => {
  const repeated = report(429);

  repeated.error_map.translation = repeated.error_map.input;

  const verified = await verifyTransientFailures(repeated, async () => {
    return new Response(null, { status: 200 });
  });

  assert.equal(verified.length, 1);
});
