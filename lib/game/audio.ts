import type { SoundEvent } from "./engine.js";

/** Short synthesized effects; no downloaded audio files or audio on page load. */
export class GameAudio {
  private context: AudioContext | null = null;
  enabled = true;
  async unlock() {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended") await this.context.resume();
    } catch {
      // Visual feedback remains complete when sound is unavailable.
    }
  }
  play(event: SoundEvent, playerId = 1) {
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== "running") return;
    const pitches: Record<SoundEvent, number[]> = {
      join: [440 + playerId * 55], tick: [650], launch: [330, 440, 660],
      bounce: [260 + playerId * 65], pause: [330, 220], return: [440, 660],
      restart: [220, 330], winner: [523.25, 659.25, 783.99, 1046.5],
    };
    pitches[event].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + index * (event === "winner" ? 0.12 : 0.07);
      const duration = event === "winner" ? 0.35 : event === "bounce" ? 0.065 : 0.14;
      oscillator.type = event === "bounce" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(event === "bounce" ? 0.055 : 0.11, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.02);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    });
  }
  dispose() { void this.context?.close(); this.context = null; }
}
