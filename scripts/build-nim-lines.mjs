import { writeFileSync } from 'node:fs';

const NUMBER_WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const SOUND = {
  m: 'mmm', n: 'nnn', s: 'sss', f: 'fff', a: 'ah', e: 'eh', i: 'ih', o: 'aw', u: 'uh',
  t: 'tuh', p: 'puh', b: 'buh', d: 'duh', c: 'kuh', k: 'kuh', g: 'guh', r: 'rrr', l: 'lll', h: 'huh', v: 'vvv',
};
const ANCHOR = {
  m: 'moon', n: 'nest', s: 'sun', f: 'fish', a: 'apple', e: 'egg', i: 'igloo', o: 'octopus', u: 'umbrella',
  t: 'top', p: 'pig', b: 'bus', d: 'dog', c: 'cat', k: 'kite', r: 'rain', l: 'lamp', g: 'goat', h: 'hat', v: 'van', q: 'queen',
};

const lines = new Set();
const add = (line) => {
  const text = String(line ?? '').trim();
  if (text) lines.add(text);
};

const numberWord = (n) => NUMBER_WORD[n] ?? String(n);
const cap = (word) => word.charAt(0).toUpperCase() + word.slice(1);
const soundOf = (letter) => SOUND[letter.toLowerCase()] ?? letter.toLowerCase();
const anchorWord = (letter) => ANCHOR[letter.toLowerCase()] ?? letter;
const choiceNums = (n) => {
  const set = [];
  const put = (c) => {
    if (c >= 0 && c <= 20 && !set.includes(c)) set.push(c);
  };
  put(n);
  for (const candidate of [n - 1, n + 1, n - 2, n + 2, n + 3, n - 3, 0, 1, 2]) {
    put(candidate);
    if (set.length >= 4) break;
  }
  return set;
};
const spellPool = (want, wordLetters) => {
  const extras = ['r', 'l', 's', 't', 'b', 'd', 'p', 'n', 'm', 'f'];
  const pool = [];
  for (const ch of [want, ...wordLetters, ...extras]) {
    if (!pool.includes(ch)) pool.push(ch);
    if (pool.length >= 4) break;
  }
  return pool;
};
const soundsOf = (letters) => letters.map((letter, i) => (i === 0 ? cap(soundOf(letter)) : soundOf(letter))).join(', ');

add('Tap a place to play.');
add('Tap a game to play.');
for (const name of ['Letters', 'Words', 'Shapes', 'Numbers', 'Sounds', 'Match', 'Spell', 'Hear It', 'Pictures', 'Missing', 'Trail', 'Count', 'More than', 'Path', 'Pattern', 'Join', 'Compare']) {
  add(name);
  add(`${name}.`);
}
for (const name of ['Home', 'Back', 'Quiet', 'Sound']) add(name);

const letterRounds = [
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
add('This is the letter M.');
add('You found every letter.');
letterRounds.forEach((round, i) => {
  const line = round.target === round.target.toLowerCase() ? `Find little ${round.target}.` : `Find the letter ${round.target}.`;
  add(i === 0 ? `Your turn. ${line}` : line);
  add(`Yes. That is ${round.target === round.target.toLowerCase() ? 'little ' : 'the letter '}${round.target}.`);
  for (const letter of round.letters) add(`That letter is ${letter}. Look again.`);
});

const soundRounds = [
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
const soundPools = {
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
add('Listen. Moon. Mmm. This letter says mmm.');
add('You matched every sound.');
soundRounds.forEach((round, i) => {
  const title = cap(round.word);
  const sound = soundOf(round.letter);
  add(sound);
  add(`${title}. ${cap(sound)}.`);
  const prompt = `Listen. ${title}. ${cap(sound)}. Which letter says ${sound}?`;
  add(i === 0 ? `Your turn. ${prompt}` : prompt);
  add(`Yes. ${round.letter.toUpperCase()} says ${sound}, like ${round.word}.`);
  for (const letter of soundPools[round.letter]) {
    add(`That one says ${soundOf(letter)}, like ${anchorWord(letter)}. Listen again: ${sound}, ${round.word}.`);
    add(soundOf(letter));
  }
});

const caseRounds = [
  ['M', ['m', 's', 'a', 't']],
  ['B', ['b', 'd', 'p', 'g']],
  ['S', ['s', 'c', 'e', 'o']],
  ['A', ['a', 'o', 'u', 'e']],
  ['T', ['t', 'l', 'f', 'k']],
  ['P', ['p', 'q', 'd', 'b']],
  ['N', ['n', 'm', 'h', 'u']],
  ['D', ['d', 'b', 'p', 'q']],
  ['R', ['r', 'n', 'm', 'h']],
];
add('Big M matches little m.');
add('You matched big and little letters.');
caseRounds.forEach(([big, small], i) => {
  const little = big.toLowerCase();
  const line = `Big ${big}. Tap its little letter.`;
  add(i === 0 ? `Your turn. ${line}` : line);
  add(`Yes. Big ${big}, little ${little}.`);
  add(`That is big ${big}. Find the little letter that matches it.`);
  for (const letter of small) add(`That is little ${letter}. Find the little letter that goes with big ${big}.`);
});

const spellWords = [
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
add('Cat. Kuh. This letter says kuh.');
add('That letter is already in the word.');
add('That box is waiting. Tap a letter card.');
add('You spelled every word.');
spellWords.forEach((word, w) => {
  const named = cap(word.pic);
  word.letters.forEach((want, i) => {
    const sound = soundOf(want);
    const spoken = soundsOf(word.letters);
    if (w === 0 && i === 0) add(`Your turn. ${named}. ${spoken}. Which letter says ${sound}?`);
    if (i === 0) add(`${named}. ${spoken}. Which letter says ${sound}?`);
    else add(`Next sound: ${sound}. Which letter says ${sound}?`);
    add(`Yes. ${want.toUpperCase()} says ${sound}.`);
    add(`${named}. ${cap(sound)}.`);
    add(sound);
    for (const letter of spellPool(want, word.letters)) {
      add(`That says ${soundOf(letter)}, like ${anchorWord(letter)}. Listen: ${sound}, ${word.pic}.`);
    }
  });
  add(`${word.letters.join(', ')}. ${named}!`);
  add(`Yes. ${named}!`);
});

const bannerRounds = [
  ['and', ['the', 'and', 'see', 'you']],
  ['the', ['the', 'and', 'is', 'to']],
  ['see', ['see', 'sun', 'the', 'go']],
  ['you', ['you', 'yes', 'the', 'to']],
  ['is', ['is', 'it', 'in', 'as']],
  ['like', ['like', 'look', 'little', 'and']],
  ['look', ['look', 'like', 'little', 'see']],
  ['go', ['go', 'to', 'the', 'cat']],
  ['my', ['my', 'me', 'the', 'and']],
];
add('Listen. I will read each word.');
add('You read every word.');
bannerRounds.forEach(([word, words], i) => {
  const prompt = `Find the word ${word}.`;
  add(i === 0 ? `Your turn. ${prompt}` : prompt);
  add(`Yes. The word is ${word}.`);
  for (const label of words) {
    add(`This word is ${label}.`);
    add(`That word says ${label}. Listen one more time.`);
  }
});

const pictureRounds = [
  { word: 'cat', words: ['cat', 'sun', 'bus', 'cup'] },
  { word: 'sun', words: ['sun', 'hat', 'dog', 'bed'] },
  { word: 'dog', words: ['dog', 'cat', 'pig', 'bus'] },
  { word: 'bus', words: ['bus', 'cup', 'hat', 'map'] },
  { word: 'cup', words: ['cup', 'cap', 'cat', 'sun'] },
  { word: 'hat', words: ['hat', 'hot', 'hit', 'bed'] },
  { word: 'pig', words: ['pig', 'dog', 'cup', 'map'] },
  { word: 'map', words: ['map', 'hat', 'bus', 'sun'] },
  { word: 'bed', words: ['bed', 'bus', 'cat', 'cup'] },
];
add('Look at the picture. This word matches it.');
add('Your turn. Look at the picture. Which word matches it?');
add('Look at the picture. Which word matches it?');
add('You matched every picture.');
pictureRounds.forEach((round) => {
  add(`Yes. ${cap(round.word)}!`);
  for (const label of round.words) add(`That word says ${label}. Look at the picture again.`);
});

const missingRounds = [
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
add('The box is empty. Tap the word that fits.');
add('Yes. That word fits.');
add('You finished every sentence.');
missingRounds.forEach((round) => {
  const spokenAfter = round.after.replace(/[.!?]+$/, '');
  add(`${round.before}, hmm, ${spokenAfter}. Which word fits?`);
  add(`${round.before}. Hmm. ${spokenAfter}. Which word fits?`);
  add(`${round.before} ${round.word} ${spokenAfter}.`);
  for (const label of round.words) add(`${cap(label)} does not fit in that sentence.`);
});

const trails = [
  ['see', 'the', 'cat', 'go'],
  ['I', 'like', 'you', 'and'],
  ['we', 'look'],
];
const trailPool = ['sun', 'bus', 'cup', 'hat', 'dog', 'is', 'to', 'my'];
add('That stone is waiting. Tap a word card.');
trails.forEach((trail) => {
  trail.forEach((word, step) => {
    const heard = trail.slice(0, step + 1).join(' ');
    if (step === 0 && trail === trails[0]) add(`Your turn. The first word is ${word}. Tap ${word}.`);
    if (step === 0) add(`The first word is ${word}. Tap ${word}.`);
    else add(`${trail.slice(0, step).join(' ')}. Next is ${word}. Tap ${word}.`);
    add(`Yes. ${cap(heard)}.`);
    if (trail === trails[0] && step === 0) add(`This word is ${word}. It starts the trail.`);
    for (const label of trailPool.filter((w) => w !== word && !trail.includes(w))) {
      add(`That word says ${label}. Listen one more time.`);
    }
  });
});

const BIT = { apple: 'apples', moon: 'moons', fish: 'fish', orb: 'stars' };
const oneWord = (kind, n) => (n === 1 && kind !== 'fish' ? BIT[kind].replace(/s$/, '') : BIT[kind]);
const unit = (kind) => (kind === 'fish' ? 'fish' : kind === 'orb' ? 'star' : BIT[kind].replace(/s$/, ''));
const countRounds = [
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
add('Watch. One, two. There are two apples.');
add('The bowl is empty. None. We say zero.');
add('The bowl is empty. Count what you see.');
add('Yes. There are zero. When there are none, we say zero.');
add('You counted every group.');
countRounds.forEach((round, i) => {
  const word = oneWord(round.bit, round.n);
  const prompt = round.n === 0 ? `Look in the bowl. How many ${word} are in the bowl?` : `Count the ${word}. Tap how many.`;
  add(i === 0 ? `Your turn. ${prompt}` : prompt);
  if (round.n === 0) add('Yes. There are zero. When there are none, we say zero.');
  else if (round.n === 1) add(`Yes. There is one ${word}.`);
  else add(`Yes. There are ${numberWord(round.n)} ${word}.`);
  if (round.n > 0) {
    const words = Array.from({ length: round.n }, (_, index) => numberWord(index + 1));
    add(`${cap(words.join(', '))}. Tap how many.`);
  }
  for (const n of choiceNums(round.n)) {
    if (n === round.n) continue;
    add(round.n === 0
      ? 'The bowl is empty. Count what you see.'
      : `That is ${numberWord(n)}. Touch each ${unit(round.bit)} one time as you count, then tap that number.`);
  }
});

const setRounds = [
  { n: 4, sets: [4, 2] },
  { n: 5, sets: [3, 5] },
  { n: 2, sets: [2, 6] },
  { n: 1, sets: [1, 3] },
  { n: 8, sets: [8, 5] },
  { n: 0, sets: [0, 4] },
  { n: 6, sets: [6, 3] },
  { n: 7, sets: [7, 4] },
  { n: 8, sets: [8, 6] },
];
add('This number is three. This group has three. It matches the number.');
add('Your turn. Count each group. Tap the group that matches this number.');
add('Count each group. Tap the group that matches this number.');
add('You matched every number.');
setRounds.forEach((round) => {
  add(`Yes. That group has ${numberWord(round.n)}.`);
  add(`This number is ${numberWord(round.n)}. Count each group. Tap the group that matches.`);
  for (const count of round.sets) {
    if (count === round.n) continue;
    add(`That group has ${numberWord(count)}. Count each group and find the one that matches the number.`);
  }
});

const moreRounds = [
  { a: 5, b: 3, fewer: false },
  { a: 2, b: 6, fewer: true },
  { a: 4, b: 1, fewer: false },
  { a: 7, b: 4, fewer: true },
  { a: 3, b: 8, fewer: false },
  { a: 1, b: 5, fewer: true },
  { a: 8, b: 5, fewer: false },
  { a: 4, b: 7, fewer: true },
  { a: 6, b: 4, fewer: false },
];
add('Count both piles. This pile is more than the other.');
add('Your turn. Tap the group that is less than the other.');
add('Tap the group that is less than the other.');
add('Your turn. Tap the group that is more than the other.');
add('Tap the group that is more than the other.');
add('You compared every group.');
moreRounds.forEach((round) => {
  const bigger = numberWord(Math.max(round.a, round.b));
  const smaller = numberWord(Math.min(round.a, round.b));
  add(round.fewer ? `Yes. ${cap(smaller)} is less than ${bigger}.` : `Yes. ${cap(bigger)} is more than ${smaller}.`);
  add(`That pile has ${numberWord(round.a)}. Count the other pile too.`);
  add(`That pile has ${numberWord(round.b)}. Count the other pile too.`);
});

const pathRounds = [
  { n: 6, dir: 'after' },
  { n: 3, dir: 'before' },
  { n: 11, dir: 'after' },
  { n: 8, dir: 'before' },
  { n: 0, dir: 'after' },
  { n: 14, dir: 'after' },
  { n: 19, dir: 'before' },
  { n: 5, dir: 'after' },
  { n: 9, dir: 'before' },
];
add('Start at four. Count up. Five comes next.');
add('You know what comes next.');
const pathNums = (n) => {
  if (n === 0) return [0, 1, 2];
  if (n === 20) return [18, 19, 20];
  return [n - 1, n, n + 1].filter((x) => x >= 0 && x <= 20);
};
pathRounds.forEach((round, i) => {
  const spoken = round.dir === 'after' ? 'after' : 'before';
  const answer = round.dir === 'after' ? round.n + 1 : round.n - 1;
  const pathLine = `Start at ${numberWord(round.n)}. Tap the number that comes ${spoken}.`;
  add(i === 0 ? `Your turn. ${pathLine}` : pathLine);
  add(`Yes. ${cap(numberWord(answer))} comes ${spoken} ${numberWord(round.n)}.`);
  for (const n of pathNums(round.n)) {
    if (n === answer) continue;
    if (n === round.n) {
      add(`That stone is ${numberWord(n)}. We start there. ${round.dir === 'after' ? 'Count up. What comes next?' : 'Count back. What comes before?'}`);
    } else if (round.dir === 'after') {
      add(`That is ${numberWord(n)}. Count up from ${numberWord(round.n)} out loud. What comes next?`);
    } else {
      add(`That is ${numberWord(n)}. Count back from ${numberWord(round.n)} out loud. What comes before?`);
    }
  }
});

const SHAPE_CLUE = {
  circle: 'A circle is round.',
  square: 'A square has four equal sides.',
  triangle: 'A triangle has three sides.',
  rectangle: 'A rectangle has two long sides and two short sides.',
  star: 'A star has points.',
};
const SHAPE_HINT = {
  circle: 'Look for the round one.',
  square: 'Look for four equal sides.',
  triangle: 'Look for three sides.',
  rectangle: 'Look for two long sides and two short sides.',
  star: 'Look for the one with points.',
};
const shapeRounds = [
  { target: 'circle', options: ['circle', 'square', 'triangle', 'star'] },
  { target: 'square', options: ['square', 'circle', 'rectangle', 'triangle'] },
  { target: 'triangle', options: ['triangle', 'star', 'circle', 'square'] },
  { target: 'rectangle', options: ['rectangle', 'square', 'circle', 'star'] },
  { target: 'star', options: ['star', 'triangle', 'rectangle', 'circle'] },
  { target: 'triangle', options: ['triangle', 'circle', 'square', 'star'] },
  { target: 'rectangle', options: ['rectangle', 'star', 'triangle', 'circle'] },
  { target: 'circle', options: ['circle', 'rectangle', 'star', 'triangle'] },
  { target: 'square', options: ['square', 'star', 'circle', 'triangle'] },
];
Object.values(SHAPE_CLUE).forEach(add);
add('You named every shape.');
shapeRounds.forEach((round, i) => {
  const prompt = `${SHAPE_CLUE[round.target]} Tap the ${round.target}.`;
  add(i === 0 ? `Your turn. ${prompt}` : prompt);
  add(`Yes. That is a ${round.target}.`);
  for (const name of round.options) {
    if (name === round.target) continue;
    add(`That is a ${name}. ${SHAPE_HINT[round.target]}`);
  }
});

const patternRounds = [
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
add('Circle, square, circle, square. A circle comes next.');
add('That space is waiting. Tap the shape that comes next.');
add('You finished every pattern.');
patternRounds.forEach((round, i) => {
  const chant = round.shown.join(', ');
  const prompt = `${cap(chant)}. What comes next?`;
  add(i === 0 ? `Your turn. ${prompt}` : prompt);
  add(`Yes. A ${round.next} comes next.`);
  add(`Say the pattern with me: ${chant}. What comes next?`);
  for (const name of round.options) {
    if (name === round.next) continue;
    add(`That is a ${name}. Say the pattern with me: ${chant}. What comes next?`);
  }
});

const appleTalk = (n) => (n === 1 ? 'one apple' : `${numberWord(n)} apples`);
const joinRounds = [
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
add('One and one make two.');
add('Skip the apples with a red cross. Count the ones that are left.');
add('Count the top apples, then keep counting the bottom apples.');
add('You joined and took away.');
joinRounds.forEach((round, i) => {
  const answer = round.leave ? round.a - round.b : round.a + round.b;
  add(round.leave
    ? `${cap(appleTalk(round.a))}. ${cap(numberWord(round.b))} ${round.b === 1 ? 'has a red cross' : 'have a red cross'}. Take those away. How many are left?`
    : `${cap(appleTalk(round.a))} and ${appleTalk(round.b)}. Count every apple. How many together?`);
  add(round.leave
    ? `Yes. ${cap(numberWord(round.a))} take away ${numberWord(round.b)} leaves ${numberWord(answer)}.`
    : `Yes. ${cap(numberWord(round.a))} and ${numberWord(round.b)} make ${numberWord(answer)}.`);
  for (const n of choiceNums(answer)) {
    if (n === answer) continue;
    add(round.leave
      ? `That is ${numberWord(n)}. Count the apples that are left.`
      : `That is ${numberWord(n)}. Count the top apples, then keep counting the bottom apples.`);
  }
});

const whichRounds = [
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
add('Eight is more than three.');
add('You compared the numbers.');
whichRounds.forEach((round) => {
  const high = Math.max(round.pair[0], round.pair[1]);
  const low = Math.min(round.pair[0], round.pair[1]);
  const askMore = round.more ? 'more' : 'less';
  add(`Look at ${numberWord(round.pair[0])} and ${numberWord(round.pair[1])}. Which number is ${askMore}? Tap it.`);
  add(round.more
    ? `Yes. ${cap(numberWord(high))} is more than ${numberWord(low)}.`
    : `Yes. ${cap(numberWord(low))} is less than ${numberWord(high)}.`);
  for (const n of round.pair) add(`That is ${numberWord(n)}. Count the stars on each card. Which card has ${askMore}?`);
});

const list = [...lines];
const chars = list.reduce((sum, line) => sum + line.length, 0);
writeFileSync(new URL('./nim-lines.json', import.meta.url), `${JSON.stringify(list, null, 2)}\n`);
console.log(`${list.length} lines, ${chars} characters`);
