let quiet = false;
const said: string[] = [];
let speakToken = 0;
let mainLive = false;
let liveLine = '';
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
  stopClip();
  window.speechSynthesis?.cancel();
  releaseSpoken();
  fadeBed(next ? 0.0001 : 1);
}

export function anchorWord(letter: string): string {
  return ANCHOR[letter.toLowerCase()] ?? letter;
}

const NIM_PITCH = 1.28;

function voiceScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  if (!/^en(-|_)/i.test(voice.lang)) return -1;
  let score = 1;
  if (/child|kid|junior/.test(name)) score += 80;
  if (/samantha|karen|moira|serena|fiona|kathy|aria|jenny/.test(name)) score += 50;
  if (/google uk english female|google us english/.test(name)) score += 46;
  if (/natural|neural|premium|enhanced/.test(name)) score += 36;
  if (/female|woman/.test(name)) score += 12;
  if (/en-us/i.test(voice.lang)) score += 8;
  if (/en-gb/i.test(voice.lang)) score += 6;
  if (voice.localService) score += 3;
  if (/espeak|compact|david|fred|albert|ralph|bad news|bahh|bells|boing|whisper|zarvox|trinoids|deranged/.test(name)) score -= 60;
  return score;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = 0;
  for (const voice of voices) {
    const score = voiceScore(voice);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

function voicesReady(): Promise<void> {
  const synth = window.speechSynthesis;
  if (!synth || synth.getVoices().length > 0) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled || synth.getVoices().length === 0) return;
      settled = true;
      window.clearTimeout(timer);
      synth.removeEventListener('voiceschanged', done);
      resolve();
    };
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      synth.removeEventListener('voiceschanged', done);
      resolve();
    }, 450);
    synth.addEventListener('voiceschanged', done);
    synth.getVoices();
  });
}

function styleNim(utter: SpeechSynthesisUtterance, rate: number): void {
  utter.lang = 'en-US';
  utter.rate = rate;
  utter.pitch = NIM_PITCH;
  utter.volume = 1;
  const voice = pickVoice();
  if (voice) utter.voice = voice;
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
  window.addEventListener('pointerdown', () => {
    const token = speakToken;
    window.setTimeout(() => {
      if (token !== speakToken) return;
      const synth = window.speechSynthesis;
      if (synth && (synth.speaking || synth.paused)) synth.resume();
    }, 0);
  });
  chromeKeepAlive = window.setInterval(() => {
    const synth = window.speechSynthesis;
    if (synth && (synth.speaking || synth.paused)) synth.resume();
  }, 500);
}

export function cancelSpeech(): void {
  speakToken += 1;
  mainLive = false;
  stopClip();
  window.speechSynthesis?.cancel();
  releaseSpoken();
}

export function speakHover(line: string): void {
  if (quiet || mainLive) return;
  stopClip();
  window.speechSynthesis?.cancel();
  void voiceReady.then(() => {
    if (quiet || mainLive) return;
    void playRecording(line).then((played) => {
      if (played || quiet || mainLive) return;
      const synth = window.speechSynthesis;
      if (!synth) return;
      const utter = new SpeechSynthesisUtterance(line);
      styleNim(utter, 0.92);
      said.push(line);
      (window as unknown as { __said?: string[] }).__said = said;
      synth.speak(utter);
    });
  });
}

export function speak(line: string, _force = false, after?: () => void, rate = 0.9): void {
  if (mainLive && line === liveLine) return;
  const synth = window.speechSynthesis;
  const token = ++speakToken;
  liveLine = line;
  stopClip();
  window.speechSynthesis?.cancel();
  armSpeech();
  keepSpeechAlive();
  const finish = () => {
    if (token !== speakToken) return;
    mainLive = false;
    releaseSpoken();
    after?.();
  };
  if (quiet) {
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
    styleNim(utter, rate);
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
    utter.onerror = (event) => {
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      advance();
    };
    synth.speak(utter);
  };
  void voiceReady.then(() => voicesReady()).then(() => {
    if (token !== speakToken) return;
    void playRecording(line).then((played) => {
      if (token !== speakToken) return;
      if (played) {
        finish();
        return;
      }
      if (!synth) {
        finish();
        return;
      }
      window.setTimeout(() => speakPart(0), 60);
    });
  });
}

const voiceFiles = new Map<string, string>();
let voiceReady: Promise<void> = Promise.resolve();
let clip: HTMLAudioElement | null = null;
let endClip: ((ok: boolean) => void) | null = null;

function loadVoiceIndex(): void {
  const url = `${import.meta.env.BASE_URL}voice/index.json`;
  let ready: () => void = () => {};
  voiceReady = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const timer = window.setTimeout(ready, 1500);
  void fetch(url)
    .then((res) => (res.ok ? res.json() : null))
    .then((data: Record<string, string> | null) => {
      if (!data) return;
      for (const [line, file] of Object.entries(data)) {
        if (line && file) voiceFiles.set(line, file);
      }
    })
    .catch(() => {})
    .finally(() => {
      window.clearTimeout(timer);
      ready();
    });
}

function stopClip(): void {
  const end = endClip;
  endClip = null;
  if (clip) {
    const el = clip;
    clip = null;
    el.onended = null;
    el.onerror = null;
    el.pause();
    el.removeAttribute('src');
    el.load();
  }
  end?.(false);
}

function recordingUrl(file: string): string {
  if (/^https?:\/\//i.test(file)) return file;
  return `${import.meta.env.BASE_URL}voice/${file}`;
}

function playRecording(line: string): Promise<boolean> {
  const file = voiceFiles.get(line);
  if (!file) return Promise.resolve(false);
  const el = new Audio(recordingUrl(file));
  clip = el;
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (endClip === done) endClip = null;
      if (clip === el) clip = null;
      resolve(ok);
    };
    endClip = done;
    el.onended = () => done(true);
    el.onerror = () => done(false);
    void el.play().catch(() => done(false));
  });
}

loadVoiceIndex();

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
  if (quiet) return;
  const sound = soundOf(letter);
  if (pickVoice()) {
    speak(word ? `${sound}, ${word}` : sound, false, undefined, 0.76);
    return;
  }
  playSynth(letter);
}

export function phoneme(kind: string): void {
  if (quiet) return;
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

const BED_URL = `${import.meta.env.BASE_URL}music/magical-discovery.mp3`;
const BED_GAIN = 0.09;

let bedEl: HTMLAudioElement | null = null;
let bedGain: GainNode | null = null;
let bedPause = 0;

function ensureBed(): void {
  if (bedEl && bedGain) return;
  const ctx = audioContext();
  if (!ctx) return;
  const el = new Audio(BED_URL);
  el.loop = true;
  el.preload = 'auto';
  const source = ctx.createMediaElementSource(el);
  const gain = ctx.createGain();
  gain.gain.value = quiet ? 0.0001 : BED_GAIN;
  source.connect(gain);
  gain.connect(ctx.destination);
  bedEl = el;
  bedGain = gain;
}

function fadeBed(target: number): void {
  ensureBed();
  if (!bedGain || !audio || !bedEl) return;
  const dest = target < 0.5 ? 0.0001 : BED_GAIN;
  const now = audio.currentTime;
  const from = Math.max(0.0001, bedGain.gain.value);
  bedGain.gain.cancelScheduledValues(now);
  bedGain.gain.setValueAtTime(from, now);
  bedGain.gain.exponentialRampToValueAtTime(dest, now + 0.45);
  window.clearTimeout(bedPause);
  if (dest > 0.001) {
    void bedEl.play().catch(() => {});
    return;
  }
  const el = bedEl;
  bedPause = window.setTimeout(() => {
    if (quiet) el.pause();
  }, 500);
}

function startBed(): void {
  ensureBed();
  if (!bedEl || quiet) return;
  fadeBed(1);
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
