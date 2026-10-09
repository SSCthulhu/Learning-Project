import * as THREE from 'three';

export const WORLD_W = 16;
export const WORLD_H = 9;

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(38, WORLD_W / WORLD_H, 0.1, 80);
export const stage = new THREE.Group();

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('view') as HTMLCanvasElement,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0xf6e2b0, 1);

scene.add(stage);

const loader = new THREE.TextureLoader();
export const textures: Record<string, THREE.Texture> = {};

const backdropGeo = new THREE.PlaneGeometry(WORLD_W, WORLD_H);
const backdropMat = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false });
const backdrop = new THREE.Mesh(backdropGeo, backdropMat);
backdrop.renderOrder = 0;
backdrop.position.z = 0;
scene.add(backdrop);

export type Clickable = {
  root: THREE.Object3D;
  click: () => void;
  hover?: string;
};

let clickables: Clickable[] = [];
let hoverRoot: THREE.Object3D | null = null;
let guideRoots: THREE.Object3D[] = [];
let onGuide: (() => void) | null = null;
let hoverTalk: ((text: string) => void) | null = null;
let hoverTimer = 0;
let lastHoverText: string | null = null;
const extraLit = new Set<THREE.Object3D>();
let resizeHook: (() => void) | null = null;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const HOVER_WAIT = 380;

const DIST = (WORLD_H / 2) / Math.tan(THREE.MathUtils.degToRad(38) / 2);
camera.position.set(0, 0, DIST);
camera.lookAt(0, 0, 0);

export function uv(u: number, v: number, z = 0): THREE.Vector3 {
  return new THREE.Vector3((u - 0.5) * WORLD_W, (0.5 - v) * WORLD_H, z);
}

export function place(obj: THREE.Object3D, u: number, v: number, z = 0.4): THREE.Object3D {
  const p = uv(u, v, z);
  obj.position.set(p.x, p.y, p.z);
  return obj;
}

export async function preload(): Promise<void> {
  const files: Record<string, string> = {
    village: '/art/village.png',
    grove: '/art/grove.png',
    market: '/art/market.png',
    songkeep: '/art/songkeep.png',
    citadel: '/art/citadel.png',
    nim: '/art/nim.png',
    bop: '/art/bop.png',
    shelf: '/art/market-shelf.png',
    feet: '/art/little-feet.png',
    tile: '/art/ui/tile.png',
    signboard: '/art/ui/sign.png',
    coincard: '/art/ui/coin.png',
    stone: '/art/ui/stone.png',
    scroll: '/art/ui/scroll.png',
  };
  for (const name of ['cat', 'dog', 'pig', 'sun', 'bus', 'cup', 'hat', 'map', 'bed', 'apple', 'moon', 'fish', 'star']) {
    files[name] = `/art/bits/${name}.png`;
  }
  const entries = Object.entries(files);
  for (let i = 0; i < entries.length; i += 4) {
    const batch = entries.slice(i, i + 4);
    await Promise.all(batch.map(([key, url]) => loadTexture(key, url)));
  }
}

function loadTexture(key: string, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        tex.needsUpdate = true;
        textures[key] = tex;
        resolve();
      },
      undefined,
      () => reject(new Error(url)),
    );
  });
}

export function setBackdrop(key: string): void {
  const tex = textures[key];
  if (!tex) return;
  backdropMat.map = tex;
  backdropMat.needsUpdate = true;
}

export function setClickables(list: Clickable[]): void {
  clickables = list;
  if (hoverRoot && !list.some((c) => c.root === hoverRoot)) {
    paintHover(null);
  }
}

export function setHoverTalk(fn: ((text: string) => void) | null): void {
  hoverTalk = fn;
}

export function setEmphasis(root: THREE.Object3D, on: boolean): void {
  if (on) extraLit.add(root);
  else extraLit.delete(root);
  tint(root, on || root === hoverRoot);
}

export function onWorldResize(fn: (() => void) | null): void {
  resizeHook = fn;
}

export function visibleAt(z: number): { w: number; h: number } {
  const dist = Math.max(0.2, camera.position.z - z);
  const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * dist;
  return { w: h * camera.aspect, h };
}

export function placeHud(
  obj: THREE.Object3D,
  side: 'left' | 'right',
  z: number,
  worldW: number,
  worldH: number,
  marginPx = 16,
): void {
  const vis = visibleAt(z);
  const vw = Math.max(1, window.innerWidth);
  const vh = Math.max(1, window.innerHeight);
  const su = worldW / vis.w;
  const sv = worldH / vis.h;
  const mu = marginPx / vw;
  const mv = marginPx / vh;
  const u = side === 'left' ? mu + su / 2 : 1 - mu - su / 2;
  const v = mv + sv / 2;
  obj.position.set((u - 0.5) * vis.w, (0.5 - v) * vis.h, z);
}

export function setGuides(roots: THREE.Object3D[], replay: () => void): void {
  guideRoots = roots;
  onGuide = replay;
  for (const root of roots) root.userData.homeY = root.position.y;
}

export function clearGroup(group: THREE.Group): void {
  const kids = [...group.children];
  for (const child of kids) {
    group.remove(child);
    disposeTree(child);
  }
}

function disposeTree(obj: THREE.Object3D): void {
  obj.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      const mapped = mat as THREE.MeshBasicMaterial;
      if (mesh.userData.disposeMap && mapped.map) mapped.map.dispose();
      mat.dispose();
    }
  });
}

function paintHover(root: THREE.Object3D | null): void {
  if (hoverRoot && hoverRoot !== root) tint(hoverRoot, extraLit.has(hoverRoot));
  hoverRoot = root;
  if (root) tint(root, true);
  renderer.domElement.style.cursor = root ? 'pointer' : 'default';
  window.clearTimeout(hoverTimer);
  if (!root) {
    lastHoverText = null;
    return;
  }
  const text = clickables.find((item) => item.root === root)?.hover;
  if (!text || text === lastHoverText) return;
  hoverTimer = window.setTimeout(() => {
    if (hoverRoot !== root) return;
    lastHoverText = text;
    hoverTalk?.(text);
  }, HOVER_WAIT);
}

function tint(root: THREE.Object3D, on: boolean): void {
  const lit = on || extraLit.has(root);
  if (!root.userData.noScale) {
    if (root.userData.baseScale == null) root.userData.baseScale = root.scale.x || 1;
    const base = root.userData.baseScale as number;
    root.scale.setScalar(lit ? base * 1.08 : base);
  }
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    if (mat.userData.glow) {
      mat.opacity = lit ? 0.9 : 0;
      return;
    }
    if (!mat?.color || mat.userData.noTint) return;
    if (mat.opacity === 0 && !mat.userData.glow) return;
    mat.color.set(lit ? 0xffe090 : 0xffffff);
  });
}

function ndc(event: PointerEvent): void {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function pick(list: THREE.Object3D[]): THREE.Object3D | null {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(list, true);
  if (!hits.length) return null;
  let node: THREE.Object3D | null = hits[0].object;
  while (node) {
    if (list.includes(node)) return node;
    node = node.parent;
  }
  return null;
}

function onMove(event: PointerEvent): void {
  ndc(event);
  const roots = clickables.map((c) => c.root);
  const hit = pick(roots);
  if (hit !== hoverRoot) paintHover(hit);
}

function onDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  ndc(event);
  const roots = clickables.map((c) => c.root);
  const hit = pick(roots);
  if (hit) {
    clickables.find((c) => c.root === hit)?.click();
    return;
  }
  if (onGuide && pick(guideRoots)) onGuide();
}

export function bindInput(): void {
  const el = renderer.domElement;
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerdown', onDown);
}

export function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  resizeHook?.();
}

let cheer = 0;

export function celebrate(): void {
  cheer = 1;
}

export function start(): void {
  resize();
  window.addEventListener('resize', resize);
  let clock = 0;
  const loop = () => {
    requestAnimationFrame(loop);
    clock += 0.016;
    if (cheer > 0) cheer = Math.max(0, cheer - 0.02);
    const bounce = cheer > 0 ? Math.sin((1 - cheer) * Math.PI) * 0.42 : 0;
    guideRoots.forEach((root, index) => {
      const home = root.userData.homeY;
      if (typeof home !== 'number') return;
      root.position.y = home + Math.sin(clock * 1.7 + index * 1.4) * 0.03 + bounce;
    });
    renderer.render(scene, camera);
  };
  loop();
}

export function plane(map: THREE.Texture | null, w: number, h: number, order = 3): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.renderOrder = order;
  return mesh;
}

export function canvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
