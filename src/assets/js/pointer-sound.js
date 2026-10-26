(() => {
  const url = document.currentScript?.dataset.pointerSound;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!url || !AudioContextClass) return;

  const bytes = fetch(url)
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .catch(() => null);
  let context;
  let gain;
  let buffer;
  let playing;

  document.addEventListener(
    "pointerdown",
    async (event) => {
      if (!event.isTrusted || event.button !== 0 || event.isPrimary === false)
        return;
      if (!(event.target instanceof Element)) return;
      const control = event.target.closest(
        'a[href],button,summary,select,input[type="button"],input[type="submit"],input[type="reset"],input[type="checkbox"],input[type="radio"],[role="button"],label[for]',
      );
      if (
        !control ||
        control.matches(":disabled") ||
        control.closest('[inert],[aria-disabled="true"]') ||
        control.control?.disabled
      )
        return;

      try {
        if (!context) {
          context = new AudioContextClass();
          gain = context.createGain();
          gain.gain.value = 0.04;
          gain.connect(context.destination);
        }
        const resumed =
          context.state === "suspended" ? context.resume() : Promise.resolve();
        buffer ||= bytes
          .then((data) =>
            data ? context.decodeAudioData(data.slice(0)) : null,
          )
          .catch(() => null);
        const [decoded] = await Promise.all([buffer, resumed]);
        if (!decoded || context.state !== "running") return;
        if (playing) playing.stop();
        const source = context.createBufferSource();
        source.buffer = decoded;
        source.connect(gain);
        source.addEventListener(
          "ended",
          () => {
            source.disconnect();
            if (playing === source) playing = null;
          },
          { once: true },
        );
        source.start();
        playing = source;
      } catch {}
    },
    { capture: true, passive: true },
  );
})();
