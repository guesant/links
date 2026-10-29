(() => {
  let observer;

  let frame = null;

  const position = () => {
    frame = null;

    const content = document.querySelector('.suspended-content');

    const anchors = [...document.querySelectorAll('[data-rail-anchor]')];

    if (!content || !anchors.length) return;

    const gap = parseFloat(getComputedStyle(content).rowGap);

    for (const body of content.querySelectorAll('.suspension-body')) {
      if (!body.getClientRects().length) continue;

      const top = body.getBoundingClientRect().top;

      for (const lantern of body.querySelectorAll('[data-rail-lantern]')) {
        const anchor = anchors[Number(lantern.dataset.railLantern)];

        if (!anchor) continue;

        const value = `${anchor.getBoundingClientRect().bottom + gap / 2 - top}px`;

        lantern.style.setProperty('--rail-lantern-position', value);

        if (
          Number(lantern.dataset.railLantern) ===
          Math.min(1, anchors.length - 1)
        )
          body.style.setProperty('--rail-splice-position', value);
      }
    }
  };

  const schedule = () => {
    if (frame === null) frame = requestAnimationFrame(position);
  };

  const observePage = () => {
    observer?.disconnect();
    observer = new ResizeObserver(schedule);

    const content = document.querySelector('.suspended-content');

    const anchors = [...document.querySelectorAll('[data-rail-anchor]')];

    for (const element of [content, ...anchors])
      if (element) observer.observe(element);

    document.fonts.ready.then(schedule);
    schedule();
  };

  window.addEventListener('resize', schedule);
  document.addEventListener('lobby:navigate', observePage);
  observePage();
})();
