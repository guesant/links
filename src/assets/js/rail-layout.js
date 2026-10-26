(() => {
  const content = document.querySelector(".suspended-content");
  const anchors = [...document.querySelectorAll("[data-rail-anchor]")];
  if (!content || !anchors.length) return;
  let frame = null;
  const position = () => {
    frame = null;
    const gap = parseFloat(getComputedStyle(content).rowGap);
    for (const body of content.querySelectorAll(".suspension-body")) {
      if (!body.getClientRects().length) continue;
      const top = body.getBoundingClientRect().top;
      for (const lantern of body.querySelectorAll("[data-rail-lantern]")) {
        const anchor = anchors[Number(lantern.dataset.railLantern)];
        if (!anchor) continue;
        const value = `${anchor.getBoundingClientRect().bottom + gap / 2 - top}px`;
        lantern.style.setProperty("--rail-lantern-position", value);
        if (
          Number(lantern.dataset.railLantern) ===
          Math.min(1, anchors.length - 1)
        )
          body.style.setProperty("--rail-splice-position", value);
      }
    }
  };
  const schedule = () => {
    if (frame === null) frame = requestAnimationFrame(position);
  };
  const observer = new ResizeObserver(schedule);
  for (const element of [content, ...anchors]) observer.observe(element);
  window.addEventListener("resize", schedule);
  document.fonts.ready.then(schedule);
  schedule();
})();
