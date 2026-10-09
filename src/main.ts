import { findGame, hubZones, lobbySigns, QUESTS, type GameDef, type QuestDef } from './games';
import * as THREE from 'three';
import { bind, currentToken, openPlace, say, toggleVoice } from './play';
import { unlockAudio } from './speak';
import { asset, bindInput, camera, preload, scene, start } from './world';

const boot = document.getElementById('boot') as HTMLButtonElement;
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
  ready = true;
  openPlace('grove', null, { chrome: false });
}

function begin(): void {
  if (!ready || started) return;
  started = true;
  boot.classList.add('gone');
  unlockAudio();
  goHub();
}

function project(prefix: string): { name: string; x: number; y: number }[] {
  const hits: { name: string; x: number; y: number }[] = [];
  const point = new THREE.Vector3();
  scene.traverse((obj) => {
    if (!obj.name.startsWith(prefix)) return;
    obj.getWorldPosition(point);
    point.project(camera);
    hits.push({
      name: obj.name,
      x: (point.x * 0.5 + 0.5) * window.innerWidth,
      y: (-point.y * 0.5 + 0.5) * window.innerHeight,
    });
  });
  return hits;
}

window.starlace = { goto, project };
void bootUp();
boot.addEventListener('pointerdown', begin);
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
