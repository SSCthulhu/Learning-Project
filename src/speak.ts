let voiceQuiet = false;
let musicQuiet = false;
const said: string[] = [];
let speakToken = 0;
let mainLive = false;
let liveLine = '';
let audio: AudioContext | null = null;
let talkHook: (on: boolean) => void = () => {};
let talkGen = 0;

export function onNimTalk(fn: (on: boolean) => void): void {
  talkHook = fn;
}

function beginTalk(): number {
  talkGen += 1;
  talkHook(true);
  return talkGen;
}

function endTalk(gen: number): void {
  if (gen !== talkGen) return;
  talkHook(false);
}

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

export function isVoiceQuiet(): boolean {
  return voiceQuiet;
}

export function isMusicQuiet(): boolean {
  return musicQuiet;
}

export function setVoiceQuiet(next: boolean): void {
  voiceQuiet = next;
  if (!next) return;
  speakToken += 1;
  mainLive = false;
  stopClip();
  talkGen += 1;
  talkHook(false);
  releaseSpoken();
}

export function setMusicQuiet(next: boolean): void {
  musicQuiet = next;
  fadeBed(next ? 0.0001 : 1);
}

export function anchorWord(letter: string): string {
  return ANCHOR[letter.toLowerCase()] ?? letter;
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

function armSpeech(): void {
  releaseSpoken();
  spoken = new Promise<void>((resolve) => {
    releaseSpoken = resolve;
  });
}

export function speechSettled(): Promise<void> {
  return spoken;
}

export function cancelSpeech(): void {
  speakToken += 1;
  mainLive = false;
  stopClip();
  talkGen += 1;
  talkHook(false);
  releaseSpoken();
}

export function speakHover(line: string): void {
  if (voiceQuiet || mainLive || !line.trim()) return;
  stopClip();
  const gen = beginTalk();
  void voiceReady.then(() => {
    if (voiceQuiet || mainLive) {
      endTalk(gen);
      return;
    }
    void playRecording(line).then(() => endTalk(gen));
  });
}

export function speak(line: string, _force = false, after?: () => void, _rate = 0.9): void {
  if (mainLive && line === liveLine) return;
  const token = ++speakToken;
  liveLine = line;
  stopClip();
  armSpeech();
  const finish = (gen: number) => {
    if (token !== speakToken) return;
    mainLive = false;
    endTalk(gen);
    releaseSpoken();
    after?.();
  };
  if (voiceQuiet || !line.trim()) {
    mainLive = false;
    releaseSpoken();
    after?.();
    return;
  }
  mainLive = true;
  const gen = beginTalk();
  said.push(line);
  (window as unknown as { __said?: string[] }).__said = said;
  void voiceReady.then(() => {
    if (token !== speakToken) return;
    void playRecording(line).then(() => finish(gen));
  });
}

const voiceFiles = new Map<string, string>();
let voiceReady: Promise<void> = Promise.resolve();
let endClip: ((ok: boolean) => void) | null = null;

function loadVoiceIndex(): void {
  const url = `${import.meta.env.BASE_URL}voice/index.json`;
  let ready: () => void = () => {};
  voiceReady = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const timer = window.setTimeout(ready, 8000);
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

const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
let voiceEl: HTMLAudioElement | null = null;
let clipGen = 0;

function voiceElement(): HTMLAudioElement {
  if (!voiceEl) {
    voiceEl = new Audio();
    voiceEl.preload = 'auto';
  }
  return voiceEl;
}

function stopClip(): void {
  const end = endClip;
  endClip = null;
  const el = voiceEl;
  if (el) {
    el.onended = null;
    el.onerror = null;
    el.pause();
  }
  clipGen += 1;
  end?.(false);
}

function recordingUrl(file: string): string {
  if (/^https?:\/\//i.test(file)) return file;
  return `${import.meta.env.BASE_URL}voice/${file}`;
}

function playRecording(line: string): Promise<boolean> {
  const file = voiceFiles.get(line);
  if (!file) return Promise.resolve(false);
  const el = voiceElement();
  const gen = ++clipGen;
  el.src = recordingUrl(file);
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (endClip === done) endClip = null;
      resolve(ok);
    };
    endClip = done;
    el.onended = () => {
      if (gen === clipGen) done(true);
    };
    el.onerror = () => {
      if (gen === clipGen) done(false);
    };
    void el.play().then(
      () => {
        if (gen !== clipGen) el.pause();
      },
      () => {
        if (gen === clipGen) done(false);
      },
    );
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

export function saySound(letter: string, word = ''): void {
  if (voiceQuiet) return;
  const sound = soundOf(letter);
  speak(word ? `${sound}, ${word}` : sound);
}

export function phoneme(kind: string): void {
  if (voiceQuiet) return;
  speak(soundOf(kind));
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
  gain.gain.value = musicQuiet ? 0.0001 : BED_GAIN;
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
    if (musicQuiet) el.pause();
  }, 500);
}

function startBed(): void {
  ensureBed();
  if (!bedEl || musicQuiet) return;
  fadeBed(1);
}

export function unlockAudio(): void {
  audioContext();
  const el = voiceElement();
  if (!el.src) {
    el.src = SILENT_WAV;
    void el.play().then(() => el.pause()).catch(() => {});
  }
  startBed();
}
