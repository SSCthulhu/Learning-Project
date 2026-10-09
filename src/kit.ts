import * as THREE from 'three';
import { canvasTexture, plane, textures } from './world';

const INK = '#3b2258';
const CREAM = '#fff6e4';
const GOLD = '#e7b34a';
const TEAL = '#1ec8b8';
const ORANGE = '#ff9a3c';

function ctx2d(w: number, h: number): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas');
  return { canvas, g };
}

function rounded(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function paintLabel(g: CanvasRenderingContext2D, label: string, x: number, y: number, maxW: number, startPx: number): void {
  let size = startPx;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = INK;
  do {
    g.font = `700 ${size}px Starlace, Andika, sans-serif`;
    if (g.measureText(label).width <= maxW || size <= 54) break;
    size -= 6;
  } while (size > 54);
  if (label === 'l') {
    drawHookedL(g, x, y, size);
    return;
  }
  g.fillText(label, x, y);
}

function drawHookedL(g: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const h = size * 0.62;
  const stem = size * 0.11;
  g.save();
  g.strokeStyle = INK;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = stem;
  g.beginPath();
  g.moveTo(x - size * 0.08, y - h * 0.5);
  g.lineTo(x - size * 0.08, y + h * 0.28);
  g.quadraticCurveTo(x - size * 0.02, y + h * 0.5, x + size * 0.28, y + h * 0.5);
  g.stroke();
  g.restore();
}

function starPath(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const spikes = 5;
  g.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / spikes;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

export type FaceBox = { x: number; y: number; w: number; h: number };

function uiImage(key: string): CanvasImageSource | null {
  const image = textures[key]?.image as CanvasImageSource & { width?: number; height?: number } | undefined;
  if (!image || !image.width) return null;
  return image;
}

function stampUi(g: CanvasRenderingContext2D, key: string, w: number, h: number): boolean {
  const image = uiImage(key);
  if (!image) return false;
  g.drawImage(image, 0, 0, w, h);
  return true;
}

function artFace(kind: 'tile' | 'signboard' | 'coincard' | 'stone' | 'scroll', cw: number, ch: number): FaceBox {
  if (kind === 'tile') return { x: cw * 0.12, y: ch * 0.12, w: cw * 0.76, h: ch * 0.76 };
  if (kind === 'signboard') return { x: cw * 0.08, y: ch * 0.2, w: cw * 0.84, h: ch * 0.6 };
  if (kind === 'coincard') {
    const s = Math.min(cw, ch) * 0.6;
    return { x: (cw - s) / 2, y: (ch - s) / 2, w: s, h: s };
  }
  if (kind === 'stone') return { x: cw * 0.16, y: ch * 0.1, w: cw * 0.68, h: ch * 0.5 };
  return { x: cw * 0.16, y: ch * 0.26, w: cw * 0.68, h: ch * 0.48 };
}

function fallbackBoard(g: CanvasRenderingContext2D, w: number, h: number, r: number): void {
  g.fillStyle = CREAM;
  rounded(g, 8, 8, w - 16, h - 16, r);
  g.fill();
  g.lineWidth = Math.max(8, Math.min(w, h) * 0.03);
  g.strokeStyle = INK;
  g.stroke();
}

function paintedBoard(
  key: 'tile' | 'signboard' | 'coincard' | 'stone' | 'scroll',
  cw: number,
  ch: number,
  worldW: number,
  worldH: number,
  paint: (g: CanvasRenderingContext2D, face: FaceBox) => void,
): THREE.Mesh {
  const { canvas, g } = ctx2d(cw, ch);
  if (!stampUi(g, key, cw, ch)) fallbackBoard(g, cw, ch, Math.min(cw, ch) * 0.12);
  paint(g, artFace(key, cw, ch));
  const mesh = plane(canvasTexture(canvas), worldW, worldH, 4);
  mesh.userData.disposeMap = true;
  return mesh;
}

function fillFaceText(g: CanvasRenderingContext2D, label: string, face: FaceBox, heightShare = 0.72): void {
  paintLabel(g, label, face.x + face.w / 2, face.y + face.h / 2, face.w * 0.9, face.h * heightShare);
}

function carve(g: CanvasRenderingContext2D, face: FaceBox, r: number, wash = 'rgba(92, 58, 28, 0.2)'): void {
  g.save();
  rounded(g, face.x, face.y, face.w, face.h, r);
  g.fillStyle = wash;
  g.fill();
  g.strokeStyle = 'rgba(62, 36, 16, 0.38)';
  g.lineWidth = Math.max(6, face.w * 0.018);
  g.stroke();
  g.strokeStyle = 'rgba(255, 246, 228, 0.28)';
  g.lineWidth = Math.max(3, face.w * 0.01);
  rounded(g, face.x + 8, face.y + 8, face.w - 16, face.h - 16, Math.max(6, r - 8));
  g.stroke();
  g.restore();
}

export function card(label: string, w = 1.7, h = 1.85, fill = CREAM): THREE.Mesh {
  return paintedBoard('tile', 512, 512, w, h, (g, face) => {
    if (fill !== CREAM) {
      g.save();
      rounded(g, face.x, face.y, face.w, face.h, face.w * 0.08);
      g.fillStyle = fill;
      g.globalAlpha = 0.28;
      g.fill();
      g.restore();
    }
    fillFaceText(g, label, face, 0.78);
  });
}

export function wordCard(label: string, w = 2.15, h = 1.35): THREE.Mesh {
  return paintedBoard('signboard', 720, 320, w, h, (g, face) => {
    fillFaceText(g, label, face, 0.7);
  });
}

export function numeralSign(n: number): THREE.Mesh {
  const mesh = paintedBoard('signboard', 860, 480, 2.55, 1.42, (g, face) => {
    g.fillStyle = INK;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 46px Starlace, Andika, sans-serif';
    g.fillText('This number', face.x + face.w / 2, face.y + face.h * 0.24);
    paintLabel(g, String(n), face.x + face.w / 2, face.y + face.h * 0.66, face.w * 0.72, face.h * 0.62);
  });
  mesh.name = `shown-${n}`;
  return mesh;
}

export function collectBits(root: THREE.Object3D): THREE.Object3D[] {
  const bits: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (!node.userData.bit || node.userData.crossed) return;
    bits.push(node);
  });
  bits.sort((a, b) => Number(a.userData.bitIndex) - Number(b.userData.bitIndex));
  return bits;
}

export function popBits(root: THREE.Object3D): void {
  collectBits(root).forEach((bit, index) => {
    window.setTimeout(() => {
      if (!bit.parent) return;
      const base = Number(bit.userData.baseBit ?? bit.scale.x ?? 1) || 1;
      bit.userData.baseBit = base;
      bit.scale.setScalar(base * 1.32);
      window.setTimeout(() => {
        if (bit.parent) bit.scale.setScalar(base);
      }, 200);
    }, index * 170);
  });
}

export function coin(n: number, size = 1.4): THREE.Mesh {
  const mesh = paintedBoard('coincard', 512, 512, size, size, (g, face) => {
    const text = String(n);
    paintLabel(g, text, face.x + face.w / 2, face.y + face.h / 2 + face.h * 0.04, face.w * 0.86, text.length > 1 ? face.h * 0.62 : face.h * 0.78);
  });
  mesh.renderOrder = 5;
  return mesh;
}

export function sign(name: string, w = 2.05, h = 1.54): THREE.Mesh {
  return paintedBoard('signboard', 720, 320, w, h, (g, face) => {
    fillFaceText(g, name, face, 0.62);
  });
}

export function iconSign(
  name: string,
  icon: (g: CanvasRenderingContext2D, face: FaceBox) => void,
  w = 3.2,
  h = 1.95,
): THREE.Mesh {
  return paintedBoard('signboard', 1024, 624, w, h, (g, face) => {
    const iconBox: FaceBox = { x: face.x, y: face.y, w: face.w, h: face.h * 0.6 };
    icon(g, iconBox);
    const labelBox: FaceBox = {
      x: face.x + face.w * 0.04,
      y: face.y + face.h * 0.58,
      w: face.w * 0.92,
      h: face.h * 0.4,
    };
    fillFaceText(g, name, labelBox, 0.7);
  });
}

export function stone(label: string | number, size = 1.7): THREE.Mesh {
  const aspect = 493 / 899;
  const mesh = paintedBoard('stone', 899, 493, size, size * aspect, (g, face) => {
    fillFaceText(g, String(label), face, 0.7);
  });
  mesh.name = `stone-${label}`;
  mesh.renderOrder = 5;
  return mesh;
}

export function backButton(): THREE.Mesh {
  const { canvas, g } = ctx2d(256, 256);
  g.fillStyle = CREAM;
  g.beginPath();
  g.arc(128, 128, 112, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = INK;
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.moveTo(52, 128);
  g.lineTo(124, 70);
  g.lineTo(124, 104);
  g.lineTo(204, 104);
  g.lineTo(204, 152);
  g.lineTo(124, 152);
  g.lineTo(124, 186);
  g.closePath();
  g.fill();
  const mesh = plane(canvasTexture(canvas), 0.86, 0.86, 8);
  mesh.userData.disposeMap = true;
  return mesh;
}

export function houseButton(): THREE.Mesh {
  const { canvas, g } = ctx2d(256, 256);
  g.fillStyle = CREAM;
  g.beginPath();
  g.arc(128, 128, 112, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = INK;
  g.stroke();
  g.fillStyle = '#e25b4a';
  g.beginPath();
  g.moveTo(128, 48);
  g.lineTo(196, 108);
  g.lineTo(176, 108);
  g.lineTo(176, 190);
  g.lineTo(80, 190);
  g.lineTo(80, 108);
  g.lineTo(60, 108);
  g.closePath();
  g.fill();
  g.lineWidth = 8;
  g.stroke();
  g.fillStyle = GOLD;
  rounded(g, 110, 140, 36, 50, 6);
  g.fill();
  const mesh = plane(canvasTexture(canvas), 0.86, 0.86, 8);
  mesh.userData.disposeMap = true;
  return mesh;
}

export function quietButton(muted: boolean): THREE.Mesh {
  const { canvas, g } = ctx2d(256, 256);
  g.fillStyle = CREAM;
  g.beginPath();
  g.arc(128, 128, 112, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = INK;
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.moveTo(70, 108);
  g.lineTo(100, 108);
  g.lineTo(138, 76);
  g.lineTo(138, 180);
  g.lineTo(100, 148);
  g.lineTo(70, 148);
  g.closePath();
  g.fill();
  if (muted) {
    g.strokeStyle = '#e25b4a';
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(86, 70);
    g.lineTo(190, 186);
    g.stroke();
  } else {
    g.strokeStyle = INK;
    g.lineWidth = 8;
    g.beginPath();
    g.arc(148, 128, 28, -0.8, 0.8);
    g.stroke();
    g.beginPath();
    g.arc(148, 128, 48, -0.7, 0.7);
    g.stroke();
  }
  const mesh = plane(canvasTexture(canvas), 0.86, 0.86, 8);
  mesh.userData.disposeMap = true;
  return mesh;
}

export function bell(): THREE.Mesh {
  const { canvas, g } = ctx2d(256, 256);
  g.fillStyle = CREAM;
  g.beginPath();
  g.arc(128, 128, 112, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 14;
  g.strokeStyle = GOLD;
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.moveTo(58, 104);
  g.lineTo(96, 104);
  g.lineTo(148, 64);
  g.lineTo(148, 192);
  g.lineTo(96, 152);
  g.lineTo(58, 152);
  g.closePath();
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 10;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(162, 128, 28, -0.9, 0.9);
  g.stroke();
  g.beginPath();
  g.arc(162, 128, 52, -0.8, 0.8);
  g.stroke();
  const mesh = plane(canvasTexture(canvas), 1.15, 1.15, 6);
  mesh.userData.disposeMap = true;
  return mesh;
}

export function hereRing(size = 1.2): THREE.Mesh {
  const { canvas, g } = ctx2d(256, 256);
  g.fillStyle = GOLD;
  g.beginPath();
  g.arc(128, 128, 120, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff6e4';
  g.beginPath();
  g.arc(128, 128, 78, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = INK;
  g.stroke();
  const mesh = plane(canvasTexture(canvas), size, size, 4);
  mesh.userData.disposeMap = true;
  return mesh;
}

export function progressMarks(total: number, step: number): THREE.Group {
  const group = new THREE.Group();
  const size = Math.min(0.4, 3.05 / Math.max(1, total * 1.28));
  const gap = size * 1.42;
  for (let i = 0; i < total; i++) {
    const { canvas, g } = ctx2d(128, 128);
    g.beginPath();
    g.arc(64, 64, 46, 0, Math.PI * 2);
    g.fillStyle = i < step ? '#6aaa3a' : i === step ? GOLD : CREAM;
    g.fill();
    g.lineWidth = 12;
    g.strokeStyle = INK;
    g.stroke();
    const mesh = plane(canvasTexture(canvas), size, size, 7);
    mesh.userData.disposeMap = true;
    mesh.position.x = (i - (total - 1) / 2) * gap;
    group.add(mesh);
  }
  return group;
}

export function prizeStar(): THREE.Mesh {
  const { canvas, g } = ctx2d(512, 512);
  g.fillStyle = 'rgba(255, 246, 228, 0.94)';
  g.beginPath();
  g.arc(256, 256, 230, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 16;
  g.strokeStyle = INK;
  g.stroke();
  starPath(g, 256, 268, 150);
  const glow = g.createRadialGradient(220, 200, 10, 256, 268, 160);
  glow.addColorStop(0, '#fff1b0');
  glow.addColorStop(0.55, GOLD);
  glow.addColorStop(1, '#e09020');
  g.fillStyle = glow;
  g.fill();
  g.lineJoin = 'round';
  g.lineWidth = 14;
  g.strokeStyle = INK;
  g.stroke();
  const mesh = plane(canvasTexture(canvas), 2.15, 2.15, 7);
  mesh.userData.disposeMap = true;
  return mesh;
}

export function stripedAwning(w: number, h: number): THREE.Mesh {
  const { canvas, g } = ctx2d(640, 180);
  const stripes = 8;
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 === 0 ? '#e25b4a' : '#fff1d2';
    g.fillRect((640 / stripes) * i, 0, 640 / stripes + 1, 128);
  }
  g.fillStyle = GOLD;
  g.fillRect(0, 118, 640, 22);
  g.fillStyle = '#e25b4a';
  for (let i = 0; i < 10; i++) {
    g.beginPath();
    g.arc(32 + i * 64, 128, 30, 0, Math.PI);
    g.fill();
  }
  const mesh = plane(canvasTexture(canvas), w, h, 5);
  mesh.userData.disposeMap = true;
  return mesh;
}

export function blankSlot(): THREE.Mesh {
  return paintedBoard('tile', 320, 320, 1.15, 1.15, (g, face) => {
    const inset = {
      x: face.x + face.w * 0.08,
      y: face.y + face.h * 0.08,
      w: face.w * 0.84,
      h: face.h * 0.84,
    };
    carve(g, inset, inset.w * 0.12);
  });
}

export function nextSlot(size: number): THREE.Mesh {
  return paintedBoard('tile', 512, 512, size, size, (g, face) => {
    const inset = {
      x: face.x + face.w * 0.08,
      y: face.y + face.h * 0.08,
      w: face.w * 0.84,
      h: face.h * 0.84,
    };
    carve(g, inset, inset.w * 0.12, 'rgba(180, 130, 40, 0.16)');
  });
}

export function thisTag(): THREE.Mesh {
  const { canvas, g } = ctx2d(420, 180);
  g.fillStyle = GOLD;
  rounded(g, 14, 18, 392, 144, 56);
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = INK;
  g.stroke();
  g.fillStyle = INK;
  g.font = '700 86px Starlace, Andika, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('this', 210, 98);
  const mesh = plane(canvasTexture(canvas), 1.15, 0.48, 6);
  mesh.userData.disposeMap = true;
  return mesh;
}

type ShapeName = 'circle' | 'square' | 'triangle' | 'rectangle' | 'star';

const SHAPE_COLOR: Record<ShapeName, string> = {
  circle: '#e25b4a',
  square: '#3a6fd8',
  triangle: '#f0c14a',
  rectangle: '#6aaa3a',
  star: '#f29a32',
};

export function shapeTile(name: ShapeName, size = 1.55): THREE.Mesh {
  const mesh = paintedBoard('tile', 512, 512, size, size, (g, face) => {
    const r = Math.min(face.w, face.h) * 0.36;
    drawShape(g, name, face.x + face.w / 2, face.y + face.h / 2, r);
  });
  mesh.name = `shape-${name}`;
  return mesh;
}

const SHAPE_LIGHT: Record<ShapeName, string> = {
  circle: '#ee7468',
  square: '#5d88de',
  triangle: '#f3cc5c',
  rectangle: '#7bb84e',
  star: '#f0aa48',
};

const SHAPE_DARK: Record<ShapeName, string> = {
  circle: '#d24b42',
  square: '#2f5cb8',
  triangle: '#d9a428',
  rectangle: '#4f8f2c',
  star: '#d88822',
};

function traceShape(g: CanvasRenderingContext2D, name: ShapeName, x: number, y: number, r: number): void {
  g.beginPath();
  if (name === 'circle') g.arc(x, y, r, 0, Math.PI * 2);
  else if (name === 'square') {
    const side = r * 1.72;
    const rad = side * 0.04;
    g.roundRect(x - side / 2, y - side / 2, side, side, rad);
  } else if (name === 'rectangle') {
    const rw = r * 2.2;
    const rh = r * 1.1;
    const rad = Math.min(rw, rh) * 0.04;
    g.roundRect(x - rw / 2, y - rh / 2, rw, rh, rad);
  } else if (name === 'triangle') {
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  } else starPath(g, x, y, r);
}

function drawShape(g: CanvasRenderingContext2D, name: ShapeName, x: number, y: number, r: number): void {
  g.save();
  g.fillStyle = 'rgba(59, 34, 88, 0.1)';
  traceShape(g, name, x, y + r * 0.05, r);
  g.fill();
  traceShape(g, name, x, y, r);
  const grd = g.createLinearGradient(x - r, y - r, x, y + r);
  grd.addColorStop(0, SHAPE_LIGHT[name]);
  grd.addColorStop(0.62, SHAPE_COLOR[name]);
  grd.addColorStop(1, SHAPE_DARK[name]);
  g.fillStyle = grd;
  g.fill();
  g.lineJoin = name === 'square' || name === 'rectangle' ? 'miter' : 'round';
  g.lineCap = 'round';
  g.strokeStyle = INK;
  g.lineWidth = Math.max(11, r * 0.12);
  g.stroke();
  g.strokeStyle = 'rgba(255, 255, 255, 0.38)';
  g.lineWidth = Math.max(4, r * 0.055);
  g.beginPath();
  g.ellipse(x - r * 0.18, y - r * 0.28, r * 0.38, r * 0.16, -0.55, Math.PI * 1.05, Math.PI * 1.75);
  g.stroke();
  g.restore();
}

export type BitKind = 'apple' | 'moon' | 'fish' | 'orb';

function bitCanvas(kind: BitKind): HTMLCanvasElement {
  if (kind === 'fish') return fishCanvas();
  if (kind === 'moon') return moonCanvas();
  if (kind === 'orb') return orbCanvas();
  return appleCanvas();
}

function appleCanvas(): HTMLCanvasElement {
  const { canvas, g } = ctx2d(256, 256);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.fillStyle = 'rgba(90, 40, 20, 0.16)';
  g.beginPath();
  g.ellipse(128, 220, 62, 14, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(128, 86);
  g.bezierCurveTo(168, 58, 228, 96, 214, 156);
  g.bezierCurveTo(202, 214, 160, 232, 128, 220);
  g.bezierCurveTo(96, 232, 54, 214, 42, 156);
  g.bezierCurveTo(28, 96, 88, 58, 128, 86);
  g.closePath();
  const body = g.createLinearGradient(50, 80, 200, 220);
  body.addColorStop(0, '#ff6f6a');
  body.addColorStop(0.42, '#e1262c');
  body.addColorStop(1, '#a30f18');
  g.fillStyle = body;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 10;
  g.stroke();
  g.fillStyle = 'rgba(255, 214, 80, 0.42)';
  g.beginPath();
  g.ellipse(86, 168, 26, 20, -0.3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.ellipse(90, 124, 14, 26, -0.6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(90, 16, 24, 0.4)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(128, 96);
  g.quadraticCurveTo(124, 130, 128, 156);
  g.stroke();
  g.strokeStyle = '#6b3a1f';
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(128, 92);
  g.quadraticCurveTo(146, 52, 168, 42);
  g.stroke();
  g.fillStyle = '#3f9a34';
  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.beginPath();
  g.ellipse(176, 58, 30, 14, 0.8, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.strokeStyle = '#2f7a28';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(158, 64);
  g.lineTo(196, 52);
  g.stroke();
  return canvas;
}

function moonCanvas(): HTMLCanvasElement {
  const { canvas, g } = ctx2d(256, 256);
  g.fillStyle = '#ffe56a';
  g.beginPath();
  g.arc(104, 128, 86, 0, Math.PI * 2, false);
  g.arc(150, 108, 68, 0, Math.PI * 2, true);
  g.fill('evenodd');
  g.strokeStyle = INK;
  g.lineWidth = 10;
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(82, 118, 8, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.arc(78, 146, 16, 0.15, Math.PI - 0.15);
  g.stroke();
  return canvas;
}

function fishCanvas(): HTMLCanvasElement {
  const { canvas, g } = ctx2d(384, 192);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.fillStyle = '#ff7a1a';
  g.strokeStyle = INK;
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(246, 96);
  g.lineTo(352, 30);
  g.quadraticCurveTo(308, 96, 352, 162);
  g.closePath();
  g.fill();
  g.stroke();
  const body = g.createLinearGradient(40, 30, 40, 170);
  body.addColorStop(0, '#ffe07a');
  body.addColorStop(0.45, '#ff9a2c');
  body.addColorStop(1, '#f06a12');
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(164, 98, 118, 60, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#ffb03a';
  g.beginPath();
  g.moveTo(150, 78);
  g.quadraticCurveTo(176, 18, 214, 70);
  g.closePath();
  g.fill();
  g.stroke();
  g.strokeStyle = 'rgba(160, 50, 8, 0.45)';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(150, 52);
  g.quadraticCurveTo(168, 98, 150, 146);
  g.moveTo(190, 48);
  g.quadraticCurveTo(208, 98, 190, 150);
  g.stroke();
  g.fillStyle = '#fff';
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.arc(104, 86, 20, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(100, 88, 9, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.arc(96, 108, 16, 0.2, Math.PI - 0.25);
  g.stroke();
  return canvas;
}

function orbCanvas(): HTMLCanvasElement {
  const { canvas, g } = ctx2d(256, 256);
  starPath(g, 128, 132, 104);
  const grd = g.createLinearGradient(40, 30, 210, 220);
  grd.addColorStop(0, '#fff1a8');
  grd.addColorStop(0.5, '#f0c14a');
  grd.addColorStop(1, '#e09020');
  g.fillStyle = grd;
  g.fill();
  g.lineJoin = 'round';
  g.lineWidth = 12;
  g.strokeStyle = INK;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath();
  g.ellipse(104, 100, 16, 10, -0.6, 0, Math.PI * 2);
  g.fill();
  return canvas;
}

function bestCols(count: number, boxW: number, boxH: number, aspect: number): number {
  let best = 1;
  let bestSize = -1;
  const gap = 0.2;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const cellW = boxW / (cols + Math.max(0, cols - 1) * gap);
    const cellH = boxH / (rows + Math.max(0, rows - 1) * gap);
    let bw = cellW;
    let bh = bw / aspect;
    if (bh > cellH) {
      bh = cellH;
      bw = bh * aspect;
    }
    const size = bw * bh;
    if (size > bestSize) {
      bestSize = size;
      best = cols;
    }
  }
  return best;
}

function bitTexture(kind: BitKind): THREE.Texture | null {
  const key = kind === 'orb' ? 'star' : kind;
  return textures[key] ?? null;
}

function crossMark(size: number): THREE.Mesh {
  const { canvas, g } = ctx2d(256, 256);
  g.fillStyle = 'rgba(226, 59, 59, 0.9)';
  g.beginPath();
  g.arc(128, 128, 108, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#fffaf0';
  g.lineWidth = 22;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(78, 78);
  g.lineTo(178, 178);
  g.moveTo(178, 78);
  g.lineTo(78, 178);
  g.stroke();
  const mesh = plane(canvasTexture(canvas), size, size, 6);
  mesh.userData.disposeMap = true;
  return mesh;
}

export function countedPile(kind: BitKind, count: number, boxW: number, boxH: number, crossed = 0): THREE.Group {
  const group = new THREE.Group();
  if (count <= 0) return group;
  const shared = bitTexture(kind);
  const fish = kind === 'fish';
  const aspect = shared ? imageSize(shared).width / imageSize(shared).height : fish ? 1.9 : 1;
  const cols = bestCols(count, boxW, boxH, aspect);
  const rows = Math.ceil(count / cols);
  const gap = 0.2;
  const cellW = boxW / (cols + Math.max(0, cols - 1) * gap);
  const cellH = boxH / (rows + Math.max(0, rows - 1) * gap);
  let bw = cellW;
  let bh = bw / aspect;
  if (bh > cellH) {
    bh = cellH;
    bw = bh * aspect;
  }
  const stepX = bw * (1 + gap);
  const stepY = bh * (1 + gap);
  const sample = shared ? null : bitCanvas(kind);
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const rowCount = Math.min(cols, count - row * cols);
    const mesh = plane(shared ?? canvasTexture(sample as HTMLCanvasElement), bw, bh, 5);
    if (!shared) mesh.userData.disposeMap = true;
    mesh.userData.bit = true;
    mesh.userData.bitIndex = i;
    if (i >= count - crossed) mesh.userData.crossed = true;
    const x = (col - (rowCount - 1) / 2) * stepX;
    const y = ((rows - 1) / 2 - row) * stepY;
    mesh.position.set(x, y, 0.02);
    group.add(mesh);
    if (i >= count - crossed) {
      const mark = crossMark(Math.min(bw, bh) * 0.62);
      mark.position.set(x, y, 0.08);
      group.add(mark);
    }
  }
  return group;
}

function tenFrameCanvas(filled: number): HTMLCanvasElement {
  const { canvas, g } = ctx2d(700, 300);
  g.fillStyle = '#fffaf0';
  rounded(g, 8, 8, 684, 284, 28);
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = GOLD;
  g.stroke();
  for (let i = 0; i < 10; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const x = 36 + col * 130;
    const y = 28 + row * 128;
    g.strokeStyle = 'rgba(59, 34, 88, 0.28)';
    g.lineWidth = 6;
    rounded(g, x, y, 112, 108, 16);
    g.stroke();
    if (i < filled) {
      starPath(g, x + 56, y + 56, 36);
      g.fillStyle = '#f0c14a';
      g.fill();
      g.lineJoin = 'round';
      g.lineWidth = 7;
      g.strokeStyle = INK;
      g.stroke();
    }
  }
  return canvas;
}

export function tenFrameArt(count: number, w: number, h: number): THREE.Group {
  const group = new THREE.Group();
  const frames = count > 10 ? [10, Math.max(0, count - 10)] : [count];
  const gap = 0.06;
  const frameH = (h - gap * (frames.length - 1)) / frames.length;
  frames.forEach((filled, index) => {
    const mesh = plane(canvasTexture(tenFrameCanvas(filled)), w, frameH, 5);
    mesh.userData.disposeMap = true;
    mesh.position.y = ((frames.length - 1) / 2 - index) * (frameH + gap);
    group.add(mesh);
  });
  return group;
}

export function emptyBowl(): THREE.Mesh {
  const { canvas, g } = ctx2d(800, 480);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.fillStyle = 'rgba(80, 42, 16, 0.22)';
  g.beginPath();
  g.ellipse(400, 400, 250, 28, 0, 0, Math.PI * 2);
  g.fill();
  const wood = g.createLinearGradient(160, 120, 640, 420);
  wood.addColorStop(0, '#f0c98a');
  wood.addColorStop(0.45, '#d39245');
  wood.addColorStop(1, '#8a4e22');
  g.fillStyle = wood;
  g.strokeStyle = INK;
  g.lineWidth = 16;
  g.beginPath();
  g.moveTo(120, 210);
  g.quadraticCurveTo(150, 390, 400, 420);
  g.quadraticCurveTo(650, 390, 680, 210);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = '#6b3a18';
  g.beginPath();
  g.ellipse(400, 214, 250, 78, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  const inside = g.createRadialGradient(400, 220, 20, 400, 214, 230);
  inside.addColorStop(0, '#f8edd4');
  inside.addColorStop(0.72, '#e7d3a4');
  inside.addColorStop(1, '#c49a62');
  g.fillStyle = inside;
  g.beginPath();
  g.ellipse(400, 214, 214, 58, 0, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = '#5c3318';
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.75)';
  g.lineWidth = 8;
  g.beginPath();
  g.ellipse(310, 198, 70, 14, -0.2, Math.PI * 1.1, Math.PI * 1.85);
  g.stroke();
  const mesh = plane(canvasTexture(canvas), 3.55, 1.72, 6);
  mesh.userData.disposeMap = true;
  return mesh;
}

export function noneTag(): THREE.Mesh {
  const { canvas, g } = ctx2d(900, 420);
  g.setLineDash([22, 16]);
  g.lineWidth = 12;
  g.strokeStyle = 'rgba(59, 34, 88, 0.4)';
  rounded(g, 70, 64, 760, 292, 70);
  g.stroke();
  const mesh = plane(canvasTexture(canvas), 2.9, 1.28, 6);
  mesh.userData.disposeMap = true;
  return mesh;
}

export function hereMark(): THREE.Mesh {
  const { canvas, g } = ctx2d(256, 160);
  g.fillStyle = GOLD;
  g.strokeStyle = INK;
  g.lineJoin = 'round';
  g.lineWidth = 12;
  g.beginPath();
  g.moveTo(128, 18);
  g.lineTo(210, 132);
  g.lineTo(46, 132);
  g.closePath();
  g.fill();
  g.stroke();
  const mesh = plane(canvasTexture(canvas), 0.62, 0.38, 6);
  mesh.userData.disposeMap = true;
  return mesh;
}

function emptyChip(w: number, h: number, now: boolean): THREE.Mesh {
  return paintedBoard('signboard', 420, 280, w, h, (g, face) => {
    carve(g, face, face.h * 0.18, now ? 'rgba(180, 130, 40, 0.18)' : 'rgba(92, 58, 28, 0.18)');
  });
}

export function trailLine(words: string[], step: number): THREE.Group {
  const group = new THREE.Group();
  const chipW = words.length > 3 ? 0.74 : 0.92;
  const chipH = 0.72;
  const gap = 0.1;
  words.forEach((word, i) => {
    const mesh = i < step ? wordCard(word, chipW, chipH) : emptyChip(chipW, chipH, i === step);
    mesh.position.x = (i - (words.length - 1) / 2) * (chipW + gap);
    group.add(mesh);
  });
  return group;
}

export function picture(kind: string, size = 3.1): THREE.Mesh {
  return paintedBoard('tile', 640, 640, size, size, (g, face) => {
    const painted = textures[kind];
    g.save();
    rounded(g, face.x, face.y, face.w, face.h, face.w * 0.08);
    g.clip();
    if (painted?.image) {
      const image = painted.image as CanvasImageSource & { width: number; height: number };
      const max = Math.min(face.w, face.h) * 0.92;
      const scale = Math.min(max / image.width, max / image.height);
      const dw = image.width * scale;
      const dh = image.height * scale;
      g.drawImage(image, face.x + face.w / 2 - dw / 2, face.y + face.h / 2 - dh / 2, dw, dh);
    } else {
      g.translate(face.x + face.w / 2 - 320, face.y + face.h / 2 - 320);
      const s = Math.min(face.w, face.h) / 640;
      g.translate(320, 320);
      g.scale(s, s);
      g.translate(-320, -320);
      drawPicture(g, kind);
    }
    g.restore();
  });
}

function drawPicture(g: CanvasRenderingContext2D, kind: string): void {
  const wash: Record<string, string> = {
    cat: '#ffe0c2',
    dog: '#f6d7b0',
    pig: '#ffd6e4',
    sun: '#fff3c4',
    bus: '#fff1c2',
    cup: '#d9f7f3',
    hat: '#efe4ff',
    map: '#f8e7c4',
    bed: '#e4f2ff',
  };
  g.fillStyle = wash[kind] ?? '#fff1d0';
  g.beginPath();
  g.arc(320, 345, 210, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = INK;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (kind === 'sun') {
    g.strokeStyle = '#f0a030';
    g.lineWidth = 16;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(320 + Math.cos(a) * 150, 330 + Math.sin(a) * 150);
      g.lineTo(320 + Math.cos(a) * 210, 330 + Math.sin(a) * 210);
      g.stroke();
    }
    g.fillStyle = '#ffe56a';
    g.strokeStyle = INK;
    g.lineWidth = 12;
    g.beginPath();
    g.arc(320, 330, 120, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    face(g, 320, 330);
    g.fillStyle = '#ffb0b0';
    g.beginPath();
    g.arc(270, 350, 16, 0, Math.PI * 2);
    g.arc(370, 350, 16, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'cat') {
    drawCat(g);
  } else if (kind === 'dog') {
    drawDog(g);
  } else if (kind === 'pig') {
    drawPig(g);
  } else if (kind === 'bus') {
    g.fillStyle = '#f0c14a';
    g.strokeStyle = INK;
    g.lineWidth = 12;
    rounded(g, 110, 210, 420, 230, 36);
    g.fill();
    g.stroke();
    g.fillStyle = INK;
    g.fillRect(110, 300, 420, 18);
    g.fillStyle = '#d7f4ff';
    g.strokeStyle = INK;
    rounded(g, 145, 236, 88, 64, 10);
    g.fill();
    g.stroke();
    rounded(g, 250, 236, 88, 64, 10);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff6e4';
    rounded(g, 390, 248, 90, 150, 12);
    g.fill();
    g.stroke();
    g.fillStyle = INK;
    g.beginPath();
    g.arc(210, 440, 38, 0, Math.PI * 2);
    g.arc(430, 440, 38, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = GOLD;
    g.beginPath();
    g.arc(210, 440, 16, 0, Math.PI * 2);
    g.arc(430, 440, 16, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e25b4a';
    g.beginPath();
    g.arc(150, 250, 10, 0, Math.PI * 2);
    g.arc(500, 250, 10, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'cup') {
    g.fillStyle = '#f7f1e4';
    g.strokeStyle = INK;
    g.lineWidth = 12;
    g.beginPath();
    g.ellipse(320, 450, 150, 28, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = TEAL;
    rounded(g, 190, 180, 230, 250, 30);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    rounded(g, 214, 200, 182, 36, 12);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 12;
    g.beginPath();
    g.arc(430, 290, 48, -1.15, 1.15);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(250, 230);
    g.quadraticCurveTo(270, 280, 250, 360);
    g.stroke();
  } else if (kind === 'hat') {
    g.fillStyle = '#6b4bb5';
    g.strokeStyle = INK;
    g.lineWidth = 12;
    g.beginPath();
    g.ellipse(320, 430, 210, 42, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    rounded(g, 210, 170, 220, 250, 80);
    g.fill();
    g.stroke();
    g.fillStyle = GOLD;
    g.fillRect(210, 340, 220, 28);
    g.fillStyle = '#e25b4a';
    g.beginPath();
    g.arc(250, 250, 22, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#7ed957';
    g.beginPath();
    g.ellipse(278, 236, 16, 8, 0.6, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'map') {
    g.fillStyle = '#f6e2b0';
    g.strokeStyle = INK;
    g.lineWidth = 12;
    rounded(g, 150, 140, 160, 360, 16);
    g.fill();
    g.stroke();
    rounded(g, 310, 140, 180, 360, 16);
    g.fill();
    g.stroke();
    g.strokeStyle = '#3a8fd8';
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(190, 200);
    g.quadraticCurveTo(250, 280, 220, 420);
    g.stroke();
    g.strokeStyle = '#e25b4a';
    g.lineWidth = 8;
    g.setLineDash([12, 10]);
    g.beginPath();
    g.moveTo(360, 430);
    g.quadraticCurveTo(400, 300, 450, 210);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#e25b4a';
    g.font = '700 72px Starlace, Inter, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('X', 450, 190);
    g.strokeStyle = INK;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(230, 250, 28, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(230, 214);
    g.lineTo(230, 286);
    g.moveTo(202, 250);
    g.lineTo(258, 250);
    g.stroke();
  } else if (kind === 'bed') {
    g.fillStyle = '#c9843a';
    g.strokeStyle = INK;
    g.lineWidth = 12;
    rounded(g, 150, 180, 40, 280, 12);
    g.fill();
    g.stroke();
    rounded(g, 450, 210, 36, 250, 12);
    g.fill();
    g.stroke();
    rounded(g, 150, 250, 320, 180, 20);
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    rounded(g, 190, 230, 130, 90, 20);
    g.fill();
    g.stroke();
    g.fillStyle = '#7eb6e8';
    rounded(g, 250, 320, 230, 100, 24);
    g.fill();
    g.stroke();
    g.fillStyle = '#c9843a';
    rounded(g, 180, 430, 28, 50, 8);
    g.fill();
    rounded(g, 430, 430, 28, 50, 8);
    g.fill();
  } else {
    g.fillStyle = TEAL;
    g.beginPath();
    g.ellipse(300, 330, 150, 80, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = ORANGE;
    g.beginPath();
    g.moveTo(430, 330);
    g.lineTo(540, 250);
    g.lineTo(540, 410);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(230, 310, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = INK;
    g.beginPath();
    g.arc(224, 310, 10, 0, Math.PI * 2);
    g.fill();
  }
}

function drawCat(g: CanvasRenderingContext2D): void {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = INK;
  g.lineWidth = 12;
  g.fillStyle = '#f08a28';
  g.beginPath();
  g.moveTo(450, 500);
  g.bezierCurveTo(590, 470, 560, 300, 500, 250);
  g.bezierCurveTo(470, 310, 520, 430, 440, 470);
  g.closePath();
  g.fill();
  g.stroke();
  g.beginPath();
  g.ellipse(320, 450, 150, 95, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#fff1dc';
  g.beginPath();
  g.ellipse(320, 470, 70, 48, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(320, 270, 118, 0, Math.PI * 2);
  g.fillStyle = '#f08a28';
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(230, 220);
  g.lineTo(250, 100);
  g.lineTo(330, 190);
  g.closePath();
  g.moveTo(410, 220);
  g.lineTo(390, 100);
  g.lineTo(310, 190);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = '#f8c8b0';
  g.beginPath();
  g.moveTo(248, 206);
  g.lineTo(262, 132);
  g.lineTo(312, 188);
  g.closePath();
  g.moveTo(392, 206);
  g.lineTo(378, 132);
  g.lineTo(328, 188);
  g.closePath();
  g.fill();
  g.strokeStyle = '#c86a18';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(320, 175);
  g.lineTo(320, 230);
  g.moveTo(280, 190);
  g.quadraticCurveTo(300, 210, 300, 230);
  g.moveTo(360, 190);
  g.quadraticCurveTo(340, 210, 340, 230);
  g.stroke();
  g.fillStyle = '#fff1dc';
  g.beginPath();
  g.ellipse(320, 310, 58, 46, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.stroke();
  g.fillStyle = '#fff';
  g.lineWidth = 8;
  g.beginPath();
  g.ellipse(278, 262, 28, 32, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.ellipse(362, 262, 28, 32, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#2f8a42';
  g.beginPath();
  g.ellipse(286, 268, 12, 18, 0, 0, Math.PI * 2);
  g.ellipse(370, 268, 12, 18, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e25b4a';
  g.beginPath();
  g.moveTo(320, 300);
  g.lineTo(304, 320);
  g.lineTo(336, 320);
  g.closePath();
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(270, 318);
  g.lineTo(170, 300);
  g.moveTo(270, 336);
  g.lineTo(175, 348);
  g.moveTo(370, 318);
  g.lineTo(470, 300);
  g.moveTo(370, 336);
  g.lineTo(465, 348);
  g.stroke();
}

function drawDog(g: CanvasRenderingContext2D): void {
  g.lineJoin = 'round';
  g.strokeStyle = INK;
  g.lineWidth = 12;
  g.fillStyle = '#d0893a';
  g.beginPath();
  g.ellipse(330, 455, 160, 90, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#f2d2a4';
  g.beginPath();
  g.ellipse(330, 470, 80, 48, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d0893a';
  g.beginPath();
  g.ellipse(200, 230, 52, 100, -0.45, 0, Math.PI * 2);
  g.ellipse(440, 230, 52, 100, 0.45, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#f2d2a4';
  g.beginPath();
  g.ellipse(188, 250, 24, 62, -0.45, 0, Math.PI * 2);
  g.ellipse(452, 250, 24, 62, 0.45, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(320, 280, 112, 0, Math.PI * 2);
  g.fillStyle = '#d0893a';
  g.fill();
  g.stroke();
  g.fillStyle = '#f2d2a4';
  g.beginPath();
  g.ellipse(320, 325, 64, 48, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.ellipse(320, 318, 16, 12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.beginPath();
  g.arc(278, 258, 22, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(366, 258, 22, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(284, 262, 10, 0, Math.PI * 2);
  g.arc(372, 262, 10, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.beginPath();
  g.arc(320, 352, 24, 0.2, Math.PI - 0.2);
  g.stroke();
  g.fillStyle = '#e25b4a';
  g.beginPath();
  g.ellipse(320, 368, 16, 22, 0, 0, Math.PI);
  g.fill();
}

function drawPig(g: CanvasRenderingContext2D): void {
  g.lineJoin = 'round';
  g.strokeStyle = INK;
  g.lineWidth = 12;
  g.fillStyle = '#f7b6c8';
  g.beginPath();
  g.ellipse(330, 450, 165, 100, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(320, 280, 120, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.ellipse(220, 190, 40, 52, -0.4, 0, Math.PI * 2);
  g.ellipse(420, 190, 40, 52, 0.4, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#f48aaa';
  g.beginPath();
  g.ellipse(320, 325, 62, 46, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#e07a98';
  g.beginPath();
  g.ellipse(300, 328, 12, 16, 0, 0, Math.PI * 2);
  g.ellipse(342, 328, 12, 16, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.beginPath();
  g.arc(276, 250, 20, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(364, 250, 20, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(280, 252, 9, 0, Math.PI * 2);
  g.arc(368, 252, 9, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.beginPath();
  g.arc(320, 370, 20, 0.2, Math.PI - 0.2);
  g.stroke();
  g.strokeStyle = '#f48aaa';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(500, 430, 28, 0.4, Math.PI * 1.4);
  g.stroke();
}

function face(g: CanvasRenderingContext2D, x: number, y: number): void {
  g.fillStyle = INK;
  g.beginPath();
  g.arc(x - 40, y - 10, 12, 0, Math.PI * 2);
  g.arc(x + 40, y - 10, 12, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.beginPath();
  g.arc(x, y + 20, 28, 0.2, Math.PI - 0.2);
  g.stroke();
}

export function sentenceBanner(before: string, after: string): THREE.Mesh {
  const cw = 1234;
  const ch = 387;
  // Writing box sits on the parchment, clear of both wooden rollers.
  const face: FaceBox = {
    x: Math.round(cw * 0.205),
    y: Math.round(ch * 0.22),
    w: Math.round(cw * 0.59),
    h: Math.round(ch * 0.54),
  };
  const { g: measure } = ctx2d(8, 8);
  const minBlankWorld = 1.18;
  const worldH = 1.1;
  let worldW = 4.5;
  let size = Math.floor(face.h * 0.64);
  let beforeW = 0;
  let afterW = 0;
  let gap = 0;
  let blankPx = 0;
  const usable = face.w - 28;

  const measureLayout = (wWorld: number, fontPx: number) => {
    measure.font = `700 ${fontPx}px Starlace, Andika, sans-serif`;
    const bw = measure.measureText(before).width;
    const aw = measure.measureText(after).width;
    const gp = Math.max(18, fontPx * 0.2);
    const bp = (minBlankWorld / wWorld) * cw;
    return { bw, aw, gp, bp, total: bw + gp + bp + gp + aw };
  };

  while (worldW < 5.2) {
    const trial = measureLayout(worldW, size);
    if (trial.total <= usable) break;
    worldW = Math.min(5.2, worldW + 0.12);
  }
  while (size > 40) {
    const trial = measureLayout(worldW, size);
    if (trial.total <= usable) break;
    size -= 2;
  }
  const laid = measureLayout(worldW, size);
  beforeW = laid.bw;
  afterW = laid.aw;
  gap = laid.gp;
  blankPx = laid.bp;
  if (laid.total > usable) {
    const minBlankPx = (1.15 / worldW) * cw;
    blankPx = Math.max(minBlankPx, blankPx - (laid.total - usable));
  }

  const total = beforeW + gap + blankPx + gap + afterW;
  const start = face.x + (face.w - total) / 2;
  const blankLeft = start + beforeW + gap;
  const blankHpx = face.h * 0.8;
  const blankY = face.y + (face.h - blankHpx) / 2;
  const blankCx = blankLeft + blankPx / 2;

  const mesh = paintedBoard('scroll', cw, ch, worldW, worldH, (g) => {
    g.fillStyle = INK;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.font = `700 ${size}px Starlace, Andika, sans-serif`;
    const midY = face.y + face.h / 2;
    g.fillText(before, start, midY);
    carve(g, { x: blankLeft, y: blankY, w: blankPx, h: blankHpx }, 22);
    g.fillStyle = INK;
    g.font = `700 ${size}px Starlace, Andika, sans-serif`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(after, blankLeft + blankPx + gap, midY);
  });
  mesh.userData.blankX = (blankCx / cw - 0.5) * worldW;
  mesh.userData.blankW = (blankPx / cw) * worldW;
  mesh.userData.blankH = (blankHpx / ch) * worldH;
  return mesh;
}

export function mat(w: number, h: number): THREE.Mesh {
  const { canvas, g } = ctx2d(512, 320);
  g.fillStyle = 'rgba(255, 246, 228, 0.9)';
  rounded(g, 12, 12, 488, 296, 40);
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = GOLD;
  g.stroke();
  const mesh = plane(canvasTexture(canvas), w, h, 3);
  mesh.userData.disposeMap = true;
  return mesh;
}

function imageSize(tex: THREE.Texture): { width: number; height: number } {
  const image = tex.image as { width: number; height: number };
  return { width: image.width, height: image.height };
}

function basic(mesh: THREE.Mesh): THREE.MeshBasicMaterial {
  return mesh.material as THREE.MeshBasicMaterial;
}

export function guide(which: 'nim' | 'bop', height: number): THREE.Group {
  const tex = textures[which];
  const size = imageSize(tex);
  const aspect = size.width / size.height;
  const foot = which === 'bop' ? 868 / 871 : 987 / 990;
  const mesh = plane(tex, height * aspect, height, 3);
  basic(mesh).alphaTest = 0.35;
  matNoTintShared(mesh);
  mesh.position.y = height * (foot - 0.5);
  const root = new THREE.Group();
  root.add(mesh);
  const shadow = softShadow(height * aspect * 0.55);
  shadow.position.y = 0.03;
  shadow.position.z = -0.05;
  root.add(shadow);
  return root;
}

function matNoTintShared(mesh: THREE.Mesh): void {
  const mat = mesh.material as THREE.MeshBasicMaterial;
  mat.userData.noTint = true;
}

function softShadow(w: number): THREE.Mesh {
  const { canvas, g } = ctx2d(320, 160);
  const grd = g.createRadialGradient(160, 78, 10, 160, 78, 148);
  grd.addColorStop(0, 'rgba(52, 32, 12, 0.5)');
  grd.addColorStop(0.4, 'rgba(52, 32, 12, 0.22)');
  grd.addColorStop(1, 'rgba(52, 32, 12, 0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 320, 160);
  const mesh = plane(canvasTexture(canvas), w * 1.08, w * 0.4, 2);
  mesh.userData.disposeMap = true;
  (mesh.material as THREE.MeshBasicMaterial).userData.noTint = true;
  return mesh;
}

export function shelfProp(): THREE.Group {
  const tex = textures.shelf;
  const size = imageSize(tex);
  const height = 6.15;
  const width = height * (size.width / size.height);
  const art = plane(tex, width, height, 3);
  basic(art).alphaTest = 0.2;
  (art.material as THREE.MeshBasicMaterial).userData.noTint = true;
  const root = new THREE.Group();
  root.add(art);
  root.userData.width = width;
  root.userData.height = height;
  root.userData.feetV = 1095 / 1152;
  return root;
}

export function feetMarker(): THREE.Mesh {
  const { canvas, g } = ctx2d(480, 240);
  const boot = (x: number) => {
    g.fillStyle = '#5b3d9a';
    rounded(g, x, 70, 150, 130, 28);
    g.fill();
    g.fillStyle = '#f0c14a';
    g.beginPath();
    g.arc(x + 75, 78, 36, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = INK;
    rounded(g, x, 70, 150, 130, 28);
    g.stroke();
    g.beginPath();
    g.arc(x + 75, 78, 36, 0, Math.PI * 2);
    g.stroke();
  };
  boot(40);
  boot(270);
  const mesh = plane(canvasTexture(canvas), 1.35, 0.68, 6);
  mesh.userData.disposeMap = true;
  basic(mesh).userData.noTint = true;
  return mesh;
}

export function glowPad(w: number, h: number): THREE.Mesh {
  const { canvas, g } = ctx2d(512, 512);
  const grd = g.createRadialGradient(256, 256, 30, 256, 256, 240);
  grd.addColorStop(0, 'rgba(255, 220, 130, 0.7)');
  grd.addColorStop(0.45, 'rgba(231, 179, 74, 0.32)');
  grd.addColorStop(1, 'rgba(231, 179, 74, 0)');
  g.fillStyle = grd;
  rounded(g, 36, 36, 440, 440, 110);
  g.fill();
  const mesh = plane(canvasTexture(canvas), w, h, 2);
  mesh.userData.disposeMap = true;
  const mat = mesh.material as THREE.MeshBasicMaterial;
  mat.userData.glow = true;
  mat.opacity = 0;
  return mesh;
}

export function plate(w: number, h: number): THREE.Mesh {
  const mesh = plane(null, w, h, 4);
  const mat = mesh.material as THREE.MeshBasicMaterial;
  mat.opacity = 0;
  mat.userData.noTint = true;
  return mesh;
}

export type { ShapeName };
