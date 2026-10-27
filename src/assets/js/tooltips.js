(() => {
  const controlFor = (target) => {
    if (!(target instanceof Element)) return null;
    return (
      target.closest("[data-tooltip]") ||
      (target.matches("[data-link-view-control]")
        ? target.nextElementSibling
        : null)
    );
  };
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll("[data-tooltip]").forEach((control) => {
      control.dataset.tooltipDismissed = "true";
    });
  });
  document.addEventListener("pointerover", (event) => {
    const control = controlFor(event.target);
    if (control && !control.contains(event.relatedTarget))
      delete control.dataset.tooltipDismissed;
  });
  document.addEventListener("focusin", (event) => {
    const control = controlFor(event.target);
    if (control) delete control.dataset.tooltipDismissed;
  });
})();
