import type { Object3D } from 'three';
import {
  glowPad,
  iconSign,
  sign,
  type FaceBox,
} from './kit';
import { addActor, currentToken, holdMs, pause, say, type PlaceName } from './play';
import { place, setEmphasis, textures, type Clickable } from './world';
import { playCase, playLetters, playSounds, playSpell } from './games/phonics';
import { playBanners, playMissing, playPictures, playTrail } from './games/sight';
import { playCount, playMore, playPath, playSets } from './games/counting';
import { playJoin, playPattern, playShapes, playWhich } from './games/shapes';

export type GameId =
  | 'letter-hunt'
  | 'sound-shell'
  | 'case-match'
  | 'word-bridge'
  | 'word-banners'
  | 'picture-match'
  | 'lantern-line'
  | 'lily-trail'
  | 'star-baskets'
  | 'constellations'
  | 'more-fewer'
  | 'number-path'
  | 'shape-windows'
  | 'glass-pattern'
  | 'join-drift'
  | 'which-more';

export type QuestId = 'phonics' | 'sight' | 'counting' | 'shapes';

export type GameDef = { id: GameId; name: string; play: (token: number) => Promise<'done' | 'leave'> };
export type QuestDef = { id: QuestId; place: PlaceName; games: GameDef[] };

export const QUESTS: QuestDef[] = [
  {
    id: 'phonics',
    place: 'grove',
    games: [
      { id: 'letter-hunt', name: 'Letters', play: playLetters },
      { id: 'sound-shell', name: 'Sounds', play: playSounds },
      { id: 'case-match', name: 'Match', play: playCase },
      { id: 'word-bridge', name: 'Spell', play: playSpell },
    ],
  },
  {
    id: 'sight',
    place: 'song',
    games: [
      { id: 'word-banners', name: 'Hear It', play: playBanners },
      { id: 'picture-match', name: 'Pictures', play: playPictures },
      { id: 'lantern-line', name: 'Missing', play: playMissing },
      { id: 'lily-trail', name: 'Trail', play: playTrail },
    ],
  },
  {
    id: 'counting',
    place: 'market',
    games: [
      { id: 'star-baskets', name: 'Count', play: playCount },
      { id: 'constellations', name: 'Match', play: playSets },
      { id: 'more-fewer', name: 'More than', play: playMore },
      { id: 'number-path', name: 'Path', play: playPath },
    ],
  },
  {
    id: 'shapes',
    place: 'citadel',
    games: [
      { id: 'shape-windows', name: 'Shapes', play: playShapes },
      { id: 'glass-pattern', name: 'Pattern', play: playPattern },
      { id: 'join-drift', name: 'Join', play: playJoin },
      { id: 'which-more', name: 'Compare', play: playWhich },
    ],
  },
];

export function findGame(id: string): { quest: QuestDef; game: GameDef } | null {
  for (const quest of QUESTS) {
    const game = quest.games.find((entry) => entry.id === id);
    if (game) return { quest, game };
  }
  return null;
}

const LOBBY_SPOTS: [number, number][] = [
  [0.385, 0.275],
  [0.615, 0.275],
  [0.385, 0.53],
  [0.615, 0.53],
];

export function lobbySigns(quest: QuestDef, onPick: (game: GameDef) => void): Clickable[] {
  const clicks = quest.games.map((game, index) => {
    const mesh = iconSign(game.name, (g, face) => paintGameIcon(g, game.id, face), 3.05, 1.86);
    mesh.name = `door-${game.name}`;
    place(mesh, LOBBY_SPOTS[index][0], LOBBY_SPOTS[index][1], 0.5);
    addActor(mesh);
    return { root: mesh, click: () => onPick(game), hover: game.name };
  });
  void introduceLobby(quest, clicks.map((item) => item.root));
  return clicks;
}

async function introduceLobby(quest: QuestDef, meshes: Object3D[]): Promise<void> {
  const token = currentToken();
  for (let i = 0; i < quest.games.length; i++) {
    if (token !== currentToken()) return;
    setEmphasis(meshes[i], true);
    const line = `${quest.games[i].name}.`;
    say(line);
    const alive = await pause(token, holdMs(line));
    setEmphasis(meshes[i], false);
    if (!alive) return;
  }
  if (token === currentToken()) say('Tap a game to play.');
}

export function hubZones(onPick: (quest: QuestDef) => void): Clickable[] {
  const zones: { quest: QuestId; label: string; u: number; v: number; w: number; h: number; su: number; sv: number }[] = [
    { quest: 'phonics', label: 'Letters', u: 0.34, v: 0.34, w: 2.9, h: 2.3, su: 0.34, sv: 0.22 },
    { quest: 'sight', label: 'Words', u: 0.12, v: 0.5, w: 3.3, h: 2.5, su: 0.24, sv: 0.4 },
    { quest: 'shapes', label: 'Shapes', u: 0.71, v: 0.19, w: 3.4, h: 2.3, su: 0.62, sv: 0.22 },
    { quest: 'counting', label: 'Numbers', u: 0.88, v: 0.48, w: 4.0, h: 2.7, su: 0.76, sv: 0.4 },
  ];
  const clicks: Clickable[] = [];
  for (const zone of zones) {
    const quest = QUESTS.find((entry) => entry.id === zone.quest);
    const open = () => {
      if (quest) onPick(quest);
    };
    const glow = glowPad(zone.w, zone.h);
    glow.userData.noScale = true;
    place(glow, zone.u, zone.v, 0.02);
    addActor(glow);
    const label = sign(zone.label, 2.2, 0.95);
    label.name = `door-${zone.label}`;
    place(label, zone.su, zone.sv, 0.72);
    addActor(label);
    clicks.push(
      { root: glow, click: open, hover: zone.label },
      { root: label, click: open, hover: zone.label },
    );
  }
  return clicks;
}

const INK = '#3b2258';

function paintGameIcon(g: CanvasRenderingContext2D, id: GameId, face: FaceBox): void {
  const cx = face.x + face.w / 2;
  const cy = face.y + face.h / 2;
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = INK;
  g.strokeStyle = INK;
  if (id === 'letter-hunt') {
    inkText(g, 'A', cx, cy, face.h * 0.92);
  } else if (id === 'sound-shell') {
    drawSpeakerIcon(g, cx, cy, face.h * 0.34);
  } else if (id === 'case-match') {
    inkText(g, 'Aa', cx, cy, face.h * 0.78);
  } else if (id === 'word-bridge') {
    drawSpellSlots(g, face);
  } else if (id === 'word-banners') {
    drawBellIcon(g, cx, cy, face.h * 0.42);
  } else if (id === 'picture-match') {
    stampBit(g, 'cat', cx, cy, face.h * 0.95);
  } else if (id === 'lantern-line') {
    inkText(g, 'I see  —', cx, cy, face.h * 0.42);
  } else if (id === 'lily-trail') {
    drawTrailStones(g, face);
  } else if (id === 'star-baskets') {
    stampBit(g, 'apple', face.x + face.w * 0.3, cy, face.h * 0.9);
    inkText(g, '1 2 3', face.x + face.w * 0.72, cy, face.h * 0.4);
  } else if (id === 'constellations') {
    inkText(g, '3', cx - face.w * 0.2, cy, face.h * 0.78);
    const dx = cx + face.w * 0.22;
    const r = face.h * 0.11;
    g.fillStyle = INK;
    [
      [-1.2, -0.75],
      [1.2, -0.75],
      [0, 1.05],
    ].forEach(([px, py]) => {
      g.beginPath();
      g.arc(dx + px * r * 1.35, cy + py * r * 1.35, r, 0, Math.PI * 2);
      g.fill();
    });
  } else if (id === 'more-fewer') {
    drawDots(g, cx - face.w * 0.22, cy, 6, face.h * 0.08);
    drawDots(g, cx + face.w * 0.26, cy, 2, face.h * 0.08);
  } else if (id === 'number-path') {
    drawTrailStones(g, face, ['1', '2', '3']);
  } else if (id === 'shape-windows') {
    paintMark(g, 'triangle', cx - face.w * 0.18, cy, face.h * 0.32);
    paintMark(g, 'circle', cx + face.w * 0.2, cy, face.h * 0.28);
  } else if (id === 'glass-pattern') {
    paintMark(g, 'circle', cx - face.w * 0.28, cy, face.h * 0.22);
    paintMark(g, 'square', cx, cy, face.h * 0.22);
    paintMark(g, 'circle', cx + face.w * 0.28, cy, face.h * 0.22);
  } else if (id === 'join-drift') {
    inkText(g, '2 + 3', cx, cy, face.h * 0.55);
  } else if (id === 'which-more') {
    inkText(g, '9     4', cx, cy, face.h * 0.62);
  }
  g.restore();
}

function inkText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  g.fillStyle = INK;
  g.font = `700 ${Math.max(18, size)}px Starlace, Andika, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}

function stampBit(g: CanvasRenderingContext2D, key: string, x: number, y: number, size: number): void {
  const image = textures[key]?.image as CanvasImageSource & { width: number; height: number } | undefined;
  if (!image?.width) {
    inkText(g, key, x, y, size * 0.4);
    return;
  }
  const scale = size / Math.max(image.width, image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  g.drawImage(image, x - dw / 2, y - dh / 2, dw, dh);
}

function drawSpeakerIcon(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  g.fillStyle = INK;
  g.beginPath();
  g.moveTo(x - s * 1.2, y - s * 0.38);
  g.lineTo(x - s * 0.45, y - s * 0.38);
  g.lineTo(x + s * 0.2, y - s * 1.05);
  g.lineTo(x + s * 0.2, y + s * 1.05);
  g.lineTo(x - s * 0.45, y + s * 0.38);
  g.lineTo(x - s * 1.2, y + s * 0.38);
  g.closePath();
  g.fill();
  g.strokeStyle = INK;
  g.lineCap = 'round';
  g.lineWidth = Math.max(7, s * 0.16);
  g.beginPath();
  g.arc(x + s * 0.45, y, s * 0.62, -0.9, 0.9);
  g.stroke();
  g.beginPath();
  g.arc(x + s * 0.45, y, s * 1.15, -0.75, 0.75);
  g.stroke();
}

function drawSpellSlots(g: CanvasRenderingContext2D, face: FaceBox): void {
  const count = 3;
  const gap = face.w * 0.045;
  const w = face.w * 0.22;
  const h = face.h * 0.62;
  const total = count * w + (count - 1) * gap;
  let x = face.x + (face.w - total) / 2;
  const y = face.y + (face.h - h) / 2;
  g.lineWidth = Math.max(6, face.h * 0.045);
  g.strokeStyle = INK;
  for (let i = 0; i < count; i++) {
    g.fillStyle = '#fff6e4';
    g.beginPath();
    g.roundRect(x, y, w, h, w * 0.14);
    g.fill();
    g.stroke();
    x += w + gap;
  }
}

function drawBellIcon(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.fillStyle = '#e7b34a';
  g.strokeStyle = INK;
  g.lineWidth = Math.max(6, r * 0.12);
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x - r * 0.72, y + r * 0.45);
  g.quadraticCurveTo(x - r * 0.7, y - r * 0.7, x, y - r * 0.85);
  g.quadraticCurveTo(x + r * 0.7, y - r * 0.7, x + r * 0.72, y + r * 0.45);
  g.closePath();
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(x, y - r * 0.95, r * 0.14, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(x, y + r * 0.62, r * 0.16, 0, Math.PI * 2);
  g.fill();
  g.stroke();
}

function drawTrailStones(g: CanvasRenderingContext2D, face: FaceBox, labels?: string[]): void {
  const n = 3;
  const stone = textures.stone?.image as CanvasImageSource & { width: number; height: number } | undefined;
  for (let i = 0; i < n; i++) {
    const x = face.x + face.w * (0.22 + i * 0.28);
    const y = face.y + face.h * 0.52;
    const w = face.w * 0.24;
    const h = face.h * 0.55;
    if (stone?.width) g.drawImage(stone, x - w / 2, y - h / 2, w, h);
    else {
      g.fillStyle = '#d2b07a';
      g.beginPath();
      g.ellipse(x, y, w * 0.45, h * 0.32, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    if (labels) inkText(g, labels[i], x, y - h * 0.04, face.h * 0.28);
  }
}

function drawDots(g: CanvasRenderingContext2D, x: number, y: number, count: number, r: number): void {
  const cols = count > 4 ? 3 : Math.min(3, count);
  const rows = Math.ceil(count / cols);
  g.fillStyle = INK;
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const rowCount = Math.min(cols, count - row * cols);
    const px = x + (col - (rowCount - 1) / 2) * r * 2.4;
    const py = y + (row - (rows - 1) / 2) * r * 2.4;
    g.beginPath();
    g.arc(px, py, r, 0, Math.PI * 2);
    g.fill();
  }
}

function paintMark(g: CanvasRenderingContext2D, kind: 'circle' | 'square' | 'triangle', x: number, y: number, r: number): void {
  g.beginPath();
  if (kind === 'circle') g.arc(x, y, r, 0, Math.PI * 2);
  else if (kind === 'square') {
    const s = r * 1.7;
    g.roundRect(x - s / 2, y - s / 2, s, s, s * 0.04);
  } else {
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  }
  const fill = kind === 'circle' ? '#e25b4a' : kind === 'square' ? '#3a6fd8' : '#f0c14a';
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = Math.max(5, r * 0.12);
  g.strokeStyle = INK;
  g.stroke();
}
