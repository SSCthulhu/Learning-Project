import { findGame, hubZones, lobbySigns, QUESTS, type GameDef, type QuestDef } from './games';
import * as THREE from 'three';
import { bind, currentToken, openPlace, say, toggleMusic, toggleVoice } from './play';
import { isMusicQuiet, musicHeard, unlockAudio } from './speak';
import { asset, bindInput, camera, preload, scene, start } from './world';

const boot = document.getElementById('boot') as HTMLElement;
const bootPlay = boot.querySelector('.boot-title') as HTMLButtonElement;
const bootMusic = document.getElementById('boot-music') as HTMLButtonElement;
let ready = false;
let started = false;

function goHub(): void {
  openPlace('hub', null);
  bind(hubZones((quest) => goQuest(quest)));
  say('Tap a place to play.');
}

function goQuest(quest: QuestDef): void {
  openPlace(quest.place, goHub, { back: goHub });
  bind(lobbySigns(quest, (game) => startGame(quest, game)));
}

function startGame(quest: QuestDef, game: GameDef): void {
  const token = openPlace(quest.place, goHub, { back: () => goQuest(quest) });
  void game.play(token).then((result) => {
    if (result === 'done' && token === currentToken()) goQuest(quest);
  });
}

function goto(id: string): void {
  if (!ready) return;
  if (id === 'hub') {
    goHub();
    return;
  }
  if (id.startsWith('lobby:')) {
    const quest = QUESTS.find((entry) => entry.id === id.slice(6));
    if (quest) goQuest(quest);
    return;
  }
  if (id.startsWith('game:')) {
    const gameId = id.split('/')[1] ?? '';
    const found = findGame(gameId);
    if (found) startGame(found.quest, found.game);
  }
}

async function bootUp(): Promise<void> {
  const face = new FontFace('Starlace', `url(${asset('/fonts/Andika-Bold.ttf')})`);
  await Promise.all([face.load().then((loaded) => document.fonts.add(loaded)), preload()]);
  bindInput();
  start();
  openPlace('grove', null, { chrome: false, guides: false });
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  ready = true;
  boot.classList.add('ready');
  unlockAudio();
  paintSplashMusic();
  window.setTimeout(paintSplashMusic, 280);
}

function waitFade(el: HTMLElement, ms: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('transitionend', onEnd);
      resolve();
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === el && event.propertyName === 'opacity') finish();
    };
    el.addEventListener('transitionend', onEnd);
    window.setTimeout(finish, ms);
  });
}

function paintSplashMusic(): void {
  const quiet = isMusicQuiet() || !musicHeard();
  bootMusic.classList.toggle('muted', quiet);
  bootMusic.setAttribute('aria-pressed', quiet ? 'true' : 'false');
  bootMusic.setAttribute('aria-label', quiet ? 'Turn music on' : 'Turn music off');
}

function onSplashMusic(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  const playing = musicHeard();
  unlockAudio();
  if (playing || isMusicQuiet()) toggleMusic();
  paintSplashMusic();
  window.setTimeout(paintSplashMusic, 280);
}

async function begin(): Promise<void> {
  if (!ready || started) return;
  started = true;
  unlockAudio();
  const fade = boot.querySelector('.boot-fade') as HTMLElement;
  const veil = document.getElementById('veil') as HTMLElement;
  boot.classList.add('leaving');
  await waitFade(fade, 900);
  veil.classList.add('on');
  await waitFade(veil, 1000);
  goHub();
  boot.classList.add('gone');
  requestAnimationFrame(() => veil.classList.remove('on'));
}

function project(prefix: string): { name: string; x: number; y: number }[] {
  const hits: { name: string; x: number; y: number }[] = [];
  const point = new THREE.Vector3();
  scene.traverse((obj) => {
    if (!obj.name.startsWith(prefix)) return;
    obj.getWorldPosition(point);
    point.project(camera);
    const rect = (document.getElementById('view') as HTMLCanvasElement).getBoundingClientRect();
    hits.push({
      name: obj.name,
      x: rect.left + (point.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-point.y * 0.5 + 0.5) * rect.height,
    });
  });
  return hits;
}

window.starlace = { goto, project };
void bootUp();
bootPlay.addEventListener('pointerdown', (event) => {
  event.stopPropagation();
  void begin();
});
bootMusic.addEventListener('pointerdown', onSplashMusic);
document.getElementById('hear')?.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleVoice();
});

declare global {
  interface Window {
    starlace: {
      goto: (id: string) => void;
      project: (prefix: string) => { name: string; x: number; y: number }[];
    };
    __said?: string[];
  }
}
