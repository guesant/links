import assert from 'node:assert/strict';
import test from 'node:test';
import { createLanguageNavigation } from '../../website/src/lib/language-navigation.ts';

function pendingNavigation() {
  const requests = [];

  const fallbacks = [];

  const context = {
    current: 'pt-br',
    default: 'pt-br',
    neutral: false,
    routes: ['pt-br', 'fr', 'es'].map((id) => {
      return { id, home: `/${id}/`, url: `/${id}/code/` };
    }),
  };

  let saved = null;

  const controller = createLanguageNavigation({
    page: () => {
      return { context, url: new URL('https://example.test/pt-br/code/') };
    },
    languages: () => {
      return ['pt-BR'];
    },
    storage: () => {
      return {
        getItem: () => {
          return saved;
        },
        setItem: (_key, value) => {
          saved = value;
        },
      };
    },
    navigate: (url) => {
      return new Promise((resolve, reject) => {
        requests.push({ url, resolve, reject });
      });
    },
    replaceURL: () => {},
    fallback: (url) => {
      fallbacks.push(url.href);
    },
  });

  return {
    controller,
    requests,
    fallbacks,
    saved: () => {
      return saved;
    },
  };
}

test('normalization cannot enqueue an older language during a manual transition', async () => {
  const { controller, requests } = pendingNavigation();

  const navigation = controller.select('fr');

  await controller.normalize();
  assert.equal(requests.length, 1);
  requests[0].resolve();
  await navigation;
});

test('a newer manual choice wins and an older rejection cannot reload the page', async () => {
  const { controller, requests, fallbacks, saved } = pendingNavigation();

  const first = controller.select('fr');

  const last = controller.select('es');

  assert.equal(saved(), 'es');
  requests[0].reject(new Error('Older navigation cancelled'));
  await first;
  requests[1].resolve();
  await last;
  assert.equal(requests[1].url.pathname, '/es/code/');
  assert.deepEqual(fallbacks, []);
});

test('destroying the controller prevents late native fallbacks and new requests', async () => {
  const { controller, requests, fallbacks } = pendingNavigation();

  const navigation = controller.select('fr');

  controller.destroy();
  requests[0].reject(new Error('Document no longer active'));
  await navigation;
  await controller.select('es');
  assert.equal(requests.length, 1);
  assert.deepEqual(fallbacks, []);
});

test('a normal page navigation cancels an older language fallback', async () => {
  const { controller, requests, fallbacks } = pendingNavigation();

  const navigation = controller.select('fr');

  controller.beforeNavigate(new URL('https://example.test/pt-br/writing/'));
  requests[0].reject(new Error('Superseded by a different page'));
  await navigation;
  assert.deepEqual(fallbacks, []);
});

test('the matching language navigation keeps its native fallback available', async () => {
  const { controller, requests, fallbacks } = pendingNavigation();

  const navigation = controller.select('fr');

  controller.beforeNavigate(requests[0].url);
  requests[0].reject(new Error('Actual language request failed'));
  await navigation;
  assert.deepEqual(fallbacks, ['https://example.test/fr/code/']);
});
