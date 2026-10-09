import * as THREE from 'three';
import {
  coin,
  countedPile,
  emptyBowl,
  mat,
  numeralSign,
  plate,
  popBits,
  type BitKind,
} from '../kit';
import { addActor, ask, drop, holdMs, pause, remind, say, type Choice } from '../play';
import { canvasTexture, place, plane, setClickables, textures, WORLD_H, WORLD_W, type Clickable } from '../world';
import { cap, finish, numberWord, pace, shuffle, stage } from './common';

const BIT_WORD: Record<BitKind, string> = {
  apple: 'apples',
  moon: 'moons',
  fish: 'fish',
  orb: 'stars',
};

const COIN = 1.62;
const COIN_GAP = 0.42;
const INK = '#3b2258';
const MATCH_NUMERAL_V = 0.34;
const MATCH_GROUPS_V = 0.58;
const PATH_STONE_V = 0.58;
const PATH_LIT_SCALE = 1.34;

function oneWord(kind: BitKind, n: number): string {
  if (n === 1 && kind !== 'fish') return BIT_WORD[kind].replace(/s$/, '');
  return BIT_WORD[kind];
}

function unit(kind: BitKind): string {
  if (kind === 'fish') return 'fish';
  if (kind === 'orb') return 'star';
  return BIT_WORD[kind].replace(/s$/, '');
}

export function picturePhrase(kind: string): string {
  return kind === 'sun' ? 'the sun' : `a ${kind}`;
}

export function numberChoices(n: number): number[] {
  const set = new Set<number>([n]);
  for (const candidate of [n - 1, n + 1, n - 2, n + 2, n + 3, n - 3, 0, 1, 2]) {
    if (candidate >= 0 && candidate <= 20) set.add(candidate);
    if (set.size >= 4) break;
  }
  return shuffle([...set].slice(0, 4));
}

function midU(): number {
  const { u0, u1 } = stage();
  return (u0 + u1) / 2;
}

function spreadU(count: number, size: number, gap: number): number[] {
  const pitch = size + gap;
  const start = midU() - ((count - 1) * pitch) / 2 / WORLD_W;
  return Array.from({ length: count }, (_, i) => start + (i * pitch) / WORLD_W);
}

function layBig(meshes: THREE.Object3D[], size: number, top: number, low: number, gap = COIN_GAP): void {
  if (meshes.length <= 2) {
    const us = spreadU(meshes.length, size, gap);
    const v = (top + low) / 2;
    meshes.forEach((mesh, i) => place(mesh, us[i], v, 0.58));
    return;
  }
  if (meshes.length === 3) {
    const us = spreadU(2, size, gap);
    place(meshes[0], us[0], top, 0.58);
    place(meshes[1], us[1], top, 0.58);
    place(meshes[2], midU(), low, 0.58);
    return;
  }
  const us = spreadU(2, size, gap);
  place(meshes[0], us[0], top, 0.58);
  place(meshes[1], us[1], top, 0.58);
  place(meshes[2], us[0], low, 0.58);
  place(meshes[3], us[1], low, 0.58);
}

function pileBox(count: number, item: number): { w: number; h: number } {
  if (count <= 0) return { w: item, h: item };
  const cols = count <= 3 ? count : count <= 6 ? 3 : 5;
  const rows = Math.ceil(count / Math.max(1, cols));
  const gap = 0.2;
  return {
    w: item * (cols + Math.max(0, cols - 1) * gap),
    h: item * (rows + Math.max(0, rows - 1) * gap),
  };
}

function bitSize(maxCount: number): number {
  if (maxCount >= 8) return 0.6;
  if (maxCount >= 6) return 0.66;
  return 0.7;
}

function pileSpan(kind: BitKind, count: number, item: number): { w: number; h: number } {
  const n = Math.max(count, 1);
  const cols = n <= 2 ? n : n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const gap = 0.2;
  const wide = kind === 'fish' ? 1.28 : 1;
  return {
    w: item * (cols + Math.max(0, cols - 1) * gap) * wide,
    h: item * (rows + Math.max(0, rows - 1) * gap),
  };
}

function evenPile(kind: BitKind, count: number, item: number): THREE.Object3D {
  if (count <= 0) {
    const bowl = emptyBowl();
    const s = Math.min(1.7 / 3.55, 1.15 / 1.72);
    bowl.scale.set(s, s, 1);
    return bowl;
  }
  const box = pileSpan(kind, count, item);
  return countedPile(kind, count, box.w, box.h);
}

function cluster(kind: BitKind, count: number, u: number, v: number, cardW: number, cardH: number, item: number): THREE.Group {
  const group = new THREE.Group();
  group.add(mat(cardW, cardH), plate(cardW, cardH), evenPile(kind, count, item));
  group.name = `set-${count}`;
  place(group, u, v, 0.5);
  return group;
}

function pairClusters(kind: BitKind, counts: number[], v = 0.52): THREE.Group[] {
  const item = bitSize(Math.max(...counts, 1));
  const boxes = counts.map((count) => pileSpan(kind, count, item));
  const needW = Math.max(...boxes.map((b) => b.w)) + 0.36;
  const needH = Math.max(...boxes.map((b) => b.h)) + 0.42;
  const cardW = Math.min(3.05, Math.max(2.0, needW));
  const cardH = Math.min(2.9, Math.max(1.85, needH));
  const us = spreadU(counts.length, cardW, 0.4);
  return counts.map((count, i) => cluster(kind, count, us[i], v, cardW, cardH, item));
}

function manyLayout(count: number): { item: number; w: number; h: number; v: number; coins: { top: number; low: number } } {
  const rows = Math.ceil(count / 5);
  const item = rows >= 3 ? 0.7 : 0.88;
  const box = pileBox(count, item);
  const w = Math.min(6.5, box.w + 0.42);
  const h = box.h + 0.36;
  const topV = 0.19;
  const bottomV = topV + h / WORLD_H;
  const coinTop = bottomV + 1.62 / 2 / WORLD_H + 0.04;
  return {
    item,
    w,
    h,
    v: topV + h / 2 / WORLD_H,
    coins: { top: coinTop, low: Math.min(0.8, coinTop + 0.2) },
  };
}

function smallLayout(kind: BitKind, count: number): { w: number; h: number; v: number; boxW: number; boxH: number; coins: { top: number; low: number } } {
  if (count <= 0) {
    const w = 3.4;
    const h = 1.7;
    const topV = 0.175;
    const bottomV = topV + h / WORLD_H;
    const coinTop = bottomV + 1.62 / 2 / WORLD_H + 0.04;
    return { w, h, v: topV + h / 2 / WORLD_H, boxW: w, boxH: h, coins: { top: coinTop, low: Math.min(0.82, coinTop + 0.2) } };
  }
  const wide = kind === 'fish' ? 1.17 : kind === 'moon' ? 0.9 : kind === 'apple' ? 0.88 : 1;
  const cols = count <= 3 ? count : count <= 8 ? (kind === 'fish' ? Math.min(4, count) : 4) : 5;
  const rows = Math.ceil(count / cols);
  const itemH = rows <= 1 ? 1.08 : rows === 2 ? 1.02 : 0.78;
  const gap = 0.18;
  const boxW = itemH * wide * (cols + Math.max(0, cols - 1) * gap);
  const boxH = itemH * (rows + Math.max(0, rows - 1) * gap);
  const w = Math.min(6.4, boxW + 0.5);
  const h = boxH + 0.42;
  const topV = 0.17;
  const bottomV = topV + h / WORLD_H;
  const coinTop = bottomV + 1.62 / 2 / WORLD_H + 0.035;
  return {
    w,
    h,
    v: topV + h / 2 / WORLD_H,
    boxW: Math.min(boxW, w * 0.92),
    boxH: Math.min(boxH, h * 0.9),
    coins: { top: coinTop, low: Math.min(0.84, coinTop + 0.2) },
  };
}

function countingBoard(kind: BitKind, count: number): THREE.Group {
  const many = count >= 10 ? manyLayout(count) : null;
  const small = many ? null : smallLayout(kind, count);
  const item = many ? many.item : count >= 6 ? 0.92 : 1.05;
  const box = pileBox(count, item);
  const w = many ? many.w : small!.w;
  const h = many ? many.h : small!.h;
  const group = new THREE.Group();
  group.add(mat(w, h));
  group.name = `board-${count}`;
  if (count === 0) {
    const bowl = emptyBowl();
    const s = Math.min(w / 3.4, h / 1.7) * 0.9;
    bowl.scale.set(s, s, 1);
    bowl.position.set(0, -0.05, 0.06);
    group.add(bowl);
  } else {
    const pileW = many ? Math.min(box.w, w * 0.92) : small!.boxW;
    const pileH = many ? Math.min(box.h, h * 0.9) : small!.boxH;
    group.add(countedPile(kind, count, pileW, pileH));
  }
  place(group, midU(), many ? many.v : small!.v, 0.42);
  return group;
}

function coinBand(kind: BitKind, count: number): { top: number; low: number } {
  return count >= 10 ? manyLayout(count).coins : smallLayout(kind, count).coins;
}

function countAloud(n: number): string {
  if (n <= 0) return 'The bowl is empty. Count what you see.';
  const words = Array.from({ length: n }, (_, i) => numberWord(i + 1));
  return `${cap(words.join(', '))}. Tap how many.`;
}

function startTag(): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 420;
  canvas.height = 160;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas');
  g.fillStyle = '#fff6e4';
  g.beginPath();
  g.roundRect(8, 8, 404, 144, 64);
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = '#e7b34a';
  g.stroke();
  g.fillStyle = INK;
  g.font = '700 72px Starlace, Andika, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('start', 210, 86);
  const mesh = plane(canvasTexture(canvas), 1.15, 0.44, 7);
  mesh.userData.disposeMap = true;
  (mesh.material as THREE.MeshBasicMaterial).userData.noTint = true;
  mesh.position.set(0, 0.78, 0.1);
  mesh.name = 'start-tag';
  return mesh;
}

function numberCoins(answer: number, tipFor: (n: number) => string): Choice[] {
  return numberChoices(answer).map((n) => {
    const mesh = coin(n, COIN);
    mesh.name = `coin-${n}`;
    return {
      mesh,
      correct: n === answer,
      tip: n === answer ? '' : tipFor(n),
    };
  });
}

async function teachBeat(token: number, line: string, props: THREE.Object3D[]): Promise<boolean> {
  setClickables([]);
  for (const obj of props) addActor(obj);
  say(line);
  const alive = await pause(token, holdMs(line));
  for (const obj of props) drop(obj);
  return alive;
}

function glowAt(u: number, v: number, w: number, h: number, z = 0.56): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas');
  const glow = g.createRadialGradient(256, 256, 36, 256, 256, 250);
  glow.addColorStop(0, 'rgba(255, 245, 170, 0.12)');
  glow.addColorStop(0.42, 'rgba(255, 214, 70, 0.28)');
  glow.addColorStop(0.62, 'rgba(255, 180, 30, 0.95)');
  glow.addColorStop(0.78, 'rgba(255, 140, 10, 0.7)');
  glow.addColorStop(1, 'rgba(255, 120, 0, 0)');
  g.fillStyle = glow;
  g.beginPath();
  g.roundRect(10, 10, 492, 492, 96);
  g.fill();
  const mesh = plane(canvasTexture(canvas), w, h, 7);
  mesh.userData.disposeMap = true;
  (mesh.material as THREE.MeshBasicMaterial).userData.noTint = true;
  place(mesh, u, v, z);
  return mesh;
}

async function ensureStone(): Promise<THREE.Texture> {
  const cached = textures.stone;
  if (cached) return cached;
  const tex = await new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      '/art/ui/stone.png',
      (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.magFilter = THREE.LinearFilter;
        loaded.minFilter = THREE.LinearFilter;
        loaded.generateMipmaps = false;
        loaded.needsUpdate = true;
        resolve(loaded);
      },
      undefined,
      () => reject(new Error('/art/ui/stone.png')),
    );
  });
  textures.stone = tex;
  return tex;
}

function numberMark(n: number, size: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${n >= 10 ? 118 : 152}px Starlace, Andika, sans-serif`;
  g.lineJoin = 'round';
  g.lineWidth = 10;
  g.strokeStyle = 'rgba(255, 246, 228, 0.92)';
  g.strokeText(String(n), 128, 136);
  g.fillStyle = INK;
  g.fillText(String(n), 128, 136);
  const mesh = plane(canvasTexture(canvas), size, size, 6);
  mesh.userData.disposeMap = true;
  return mesh;
}

function stoneRing(w: number, h: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 280;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas');
  g.lineCap = 'round';
  g.strokeStyle = '#f0c14a';
  g.lineWidth = 26;
  g.beginPath();
  g.ellipse(256, 140, 214, 96, 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = '#3b2258';
  g.lineWidth = 8;
  g.stroke();
  const mesh = plane(canvasTexture(canvas), w, h, 8);
  mesh.userData.disposeMap = true;
  (mesh.material as THREE.MeshBasicMaterial).userData.noTint = true;
  return mesh;
}

function stoneHalo(w: number, h: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas');
  const glow = g.createRadialGradient(256, 256, 6, 256, 256, 250);
  glow.addColorStop(0, 'rgba(255, 250, 190, 1)');
  glow.addColorStop(0.28, 'rgba(255, 210, 70, 1)');
  glow.addColorStop(0.5, 'rgba(255, 150, 20, 0.95)');
  glow.addColorStop(0.7, 'rgba(255, 120, 10, 0.55)');
  glow.addColorStop(1, 'rgba(255, 110, 0, 0)');
  g.fillStyle = glow;
  g.beginPath();
  g.ellipse(256, 256, 250, 250, 0, 0, Math.PI * 2);
  g.fill();
  const mesh = plane(canvasTexture(canvas), w, h, 3);
  mesh.userData.disposeMap = true;
  (mesh.material as THREE.MeshBasicMaterial).userData.noTint = true;
  return mesh;
}

function stoneWash(w: number, h: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas');
  const wash = g.createRadialGradient(256, 108, 16, 256, 108, 210);
  wash.addColorStop(0, 'rgba(255, 236, 140, 0.5)');
  wash.addColorStop(0.45, 'rgba(255, 196, 64, 0.32)');
  wash.addColorStop(1, 'rgba(255, 170, 40, 0)');
  g.fillStyle = wash;
  g.beginPath();
  g.ellipse(256, 112, 228, 96, 0, 0, Math.PI * 2);
  g.fill();
  const mesh = plane(canvasTexture(canvas), w, h, 5);
  mesh.userData.disposeMap = true;
  (mesh.material as THREE.MeshBasicMaterial).userData.noTint = true;
  return mesh;
}

function steppingStone(n: number, mode: 'plain' | 'halo' | 'hero' | 'start' = 'plain'): THREE.Group {
  const tex = textures.stone;
  if (!tex) throw new Error('/art/ui/stone.png');
  const img = tex.image as { width: number; height: number };
  const aspect = img.width / Math.max(1, img.height);
  const w = 1.82;
  const h = w / aspect;
  const lit = mode === 'halo' || mode === 'hero';
  const group = new THREE.Group();
  if (lit) {
    const halo = stoneHalo(w * 1.22, h * 1.35);
    halo.position.z = -0.04;
    group.add(halo);
    const ring = stoneRing(w * 1.22, h * 1.28);
    ring.position.z = 0.12;
    group.add(ring);
  }
  const rock = plane(tex, w, h, 4);
  (rock.material as THREE.MeshBasicMaterial).alphaTest = 0.12;
  group.add(rock);
  if (lit) {
    const wash = stoneWash(w * 1.02, h * 1.06);
    wash.position.set(0, 0.04, 0.03);
    group.add(wash);
  }
  const mark = numberMark(n, 0.9);
  mark.position.set(0, 0.1, 0.06);
  group.add(mark);
  if (mode === 'start') group.add(startTag());
  group.add(plate(mode === 'hero' ? 2.05 : 1.9, mode === 'hero' ? 2.05 : 1.9));
  if (mode === 'hero') {
    group.scale.setScalar(PATH_LIT_SCALE);
    group.userData.baseScale = PATH_LIT_SCALE;
  }
  group.name = `coin-${n}`;
  return group;
}

function pathNums(n: number): number[] {
  const nums = [n - 1, n, n + 1].filter((x) => x >= 0 && x <= 20);
  if (n === 0) return [0, 1, 2];
  if (n === 20) return [18, 19, 20];
  return nums;
}

function layPath(meshes: THREE.Object3D[]): void {
  const n = meshes.length;
  const us = spreadU(n, 1.7, 0.28);
  meshes.forEach((mesh, i) => {
    const t = n === 1 ? 0.5 : i / Math.max(1, n - 1);
    const v = PATH_STONE_V + Math.sin(t * Math.PI) * 0.02;
    place(mesh, us[i], v, 0.52 + i * 0.012);
  });
}

export async function playCount(token: number): Promise<'done' | 'leave'> {
  const rounds: { n: number; bit: BitKind }[] = [
    { n: 3, bit: 'apple' },
    { n: 0, bit: 'moon' },
    { n: 6, bit: 'moon' },
    { n: 1, bit: 'apple' },
    { n: 7, bit: 'fish' },
    { n: 10, bit: 'fish' },
    { n: 4, bit: 'orb' },
    { n: 14, bit: 'apple' },
    { n: 8, bit: 'moon' },
  ];
  return finish(token, async () => {
    const demoBoard = countingBoard('apple', 2);
    const demoNums = [1, 2, 3].map((n) => {
      const mesh = coin(n, COIN);
      mesh.name = `coin-${n}`;
      return mesh;
    });
    layBig(demoNums, COIN, 0.42, 0.64);
    const two = demoNums.find((mesh) => mesh.name === 'coin-2') ?? demoNums[1];
    const glow = glowAt(two.position.x / WORLD_W + 0.5, 0.5 - two.position.y / WORLD_H, 1.95, 1.95);
    popBits(demoBoard);
    const teach = 'Watch. One, two. There are two apples.';
    if (!(await teachBeat(token, teach, [demoBoard, glow, ...demoNums]))) return false;
    const zeroBoard = countingBoard('moon', 0);
    const zeroNums = [0, 1, 2].map((n) => {
      const mesh = coin(n, COIN);
      mesh.name = `coin-${n}`;
      return mesh;
    });
    layBig(zeroNums, COIN, 0.42, 0.64);
    const zeroCoin = zeroNums.find((mesh) => mesh.name === 'coin-0') ?? zeroNums[0];
    const zeroGlow = glowAt(zeroCoin.position.x / WORLD_W + 0.5, 0.5 - zeroCoin.position.y / WORLD_H, 1.95, 1.95);
    const zeroTeach = 'The bowl is empty. None. We say zero.';
    if (!(await teachBeat(token, zeroTeach, [zeroBoard, zeroGlow, ...zeroNums]))) return false;
    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];
      const board = countingBoard(round.bit, round.n);
      addActor(board);
      const items = numberCoins(round.n, (n) =>
        round.n === 0
          ? 'The bowl is empty. Count what you see.'
          : `That is ${numberWord(n)}. Touch each ${unit(round.bit)} one time as you count, then tap that number.`,
      );
      const band = coinBand(round.bit, round.n);
      layBig(items.map((item) => item.mesh), COIN, band.top, band.low);
      const word = oneWord(round.bit, round.n);
      const prompt =
        round.n === 0
          ? `Look in the bowl. How many ${word} are in the bowl?`
          : `Count the ${word}. Tap how many.`;
      const turn = i === 0 ? `Your turn. ${prompt}` : prompt;
      const praise =
        round.n === 0
          ? 'Yes. There are zero. When there are none, we say zero.'
          : round.n === 1
            ? `Yes. There is one ${word}.`
            : `Yes. There are ${numberWord(round.n)} ${word}.`;
      const boardTap: Clickable = {
        root: board,
        click: () => {
          popBits(board);
          if (round.n === 0) remind('The bowl is empty. Count what you see.');
          else remind(countAloud(round.n));
        },
      };
      const ok = await ask(token, turn, items, praise, [boardTap], pace(i, rounds.length));
      if (!ok) return false;
      drop(board);
    }
    return true;
  }, 'You counted every group.');
}

export async function playSets(token: number): Promise<'done' | 'leave'> {
  const rounds = [
    { n: 4, sets: [4, 2], bit: 'apple' as BitKind },
    { n: 5, sets: [3, 5], bit: 'moon' as BitKind },
    { n: 2, sets: [2, 6], bit: 'fish' as BitKind },
    { n: 1, sets: [1, 3], bit: 'orb' as BitKind },
    { n: 8, sets: [8, 5], bit: 'apple' as BitKind },
    { n: 0, sets: [0, 4], bit: 'moon' as BitKind },
    { n: 6, sets: [6, 3], bit: 'fish' as BitKind },
    { n: 7, sets: [7, 4], bit: 'moon' as BitKind },
    { n: 8, sets: [8, 6], bit: 'apple' as BitKind },
  ];
  return finish(token, async () => {
    const hero = numeralSign(3);
    place(hero, midU(), MATCH_NUMERAL_V, 0.55);
    const demo = pairClusters('apple', [3, 5], MATCH_GROUPS_V);
    const match = demo.find((g) => g.name === 'set-3') ?? demo[0];
    const matchU = match.position.x / WORLD_W + 0.5;
    const glow = glowAt(matchU, MATCH_GROUPS_V, 3.05, 3.2, 0.58);
    const teach = 'This number is three. This group has three. It matches the number.';
    if (!(await teachBeat(token, teach, [hero, glow, ...demo]))) return false;
    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];
      const numeral = numeralSign(round.n);
      place(numeral, midU(), MATCH_NUMERAL_V, 0.55);
      addActor(numeral);
      const order = shuffle(round.sets.slice());
      const cards = pairClusters(round.bit, order, MATCH_GROUPS_V);
      const items: Choice[] = cards.map((mesh, idx) => {
        const count = order[idx];
        return {
          mesh,
          correct: count === round.n,
          tip:
            count === round.n
              ? ''
              : `That group has ${numberWord(count)}. Count each group and find the one that matches the number.`,
          hear: () => popBits(mesh),
        };
      });
      const numeralTap: Clickable = {
        root: numeral,
        click: () => remind(`This number is ${numberWord(round.n)}. Count each group. Tap the group that matches.`),
      };
      const ok = await ask(
        token,
        i === 0
          ? 'Your turn. Count each group. Tap the group that matches this number.'
          : 'Count each group. Tap the group that matches this number.',
        items,
        `Yes. That group has ${numberWord(round.n)}.`,
        [numeralTap],
        pace(i, rounds.length),
      );
      if (!ok) return false;
      drop(numeral);
    }
    return true;
  }, 'You matched every number.');
}

export async function playMore(token: number): Promise<'done' | 'leave'> {
  const rounds = [
    { a: 5, b: 3, bit: 'apple' as BitKind, fewer: false },
    { a: 2, b: 6, bit: 'moon' as BitKind, fewer: true },
    { a: 4, b: 1, bit: 'fish' as BitKind, fewer: false },
    { a: 7, b: 4, bit: 'apple' as BitKind, fewer: true },
    { a: 3, b: 8, bit: 'orb' as BitKind, fewer: false },
    { a: 1, b: 5, bit: 'fish' as BitKind, fewer: true },
    { a: 8, b: 5, bit: 'moon' as BitKind, fewer: false },
    { a: 4, b: 7, bit: 'apple' as BitKind, fewer: true },
    { a: 6, b: 4, bit: 'fish' as BitKind, fewer: false },
  ];
  return finish(token, async () => {
    const demo = pairClusters('apple', [5, 2], 0.5);
    const more = demo.find((g) => g.name === 'set-5') ?? demo[0];
    const glow = glowAt(more.position.x / WORLD_W + 0.5, 0.5, 3.15, 3.25, 0.58);
    const teach = 'Count both piles. This pile is more than the other.';
    if (!(await teachBeat(token, teach, [glow, ...demo]))) return false;
    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];
      const cards = pairClusters(round.bit, [round.a, round.b], 0.5);
      const wantLeft = round.fewer ? round.a < round.b : round.a > round.b;
      const bigger = numberWord(Math.max(round.a, round.b));
      const smaller = numberWord(Math.min(round.a, round.b));
      const items: Choice[] = [
        {
          mesh: cards[0],
          correct: wantLeft,
          tip: `That pile has ${numberWord(round.a)}. Count the other pile too.`,
          hear: () => popBits(cards[0]),
        },
        {
          mesh: cards[1],
          correct: !wantLeft,
          tip: `That pile has ${numberWord(round.b)}. Count the other pile too.`,
          hear: () => popBits(cards[1]),
        },
      ];
      const askLine = round.fewer
        ? 'Tap the group that is less than the other.'
        : 'Tap the group that is more than the other.';
      const caption = i === 0 ? `Your turn. ${askLine}` : askLine;
      const praise = round.fewer
        ? `Yes. ${cap(smaller)} is less than ${bigger}.`
        : `Yes. ${cap(bigger)} is more than ${smaller}.`;
      const ok = await ask(token, caption, items, praise, [], pace(i, rounds.length));
      if (!ok) return false;
    }
    return true;
  }, 'You compared every group.');
}

export async function playPath(token: number): Promise<'done' | 'leave'> {
  const rounds = [
    { n: 6, dir: 'after' as const },
    { n: 3, dir: 'before' as const },
    { n: 11, dir: 'after' as const },
    { n: 8, dir: 'before' as const },
    { n: 0, dir: 'after' as const },
    { n: 14, dir: 'after' as const },
    { n: 19, dir: 'before' as const },
    { n: 5, dir: 'after' as const },
    { n: 9, dir: 'before' as const },
  ];
  return finish(token, async () => {
    await ensureStone();
    const demoNums = [3, 4, 5];
    const demo = demoNums.map((n) => steppingStone(n, n === 5 ? 'halo' : n === 4 ? 'start' : 'plain'));
    layPath(demo);
    const teach = 'Start at four. Count up. Five comes next.';
    if (!(await teachBeat(token, teach, demo))) return false;
    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];
      const answer = round.dir === 'after' ? round.n + 1 : round.n - 1;
      const nums = pathNums(round.n);
      const items: Choice[] = nums.map((n) => {
        const mesh = steppingStone(n, n === round.n ? 'start' : 'plain');
        return {
          mesh,
          correct: n === answer,
          tip:
            n === answer
              ? ''
              : n === round.n
                ? `That stone is ${numberWord(n)}. We start there. ${round.dir === 'after' ? 'Count up. What comes next?' : 'Count back. What comes before?'}`
                : round.dir === 'after'
                  ? `That is ${numberWord(n)}. Count up from ${numberWord(round.n)} out loud. What comes next?`
                  : `That is ${numberWord(n)}. Count back from ${numberWord(round.n)} out loud. What comes before?`,
        };
      });
      layPath(items.map((item) => item.mesh));
      const spoken = round.dir === 'after' ? 'after' : 'before';
      const pathLine = `Start at ${numberWord(round.n)}. Tap the number that comes ${spoken}.`;
      const ok = await ask(
        token,
        i === 0 ? `Your turn. ${pathLine}` : pathLine,
        items,
        `Yes. ${cap(numberWord(answer))} comes ${spoken} ${numberWord(round.n)}.`,
        [],
        pace(i, rounds.length),
      );
      if (!ok) return false;
    }
    return true;
  }, 'You know what comes next.');
}
