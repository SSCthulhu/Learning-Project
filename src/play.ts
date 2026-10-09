import * as THREE from 'three';
import { houseButton, quietButton, guide } from './kit';
import { boop, speak, speakHover, speechSettled, setQuiet, isQuiet, cancelSpeech } from './speak';
import {
  placeHud,
  setBackdrop,
  setClickables,
  setGuides,
  setBopTap,
  setEmptyTap,
  setTalking,
  setHoverTalk,
  onWorldResize,
  stage,
  clearGroup,
  celebrate,
  encourage,
  giggle,
  wobble,
  uv,
  type Clickable,
} from './world';

const caption = document.getElementById('caption') as HTMLParagraphElement;
const progressRow = document.getElementById('progress');

export type PlaceName = 'hub' | 'grove' | 'market' | 'song' | 'citadel';

type Spot = { u: number; v: number };

const PLACES: Record<PlaceName, { bg: string; nim: Spot; bop: Spot }> = {
  hub: { bg: 'village', nim: { u: 0.3, v: 0.86 }, bop: { u: 0.56, v: 0.885 } },
  grove: { bg: 'grove', nim: { u: 0.175, v: 0.86 }, bop: { u: 0.83, v: 0.86 } },
  market: { bg: 'market', nim: { u: 0.21, v: 0.88 }, bop: { u: 0.79, v: 0.88 } },
  song: { bg: 'songkeep', nim: { u: 0.18, v: 0.86 }, bop: { u: 0.82, v: 0.86 } },
  citadel: { bg: 'citadel', nim: { u: 0.185, v: 0.86 }, bop: { u: 0.815, v: 0.86 } },
};

let placeNow: PlaceName = 'hub';

export function currentPlace(): PlaceName {
  return placeNow;
}

const NIM_H = 4.55;
const BOP_H = 5.7;

let tokenN = 1;
let line = '';
let shown = '';
let tail: (() => void) | undefined;
let lock = false;
let pending: ((ok: boolean) => void) | null = null;
let timers: number[] = [];
let chrome: Clickable[] = [];
let extras: Clickable[] = [];
let quietMesh: THREE.Mesh | null = null;
let houseMesh: THREE.Mesh | null = null;
const HUD_SIZE = 0.86;
const HUD_Z = 0.9;

setHoverTalk((text) => {
  if (pending || lock) return;
  speakHover(text);
});
setBopTap(() => {
  giggle();
  boop();
});
setEmptyTap(() => {
  if (line) replay();
});
onWorldResize(() => layoutHud());

export function currentToken(): number {
  return tokenN;
}

export function holdMs(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(2600, words * 460);
}

export function say(text: string, opts?: { speech?: string; then?: () => void }): void {
  shown = text;
  line = opts?.speech ?? text;
  tail = opts?.then;
  caption.textContent = shown;
  caption.parentElement?.classList.toggle('show', shown.length > 0);
  if (isQuiet()) {
    markTalking(false);
    return;
  }
  markTalking(true);
  const after = tail;
  speak(line, false, () => {
    markTalking(false);
    after?.();
  });
}

export function replay(): void {
  if (!line) return;
  markTalking(true);
  const after = tail;
  speak(line, true, () => {
    markTalking(false);
    after?.();
  });
}

export function remind(text: string): void {
  if (!line) {
    say(text);
    return;
  }
  const savedShown = shown;
  const savedLine = line;
  const savedTail = tail;
  caption.textContent = text;
  caption.parentElement?.classList.toggle('show', true);
  markTalking(true);
  speak(text, true, () => {
    markTalking(false);
    shown = savedShown;
    line = savedLine;
    tail = savedTail;
    caption.textContent = savedShown;
    caption.parentElement?.classList.toggle('show', savedShown.length > 0);
  });
}

let waits: ((ok: boolean) => void)[] = [];

export function pause(token: number, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finishWait = (ok: boolean) => {
      if (settled) return;
      settled = true;
      waits = waits.filter((wait) => wait !== finishWait);
      resolve(ok);
    };
    waits.push(finishWait);
    const id = window.setTimeout(() => {
      if (settled) return;
      if (ms < 1200) {
        finishWait(token === tokenN);
        return;
      }
      let moved = false;
      let backup = 0;
      const proceed = () => {
        if (moved || settled) return;
        moved = true;
        window.clearTimeout(backup);
        const tail = window.setTimeout(() => finishWait(token === tokenN), 320);
        timers.push(tail);
      };
      // Sample the voice that is speaking now, including a replay started during the wait.
      const voice = speechSettled();
      backup = window.setTimeout(proceed, Math.max(ms, 8000));
      timers.push(backup);
      void voice.then(proceed);
    }, ms);
    timers.push(id);
  });
}

export function showProgress(step: number | null, total: number | null): void {
  if (!progressRow) return;
  if (total == null || total < 2) {
    progressRow.classList.remove('on');
    progressRow.replaceChildren();
    return;
  }
  const current = step ?? 0;
  progressRow.replaceChildren();
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('span');
    if (i < current) dot.className = 'done';
    else if (i === current) dot.className = 'now';
    progressRow.appendChild(dot);
  }
  progressRow.classList.add('on');
}

export function interrupt(): void {
  tokenN += 1;
  lock = false;
  showProgress(null, null);
  for (const id of timers) clearTimeout(id);
  timers = [];
  for (const wait of waits) wait(false);
  waits = [];
  if (pending) {
    const done = pending;
    pending = null;
    done(false);
  }
  cancelSpeech();
}

export type Choice = {
  mesh: THREE.Object3D;
  correct: boolean;
  tip: string;
  hear?: () => void;
};

export function openPlace(where: PlaceName, home: (() => void) | null, opts?: { chrome?: boolean }): number {
  interrupt();
  clearGroup(stage);
  chrome = [];
  extras = [];
  quietMesh = null;
  houseMesh = null;
  const spec = PLACES[where];
  placeNow = where;
  setBackdrop(spec.bg);
  const nimH = where === 'hub' ? 3.95 : NIM_H;
  const bopH = where === 'hub' ? 4.95 : BOP_H;
  const nim = guide('nim', nimH);
  const bop = guide('bop', bopH);
  nim.userData.who = 'nim';
  bop.userData.who = 'bop';
  plant(nim, spec.nim);
  plant(bop, spec.bop);
  stage.add(nim, bop);
  setGuides([nim, bop], replay);
  if (opts?.chrome === false) {
    setClickables([]);
    return tokenN;
  }
  const quiet = quietButton(isQuiet());
  quietMesh = quiet;
  stage.add(quiet);
  const buttons: Clickable[] = [{ root: quiet, hover: isQuiet() ? 'Sound' : 'Quiet', click: toggleQuiet }];
  if (home) {
    const house = houseButton();
    house.name = 'door-home';
    houseMesh = house;
    stage.add(house);
    buttons.push({
      root: house,
      hover: 'Home',
      click: () => home(),
    });
  }
  chrome = buttons;
  layoutHud();
  setClickables(chrome);
  return tokenN;
}

function layoutHud(): void {
  if (quietMesh) placeHud(quietMesh, 'right', HUD_Z, HUD_SIZE, HUD_SIZE);
  if (houseMesh) placeHud(houseMesh, 'left', HUD_Z, HUD_SIZE, HUD_SIZE);
}

export function bind(extra: Clickable[]): void {
  extras = extra;
  setClickables([...extras, ...chrome]);
}

function plant(root: THREE.Object3D, spot: Spot): void {
  const p = uv(spot.u, spot.v, 0.35);
  root.position.copy(p);
}

function markTalking(on: boolean): void {
  setTalking(on);
  caption.parentElement?.classList.toggle('talking', on);
}

function toggleQuiet(): void {
  setQuiet(!isQuiet());
  const button = chrome.find((item) => item.root === quietMesh);
  if (button) button.hover = isQuiet() ? 'Sound' : 'Quiet';
  if (!quietMesh) return;
  const next = quietButton(isQuiet());
  const oldMat = quietMesh.material as THREE.MeshBasicMaterial;
  const newMat = next.material as THREE.MeshBasicMaterial;
  oldMat.map?.dispose();
  oldMat.map = newMat.map;
  oldMat.needsUpdate = true;
  newMat.map = null;
  next.geometry.dispose();
  newMat.dispose();
  if (!isQuiet() && line) speak(line, false, tail);
}

export function addActor(obj: THREE.Object3D): void {
  stage.add(obj);
}

export function ask(
  token: number,
  captionText: string,
  items: Choice[],
  praise: string,
  extras: Clickable[] = [],
  opts?: { speech?: string; then?: () => void; praiseThen?: () => void; step?: number; total?: number },
): Promise<boolean> {
  const showPrompt = () => say(captionText, { speech: opts?.speech, then: opts?.then });
  showPrompt();
  return new Promise((resolve) => {
    if (token !== tokenN) {
      resolve(false);
      return;
    }
    pending = resolve;
    showProgress(opts?.step ?? null, opts?.total ?? null);
    let tipGen = 0;
    let won = false;
    const choiceClicks: Clickable[] = items.map((item) => ({
      root: item.mesh,
      click: () => {
        if (token !== tokenN) return;
        if (item.correct) {
          if (won) return;
          won = true;
          tipGen += 1;
          lock = true;
          recolor(item.mesh, 0xb7efc3);
          celebrate();
          say(praise, { then: opts?.praiseThen });
          const listen = holdMs(praise) + (opts?.praiseThen ? 900 : 0);
          void pause(token, listen).then((alive) => {
            lock = false;
            if (pending && token === tokenN) {
              const done = pending;
              pending = null;
              clearActors(items, extras);
              done(alive);
            }
          });
          return;
        }
        if (lock) return;
        lock = true;
        const gen = tipGen;
        recolor(item.mesh, 0xffe7a8);
        wobble(item.mesh);
        encourage();
        item.hear?.();
        say(item.tip);
        const listen = holdMs(item.tip) + (item.hear ? 800 : 0);
        void pause(token, listen).then((alive) => {
          if (gen !== tipGen) return;
          lock = false;
          if (!alive || token !== tokenN) return;
          recolor(item.mesh, 0xffffff);
          showPrompt();
        });
      },
    }));
    for (const item of items) stage.add(item.mesh);
    for (const extra of extras) stage.add(extra.root);
    setClickables([...choiceClicks, ...extras, ...chrome]);
  });
}

function recolor(root: THREE.Object3D, hex: number): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    if (!mat?.color || mat.userData.noTint || mat.opacity === 0) return;
    mat.color.setHex(hex);
  });
}

function clearActors(items: Choice[], also: Clickable[]): void {
  for (const item of items) removeTree(item.mesh);
  for (const extra of also) removeTree(extra.root);
  setClickables([...extras, ...chrome]);
}

function removeTree(obj: THREE.Object3D): void {
  if (!obj.parent) return;
  stage.remove(obj);
  obj.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mat = mesh.material as THREE.MeshBasicMaterial;
    if (mesh.userData.disposeMap && mat.map) mat.map.dispose();
    mat?.dispose();
  });
}

export function drop(obj: THREE.Object3D): void {
  if (!obj.parent) return;
  removeTree(obj);
}

export { speak };
