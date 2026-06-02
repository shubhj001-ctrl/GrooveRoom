/**
 * Procedural Audio Synthesizers using Web Audio API for soft UI notification sounds.
 */

// Soft chime sound for new tracks in queue (quintal chord with exponential decay)
export function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    // Smooth out bell transients via a low-pass filter
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1000, now);
    filter.connect(ctx.destination);
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();
    
    osc1.type = "sine";
    osc2.type = "sine";
    
    // Harmonic notes (E5 and B5)
    osc1.frequency.setValueAtTime(659.25, now); // E5
    osc2.frequency.setValueAtTime(987.77, now); // B5
    
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    
    gain2.gain.setValueAtTime(0.06, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    
    osc1.connect(gain1);
    osc2.connect(gain2);
    
    gain1.connect(filter);
    gain2.connect(filter);
    
    osc1.start(now);
    osc2.start(now);
    
    osc1.stop(now + 1.3);
    osc2.stop(now + 0.9);
  } catch (err) {
    console.warn("Audio Context chime failed:", err);
  }
}

// Crisp warm ping sound for chat messages (sine wave arpeggio)
export function playChatPingSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "triangle"; // soft analog style
    
    // Clear bright slide from high E6 to A6
    osc.frequency.setValueAtTime(1318.51, now); // E6
    osc.frequency.exponentialRampToValueAtTime(1760.00, now + 0.08); // A6
    
    gain.gain.setValueAtTime(0.10, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.3);
  } catch (err) {
    console.warn("Audio Context ping failed:", err);
  }
}
