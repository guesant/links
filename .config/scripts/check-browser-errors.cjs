const assert = require('node:assert/strict');

module.exports = async function withBrowserErrors(browser, task) {
  const errors = [];

  const observed = new Map();

  const observe = async (target) => {
    const page = await target.page();

    if (!page) {
      return;
    }

    const listener = (error) => {
      errors.push({
        url: page.url(),
        message: error.message,
        stack: error.stack,
      });
    };

    observed.set(page, listener);
    page.on('pageerror', listener);
  };

  browser.on('targetcreated', observe);

  try {
    await task();
  } catch (error) {
    throw new AggregateError([error, ...errors], 'Browser scenario failed');
  } finally {
    browser.off('targetcreated', observe);

    for (const [page, listener] of observed) {
      page.off('pageerror', listener);
    }
  }

  assert.deepEqual(errors, [], 'No uncaught errors during browser scenarios');
};
