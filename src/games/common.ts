import * as THREE from 'three';
import { prizeStar } from '../kit';
import { addActor, currentPlace, holdMs, pause, say, type PlaceName } from '../play';
import { place } from '../world';

export function shuffle<T>(list: T[]): T[] {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const STAGE: Record<PlaceName, { u0: number; u1: number; top: number; low: number }> = {
  hub: { u0: 0.38, u1: 0.62, top: 0.34, low: 0.52 },
  grove: { u0: 0.36, u1: 0.58, top: 0.34, low: 0.52 },
  market: { u0: 0.37, u1: 0.57, top: 0.34, low: 0.52 },
  song: { u0: 0.36, u1: 0.57, top: 0.34, low: 0.52 },
  citadel: { u0: 0.36, u1: 0.57, top: 0.34, low: 0.52 },
};

export const LOWER = { top: 0.45, low: 0.61 };

export function stage() {
  return STAGE[currentPlace()];
}

function putAt(meshes: THREE.Object3D[], spots: [number, number][], z = 0.55): void {
  meshes.forEach((mesh, i) => place(mesh, spots[i][0], spots[i][1], z));
}

export function choiceSpots(count: number, band?: { top: number; low: number }): [number, number][] {
  const base = stage();
  const { u0, u1 } = base;
  const top = band?.top ?? base.top;
  const low = band?.low ?? base.low;
  const mid = (u0 + u1) / 2;
  const gap = Math.min(0.1, (u1 - u0) * 0.42);
  if (count <= 1) return [[mid, (top + low) / 2]];
  if (count === 2) return [[mid - gap, (top + low) / 2], [mid + gap, (top + low) / 2]];
  if (count === 3) {
    const step = (u1 - u0) / 2;
    return [0, 1, 2].map((i) => [u0 + step * i, (top + low) / 2]);
  }
  return [
    [mid - gap, top],
    [mid + gap, top],
    [mid - gap, low],
    [mid + gap, low],
  ];
}

export function layChoices(meshes: THREE.Object3D[], band?: { top: number; low: number }): void {
  putAt(meshes, choiceSpots(meshes.length, band));
}

export function layTight(meshes: THREE.Object3D[], v: number, size: number, align: 'center' | 'left' = 'center'): void {
  const { u0, u1 } = stage();
  const gap = (size * 1.16) / 16;
  if (align === 'left') {
    const start = u0 + size / 2 / 16 + 0.006;
    meshes.forEach((mesh, i) => place(mesh, start + gap * i, v, 0.5));
    return;
  }
  const mid = (u0 + u1) / 2;
  const total = gap * Math.max(0, meshes.length - 1);
  meshes.forEach((mesh, i) => place(mesh, mid - total / 2 + gap * i, v, 0.5));
}

export function layRow(meshes: THREE.Object3D[], v: number, sizePad = 0.02): void {
  const { u0, u1 } = stage();
  const left = u0 + sizePad;
  const right = u1 - sizePad;
  if (meshes.length === 1) {
    place(meshes[0], (left + right) / 2, v, 0.55);
    return;
  }
  const step = (right - left) / (meshes.length - 1);
  meshes.forEach((mesh, i) => place(mesh, left + step * i, v, 0.55));
}

export async function finish(token: number, run: () => Promise<boolean>, closing: string): Promise<'done' | 'leave'> {
  const ok = await run();
  if (!ok) return 'leave';
  const { u0, u1 } = stage();
  const star = prizeStar();
  place(star, (u0 + u1) / 2, 0.42, 0.8);
  addActor(star);
  say(closing);
  const alive = await pause(token, holdMs(closing));
  return alive ? 'done' : 'leave';
}

export function pace(step: number, total: number, extra?: { speech?: string; then?: () => void; praiseThen?: () => void }) {
  return { step, total, ...extra };
}

const NUMBER_WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

export function numberWord(n: number): string {
  return NUMBER_WORD[n] ?? String(n);
}

export function cap(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function countAloud(n: number): string {
  if (n <= 0) return 'zero';
  const words: string[] = [];
  for (let i = 1; i <= n; i++) words.push(numberWord(i));
  return words.join(', ');
}
