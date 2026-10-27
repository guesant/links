import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
const context = { document: { querySelector: () => null } };
runInNewContext(await readFile("src/assets/js/search.js", "utf8"), context);
const items = [
  {
    id: "one",
    title: "Formação",
    summary: "A public summary",
    tags: ["backend"],
    metadata: { area: "Computação" },
  },
  { id: "two", title: "Project", summary: "Other", tags: [], metadata: {} },
];
test("search matches accents, case, tags, metadata and multiple terms", () => {
  for (const query of ["FORMACAO", "backend", "computacao", "public backend"])
    assert.equal(context.lobbySearchItems(items, query)[0].id, "one");
  assert.equal(context.lobbySearchItems(items, "backend missing").length, 0);
  assert.equal(context.lobbySearchItems(items, " ").length, 0);
});
test("search bounds results without changing source records", () => {
  const many = Array.from({ length: 150 }, (_, id) => ({ ...items[0], id }));
  assert.equal(context.lobbySearchItems(many, "backend").length, 100);
  assert.equal(many.length, 150);
});

function searchHarness() {
  let activeElement;
  class Element {
    constructor() {
      this.children = [];
      this.listeners = new Map();
      this.attributes = {};
      this.value = "";
      this.hidden = false;
      this.disabled = false;
    }
    addEventListener(name, listener) {
      this.listeners.set(name, listener);
    }
    append(...children) {
      this.children.push(...children);
    }
    replaceChildren() {
      this.children = [];
    }
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
    focus() {
      activeElement = this;
    }
    showModal() {
      this.open = true;
    }
  }
  const query = new Element();
  const results = new Element();
  const status = new Element();
  const retry = new Element();
  const button = new Element();
  const dialog = new Element();
  dialog.dataset = {
    searchIndex: "/search/pt-br.json",
    searchLoading: "Loading",
    searchStart: "Start",
    searchUnavailable: "Unavailable",
    searchEmpty: "Empty",
    searchSource: "Source",
    searchLanguage: "Language",
  };
  dialog.querySelector = (selector) =>
    ({
      input: query,
      "#search-results": results,
      "#search-status": status,
      "[data-search-retry]": retry,
    })[selector];
  const requests = [];
  runInNewContext(script, {
    AbortSignal: {
      timeout(duration) {
        assert.equal(duration, 10000);
        return "timeout-signal";
      },
    },
    document: {
      querySelector: (selector) =>
        selector === "#search-dialog" ||
        (selector === "dialog[open]" && dialog.open)
          ? dialog
          : null,
      querySelectorAll: () => [button],
      createElement: () => new Element(),
      addEventListener() {},
      get activeElement() {
        return activeElement;
      },
    },
    fetch(url, options) {
      assert.equal(url, dialog.dataset.searchIndex);
      assert.equal(options.signal, "timeout-signal");
      return new Promise((resolve, reject) =>
        requests.push({ resolve, reject }),
      );
    },
  });
  const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };
  return {
    dialog,
    query,
    results,
    status,
    retry,
    requests,
    flush,
    open() {
      button.listeners.get("click")();
    },
    input(value) {
      query.value = value;
      query.listeners.get("input")();
    },
    retryLoad() {
      retry.listeners.get("click")();
    },
    resolve(value, ok = true) {
      requests.at(-1).resolve({ ok, json: async () => value });
    },
  };
}
const script = await readFile("src/assets/js/search.js", "utf8");
const searchEntry = {
  ...items[0],
  url: "/pt-br/career/",
  group: "Pages",
  source: "lobby",
  language: "pt-br",
};
test("search shows loading rather than no results while preparing its index", async () => {
  const h = searchHarness();
  h.open();
  assert.equal(h.status.textContent, "Loading");
  assert.equal(h.results.attributes["aria-busy"], "true");
  h.input("backend");
  assert.equal(h.status.textContent, "Loading");
  h.resolve([searchEntry]);
  await h.flush();
  assert.equal(h.status.textContent, "1");
  assert.equal(h.results.attributes["aria-busy"], "false");
  assert.equal(h.retry.hidden, true);
});
test("search keeps failure visible while editing and retries without losing the query", async () => {
  const h = searchHarness();
  h.open();
  h.input("backend");
  h.requests[0].reject(new Error("Offline"));
  await h.flush();
  assert.equal(h.status.textContent, "Unavailable");
  assert.equal(h.retry.hidden, false);
  h.input("formacao");
  assert.equal(h.status.textContent, "Unavailable");
  h.retryLoad();
  h.retryLoad();
  assert.equal(h.requests.length, 2);
  assert.equal(h.status.textContent, "Loading");
  assert.equal(h.query.value, "formacao");
  h.resolve([searchEntry]);
  await h.flush();
  assert.equal(h.status.textContent, "1");
  assert.equal(h.retry.hidden, true);
});
test("search handles empty indexes, malformed indexes and HTTP failures distinctly", async () => {
  for (const [value, ok, expected] of [
    [[], true, "Empty"],
    [{}, true, "Unavailable"],
    [[null], true, "Unavailable"],
    [[], false, "Unavailable"],
  ]) {
    const h = searchHarness();
    h.open();
    h.input("anything");
    h.resolve(value, ok);
    await h.flush();
    assert.equal(h.status.textContent, expected);
    assert.equal(h.retry.hidden, expected !== "Unavailable");
  }
});
test("search settles closed requests and reopens without fetching a ready index again", async () => {
  const h = searchHarness();
  h.open();
  h.dialog.open = false;
  h.resolve([searchEntry]);
  await h.flush();
  h.open();
  assert.equal(h.requests.length, 1);
  assert.equal(h.status.textContent, "Start");
  assert.equal(h.results.attributes["aria-busy"], "false");
});
