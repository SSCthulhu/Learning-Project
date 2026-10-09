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
let hudClickables: Clickable[] = [];
let hoverRoot: THREE.Object3D | null = null;
let guideRoots: THREE.Object3D[] = [];
let onGuide: (() => void) | null = null;
let onBop: (() => void) | null = null;
let onEmpty: (() => void) | null = null;
let hoverTalk: ((text: string) => void) | null = null;
let talking = false;
let beakAcc = 0;
let beakStep = 0;
const BEAK_ORDER = [0, 1, 2, 1];
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

export function asset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

export async function preload(): Promise<void> {
  const files: Record<string, string> = {
    village: asset('/art/village.png'),
    grove: asset('/art/grove.png'),
    market: asset('/art/market.png'),
    songkeep: asset('/art/songkeep.png'),
    citadel: asset('/art/citadel.png'),
    nim: asset('/art/nim.png'),
    nimTalk1: asset('/art/nim-talk-1.png'),
    nimTalk2: asset('/art/nim-talk-2.png'),
    bop: asset('/art/bop.png'),
    shelf: asset('/art/market-shelf.png'),
    feet: asset('/art/little-feet.png'),
    tile: asset('/art/ui/tile.png'),
    signboard: asset('/art/ui/sign.png'),
    coincard: asset('/art/ui/coin.png'),
    stone: asset('/art/ui/stone.png'),
    scroll: asset('/art/ui/scroll.png'),
  };
  for (const name of ['cat', 'dog', 'pig', 'sun', 'bus', 'cup', 'hat', 'map', 'bed', 'apple', 'moon', 'fish', 'star']) {
    files[name] = asset(`/art/bits/${name}.png`);
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
  document.documentElement.style.setProperty('--place', `url("${asset(`/art/${key}.png`)}")`);
}

function listed(root: THREE.Object3D): boolean {
  return clickables.some((item) => item.root === root) || hudClickables.some((item) => item.root === root);
}

export function setClickables(list: Clickable[]): void {
  clickables = list;
  if (hoverRoot && !listed(hoverRoot)) paintHover(null);
}

export function setHud(list: Clickable[]): void {
  hudClickables = list;
  if (hoverRoot && !listed(hoverRoot)) paintHover(null);
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
  slot = 0,
): void {
  const vis = visibleAt(z);
  const view = renderer.domElement.getBoundingClientRect();
  const vw = Math.max(1, view.width);
  const vh = Math.max(1, view.height);
  marginPx *= vh / 800;
  const su = worldW / vis.w;
  const sv = worldH / vis.h;
  const gap = 10 / vw;
  const step = su + gap;
  const mu = marginPx / vw;
  const mv = marginPx / vh;
  const u = side === 'left' ? mu + su / 2 + slot * step : 1 - mu - su / 2 - slot * step;
  const v = mv + sv / 2;
  obj.position.set((u - 0.5) * vis.w, (0.5 - v) * vis.h, z);
}

export function setGuides(roots: THREE.Object3D[], replay: () => void): void {
  guideRoots = roots;
  onGuide = replay;
  for (const root of roots) root.userData.homeY = root.position.y;
}

export function setBopTap(fn: (() => void) | null): void {
  onBop = fn;
}

export function setEmptyTap(fn: (() => void) | null): void {
  onEmpty = fn;
}

export function setTalking(on: boolean): void {
  talking = on;
  if (!on) {
    beakAcc = 0;
    beakStep = 0;
    showBeak(0);
  }
}

function showBeak(frame: number): void {
  const key = frame === 1 ? 'nimTalk1' : frame === 2 ? 'nimTalk2' : 'nim';
  const tex = textures[key];
  if (!tex) return;
  for (const root of guideRoots) {
    if (root.userData.who !== 'nim') continue;
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !mesh.userData.beak) return;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (mat.map === tex) return;
      mat.map = tex;
      mat.needsUpdate = true;
    });
  }
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
  const text = [...hudClickables, ...clickables].find((item) => item.root === root)?.hover;
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
  const hudHit = pick(hudClickables.map((item) => item.root));
  const hit = hudHit ?? pick(clickables.map((item) => item.root));
  if (hit !== hoverRoot) paintHover(hit);
}

function onDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  ndc(event);
  const hudHit = pick(hudClickables.map((item) => item.root));
  if (hudHit) {
    hudClickables.find((item) => item.root === hudHit)?.click();
    return;
  }
  const roots = clickables.map((c) => c.root);
  const hit = pick(roots);
  if (hit) {
    clickables.find((c) => c.root === hit)?.click();
    return;
  }
  const guide = pick(guideRoots);
  if (guide) {
    if (guide.userData.who === 'bop') onBop?.();
    else onGuide?.();
    return;
  }
  onEmpty?.();
}

export function bindInput(): void {
  const el = renderer.domElement;
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerdown', onDown);
}

export function resize(): void {
  const rect = renderer.domElement.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  let dpr = window.devicePixelRatio || 1;
  const maxPixels = 3840 * 2160;
  if (w * h * dpr * dpr > maxPixels) dpr = Math.sqrt(maxPixels / (w * h));
  renderer.setPixelRatio(Math.min(2, Math.max(1, dpr)));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  resizeHook?.();
}

let cheer = 0;
let shake = 0;

type Spark = { mesh: THREE.Mesh; vx: number; vy: number; life: number };

const sparks: Spark[] = [];
let starTex: THREE.Texture | null = null;
let moteTex: THREE.Texture | null = null;
const motes: { mesh: THREE.Mesh; seed: number }[] = [];

function dotTexture(color: string): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('canvas');
  const glow = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  glow.addColorStop(0, color);
  glow.addColorStop(0.45, color);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 64, 64);
  return canvasTexture(canvas);
}

function burstStars(): void {
  if (!starTex) starTex = dotTexture('#ffe08a');
  for (let i = 0; i < 12; i++) {
    const mesh = plane(starTex, 0.22, 0.22, 12);
    (mesh.material as THREE.MeshBasicMaterial).depthTest = false;
    mesh.position.set((Math.random() - 0.5) * 2.4, 0.2 + Math.random() * 0.6, 1.4);
    scene.add(mesh);
    const angle = (i / 12) * Math.PI * 2;
    sparks.push({
      mesh,
      vx: Math.cos(angle) * (1.4 + Math.random()),
      vy: 1.1 + Math.random() * 1.4,
      life: 1,
    });
  }
}

function spawnMotes(): void {
  if (motes.length) return;
  if (!moteTex) moteTex = dotTexture('rgba(255, 236, 170, 0.95)');
  for (let i = 0; i < 14; i++) {
    const mesh = plane(moteTex, 0.18, 0.18, 1);
    (mesh.material as THREE.MeshBasicMaterial).depthTest = false;
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.75;
    scene.add(mesh);
    motes.push({ mesh, seed: i * 1.7 });
  }
}

export function celebrate(): void {
  cheer = 1;
  burstStars();
}

export function giggle(): void {
  cheer = Math.max(cheer, 0.48);
}

export function encourage(): void {
  shake = 1;
}

export function wobble(root: THREE.Object3D): void {
  root.userData.wobble = 1;
}

export function start(): void {
  resize();
  spawnMotes();
  const frame = renderer.domElement.parentElement;
  if (frame) new ResizeObserver(() => resize()).observe(frame);
  window.addEventListener('resize', resize);
  let clock = 0;
  const loop = () => {
    requestAnimationFrame(loop);
    clock += 0.016;
    if (cheer > 0) cheer = Math.max(0, cheer - 0.018);
    if (shake > 0) shake = Math.max(0, shake - 0.03);
    if (talking) {
      beakAcc += 0.016;
      if (beakAcc >= 0.13) {
        beakAcc = 0;
        beakStep = (beakStep + 1) % BEAK_ORDER.length;
        showBeak(BEAK_ORDER[beakStep]);
      }
    }
    guideRoots.forEach((root) => {
      const home = root.userData.homeY;
      if (typeof home !== 'number') return;
      const who = root.userData.who as string | undefined;
      let y = home;
      if (who === 'bop') {
        const hop = Math.sin(clock * 1.1);
        y += Math.max(0, hop) * hop * 0.02;
        root.rotation.z = Math.sin(clock * 0.55) * 0.008;
        if (cheer > 0) y += Math.sin((1 - cheer) * Math.PI) * 0.16;
        if (shake > 0) root.rotation.z = Math.sin(shake * 46) * 0.04 * shake;
      } else {
        y += Math.sin(clock * 0.7) * 0.01;
        root.rotation.z = Math.sin(clock * 0.4) * 0.004;
      }
      root.position.y = y;
    });
    for (const child of stage.children) {
      const w = child.userData.wobble as number | undefined;
      if (w == null || w <= 0) continue;
      if (child.userData.baseRot == null) child.userData.baseRot = child.rotation.z;
      const next = w - 0.045;
      child.userData.wobble = next;
      if (next <= 0) {
        child.rotation.z = child.userData.baseRot as number;
        delete child.userData.baseRot;
        child.userData.wobble = 0;
      } else {
        child.rotation.z = (child.userData.baseRot as number) + Math.sin(next * 28) * 0.1 * next;
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const spark = sparks[i];
      spark.life -= 0.02;
      spark.vy -= 0.045;
      spark.mesh.position.x += spark.vx * 0.016;
      spark.mesh.position.y += spark.vy * 0.016;
      (spark.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, spark.life);
      if (spark.life <= 0) {
        scene.remove(spark.mesh);
        spark.mesh.geometry.dispose();
        (spark.mesh.material as THREE.Material).dispose();
        sparks.splice(i, 1);
      }
    }
    motes.forEach((mote, index) => {
      const s = mote.seed;
      const lane = index % 2 === 0 ? 0.05 : 0.86;
      const u = lane + ((index * 0.04 + clock * 0.02) % 0.1);
      const v = 0.12 + (Math.sin(clock * 0.45 + s) * 0.5 + 0.5) * 0.72;
      mote.mesh.position.copy(uv(u, v, 0.18));
      const mat = mote.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + (Math.sin(clock * 1.7 + s) * 0.5 + 0.5) * 0.45;
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
