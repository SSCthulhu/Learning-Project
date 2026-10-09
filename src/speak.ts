let quiet = false;
const said: string[] = [];
let speakToken = 0;
let mainLive = false;
let audio: AudioContext | null = null;

const ANCHOR: Record<string, string> = {
  m: 'moon',
  n: 'nest',
  s: 'sun',
  f: 'fish',
  a: 'apple',
  e: 'egg',
  i: 'igloo',
  o: 'octopus',
  u: 'umbrella',
  t: 'top',
  p: 'pig',
  b: 'bus',
  d: 'dog',
  c: 'cat',
  k: 'kite',
  r: 'rain',
  l: 'lamp',
  g: 'goat',
  h: 'hat',
  v: 'van',
  q: 'queen',
};

export function isQuiet(): boolean {
  return quiet;
}

export function setQuiet(next: boolean): void {
  quiet = next;
  speakToken += 1;
  mainLive = false;
  window.speechSynthesis?.cancel();
  releaseSpoken();
  fadeBed(next ? 0.0001 : 1);
}

export function anchorWord(letter: string): string {
  return ANCHOR[letter.toLowerCase()] ?? letter;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  const voices = synth.getVoices();
  const english = voices.filter((voice) => /^en(-|_)/i.test(voice.lang));
  const named = english.find((voice) => /samantha|google us english|aria|jenny|natural|female/i.test(voice.name));
  return named ?? english.find((voice) => /en-US/i.test(voice.lang)) ?? english[0] ?? null;
}

const SOUND: Record<string, string> = {
  m: 'mmm',
  n: 'nnn',
  s: 'sss',
  f: 'fff',
  a: 'ah',
  e: 'eh',
  i: 'ih',
  o: 'aw',
  u: 'uh',
  t: 'tuh',
  p: 'puh',
  b: 'buh',
  d: 'duh',
  c: 'kuh',
  k: 'kuh',
  g: 'guh',
  r: 'rrr',
  l: 'lll',
  h: 'huh',
  v: 'vvv',
};

export function soundOf(letter: string): string {
  return SOUND[letter.toLowerCase()] ?? letter.toLowerCase();
}

let spoken: Promise<void> = Promise.resolve();
let releaseSpoken: () => void = () => {};
let chromeKeepAlive = 0;

function armSpeech(): void {
  releaseSpoken();
  spoken = new Promise<void>((resolve) => {
    releaseSpoken = resolve;
  });
}

export function speechSettled(): Promise<void> {
  return spoken;
}

function speechParts(line: string): string[] {
  const bits = line.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [line];
  const parts = bits.map((bit) => bit.trim()).filter((bit) => bit.length > 0);
  return parts.length > 0 ? parts : [line];
}

function keepSpeechAlive(): void {
  if (chromeKeepAlive) return;
  chromeKeepAlive = window.setInterval(() => {
    const synth = window.speechSynthesis;
    if (synth?.speaking) synth.resume();
  }, 4000);
}

export function cancelSpeech(): void {
  speakToken += 1;
  mainLive = false;
  window.speechSynthesis?.cancel();
  releaseSpoken();
}

export function speakHover(line: string): void {
  const synth = window.speechSynthesis;
  if (!synth || quiet || mainLive) return;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(line);
  utter.lang = 'en-US';
  utter.rate = 0.92;
  utter.pitch = 1.05;
  utter.volume = 1;
  const voice = pickVoice();
  if (voice) utter.voice = voice;
  said.push(line);
  (window as unknown as { __said?: string[] }).__said = said;
  synth.speak(utter);
}

export function speak(line: string, force = false, after?: () => void, rate = 0.9): void {
  const synth = window.speechSynthesis;
  const token = ++speakToken;
  window.speechSynthesis?.cancel();
  armSpeech();
  keepSpeechAlive();
  const finish = () => {
    if (token !== speakToken) return;
    mainLive = false;
    releaseSpoken();
    after?.();
  };
  if (!synth) {
    mainLive = false;
    releaseSpoken();
    if (token === speakToken) after?.();
    return;
  }
  if (quiet && !force) {
    mainLive = false;
    releaseSpoken();
    return;
  }
  mainLive = true;
  said.push(line);
  (window as unknown as { __said?: string[] }).__said = said;
  const parts = speechParts(line);
  const speakPart = (index: number) => {
    if (token !== speakToken) return;
    if (index >= parts.length) {
      finish();
      return;
    }
    const text = parts[index];
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = rate;
    utter.pitch = 1.05;
    utter.volume = 1;
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    let moved = false;
    const words = text.trim().split(/\s+/).filter((bit) => bit.length > 0).length;
    const capMs = Math.max(4500, words * 1200 + 1600);
    let capId = 0;
    const advance = () => {
      if (moved || token !== speakToken) return;
      moved = true;
      window.clearTimeout(capId);
      window.setTimeout(() => speakPart(index + 1), 80);
    };
    capId = window.setTimeout(advance, capMs);
    utter.onend = advance;
    utter.onerror = advance;
    synth.speak(utter);
  };
  window.setTimeout(() => speakPart(0), 100);
}

function audioContext(): AudioContext | null {
  const Ctx = window.AudioContext;
  if (!Ctx) return null;
  if (!audio) audio = new Ctx();
  if (audio.state === 'suspended') void audio.resume();
  return audio;
}

function envGain(ctx: AudioContext, dur: number, peak: number): GainNode {
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  gain.connect(ctx.destination);
  return gain;
}

function tone(ctx: AudioContext, freq: number, dur: number, type: OscillatorType, peak: number, filterHz?: number): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = envGain(ctx, dur, peak);
  if (filterHz) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterHz;
    osc.connect(filter);
    filter.connect(gain);
  } else {
    osc.connect(gain);
  }
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
}

function vowel(ctx: AudioContext, f1: number, f2: number, dur = 0.42): void {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 185;
  const mix = ctx.createGain();
  mix.gain.value = 1;
  for (const [freq, amount] of [
    [f1, 0.55],
    [f2, 0.28],
    [2500, 0.08],
  ] as const) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = freq;
    band.Q.value = 5;
    const gain = ctx.createGain();
    gain.gain.value = amount;
    osc.connect(band);
    band.connect(gain);
    gain.connect(mix);
  }
  const out = envGain(ctx, dur, 0.9);
  mix.connect(out);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
}

function hiss(ctx: AudioContext, freq: number, q: number, dur: number, peak: number): void {
  const samples = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = envGain(ctx, dur, peak);
  source.connect(filter);
  filter.connect(gain);
  source.start();
}

export function saySound(letter: string, word = ''): void {
  const sound = soundOf(letter);
  if (pickVoice()) {
    speak(word ? `${sound}, ${word}` : sound, false, undefined, 0.76);
    return;
  }
  playSynth(letter);
}

export function phoneme(kind: string): void {
  if (pickVoice()) {
    speak(soundOf(kind), false, undefined, 0.7);
    return;
  }
  playSynth(kind);
}

function playSynth(kind: string): void {
  const ctx = audioContext();
  if (!ctx) return;
  const key = kind.toLowerCase();
  if (key === 'm') tone(ctx, 140, 0.48, 'sine', 0.28, 320);
  else if (key === 'n') tone(ctx, 150, 0.42, 'sine', 0.24, 520);
  else if (key === 's') hiss(ctx, 6200, 0.7, 0.42, 0.16);
  else if (key === 'f') hiss(ctx, 1800, 0.55, 0.36, 0.12);
  else if (key === 'a') vowel(ctx, 750, 1600);
  else if (key === 'e') vowel(ctx, 420, 2200);
  else if (key === 'i') vowel(ctx, 450, 1900);
  else if (key === 'o') vowel(ctx, 520, 900);
  else if (key === 'u') vowel(ctx, 380, 800);
  else if (key === 'r') vowel(ctx, 500, 1200, 0.32);
  else if (key === 'l') vowel(ctx, 420, 1500, 0.32);
  else if (key === 't') hiss(ctx, 4200, 2.4, 0.1, 0.22);
  else if (key === 'p' || key === 'b') hiss(ctx, 900, 1.4, 0.1, 0.2);
  else if (key === 'd') hiss(ctx, 2400, 2, 0.1, 0.2);
  else if (key === 'c' || key === 'k') hiss(ctx, 1600, 1.6, 0.12, 0.2);
  else vowel(ctx, 600, 1400, 0.3);
}

const C3 = 130.81;
const E3 = 164.81;
const G3 = 196.0;
const A3 = 220.0;
const C4 = 261.63;
const D4 = 293.66;
const E4 = 329.63;
const G4 = 392.0;
const A4 = 440.0;
const C5 = 523.25;
const BED_STEP = 60 / 92 / 2;
const BED_MELODY = [C4, E4, G4, C5, G4, E4, A4, G4, D4, E4, G4, A4, G4, E4, D4, C4];
const BED_BASS = [C3, 0, G3, 0, A3, 0, E3, 0, C3, 0, G3, 0, A3, 0, C3, 0];

let bedMaster: GainNode | null = null;
let bedMix: GainNode | null = null;
let bedNoise: AudioBuffer | null = null;
let bedNext = 0;
let bedStep = 0;
let bedOn = false;

function fadeBed(target: number): void {
  if (!bedMaster || !audio) return;
  const now = audio.currentTime;
  const from = Math.max(0.0001, bedMaster.gain.value);
  bedMaster.gain.cancelScheduledValues(now);
  bedMaster.gain.setValueAtTime(from, now);
  bedMaster.gain.exponentialRampToValueAtTime(Math.max(0.0001, target), now + 0.45);
}

function pluckBed(freq: number, when: number, peak: number, type: OscillatorType, dur: number): void {
  if (!audio || !bedMix || freq <= 0) return;
  const osc = audio.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(gain);
  gain.connect(bedMix);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

function hatBed(when: number): void {
  if (!audio || !bedMix || !bedNoise) return;
  const source = audio.createBufferSource();
  source.buffer = bedNoise;
  const filter = audio.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7200;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.12, when + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(bedMix);
  source.start(when);
}

function tickBed(): void {
  if (!audio || !bedOn) return;
  const horizon = audio.currentTime + 0.22;
  while (bedNext < horizon) {
    const i = bedStep % 16;
    pluckBed(BED_MELODY[i], bedNext, 0.62, 'triangle', 0.38);
    pluckBed(BED_BASS[i], bedNext, 0.34, 'sine', 0.52);
    if (i % 2 === 1) hatBed(bedNext);
    bedNext += BED_STEP;
    bedStep += 1;
  }
  window.setTimeout(tickBed, 50);
}

function startBed(): void {
  if (bedOn) return;
  const ctx = audioContext();
  if (!ctx) return;
  const mix = ctx.createGain();
  mix.gain.value = 0.035;
  const master = ctx.createGain();
  master.gain.value = quiet ? 0.0001 : 1;
  mix.connect(master);
  master.connect(ctx.destination);
  const samples = Math.max(1, Math.floor(ctx.sampleRate * 0.08));
  const noise = ctx.createBuffer(1, samples, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
  bedMix = mix;
  bedMaster = master;
  bedNoise = noise;
  bedStep = 0;
  bedNext = ctx.currentTime + 0.06;
  bedOn = true;
  tickBed();
}

export function boop(): void {
  const ctx = audioContext();
  if (!ctx || quiet) return;
  tone(ctx, 494, 0.1, 'sine', 0.16);
  tone(ctx, 740, 0.16, 'triangle', 0.1);
}

export function unlockAudio(): void {
  audioContext();
  startBed();
}
