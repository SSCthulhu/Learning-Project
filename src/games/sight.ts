import * as THREE from 'three';
import { picture, sentenceBanner, wordCard } from '../kit';
import { addActor, bind, currentToken, drop, holdMs, pause, remind, say, showProgress } from '../play';
import { asset, canvasTexture, celebrate, encourage, place, plane, textures, wobble, type Clickable } from '../world';
import { cap, finish, shuffle, stage } from './common';

const CARD_W = 1.74;
const CARD_H = 1.4;

type WordPick = {
  mesh: THREE.Object3D;
  label: string;
  correct: boolean;
  tip: string;
};

function wait(token: number, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const end = Date.now() + ms;
    const tick = () => {
      if (token !== currentToken()) {
        resolve(false);
        return;
      }
      if (Date.now() >= end) {
        resolve(true);
        return;
      }
      window.setTimeout(tick, 40);
    };
    tick();
  });
}

async function talk(token: number, text: string, opts?: { speech?: string }): Promise<boolean> {
  if (token !== currentToken()) return false;
  say(text, opts);
  return pause(token, holdMs(opts?.speech ?? text));
}

function tint(root: THREE.Object3D, hex: number): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    if (!mat?.color || mat.userData.noTint || mat.opacity === 0) return;
    mat.color.setHex(hex);
  });
}

function glow(root: THREE.Object3D, on: boolean): void {
  tint(root, on ? 0xffe090 : 0xffffff);
  if (root.userData.baseScale == null) root.userData.baseScale = root.scale.x || 1;
  root.scale.setScalar(on ? (root.userData.baseScale as number) * 1.08 : (root.userData.baseScale as number));
}

function makeWord(label: string, w = CARD_W, h = CARD_H): THREE.Mesh {
  const mesh = wordCard(label, w, h);
  mesh.name = `word-${label}`;
  return mesh;
}

function wordItems(words: readonly string[], want: string, tipFor: (label: string) => string): WordPick[] {
  return shuffle([...words]).map((label) => ({
    mesh: makeWord(label),
    label,
    correct: label === want,
    tip: label === want ? '' : tipFor(label),
  }));
}

function layWords(meshes: THREE.Object3D[], band?: { top: number; low: number }): void {
  const { u0, u1 } = stage();
  const mid = (u0 + u1) / 2;
  const top = band?.top ?? 0.4;
  const low = band?.low ?? 0.61;
  const du = 0.078;
  const spots: [number, number][] = [
    [mid - du, top],
    [mid + du, top],
    [mid - du, low],
    [mid + du, low],
  ];
  meshes.forEach((mesh, i) => place(mesh, spots[i][0], spots[i][1], 0.58));
}

async function slideTo(token: number, mesh: THREE.Object3D, x: number, y: number, z: number, scale: number): Promise<boolean> {
  const x0 = mesh.position.x;
  const y0 = mesh.position.y;
  const z0 = mesh.position.z;
  const s0 = mesh.scale.x || 1;
  const frames = 12;
  for (let i = 1; i <= frames; i++) {
    const t = i / frames;
    const e = t * t * (3 - 2 * t);
    mesh.position.set(x0 + (x - x0) * e, y0 + (y - y0) * e, z0 + (z - z0) * e);
    mesh.scale.setScalar(s0 + (scale - s0) * e);
    if (!(await wait(token, 28))) return false;
  }
  mesh.userData.noScale = true;
  mesh.userData.baseScale = scale;
  return true;
}

function stripEnd(text: string): string {
  return text.replace(/[.!?]+$/, '');
}

function bannerBlankX(banner: THREE.Object3D): number {
  return banner.position.x + Number(banner.userData.blankX ?? 0) * (banner.scale.x || 1);
}

async function loadStone(): Promise<THREE.Texture> {
  const had = textures.stone;
  if (had) return had;
  await new Promise<void>((resolve, reject) => {
    new THREE.TextureLoader().load(
      asset('/art/ui/stone.png'),
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        tex.needsUpdate = true;
        textures.stone = tex;
        resolve();
      },
      undefined,
      () => reject(new Error('/art/ui/stone.png')),
    );
  });
  const loaded = textures.stone;
  if (!loaded) throw new Error('/art/ui/stone.png');
  return loaded;
}

function landingMark(w: number, h: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 280;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas');
  g.lineCap = 'round';
  g.strokeStyle = '#e7b34a';
  g.lineWidth = 26;
  g.beginPath();
  g.ellipse(256, 140, 214, 104, 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = '#3b2258';
  g.lineWidth = 8;
  g.stroke();
  const mesh = plane(canvasTexture(canvas), w, h, 2);
  mesh.userData.disposeMap = true;
  (mesh.material as THREE.MeshBasicMaterial).userData.noTint = true;
  mesh.name = 'trail-next';
  return mesh;
}

function steppingStone(index: number): THREE.Mesh {
  const tex = textures.stone;
  const w = 1.78;
  const h = w * (493 / 899);
  const mesh = plane(tex, w, h, 3);
  const mat = mesh.material as THREE.MeshBasicMaterial;
  mat.userData.noTint = true;
  mesh.userData.noScale = true;
  mesh.name = `stone-${index}`;
  return mesh;
}

function stoneSpots(count: number): [number, number][] {
  // Wide enough that a 0.85-scale word card sits on its own stone.
  const left = 0.36;
  const right = 0.66;
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const u = left + (right - left) * t;
    const v = 0.718 + Math.sin(t * Math.PI) * 0.018 + (i % 2 === 0 ? 0 : 0.01);
    return [u, v] as [number, number];
  });
}

async function introWords(token: number, items: WordPick[]): Promise<boolean> {
  for (const item of items) {
    glow(item.mesh, true);
    const ok = await talk(token, `This word is ${item.label}.`);
    glow(item.mesh, false);
    if (!ok) return false;
  }
  return token === currentToken();
}

async function choose(
  token: number,
  prompt: string,
  items: WordPick[],
  praise: string,
  opts?: {
    speech?: string;
    step?: number;
    total?: number;
    onCorrect?: (item: WordPick) => Promise<void> | void;
    afterCorrect?: (item: WordPick) => Promise<boolean>;
    extras?: Clickable[];
  },
): Promise<boolean> {
  if (token !== currentToken()) return false;
  const showPrompt = () => say(prompt, { speech: opts?.speech });
  showPrompt();
  showProgress(opts?.step ?? null, opts?.total ?? null);
  for (const item of items) addActor(item.mesh);

  return new Promise((resolve) => {
    let closed = false;
    let won = false;
    let cooling = false;

    const finishPick = (ok: boolean) => {
      if (closed) return;
      closed = true;
      window.clearInterval(watch);
      bind([]);
      resolve(ok && token === currentToken());
    };

    const watch = window.setInterval(() => {
      if (token !== currentToken()) finishPick(false);
    }, 80);

    const settleMiss = async (item: WordPick) => {
      tint(item.mesh, 0xffe7a8);
      wobble(item.mesh);
      encourage();
      say(item.tip);
      await pause(token, holdMs(item.tip));
      if (closed || won || token !== currentToken()) return;
      tint(item.mesh, 0xffffff);
      cooling = false;
      showPrompt();
    };

    const settleWin = async (item: WordPick) => {
      tint(item.mesh, 0xb7efc3);
      celebrate();
      for (const entry of items) {
        if (entry.mesh !== item.mesh) drop(entry.mesh);
      }
      await opts?.onCorrect?.(item);
      if (closed || token !== currentToken()) {
        finishPick(false);
        return;
      }
      if (opts?.afterCorrect) {
        const ok = await opts.afterCorrect(item);
        if (!ok || closed || token !== currentToken()) {
          finishPick(false);
          return;
        }
      }
      say(praise);
      await pause(token, holdMs(praise));
      for (const entry of items) {
        if (entry.mesh.userData.stay || !entry.mesh.parent) continue;
        drop(entry.mesh);
      }
      finishPick(token === currentToken());
    };

    const clicks: Clickable[] = items.map((item) => ({
      root: item.mesh,
      click: () => {
        if (closed || token !== currentToken()) return;
        if (item.correct) {
          if (won) return;
          won = true;
          void settleWin(item);
          return;
        }
        if (won || cooling) return;
        cooling = true;
        void settleMiss(item);
      },
    }));
    bind([...clicks, ...(opts?.extras ?? [])]);
  });
}

export async function playBanners(token: number): Promise<'done' | 'leave'> {
  const rounds = [
    ['and', ['the', 'and', 'see', 'you']],
    ['the', ['the', 'and', 'is', 'to']],
    ['see', ['see', 'sun', 'the', 'go']],
    ['you', ['you', 'yes', 'the', 'to']],
    ['is', ['is', 'it', 'in', 'as']],
    ['like', ['like', 'look', 'little', 'and']],
    ['look', ['look', 'like', 'little', 'see']],
    ['go', ['go', 'to', 'the', 'cat']],
    ['my', ['my', 'me', 'the', 'and']],
  ] as const;
  return finish(
    token,
    async () => {
      for (let i = 0; i < rounds.length; i++) {
        const [word, words] = rounds[i];
        const items = wordItems(words, word, (label) => `That word says ${label}. Listen one more time.`);
        layWords(items.map((item) => item.mesh));
        for (const item of items) addActor(item.mesh);
        if (i === 0) {
          const intro = await talk(token, 'Listen. I will read each word.');
          if (!intro) return false;
        }
        if (!(await introWords(token, items))) return false;
        const prompt = i === 0 ? `Your turn. Find the word ${word}.` : `Find the word ${word}.`;
        const ok = await choose(token, prompt, items, `Yes. The word is ${word}.`, {
          step: i,
          total: rounds.length,
        });
        if (!ok) return false;
      }
      return true;
    },
    'You read every word.',
  );
}

export async function playPictures(token: number): Promise<'done' | 'leave'> {
  const rounds = [
    { pic: 'cat', word: 'cat', words: ['cat', 'sun', 'bus', 'cup'] },
    { pic: 'sun', word: 'sun', words: ['sun', 'hat', 'dog', 'bed'] },
    { pic: 'dog', word: 'dog', words: ['dog', 'cat', 'pig', 'bus'] },
    { pic: 'bus', word: 'bus', words: ['bus', 'cup', 'hat', 'map'] },
    { pic: 'cup', word: 'cup', words: ['cup', 'cap', 'cat', 'sun'] },
    { pic: 'hat', word: 'hat', words: ['hat', 'hot', 'hit', 'bed'] },
    { pic: 'pig', word: 'pig', words: ['pig', 'dog', 'cup', 'map'] },
    { pic: 'map', word: 'map', words: ['map', 'hat', 'bus', 'sun'] },
    { pic: 'bed', word: 'bed', words: ['bed', 'bus', 'cat', 'cup'] },
  ];
  return finish(
    token,
    async () => {
      for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i];
        const { u0, u1 } = stage();
        const pic = picture(round.pic, 1.55);
        pic.name = 'clue-picture';
        place(pic, (u0 + u1) / 2, 0.275, 0.48);
        addActor(pic);
        const items = wordItems(round.words, round.word, (label) => `That word says ${label}. Look at the picture again.`);
        layWords(
          items.map((item) => item.mesh),
          { top: 0.46, low: 0.66 },
        );
        for (const item of items) addActor(item.mesh);
        if (i === 0) {
          const match = items.find((item) => item.correct);
          if (match) glow(match.mesh, true);
          const taught = await talk(token, 'Look at the picture. This word matches it.');
          if (match) glow(match.mesh, false);
          if (!taught) return false;
        }
        const caption =
          i === 0
            ? 'Your turn. Look at the picture. Which word matches it?'
            : 'Look at the picture. Which word matches it?';
        const pictureTap: Clickable = {
          root: pic,
          click: () => remind('Look at the picture. Which word matches it?'),
        };
        const ok = await choose(token, caption, items, `Yes. ${cap(round.word)}!`, {
          extras: [pictureTap],
          step: i,
          total: rounds.length,
          onCorrect: async (item) => {
            item.mesh.userData.stay = true;
            item.mesh.name = `fill-${round.word}`;
            await slideTo(token, item.mesh, pic.position.x, pic.position.y - 1.18, pic.position.z + 0.12, 0.62);
          },
        });
        drop(pic);
        for (const item of items) {
          if (item.mesh.parent) drop(item.mesh);
        }
        if (!ok) return false;
      }
      return true;
    },
    'You matched every picture.',
  );
}

export async function playMissing(token: number): Promise<'done' | 'leave'> {
  const rounds = [
    { before: 'I', after: 'a cat.', word: 'see', words: ['see', 'sun', 'and', 'the'] },
    { before: 'We', after: 'to go.', word: 'like', words: ['like', 'look', 'little', 'is'] },
    { before: 'You', after: 'my friend.', word: 'are', words: ['are', 'and', 'the', 'see'] },
    { before: 'It', after: 'a dog.', word: 'is', words: ['is', 'in', 'it', 'as'] },
    { before: 'Look', after: 'the sun.', word: 'at', words: ['at', 'and', 'a', 'the'] },
    { before: 'The', after: 'is little.', word: 'cat', words: ['cat', 'cup', 'can', 'see'] },
    { before: 'We', after: 'the bus.', word: 'see', words: ['see', 'sun', 'set', 'and'] },
    { before: 'I', after: 'my hat.', word: 'like', words: ['like', 'look', 'little', 'is'] },
    { before: 'You', after: 'go too.', word: 'can', words: ['can', 'cat', 'and', 'the'] },
  ];
  return finish(
    token,
    async () => {
      for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i];
        const { u0, u1 } = stage();
        const banner = sentenceBanner(`${round.before} `, ` ${round.after}`);
        banner.name = 'clue-scroll';
        place(banner, (u0 + u1) / 2, 0.26, 0.48);
        addActor(banner);
        const spokenAfter = stripEnd(round.after);
        const items = wordItems(round.words, round.word, (label) => `${cap(label)} does not fit in that sentence.`);
        layWords(
          items.map((item) => item.mesh),
          { top: 0.46, low: 0.66 },
        );
        for (const item of items) addActor(item.mesh);
        if (i === 0) {
          const taught = await talk(token, 'The box is empty. Tap the word that fits.');
          if (!taught) return false;
        }
        const caption =
          i === 0
            ? `Your turn. ${round.before} ___ ${round.after} Which word fits?`
            : `${round.before} ___ ${round.after} Which word fits?`;
        const speech = `${round.before}, hmm, ${spokenAfter}. Which word fits?`;
        const sentence = `${round.before} ${round.word} ${spokenAfter}.`;
        const placed: THREE.Object3D[] = [];
        const scrollTap: Clickable = {
          root: banner,
          click: () => remind(`${round.before}. Hmm. ${spokenAfter}. Which word fits?`),
        };
        const ok = await choose(token, caption, items, 'Yes. That word fits.', {
          extras: [scrollTap],
          speech,
          step: i,
          total: rounds.length,
          onCorrect: async (item) => {
            const blankW = Math.max(1.15, Number(banner.userData.blankW) || 1.18);
            const blankH = Math.max(0.52, Number(banner.userData.blankH) || 0.58);
            const chip = makeWord(round.word, blankW * 1.04, blankH * 1.12);
            chip.name = `fill-${round.word}`;
            chip.position.copy(item.mesh.position);
            addActor(chip);
            drop(item.mesh);
            chip.userData.stay = true;
            placed.push(chip);
            const x = bannerBlankX(banner);
            await slideTo(token, chip, x, banner.position.y + 0.01, banner.position.z + 0.16, banner.scale.x || 1);
          },
          afterCorrect: async () => talk(token, sentence),
        });
        drop(banner);
        for (const chip of placed) drop(chip);
        for (const item of items) {
          if (item.mesh.parent) drop(item.mesh);
        }
        if (!ok) return false;
      }
      return true;
    },
    'You finished every sentence.',
  );
}

export async function playTrail(token: number): Promise<'done' | 'leave'> {
  const trails = [
    ['see', 'the', 'cat', 'go'],
    ['I', 'like', 'you', 'and'],
    ['we', 'look'],
  ];
  const total = trails.reduce((sum, trail) => sum + trail.length, 0);
  return finish(
    token,
    async () => {
      await loadStone();
      let n = 0;
      let first = true;
      for (const trail of trails) {
        const spots = stoneSpots(trail.length);
        const stones: THREE.Mesh[] = [];
        for (let i = 0; i < trail.length; i++) {
          const stone = steppingStone(i);
          place(stone, spots[i][0], spots[i][1], 0.32);
          addActor(stone);
          stones.push(stone);
        }
        const landed: THREE.Object3D[] = [];
        for (let step = 0; step < trail.length; step++) {
          const word = trail[step];
          const others = shuffle(['sun', 'bus', 'cup', 'hat', 'dog', 'is', 'to', 'my'].filter((w) => w !== word && !trail.includes(w))).slice(0, 3);
          const items = wordItems([word, ...others], word, (label) => `That word says ${label}. Listen one more time.`);
          layWords(
            items.map((item) => item.mesh),
            { top: 0.3, low: 0.51 },
          );
          for (const item of items) addActor(item.mesh);
          const nextStone = stones[step];
          const ring = landingMark(2.05, 1.22);
          ring.position.copy(nextStone.position);
          ring.position.z = nextStone.position.z + 0.2;
          ring.renderOrder = 6;
          addActor(ring);
          let stonesLive = true;
          const stoneClicks: Clickable[] = stones.map((stone) => ({
            root: stone,
            click: () => {
              if (!stonesLive || token !== currentToken()) return;
              say('That stone is waiting. Tap a word card.');
            },
          }));
          if (first) {
            const match = items.find((item) => item.correct);
            if (match) glow(match.mesh, true);
            const taught = await talk(token, `This word is ${word}. It starts the trail.`);
            if (match) glow(match.mesh, false);
            if (!taught) {
              drop(ring);
              return false;
            }
            first = false;
          }
          const heard = trail.slice(0, step + 1).join(' ');
          const prompt =
            n === 0
              ? `Your turn. The first word is ${word}. Tap ${word}.`
              : step === 0
                ? `The first word is ${word}. Tap ${word}.`
                : `${trail.slice(0, step).join(' ')}. Next is ${word}. Tap ${word}.`;
          const ok = await choose(token, prompt, items, `Yes. ${cap(heard)}.`, {
            step: n,
            total,
            extras: stoneClicks,
            onCorrect: async (item) => {
              stonesLive = false;
              if (ring.parent) drop(ring);
              item.mesh.userData.stay = true;
              item.mesh.name = `fill-${word}`;
              const stone = stones[step];
              await slideTo(token, item.mesh, stone.position.x, stone.position.y + 0.14, stone.position.z + 0.14, 0.85);
              landed.push(item.mesh);
            },
          });
          if (ring.parent) drop(ring);
          n += 1;
          if (!ok) {
            landed.forEach(drop);
            stones.forEach(drop);
            return false;
          }
        }
        landed.forEach(drop);
        stones.forEach(drop);
      }
      return true;
    },
    'You followed the whole trail.',
  );
}
