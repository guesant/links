(() => {
  const urls = document.currentScript?.dataset;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!urls?.pointerPress || !urls.pointerRelease || !AudioContextClass) return;
  let context;
  let gain;
  let playing;
  let pressed;
  let pressedAt = 0;
  let releaseTimer;
  let releasePointer;
  const minimumPressDuration = 80;
  const buffers = {};
  try {
    context = new AudioContextClass();
    gain = context.createGain();
    gain.gain.value = 0.04;
    gain.connect(context.destination);
  } catch {
    return;
  }
  for (const [name, url] of Object.entries({
    press: urls.pointerPress,
    release: urls.pointerRelease,
  })) {
    fetch(url, { priority: 'low' })
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .then((bytes) => (bytes ? context.decodeAudioData(bytes) : null))
      .then((buffer) => {
        buffers[name] = buffer;
      })
      .catch(() => {});
  }
  function stop() {
    if (!playing) return;
    try {
      playing.stop();
    } catch {}
    playing.disconnect();
    playing = null;
  }
  function reset() {
    pressed = undefined;
    clearTimeout(releaseTimer);
    releaseTimer = undefined;
    releasePointer = undefined;
    stop();
  }
  function play(name) {
    stop();
    if (!buffers[name] || context.state !== 'running') return;
    try {
      const source = context.createBufferSource();
      source.buffer = buffers[name];
      source.connect(gain);
      source.addEventListener(
        'ended',
        () => {
          source.disconnect();
          if (playing === source) playing = null;
        },
        { once: true },
      );
      source.start();
      playing = source;
    } catch {}
  }
  const valid = (event) =>
    event.isTrusted && event.pointerType === 'mouse' && event.button === 0;
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!valid(event)) return;
      reset();
      pressed = event.pointerId;
      pressedAt = performance.now();
      if (context.state === 'suspended') {
        try {
          Promise.resolve(context.resume()).catch(() => {});
        } catch {}
      }
      play('press');
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    'pointerup',
    (event) => {
      if (!valid(event) || pressed !== event.pointerId) return;
      pressed = undefined;
      if (!buffers.release || context.state !== 'running') return;
      const remaining = minimumPressDuration - (performance.now() - pressedAt);
      if (remaining <= 0) {
        play('release');
      } else {
        releasePointer = event.pointerId;
        releaseTimer = setTimeout(() => {
          releaseTimer = undefined;
          releasePointer = undefined;
          play('release');
        }, remaining);
      }
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    'pointercancel',
    (event) => {
      if (pressed === event.pointerId || releasePointer === event.pointerId)
        reset();
    },
    { capture: true, passive: true },
  );
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) reset();
  });
})();
