import * as THREE from 'three';
import {
  bell,
  blankSlot,
  card,
  hereRing,
  picture,
} from '../kit';
import { addActor, ask, bind, drop, holdMs, pause, remind, say, showProgress, type Choice } from '../play';
import { anchorWord, phoneme, soundOf } from '../speak';
import { celebrate, place, type Clickable } from '../world';
import { cap, finish, layChoices, pace, shuffle, stage } from './common';

const CARD = 1.52;
const SLOT = 0.98;
const OPEN_BAND = { top: 0.36, low: 0.61 };
const LOWER_BAND = { top: 0.43, low: 0.64 };
const SPELL_BAND = { top: 0.49, low: 0.70 };
const HIGHLIGHT = '#ffe9a0';
const CREAM = '#fff6e4';

function letterRound(target: string, letters: string[], tipFor: (letter: string) => string): Choice[] {
  return shuffle(letters).map((letter) => {
    const mesh = card(letter, CARD, CARD);
    mesh.name = `pick-${letter}`;
    return {
      mesh,
      correct: letter === target,
      tip: letter === target ? '' : tipFor(letter),
    };
  });
}

function tintCard(root: THREE.Object3D, hex: number): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    if (!mat?.color || mat.userData.noTint || mat.opacity === 0) return;
    mat.color.setHex(hex);
  });
}

function soundsOf(letters: string[]): string {
  return letters.map((letter, i) => {
    const sound = soundOf(letter);
    return i === 0 ? cap(sound) : sound;
  }).join(', ');
}

function findLine(target: string): string {
  return target === target.toLowerCase() ? `Find little ${target}.` : `Find the letter ${target}.`;
}

function tipFind(target: string): string {
  return target === target.toLowerCase() ? `Find little ${target}.` : `Find ${target}.`;
}

async function teachBeat(
  token: number,
  letters: string[],
  target: string,
  line: string,
  band: { top: number; low: number },
): Promise<boolean> {
  const meshes = shuffle(letters).map((letter) => {
    const mesh = card(letter, CARD, CARD, letter === target ? HIGHLIGHT : CREAM);
    mesh.name = `demo-${letter}`;
    if (letter === target) mesh.scale.setScalar(1.12);
    return mesh;
  });
  layChoices(meshes, band);
  const taught = meshes.find((mesh) => mesh.name === `demo-${target}`);
  const ring = hereRing(2.75);
  ring.name = 'teach-halo';
  ring.renderOrder = 3;
  if (taught) {
    ring.position.copy(taught.position);
    ring.position.z -= 0.06;
  }
  addActor(ring);
  for (const mesh of meshes) addActor(mesh);
  const clear = () => {
    for (const mesh of meshes) drop(mesh);
    drop(ring);
  };
  say(line);
  if (!await pause(token, holdMs(line))) {
    clear();
    return false;
  }
  clear();
  return true;
}

async function awaitPick(
  token: number,
  captionText: string,
  items: Choice[],
  praise: string,
  extras: Clickable[] = [],
  opts?: {
    speech?: string;
    then?: () => void;
    praiseThen?: () => void;
    step?: number;
    total?: number;
    onCorrect?: () => void;
    skipPraise?: boolean;
  },
): Promise<boolean> {
  const showPrompt = () => say(captionText, { speech: opts?.speech, then: opts?.then });
  showPrompt();
  showProgress(opts?.step ?? null, opts?.total ?? null);
  return new Promise((resolve) => {
    let locked = false;
    let tipGen = 0;
    let won = false;
    const clearChoices = () => {
      for (const item of items) drop(item.mesh);
      bind([]);
    };
    const clicks: Clickable[] = items.map((item) => ({
      root: item.mesh,
      click: () => {
        if (item.correct) {
          if (won) return;
          won = true;
          tipGen += 1;
          locked = true;
          tintCard(item.mesh, 0xb7efc3);
          celebrate();
          opts?.onCorrect?.();
          if (opts?.skipPraise) {
            clearChoices();
            resolve(true);
            return;
          }
          say(praise, { then: opts?.praiseThen });
          const listen = holdMs(praise) + (opts?.praiseThen ? 900 : 0);
          void pause(token, listen).then((alive) => {
            clearChoices();
            resolve(alive);
          });
          return;
        }
        if (locked) return;
        locked = true;
        const gen = tipGen;
        tintCard(item.mesh, 0xffc8c4);
        say(item.tip, { then: item.hear });
        const listen = holdMs(item.tip) + (item.hear ? 800 : 0);
        void pause(token, listen).then((alive) => {
          if (gen !== tipGen) return;
          locked = false;
          if (!alive) {
            clearChoices();
            for (const extra of extras) drop(extra.root);
            resolve(false);
            return;
          }
          tintCard(item.mesh, 0xffffff);
          showPrompt();
        });
      },
    }));
    for (const item of items) addActor(item.mesh);
    for (const extra of extras) addActor(extra.root);
    bind([...clicks, ...extras]);
  });
}

export async function playLetters(token: number): Promise<'done' | 'leave'> {
  const rounds: { target: string; letters: string[] }[] = [
    { target: 'M', letters: ['M', 'S', 'A', 'T'] },
    { target: 'S', letters: ['S', 'C', 'O', 'E'] },
    { target: 'b', letters: ['b', 'p', 's', 'a'] },
    { target: 'F', letters: ['F', 'E', 'T', 'L'] },
    { target: 'a', letters: ['a', 'o', 'c', 'e'] },
    { target: 'b', letters: ['b', 'd', 'p', 'q'] },
    { target: 'n', letters: ['n', 'm', 'h', 'u'] },
    { target: 'P', letters: ['P', 'R', 'B', 'D'] },
    { target: 'q', letters: ['q', 'p', 'd', 'b'] },
  ];
  return finish(token, async () => {
    if (!await teachBeat(token, ['M', 'S', 'A', 'T'], 'M', 'This is the letter M.', OPEN_BAND)) return false;
    for (let i = 0; i < rounds.length; i++) {
      const { target, letters } = rounds[i];
      const items = letterRound(target, letters, (letter) => `That is ${letter}. ${tipFind(target)}`);
      layChoices(items.map((item) => item.mesh), OPEN_BAND);
      const line = findLine(target);
      const ok = await ask(
        token,
        i === 0 ? `Your turn. ${line}` : line,
        items,
        `Yes. That is ${target === target.toLowerCase() ? 'little ' : 'the letter '}${target}.`,
        [],
        pace(i, rounds.length),
      );
      if (!ok) return false;
    }
    return true;
  }, 'You found every letter.');
}

export async function playSounds(token: number): Promise<'done' | 'leave'> {
  const rounds = [
    { letter: 'm', word: 'moon' },
    { letter: 's', word: 'sun' },
    { letter: 'a', word: 'apple' },
    { letter: 'p', word: 'pig' },
    { letter: 'f', word: 'fish' },
    { letter: 'd', word: 'dog' },
    { letter: 'b', word: 'bus' },
    { letter: 'c', word: 'cat' },
    { letter: 'h', word: 'hat' },
  ];
  const pools: Record<string, string[]> = {
    m: ['m', 's', 't', 'a'],
    s: ['s', 'm', 'f', 'p'],
    a: ['a', 'o', 'u', 'e'],
    p: ['p', 'b', 'd', 't'],
    f: ['f', 's', 't', 'h'],
    d: ['d', 'b', 'p', 'g'],
    b: ['b', 'd', 'p', 'h'],
    c: ['c', 's', 't', 'a'],
    h: ['h', 'n', 'm', 'b'],
  };
  return finish(token, async () => {
    const { u0, u1 } = stage();
    const picU = (u0 + u1) / 2;
    const picSize = 2.06;
    const picV = 0.312;
    const hearU = picU - 0.168;
    const letterTop = 0.52;
    const letterLow = 0.72;
    const letterDu = 0.136;
    const layLetters = (meshes: THREE.Object3D[]) => {
      const spots: [number, number][] = [
        [picU - letterDu, letterTop],
        [picU + letterDu, letterTop],
        [picU - letterDu, letterLow],
        [picU + letterDu, letterLow],
      ];
      meshes.forEach((mesh, i) => place(mesh, spots[i][0], spots[i][1], 0.55));
    };
    const teachPic = picture('moon', picSize);
    place(teachPic, picU, picV, 0.48);
    addActor(teachPic);
    const taught = await teachBeat(
      token,
      ['m', 's', 't', 'a'],
      'm',
      'Listen. Moon. Mmm. This letter says mmm.',
      { top: 0.56, low: 0.76 },
    );
    drop(teachPic);
    if (!taught) return false;
    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];
      const title = cap(round.word);
      const sound = soundOf(round.letter);
      const items = letterRound(round.letter, pools[round.letter], (letter) => {
        return `That one says ${soundOf(letter)}, like ${anchorWord(letter)}. Listen again: ${sound}, ${round.word}.`;
      });
      layLetters(items.map((item) => item.mesh));
      const pic = picture(round.word, picSize);
      pic.name = 'sound-pic';
      place(pic, picU, picV, 0.48);
      addActor(pic);
      const hear = bell();
      hear.scale.setScalar(0.86);
      place(hear, hearU, picV, 0.62);
      const extras: Clickable[] = [
        {
          root: pic,
          click: () => {
            phoneme(round.letter);
            remind(`${title}. ${cap(sound)}.`);
          },
        },
        { root: hear, click: () => phoneme(round.letter) },
      ];
      const prompt =
        i === 0
          ? `Your turn. Listen. ${title}. ${cap(sound)}. Which letter says ${sound}?`
          : `Listen. ${title}. ${cap(sound)}. Which letter says ${sound}?`;
      const ok = await ask(
        token,
        prompt,
        items,
        `Yes. ${round.letter.toUpperCase()} says ${sound}, like ${round.word}.`,
        extras,
        pace(i, rounds.length, { then: () => phoneme(round.letter) }),
      );
      drop(pic);
      if (!ok) return false;
    }
    return true;
  }, 'You matched every sound.');
}

export async function playCase(token: number): Promise<'done' | 'leave'> {
  const rounds = [
    ['M', ['m', 's', 'a', 't']],
    ['B', ['b', 'd', 'p', 'g']],
    ['S', ['s', 'c', 'e', 'o']],
    ['A', ['a', 'o', 'u', 'e']],
    ['T', ['t', 'l', 'f', 'k']],
    ['P', ['p', 'q', 'd', 'b']],
    ['N', ['n', 'm', 'h', 'u']],
    ['D', ['d', 'b', 'p', 'q']],
    ['R', ['r', 'n', 'm', 'h']],
  ] as const;
  return finish(token, async () => {
    const { u0, u1 } = stage();
    const mid = (u0 + u1) / 2;
    const teachHero = card('M', CARD, CARD);
    teachHero.name = 'demo-big-M';
    place(teachHero, mid, 0.25, 0.5);
    addActor(teachHero);
    const taught = await teachBeat(token, ['m', 's', 'a', 't'], 'm', 'Big M matches little m.', LOWER_BAND);
    drop(teachHero);
    if (!taught) return false;
    for (let i = 0; i < rounds.length; i++) {
      const [big, small] = rounds[i];
      const little = big.toLowerCase();
      const hero = card(big, CARD, CARD);
      hero.name = `hero-${big}`;
      place(hero, mid, 0.23, 0.5);
      addActor(hero);
      const heroTap: Clickable = {
        root: hero,
        click: () => remind(`That is big ${big}. Find the little letter that matches it.`),
      };
      const items = letterRound(little, [...small], (letter) => {
        return `That is little ${letter}. Find the little letter that goes with big ${big}.`;
      });
      layChoices(items.map((item) => item.mesh), LOWER_BAND);
      const ok = await ask(
        token,
        i === 0 ? `Your turn. Big ${big}. Tap its little letter.` : `Big ${big}. Tap its little letter.`,
        items,
        `Yes. Big ${big}, little ${little}.`,
        [heroTap],
        pace(i, rounds.length),
      );
      drop(hero);
      if (!ok) return false;
    }
    return true;
  }, 'You matched big and little letters.');
}

function spellPool(want: string, wordLetters: string[]): string[] {
  const extras = ['r', 'l', 's', 't', 'b', 'd', 'p', 'n', 'm', 'f'];
  const pool: string[] = [];
  for (const ch of [want, ...wordLetters, ...extras]) {
    if (!pool.includes(ch)) pool.push(ch);
    if (pool.length >= 4) break;
  }
  return shuffle(pool);
}

export async function playSpell(token: number): Promise<'done' | 'leave'> {
  const words = [
    { pic: 'cat', letters: ['c', 'a', 't'] },
    { pic: 'sun', letters: ['s', 'u', 'n'] },
    { pic: 'map', letters: ['m', 'a', 'p'] },
    { pic: 'bed', letters: ['b', 'e', 'd'] },
    { pic: 'bus', letters: ['b', 'u', 's'] },
    { pic: 'hat', letters: ['h', 'a', 't'] },
    { pic: 'cup', letters: ['c', 'u', 'p'] },
    { pic: 'pig', letters: ['p', 'i', 'g'] },
    { pic: 'dog', letters: ['d', 'o', 'g'] },
  ];
  return finish(token, async () => {
    const { u0, u1 } = stage();
    const mid = (u0 + u1) / 2;
    const picSize = 1.78;
    const picV = 0.298;
    const slotV = 0.468;
    const letterBand = { top: 0.655, low: 0.862 };
    const teachPic = picture('cat', picSize);
    place(teachPic, mid, picV, 0.46);
    addActor(teachPic);
    const taught = await teachBeat(token, ['c', 'a', 't', 'r'], 'c', 'Cat. Kuh. This letter says kuh.', letterBand);
    drop(teachPic);
    if (!taught) return false;
    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      const named = cap(word.pic);
      const pic = picture(word.pic, picSize);
      pic.name = 'spell-pic';
      place(pic, mid, picV, 0.46);
      addActor(pic);
      const slots = word.letters.map(() => blankSlot());
      slots.forEach((slot, i) => {
        slot.name = `blank-${i}`;
        slot.scale.setScalar(SLOT / 1.15);
        place(slot, mid + (i - 1) * 0.092, slotV, 0.55);
        addActor(slot);
      });
      for (let i = 0; i < word.letters.length; i++) {
        const want = word.letters[i];
        const sound = soundOf(want);
        const pool = spellPool(want, word.letters);
        const items = letterRound(want, pool, (letter) => {
          return `That says ${soundOf(letter)}, like ${anchorWord(letter)}. Listen: ${sound}, ${word.pic}.`;
        });
        layChoices(items.map((item) => item.mesh), letterBand);
        const last = i === word.letters.length - 1;
        const prompt =
          w === 0 && i === 0
            ? `Your turn. ${named}. ${soundsOf(word.letters)}. Which letter says ${sound}?`
            : i === 0
              ? `${named}. ${soundsOf(word.letters)}. Which letter says ${sound}?`
              : `Next sound: ${sound}. Which letter says ${sound}?`;
        const ok = await awaitPick(
          token,
          prompt,
          items,
          `Yes. ${want.toUpperCase()} says ${sound}.`,
          [
            {
              root: pic,
              click: () => {
                phoneme(want);
                remind(`${named}. ${cap(sound)}.`);
              },
            },
            ...slots.map((slot, index) => ({
              root: slot,
              click: () =>
                remind(
                  index < i
                    ? 'That letter is already in the word.'
                    : 'That box is waiting. Tap a letter card.',
                ),
            })),
          ],
          {
            then: () => phoneme(want),
            skipPraise: last,
            onCorrect: () => {
              const filled = card(want, SLOT, SLOT);
              filled.name = `slot-${want}-${i}`;
              filled.position.copy(slots[i].position);
              drop(slots[i]);
              addActor(filled);
              slots[i] = filled;
            },
          },
        );
        if (!ok) return false;
        if (last) {
          const blend = `${word.letters.join(', ')}. ${named}!`;
          say(blend);
          if (!await pause(token, Math.max(2000, holdMs(blend)))) return false;
          const praise = `Yes. ${named}!`;
          say(praise);
          if (!await pause(token, holdMs(praise))) return false;
        }
      }
      drop(pic);
      slots.forEach(drop);
    }
    return true;
  }, 'You spelled every word.');
}
