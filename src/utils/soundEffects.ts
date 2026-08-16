// Web Audio API Synthesizer for Game Sound Effects (Zero External Dependencies)

let audioCtx: AudioContext | null = null;
let soundEnabled = true;

// Retrieve mute preference from localStorage
try {
  const savedMute = localStorage.getItem("classroom_archives_sound_muted");
  if (savedMute !== null) {
    soundEnabled = savedMute !== "true";
  }
} catch (e) {
  // ignore
}

export function isSoundMuted(): boolean {
  return !soundEnabled;
}

export function toggleSoundMute(): boolean {
  soundEnabled = !soundEnabled;
  try {
    localStorage.setItem("classroom_archives_sound_muted", String(!soundEnabled));
  } catch (e) {
    // ignore
  }
  return soundEnabled;
}

function getAudioContext(): AudioContext | null {
  if (!soundEnabled) return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

// 1. Wheel Spin Ticking Sound
export function playSpinTick() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(600 + Math.random() * 200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {
    // audio error fallback
  }
}

// 2. Submitting Answers / Paper Click Sound
export function playSubmitChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    
    // Play dual rising chime
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.15, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.18);
    });
  } catch (e) {
    // ignore
  }
}

// 3. Earning Badge Sparkle Sound
export function playBadgeFanfare() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // Magic arpeggio
    const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.18, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.25);
    });
  } catch (e) {
    // ignore
  }
}

// 4. End-of-Game Celebration Victory Fanfare
export function playCelebrationVictory() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // Grand victory chord sequence (C - G - C - E - G - High C)
    const sequence = [
      { f: 523.25, time: 0.0, duration: 0.15 },
      { f: 659.25, time: 0.12, duration: 0.15 },
      { f: 783.99, time: 0.24, duration: 0.15 },
      { f: 1046.50, time: 0.38, duration: 0.5 }
    ];

    sequence.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(note.f, now + note.time);

      gain.gain.setValueAtTime(0.22, now + note.time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.time);
      osc.stop(now + note.time + note.duration);
    });
  } catch (e) {
    // ignore
  }
}
