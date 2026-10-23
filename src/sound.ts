/**
 * A generative ambient bed. No audio files: two detuned oscillators per voice through a slow low-pass,
 * a root note per chapter, a shimmer that swells on cornerstones, and a darker filter under concentration.
 * Nothing plays until the viewer turns it on (browsers require a gesture anyway).
 */
type Voice = { osc: OscillatorNode[]; gain: GainNode };

const ROOTS = [110, 98, 87.31, 82.41, 73.42]; // A2, G2, F2, E2, D2: the century slowly descends
const CHORD = [1, 1.5, 2, 2.5198]; // root, fifth, octave, major third above

class Bed {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private filter!: LowpassLike;
  private voices: Voice[] = [];
  private shimmer!: GainNode;
  private shimmerOsc: OscillatorNode[] = [];
  private era = 0;
  on = false;

  start() {
    if (this.on) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = this.ctx ?? new AC();
    const ctx = this.ctx;
    if (ctx.state === "suspended") ctx.resume();
    this.master = ctx.createGain(); this.master.gain.value = 0;
    this.filter = ctx.createBiquadFilter(); this.filter.type = "lowpass"; this.filter.frequency.value = 900; this.filter.Q.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05; const lfoGain = ctx.createGain(); lfoGain.gain.value = 260; lfo.connect(lfoGain).connect(this.filter.frequency); lfo.start();
    this.filter.connect(this.master).connect(ctx.destination);
    const root = ROOTS[this.era];
    this.voices = CHORD.map((m, i) => {
      const gain = ctx.createGain(); gain.gain.value = [0.22, 0.12, 0.1, 0.06][i];
      const osc = [-6, 6].map((cents) => { const o = ctx.createOscillator(); o.type = i === 0 ? "sawtooth" : "triangle"; o.frequency.value = root * m; o.detune.value = cents; o.connect(gain); o.start(); return o; });
      gain.connect(this.filter);
      return { osc, gain };
    });
    this.shimmer = ctx.createGain(); this.shimmer.gain.value = 0;
    this.shimmerOsc = [4, 6, 8].map((m) => { const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = root * m; o.connect(this.shimmer); o.start(); return o; });
    this.shimmer.connect(this.master);
    this.master.gain.setTargetAtTime(0.16, ctx.currentTime, 1.2);
    this.on = true;
  }

  stop() {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx, m = this.master, all = [...this.voices.flatMap((v) => v.osc), ...this.shimmerOsc];
    m.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    setTimeout(() => { all.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } }); m.disconnect(); }, 1600);
    this.voices = []; this.shimmerOsc = []; this.on = false;
  }

  setEra(i: number) {
    this.era = Math.max(0, Math.min(ROOTS.length - 1, i));
    if (!this.on || !this.ctx) return;
    const root = ROOTS[this.era], now = this.ctx.currentTime;
    this.voices.forEach((v, k) => v.osc.forEach((o) => o.frequency.setTargetAtTime(root * CHORD[k], now, 1.5)));
    this.shimmerOsc.forEach((o, k) => o.frequency.setTargetAtTime(root * [4, 6, 8][k], now, 1.5));
  }

  /** 0 = calm, 1 = a cornerstone on screen */
  setIntensity(x: number) {
    if (!this.on || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.shimmer.gain.setTargetAtTime(0.05 * x, now, 0.8);
    this.master.gain.setTargetAtTime(0.16 + 0.06 * x, now, 0.8);
  }

  /** concentration darkens the bed */
  setDark(x: number) {
    if (!this.on || !this.ctx) return;
    this.filter.frequency.setTargetAtTime(900 - 480 * x, this.ctx.currentTime, 1.2);
  }
}
type LowpassLike = BiquadFilterNode;

export const bed = new Bed();
