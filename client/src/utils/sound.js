let audioCtx = null;
let unlocked = false;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
};

export const unlockAudio = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  if (!unlocked) {
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      unlocked = true;
    } catch {
      // Ignore until next interaction
    }
  }
};

export const initAudioUnlockListener = () => {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    unlockAudio();
    if (unlocked) {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    }
  };
  window.addEventListener('pointerdown', handler, { passive: true });
  window.addEventListener('keydown', handler, { passive: true });
  return () => {
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
};

const playToneSequence = (notes) => {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  notes.forEach(({ freq, start, duration, type = 'sine', gain = 0.18 }) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + start);

    gainNode.gain.setValueAtTime(0.0001, now + start);
    gainNode.gain.exponentialRampToValueAtTime(gain, now + start + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now + start);
    osc.stop(now + start + duration + 0.02);
  });
};

export const playNewOrder = () => {
  playToneSequence([
    { freq: 587.33, start: 0, duration: 0.16, type: 'triangle', gain: 0.2 },
    { freq: 880.0, start: 0.14, duration: 0.28, type: 'triangle', gain: 0.22 },
  ]);
};

export const playAlert = () => {
  playToneSequence([
    { freq: 783.99, start: 0, duration: 0.13, type: 'sine', gain: 0.22 },
    { freq: 659.25, start: 0.14, duration: 0.13, type: 'sine', gain: 0.22 },
    { freq: 987.77, start: 0.30, duration: 0.26, type: 'triangle', gain: 0.24 },
  ]);
};
