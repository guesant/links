(() => {
  document.addEventListener("change", (event) => {
    if (
      event.target instanceof HTMLSelectElement &&
      event.target.matches("[data-language-switcher]")
    ) {
      window.location.assign(event.target.value);
    }
  });
})();
