(() => {
  const switcher = document.querySelector("[data-section-switcher]");
  if (!(switcher instanceof HTMLDetailsElement)) return;
  const trigger = switcher.querySelector("summary");
  const panel = switcher.querySelector(".section-menu");
  const position = () => {
    if (!switcher.open) return;
    const rect = switcher.closest(".page-navigation").getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(panel).marginBlockStart);
    const below = window.innerHeight - rect.bottom - gap * 2;
    const above = rect.top - gap * 2;
    const minimum = parseFloat(getComputedStyle(trigger).minHeight) * 3;
    const upwards = below < Math.min(minimum, above);
    switcher.dataset.placement = upwards ? "above" : "below";
    switcher.style.setProperty(
      "--navigation-available-height",
      `${Math.max(0, upwards ? above : below)}px`,
    );
  };
  switcher.addEventListener("toggle", position);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !switcher.open) return;
    event.preventDefault();
    switcher.open = false;
    trigger.focus({ preventScroll: true });
  });
  document.addEventListener("pointerdown", (event) => {
    if (!switcher.open || switcher.contains(event.target)) return;
    const restoreFocus = switcher.contains(document.activeElement);
    switcher.open = false;
    if (restoreFocus) trigger.focus({ preventScroll: true });
  });
  document.addEventListener("focusin", (event) => {
    if (switcher.open && !switcher.contains(event.target))
      switcher.open = false;
  });
  window.addEventListener("resize", position);
  document.addEventListener("scroll", position, {
    passive: true,
    capture: true,
  });
})();
