import * as THREE from 'three';
import {
  coin,
  countedPile,
  hereRing,
  mat,
  plate,
  popBits,
  shapeTile,
  type ShapeName,
} from '../kit';
import { addActor, ask, currentToken, drop, holdMs, pause, remind, say, type Choice } from '../play';
import { canvasTexture, place, plane, type Clickable } from '../world';
import { numberChoices } from './counting';
import { cap, finish, numberWord, pace, shuffle, stage } from './common';

const SHAPE_CLUE: Record<ShapeName, string> = {
  circle: 'A circle is round.',
  square: 'A square has four equal sides.',
  triangle: 'A triangle has three sides.',
  rectangle: 'A rectangle has two long sides and two short sides.',
  star: 'A star has points.',
};

const SHAPE_HINT: Record<ShapeName, string> = {
  circle: 'Look for the round one.',
  square: 'Look for four equal sides.',
  triangle: 'Look for three sides.',
  rectangle: 'Look for two long sides and two short sides.',
  star: 'Look for the one with points.',
};

const ANSWER = 1.5;
const PITCH = 1.98;

async function speakHold(token: number, text: string): Promise<boolean> {
  say(text);
  return pause(token, holdMs(text));
}

function whenCaption(token: number, pred: (text: string) => boolean, fn: () => void): void {
  const el = document.getElementById('caption');
  const id = window.setInterval(() => {
    if (token !== currentToken()) {
      window.clearInterval(id);
      return;
    }
    if (pred(el?.textContent || '')) {
      window.clearInterval(id);
      fn();
    }
  }, 40);
}

function layAnswers(meshes: THREE.Object3D[], band?: { top: number; low: number }): void {
  const { u0, u1, top: stageTop, low: stageLow } = stage();
  const mid = (u0 + u1) / 2;
  const du = PITCH / 16;
  const dv = PITCH / 9;
  const n = meshes.length;
  if (n === 2) {
    const v = band?.top ?? (stageTop + stageLow) / 2;
    place(meshes[0], mid - du / 2, v, 0.55);
    place(meshes[1], mid + du / 2, v, 0.55);
    return;
  }
  if (n === 3) {
    const v = band?.low ?? band?.top ?? 0.64;
    meshes.forEach((mesh, i) => place(mesh, mid + (i - 1) * du, v, 0.55));
    return;
  }
  const top = band?.top ?? 0.34;
  const low = band?.low ?? top + dv;
  const spots: [number, number][] = [
    [mid - du / 2, top],
    [mid + du / 2, top],
    [mid - du / 2, low],
    [mid + du / 2, low],
  ];
  meshes.forEach((mesh, i) => place(mesh, spots[i][0], spots[i][1], 0.55));
}

function layLine(meshes: THREE.Object3D[], v: number, pitch = 1.12): void {
  const { u0, u1 } = stage();
  const mid = (u0 + u1) / 2;
  const du = pitch / 16;
  const start = mid - (du * (meshes.length - 1)) / 2;
  meshes.forEach((mesh, i) => place(mesh, start + du * i, v, 0.5));
}

const JOIN_COIN = 1.4;
const JOIN_PITCH = 1.78;
const JOIN_COIN_TOP = 0.485;
const JOIN_APPLE = 0.72;
const JOIN_ROW_GAP = 0.3;

function joinCoinBand(): { top: number; low: number } {
  const dv = JOIN_PITCH / 9;
  return { top: JOIN_COIN_TOP, low: JOIN_COIN_TOP + dv };
}

function layJoinCoins(meshes: THREE.Object3D[]): void {
  const { u0, u1 } = stage();
  const mid = (u0 + u1) / 2;
  const du = JOIN_PITCH / 16;
  const { top, low } = joinCoinBand();
  const spots: [number, number][] = [
    [mid - du / 2, top],
    [mid + du / 2, top],
    [mid - du / 2, low],
    [mid + du / 2, low],
  ];
  meshes.forEach((mesh, i) => place(mesh, spots[i][0], spots[i][1], 0.55));
}

function plusMark(size = 0.24): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas');
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#3b2258';
  g.lineWidth = 42;
  g.beginPath();
  g.moveTo(128, 36);
  g.lineTo(128, 220);
  g.moveTo(36, 128);
  g.lineTo(220, 128);
  g.stroke();
  g.strokeStyle = '#f0c14a';
  g.lineWidth = 22;
  g.beginPath();
  g.moveTo(128, 36);
  g.lineTo(128, 220);
  g.moveTo(36, 128);
  g.lineTo(220, 128);
  g.stroke();
  const mesh = plane(canvasTexture(canvas), size, size, 6);
  mesh.name = 'plus';
  mesh.userData.disposeMap = true;
  (mesh.material as THREE.MeshBasicMaterial).userData.noTint = true;
  return mesh;
}

function appleRow(n: number): THREE.Group {
  const w = Math.max(0.72, n * 0.64);
  return countedPile('apple', n, w, JOIN_APPLE);
}

function appleGrid(n: number, crossed: number): THREE.Group {
  const cols = n <= 3 ? Math.max(1, n) : n <= 6 ? 3 : 4;
  const rows = Math.ceil(n / Math.max(1, cols));
  const gap = 0.2;
  const boxW = JOIN_APPLE * 0.88 * (cols + Math.max(0, cols - 1) * gap);
  const boxH = JOIN_APPLE * (rows + Math.max(0, rows - 1) * gap);
  return countedPile('apple', n, boxW, boxH, crossed);
}

function placeJoinBoard(board: THREE.Group, height: number): void {
  const { u0, u1 } = stage();
  const mid = (u0 + u1) / 2;
  const coinTopV = JOIN_COIN_TOP - JOIN_COIN / 2 / 9;
  const bottomV = coinTopV - 36 / 768;
  const v = bottomV - height / 2 / 9;
  place(board, mid, v, 0.46);
}

function joinAddBoard(a: number, b: number): { board: THREE.Group; height: number } {
  const board = new THREE.Group();
  const top = appleRow(a);
  const bottom = appleRow(b);
  const dy = JOIN_APPLE / 2 + JOIN_ROW_GAP / 2;
  top.position.y = dy;
  bottom.position.y = -dy;
  const plus = plusMark(0.22);
  plus.position.z = 0.06;
  board.add(top, plus, bottom);
  return { board, height: JOIN_APPLE * 2 + JOIN_ROW_GAP };
}

function joinTakeBoard(a: number, crossed: number): { board: THREE.Group; height: number } {
  const pile = appleGrid(a, crossed);
  const cols = a <= 3 ? Math.max(1, a) : a <= 6 ? 3 : 4;
  const rows = Math.ceil(a / Math.max(1, cols));
  const gap = 0.2;
  const height = JOIN_APPLE * (rows + Math.max(0, rows - 1) * gap);
  const board = new THREE.Group();
  board.add(pile);
  return { board, height };
}

function choiceShape(name: ShapeName, pose: { size?: number; rot?: number } = {}): THREE.Group {
  const tile = shapeTile(name, pose.size ?? ANSWER);
  tile.name = `art-${name}`;
  if (pose.rot) tile.rotation.z = pose.rot;
  const group = new THREE.Group();
  group.add(tile);
  group.name = `shape-${name}`;
  return group;
}

function questionSpot(size: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas');
  g.fillStyle = 'rgba(255, 246, 228, 0.4)';
  g.beginPath();
  g.roundRect(40, 40, 432, 432, 52);
  g.fill();
  g.setLineDash([12, 18]);
  g.lineWidth = 7;
  g.strokeStyle = 'rgba(59, 34, 88, 0.32)';
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = 'rgba(59, 34, 88, 0.42)';
  g.font = '700 210px Starlace, Andika, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('?', 256, 278);
  const mesh = plane(canvasTexture(canvas), size, size, 4);
  mesh.name = 'pattern-slot';
  mesh.userData.disposeMap = true;
  (mesh.material as THREE.MeshBasicMaterial).userData.noTint = true;
  return mesh;
}

function appleTalk(n: number): string {
  return n === 1 ? 'one apple' : `${numberWord(n)} apples`;
}

const STACK_COIN = 0.86;
const STACK_PAD = 0.14;
const STACK_GAP = 0.1;

function starItem(maxN: number): number {
  if (maxN >= 13) return 0.36;
  if (maxN >= 10) return 0.4;
  if (maxN >= 7) return 0.48;
  return 0.54;
}

function pileBox(count: number, item: number): { w: number; h: number } {
  if (count <= 0) return { w: item, h: item };
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  const gap = 0.2;
  return {
    w: item * (cols + Math.max(0, cols - 1) * gap),
    h: item * (rows + Math.max(0, rows - 1) * gap),
  };
}

function stackMetrics(counts: number[]): { item: number; cardW: number; cardH: number } {
  const item = starItem(Math.max(...counts, 1));
  const boxes = counts.map((n) => pileBox(Math.max(n, 1), item));
  const pileW = Math.max(...boxes.map((b) => b.w));
  const pileH = Math.max(...boxes.map((b) => b.h));
  return {
    item,
    cardW: Math.max(1.85, pileW + 0.34),
    cardH: STACK_PAD + STACK_COIN + STACK_GAP + pileH + STACK_PAD,
  };
}

function numberStack(n: number, item: number, cardW: number, cardH: number): THREE.Group {
  const group = new THREE.Group();
  const base = mat(cardW, cardH);
  const disk = coin(n, STACK_COIN);
  disk.position.y = cardH / 2 - STACK_PAD - STACK_COIN / 2;
  disk.position.z = 0.05;
  const box = pileBox(n, item);
  const dots = n > 0 ? countedPile('orb', n, box.w, box.h) : new THREE.Group();
  const areaTop = disk.position.y - STACK_COIN / 2 - STACK_GAP;
  const areaBot = -cardH / 2 + STACK_PAD;
  dots.position.y = (areaTop + areaBot) / 2;
  const hit = plate(cardW, cardH);
  group.add(base, disk, dots, hit);
  group.name = `more-${n}`;
  return group;
}

function layNumberPair(meshes: THREE.Object3D[], cardW: number, cardH: number): void {
  const { u0, u1 } = stage();
  const mid = (u0 + u1) / 2;
  const du = (cardW + 0.42) / 16;
  const halfV = cardH / 2 / 9;
  const v = Math.max(0.4, 0.195 + 0.02 + halfV);
  place(meshes[0], mid - du / 2, v, 0.5);
  place(meshes[1], mid + du / 2, v, 0.5);
}

export async function playShapes(token: number): Promise<'done' | 'leave'> {
  const rounds: { target: ShapeName; options: ShapeName[]; size: number; rot: number }[] = [
    { target: 'circle', options: ['circle', 'square', 'triangle', 'star'], size: 1.5, rot: 0 },
    { target: 'square', options: ['square', 'circle', 'rectangle', 'triangle'], size: 1.42, rot: 0 },
    { target: 'triangle', options: ['triangle', 'star', 'circle', 'square'], size: 1.5, rot: 0 },
    { target: 'rectangle', options: ['rectangle', 'square', 'circle', 'star'], size: 1.55, rot: 0 },
    { target: 'star', options: ['star', 'triangle', 'rectangle', 'circle'], size: 1.42, rot: Math.PI / 2 },
    { target: 'triangle', options: ['triangle', 'circle', 'square', 'star'], size: 1.5, rot: 0 },
    { target: 'rectangle', options: ['rectangle', 'star', 'triangle', 'circle'], size: 1.5, rot: Math.PI / 2 },
    { target: 'circle', options: ['circle', 'rectangle', 'star', 'triangle'], size: 1.38, rot: 0 },
    { target: 'square', options: ['square', 'star', 'circle', 'triangle'], size: 1.55, rot: 0 },
  ];
  return finish(token, async () => {
    if (!(await teachShapes(token))) return false;
    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];
      const items: Choice[] = shuffle(round.options).map((name) => {
        const pose = name === round.target ? { size: round.size, rot: round.rot } : { size: round.size };
        return {
          mesh: choiceShape(name, pose),
          correct: name === round.target,
          tip: name === round.target ? '' : `That is a ${name}. ${SHAPE_HINT[round.target]}`,
        };
      });
      layAnswers(items.map((item) => item.mesh));
      const prompt =
        i === 0
          ? `Your turn. ${SHAPE_CLUE[round.target]} Tap the ${round.target}.`
          : `${SHAPE_CLUE[round.target]} Tap the ${round.target}.`;
      const ok = await ask(token, prompt, items, `Yes. That is a ${round.target}.`, [], pace(i, rounds.length));
      if (!ok) return false;
    }
    return true;
  }, 'You named every shape.');
}

async function teachShapes(token: number): Promise<boolean> {
  const names: ShapeName[] = ['circle', 'square', 'triangle', 'rectangle', 'star'];
  const { u0, u1 } = stage();
  const mid = (u0 + u1) / 2;
  for (const name of names) {
    const tile = shapeTile(name, 1.55);
    tile.name = `teach-${name}`;
    const ring = hereRing(2.15);
    place(ring, mid, 0.42, 0.48);
    place(tile, mid, 0.42, 0.55);
    addActor(ring);
    addActor(tile);
    const alive = await speakHold(token, SHAPE_CLUE[name]);
    drop(tile);
    drop(ring);
    if (!alive) return false;
  }
  return true;
}

export async function playPattern(token: number): Promise<'done' | 'leave'> {
  const rounds: { shown: ShapeName[]; next: ShapeName; options: ShapeName[] }[] = [
    { shown: ['circle', 'square', 'circle', 'square'], next: 'circle', options: ['circle', 'triangle', 'star'] },
    { shown: ['triangle', 'star', 'triangle', 'star'], next: 'triangle', options: ['triangle', 'square', 'circle'] },
    { shown: ['star', 'circle', 'star', 'circle'], next: 'star', options: ['star', 'square', 'rectangle'] },
    { shown: ['square', 'square', 'triangle', 'triangle'], next: 'square', options: ['square', 'circle', 'star'] },
    { shown: ['rectangle', 'circle', 'rectangle', 'circle'], next: 'rectangle', options: ['rectangle', 'star', 'triangle'] },
    { shown: ['circle', 'triangle', 'circle', 'triangle'], next: 'circle', options: ['circle', 'star', 'square'] },
    { shown: ['star', 'star', 'square', 'square'], next: 'star', options: ['star', 'circle', 'rectangle'] },
    { shown: ['triangle', 'rectangle', 'triangle', 'rectangle'], next: 'triangle', options: ['triangle', 'circle', 'star'] },
    { shown: ['square', 'circle', 'square', 'circle'], next: 'square', options: ['square', 'star', 'triangle'] },
  ];
  return finish(token, async () => {
    if (!(await teachPattern(token))) return false;
    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];
      const tile = 0.95;
      const shown = round.shown.map((name, index) => {
        const mesh = shapeTile(name, tile);
        mesh.name = `shown-${name}-${index}`;
        return mesh;
      });
      const empty = questionSpot(tile);
      empty.name = 'pattern-hole';
      const row: THREE.Object3D[] = [...shown, empty];
      layLine(row, 0.3, 1.12);
      row.forEach(addActor);
      const chant = round.shown.join(', ');
      const items: Choice[] = shuffle(round.options).map((name) => ({
        mesh: choiceShape(name),
        correct: name === round.next,
        tip: name === round.next ? '' : `That is a ${name}. Say the pattern with me: ${chant}. What comes next?`,
      }));
      const { u0, u1 } = stage();
      const mid = (u0 + u1) / 2;
      const tray = mat(6.2, 1.95);
      place(tray, mid, 0.62, 0.42);
      addActor(tray);
      row.push(tray);
      layAnswers(items.map((item) => item.mesh), { top: 0.62, low: 0.62 });
      const prompt = i === 0 ? `Your turn. ${cap(chant)}. What comes next?` : `${cap(chant)}. What comes next?`;
      const praise = `Yes. A ${round.next} comes next.`;
      const patternTaps: Clickable[] = [
        ...shown.map((mesh) => ({
          root: mesh,
          click: () => remind(`Say the pattern with me: ${chant}. What comes next?`),
        })),
        { root: empty, click: () => remind('That space is waiting. Tap the shape that comes next.') },
      ];
      const pending = ask(token, prompt, items, praise, patternTaps, pace(i, rounds.length));
      whenCaption(token, (text) => text === praise, () => {
        if (!empty.parent) return;
        const fill = shapeTile(round.next, tile);
        fill.name = `filled-${round.next}`;
        fill.position.copy(empty.position);
        addActor(fill);
        row.push(fill);
        drop(empty);
      });
      const ok = await pending;
      row.forEach((obj) => {
        if (obj.parent) drop(obj);
      });
      if (!ok) return false;
    }
    return true;
  }, 'You finished every pattern.');
}

async function teachPattern(token: number): Promise<boolean> {
  const names: ShapeName[] = ['circle', 'square', 'circle', 'square', 'circle'];
  const tiles = names.map((name, index) => {
    const mesh = shapeTile(name, 0.95);
    mesh.name = `teach-pat-${index}`;
    return mesh;
  });
  layLine(tiles, 0.38, 1.12);
  tiles.forEach(addActor);
  const last = tiles[tiles.length - 1];
  const ring = hereRing(1.55);
  ring.position.copy(last.position);
  ring.position.z -= 0.04;
  addActor(ring);
  const demo = 'Circle, square, circle, square. A circle comes next.';
  if (!(await speakHold(token, demo))) {
    tiles.forEach(drop);
    drop(ring);
    return false;
  }
  tiles.forEach(drop);
  drop(ring);
  return true;
}

export async function playJoin(token: number): Promise<'done' | 'leave'> {
  const rounds = [
    { a: 2, b: 3, leave: false },
    { a: 4, b: 1, leave: false },
    { a: 3, b: 3, leave: false },
    { a: 1, b: 2, leave: false },
    { a: 5, b: 2, leave: false },
    { a: 6, b: 2, leave: true },
    { a: 8, b: 3, leave: true },
    { a: 5, b: 1, leave: true },
    { a: 7, b: 4, leave: true },
  ];
  return finish(token, async () => {
    if (!(await teachJoin(token))) return false;
    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];
      const answer = round.leave ? round.a - round.b : round.a + round.b;
      const actors: THREE.Object3D[] = [];
      const built = round.leave
        ? joinTakeBoard(round.a, round.b)
        : joinAddBoard(round.a, round.b);
      placeJoinBoard(built.board, built.height);
      built.board.name = 'join-apples';
      actors.push(built.board);
      actors.forEach(addActor);
      const nums = numberChoices(answer);
      const items: Choice[] = nums.map((n) => {
        const mesh = coin(n, JOIN_COIN);
        mesh.name = `coin-${n}`;
        return {
          mesh,
          correct: n === answer,
          tip: n === answer
            ? ''
            : round.leave
              ? `That is ${numberWord(n)}. Count the apples that are left.`
              : `That is ${numberWord(n)}. Count the top apples, then keep counting the bottom apples.`,
        };
      });
      layJoinCoins(items.map((item) => item.mesh));
      const caption = round.leave
        ? `${i === 0 ? 'Your turn. ' : ''}Take away ${numberWord(round.b)}. Tap how many are left.`
        : `${i === 0 ? 'Your turn. ' : ''}${cap(numberWord(round.a))} and ${numberWord(round.b)}. Tap how many together.`;
      const speech = round.leave
        ? `${cap(appleTalk(round.a))}. ${cap(numberWord(round.b))} ${round.b === 1 ? 'has a red cross' : 'have a red cross'}. Take those away. How many are left?`
        : `${cap(appleTalk(round.a))} and ${appleTalk(round.b)}. Count every apple. How many together?`;
      const praise = round.leave
        ? `Yes. ${cap(numberWord(round.a))} take away ${numberWord(round.b)} leaves ${numberWord(answer)}.`
        : `Yes. ${cap(numberWord(round.a))} and ${numberWord(round.b)} make ${numberWord(answer)}.`;
      const appleTap: Clickable = {
        root: built.board,
        click: () => {
          popBits(built.board);
          remind(
            round.leave
              ? 'Skip the apples with a red cross. Count the ones that are left.'
              : 'Count the top apples, then keep counting the bottom apples.',
          );
        },
      };
      const ok = await ask(token, caption, items, praise, [appleTap], pace(i, rounds.length, { speech }));
      actors.forEach(drop);
      if (!ok) return false;
    }
    return true;
  }, 'You joined and took away.');
}

async function teachJoin(token: number): Promise<boolean> {
  const { u0, u1 } = stage();
  const mid = (u0 + u1) / 2;
  const built = joinAddBoard(1, 1);
  placeJoinBoard(built.board, built.height);
  const demo = coin(2, JOIN_COIN);
  demo.name = 'teach-coin-2';
  const ring = hereRing(2.05);
  const coinV = JOIN_COIN_TOP + JOIN_PITCH / 18;
  place(ring, mid, coinV, 0.5);
  place(demo, mid, coinV, 0.55);
  addActor(built.board);
  addActor(ring);
  addActor(demo);
  if (!(await speakHold(token, 'One and one make two.'))) {
    drop(built.board);
    drop(ring);
    drop(demo);
    return false;
  }
  drop(built.board);
  drop(ring);
  drop(demo);
  return true;
}

export async function playWhich(token: number): Promise<'done' | 'leave'> {
  const rounds: { pair: [number, number]; more: boolean }[] = [
    { pair: [4, 9], more: true },
    { pair: [8, 5], more: false },
    { pair: [3, 7], more: true },
    { pair: [6, 10], more: false },
    { pair: [14, 11], more: true },
    { pair: [2, 5], more: false },
    { pair: [9, 6], more: true },
    { pair: [12, 8], more: false },
    { pair: [5, 11], more: true },
  ];
  return finish(token, async () => {
    if (!(await teachWhich(token))) return false;
    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];
      const high = Math.max(round.pair[0], round.pair[1]);
      const low = Math.min(round.pair[0], round.pair[1]);
      const want = round.more ? high : low;
      const metrics = stackMetrics(round.pair);
      const askMore = round.more ? 'more' : 'less';
      const items: Choice[] = shuffle([round.pair[0], round.pair[1]]).map((n) => {
        const mesh = numberStack(n, metrics.item, metrics.cardW, metrics.cardH);
        return {
          mesh,
          correct: n === want,
          tip: n === want ? '' : `That is ${numberWord(n)}. Count the stars on each card. Which card has ${askMore}?`,
          hear: () => popBits(mesh),
        };
      });
      layNumberPair(items.map((item) => item.mesh), metrics.cardW, metrics.cardH);
      const caption = i === 0 ? `Your turn. Which number is ${askMore}? Tap it.` : `Which number is ${askMore}? Tap it.`;
      const praise = round.more
        ? `Yes. ${cap(numberWord(high))} is more than ${numberWord(low)}.`
        : `Yes. ${cap(numberWord(low))} is less than ${numberWord(high)}.`;
      const ok = await ask(token, caption, items, praise, [], pace(i, rounds.length, {
        speech: `Look at ${numberWord(round.pair[0])} and ${numberWord(round.pair[1])}. Which number is ${askMore}? Tap it.`,
      }));
      if (!ok) return false;
    }
    return true;
  }, 'You compared the numbers.');
}

async function teachWhich(token: number): Promise<boolean> {
  const { u0, u1 } = stage();
  const mid = (u0 + u1) / 2;
  const metrics = stackMetrics([3, 8]);
  const left = numberStack(3, metrics.item, metrics.cardW, metrics.cardH);
  const right = numberStack(8, metrics.item, metrics.cardW, metrics.cardH);
  left.name = 'teach-more-3';
  right.name = 'teach-more-8';
  layNumberPair([left, right], metrics.cardW, metrics.cardH);
  const du = (metrics.cardW + 0.42) / 16;
  const halfV = metrics.cardH / 2 / 9;
  const v = Math.max(0.4, 0.195 + 0.02 + halfV);
  const ring = hereRing(Math.max(2.6, metrics.cardW + 0.7));
  place(ring, mid + du / 2, v, 0.44);
  addActor(left);
  addActor(right);
  addActor(ring);
  if (!(await speakHold(token, 'Eight is more than three.'))) {
    drop(left);
    drop(right);
    drop(ring);
    return false;
  }
  drop(left);
  drop(right);
  drop(ring);
  return true;
}
