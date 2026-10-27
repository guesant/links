function lobbySelectList(items, limit = 0) {
  limit = Number(limit);
  if (!Number.isSafeInteger(limit) || limit < 0)
    throw new RangeError("List limit must be a nonnegative integer");
  const total = items.length;
  const selected = limit ? items.slice(0, limit) : items;
  return {
    items: selected,
    total,
    shown: selected.length,
    partial: selected.length < total,
  };
}
function lobbySearchItems(index, query) {
  const normalize = (value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return index.filter((item) => {
    const haystack = normalize(
      [
        item.title,
        item.summary,
        ...(item.tags || []),
        ...Object.values(item.metadata || {}),
      ].join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  });
}
(() => {
  const dialog = document.querySelector("#search-dialog");
  if (!dialog || typeof dialog.showModal !== "function") return;
  const query = dialog.querySelector("input");
  const results = dialog.querySelector("#search-results");
  const status = dialog.querySelector("#search-status");
  const retry = dialog.querySelector("[data-search-retry]");
  let index;
  let loading;
  let state = "idle";
  function render() {
    results.replaceChildren();
    results.setAttribute("aria-busy", String(state === "loading"));
    retry.hidden = state !== "error";
    retry.disabled = state === "loading";
    if (state === "loading") {
      status.textContent = dialog.dataset.searchLoading;
      return;
    }
    if (state === "error") {
      status.textContent = dialog.dataset.searchUnavailable;
      return;
    }
    if (!query.value.trim()) {
      status.textContent = dialog.dataset.searchStart;
      return;
    }
    const selection = lobbySelectList(
      lobbySearchItems(index || [], query.value),
      dialog.dataset.searchLimit,
    );
    status.textContent = selection.partial
      ? dialog.dataset.searchPartial
          .replaceAll("{shown}", String(selection.shown))
          .replaceAll("{total}", String(selection.total))
      : selection.total
        ? String(selection.total)
        : dialog.dataset.searchEmpty;
    const groups = new Map();
    for (const item of selection.items) {
      let list = groups.get(item.group);
      if (!list) {
        const heading = document.createElement("h3");
        heading.textContent = item.group;
        list = document.createElement("ul");
        results.append(heading, list);
        groups.set(item.group, list);
      }
      const row = document.createElement("li");
      const link = document.createElement("a");
      link.href = item.url;
      link.textContent = item.title;
      const meta = document.createElement("small");
      meta.textContent = `${dialog.dataset.searchSource}: ${item.source} · ${dialog.dataset.searchLanguage}: ${item.language}`;
      row.append(link, meta);
      if (item.details_url) {
        const details = document.createElement("a");
        details.href = item.details_url;
        details.textContent = item.details_label;
        details.target = "_blank";
        details.rel = "noopener noreferrer";
        details.setAttribute(
          "aria-label",
          `${item.details_label}: ${item.title}`,
        );
        details.className = "editorial-details";
        row.append(details);
      }
      list.append(row);
    }
  }
  async function load() {
    if (state === "loading") return;
    state = "loading";
    render();
    try {
      loading = fetch(dialog.dataset.searchIndex, {
        signal: AbortSignal.timeout(10000),
      }).then((response) => {
        if (!response.ok) throw new Error("Search unavailable");
        return response.json();
      });
      index = await loading;
      if (
        !Array.isArray(index) ||
        !index.every(
          (item) =>
            item &&
            ["title", "summary", "url", "group", "source", "language"].every(
              (key) => typeof item[key] === "string",
            ) &&
            Array.isArray(item.tags) &&
            (!item.details_url || typeof item.details_label === "string"),
        )
      )
        throw new Error("Invalid search index");
      state = "ready";
      if (dialog.open) render();
    } catch {
      state = "error";
      if (dialog.open) render();
    } finally {
      loading = undefined;
    }
  }
  function open() {
    if (dialog.open) return;
    dialog.showModal();
    query.focus();
    if (state === "idle") load();
    else render();
  }
  retry.addEventListener("click", () => {
    query.focus();
    load();
  });
  for (const button of document.querySelectorAll("[data-search-open]")) {
    button.hidden = false;
    button.addEventListener("click", open);
  }
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (!document.querySelector("dialog[open]") || dialog.open) open();
    }
  });
  query.addEventListener("input", render);
  query.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      const first = results.querySelector("a");
      if (first) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  results.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    const links = [...results.querySelectorAll("a")];
    const position = links.indexOf(document.activeElement);
    if (position < 0) return;
    event.preventDefault();
    if (event.key === "ArrowUp" && position === 0) query.focus();
    else
      links[
        Math.max(
          0,
          Math.min(
            links.length - 1,
            position + (event.key === "ArrowDown" ? 1 : -1),
          ),
        )
      ].focus();
  });
})();
