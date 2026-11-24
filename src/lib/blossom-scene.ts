import {
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cycleDurationMs, restPose, rotationReturnWeight, sampleSequence, wrapDegrees } from './blossom-sequence';

const turn = Math.PI * 2;
const glyphs = '.:-=+*#%@';
const radiansPerDegree = Math.PI / 180;
const minimumFrameTime = 32;
type Rotation = { x: number; y: number; z: number };

function drawCharacters(
  source: HTMLCanvasElement,
  sampler: CanvasRenderingContext2D,
  display: CanvasRenderingContext2D,
  width: number,
  height: number,
  ink: string,
  highlightInk = ink,
) {
  const { width: columns, height: rows } = sampler.canvas;
  sampler.clearRect(0, 0, columns, rows);
  sampler.drawImage(source, 0, 0, columns, rows);
  const { data } = sampler.getImageData(0, 0, columns, rows);
  const cellWidth = width / columns;
  const cellHeight = height / rows;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = 4 * (row * columns + column);
      const coverage = data[index + 3];
      if (coverage < 40) continue;

      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const luminance = (.2126 * red + .7152 * green + .0722 * blue) / 255;
      const shade = Math.max(0, Math.min(1, .5 + (luminance - .5) * 1.45));
      const character = coverage < 130 ? '.' : glyphs[Math.round(shade * (glyphs.length - 1))];
      // The violet material on the stamens selects the accent ink after sampling.
      display.fillStyle = blue - red > 18 ? highlightInk : ink;
      display.globalAlpha = .68 + .32 * shade;
      display.fillText(character, (column + .5) * cellWidth, (row + .5) * cellHeight);
    }
  }
}

function petalGeometry() {
  const steps = 32;
  const strips = 24;
  const points: number[] = [];
  const colors: number[] = [];
  const faces: number[] = [];
  const heart = new Color('#692247');
  const tip = new Color('#f7c1d6');
  const color = new Color();

  for (let row = 0; row <= steps; row++) {
    const t = row / steps;
    const width = .37 * Math.sin(Math.PI * t ** 1.46) ** .58 + .018 + .11 * t ** 5;

    for (let column = 0; column <= strips; column++) {
      const u = column / strips * 2 - 1;
      const notch = .15 * Math.exp(-(u ** 2) * 7) * t ** 5;
      const folds = .018 * Math.cos(u * 10 + t * 4) * t;
      points.push(
        u * width + .044 * Math.sin(Math.PI * t),
        .015 + 1.08 * t - notch,
        .23 * t ** 2 - .21 * u ** 2 * Math.sin(Math.PI * t) + folds,
      );

      const tone = Math.min(1, .1 + .92 * t + .1 * u ** 2);
      const vein = 1 - .07 * Math.cos(u * (17 + t * 9)) ** 4 * Math.sin(Math.PI * t);
      color.copy(heart).lerp(tip, tone).multiplyScalar(vein);
      colors.push(color.r, color.g, color.b);

      if (row < steps && column < strips) {
        const index = row * (strips + 1) + column;
        faces.push(index, index + 1, index + strips + 1, index + 1, index + strips + 2, index + strips + 1);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  return geometry;
}

function blossom(geometry: BufferGeometry, material: MeshStandardMaterial, seed: number) {
  const flower = new Group();

  for (let i = 0; i < 5; i++) {
    const petal = new Mesh(geometry, material);
    petal.rotation.set(.055 * Math.sin(i + seed), 0, i * turn / 5 + seed);
    petal.scale.set(1 + .075 * Math.sin(i * 2 + seed), 1 + .064 * Math.cos(i * 3 + seed), 1);
    flower.add(petal);
  }

  const center = new Mesh(new SphereGeometry(.103, 16, 12), new MeshStandardMaterial({ color: '#6b3bb2' }));
  center.scale.z = .54;
  center.position.z = .048;
  flower.add(center);

  const filamentGeometry = new SphereGeometry(1, 8, 6);
  const filamentMaterial = new MeshStandardMaterial({ color: '#fad3e0', roughness: .65 });
  const pollenMaterial = new MeshStandardMaterial({ color: '#7d4ede', roughness: .65 });

  const stamenCount = 24;
  const stems = new InstancedMesh(filamentGeometry, filamentMaterial, stamenCount);
  const tips = new InstancedMesh(filamentGeometry, pollenMaterial, stamenCount);
  const pose = new Object3D();

  for (let i = 0; i < stamenCount; i++) {
    const angle = i * 2.39996 + seed;
    const spread = .075 + .147 * Math.sqrt(i / stamenCount);
    const height = .118 + .095 * (.5 + .5 * Math.cos(i * 1.4 + seed));
    const base = new Vector3(Math.cos(angle) * .048, Math.sin(angle) * .048, .06);
    const end = new Vector3(Math.cos(angle) * spread, Math.sin(angle) * spread, height);
    pose.position.copy(base).lerp(end, .5);
    pose.scale.set(.008, .008, base.distanceTo(end) / 2);
    pose.lookAt(end);
    pose.updateMatrix();
    stems.setMatrixAt(i, pose.matrix);

    pose.position.copy(end);
    pose.scale.set(.027, .02, .02);
    pose.rotation.set(0, 0, angle);
    pose.updateMatrix();
    tips.setMatrixAt(i, pose.matrix);
  }

  flower.add(stems, tips);
  return flower;
}

export async function mountBlossom(panel: HTMLElement, petalUrl: string) {
  const output = panel.querySelector<HTMLCanvasElement>('[data-blossom-ascii]');
  const display = output?.getContext('2d');
  const sampler = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!output || !display || !sampler) return;

  const source = document.createElement('canvas');
  const renderer = new WebGLRenderer({ canvas: source, alpha: true, antialias: true });

  const scene = new Scene();
  const camera = new OrthographicCamera();
  camera.position.z = 6;

  const key = new DirectionalLight('#fff1f9', 2.5);
  key.position.set(-3, 4, 6);
  const rim = new DirectionalLight('#d7a4ff', 1.45);
  rim.position.set(4, -2, -1);
  scene.add(key, rim, new HemisphereLight('#fff0f9', '#843a77', 1.45), new AmbientLight('#e6aed6', .34));

  const placement = new Group();
  const flowers = new Group();
  const petals = new Group();
  placement.add(flowers, petals);
  scene.add(placement);

  const geometry = petalGeometry();
  const material = new MeshStandardMaterial({
    vertexColors: true,
    side: DoubleSide,
    roughness: .74,
  });

  const main = blossom(geometry, material, .06);
  main.rotation.set(-.19, -.22, -.25);
  main.position.set(.12, -.04, .15);

  const upper = blossom(geometry, material, .42);
  upper.scale.setScalar(.34);
  upper.position.set(-1.26, .69, -.2);
  upper.rotation.set(.42, -.36, .13);

  const lower = blossom(geometry, material, .31);
  lower.scale.setScalar(.27);
  lower.position.set(1.26, -.8, -.24);
  lower.rotation.set(-.44, .36, -.54);

  flowers.add(main, upper, lower);
  try {
    const { scene: asset } = await new GLTFLoader().loadAsync(petalUrl);
    const center = new Box3().setFromObject(asset).getCenter(new Vector3());
    asset.position.sub(center);
    const floatingPetal = new Group();
    floatingPetal.add(asset);
    floatingPetal.position.set(1.21, .74, 0);
    floatingPetal.rotation.set(1.16, .38, -.23);
    floatingPetal.scale.setScalar(.37);
    const second = floatingPetal.clone();
    second.position.set(-1.14, -.72, -.05);
    second.rotation.set(1.75, -.3, .91);
    second.scale.setScalar(.31);
    petals.add(floatingPetal, second);
  } catch {
    // A flor principal é gerada localmente e independe do arquivo da pétala.
  }

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let previousTime: number | undefined;
  let elapsedMs = 0;
  let adjustment: Rotation = { x: 0, y: 0, z: 0 };
  let releasedAt: number | undefined;
  let drag: { id: number; x: number; y: number; rotation: Rotation; roll: boolean } | undefined;
  let visible = false;
  let lost = false;
  let width = 0;
  let height = 0;
  let flowerInk = '';
  let petalInk = '';

  const readInk = () => {
    const style = getComputedStyle(panel);
    flowerInk = style.getPropertyValue('--flower-ink').trim();
    petalInk = style.getPropertyValue('--petal-ink').trim();
  };

  const rotationAt = (time: number): Rotation => {
    const seconds = releasedAt === undefined ? 0 : Math.max(0, time - releasedAt) / 1_000;
    const weight = seconds >= 3 ? 0 : rotationReturnWeight(seconds);
    return { x: adjustment.x * weight, y: adjustment.y * weight, z: adjustment.z * weight };
  };

  const render = (time = performance.now()) => {
    if (lost || !width || !height) return;
    const pose = motion.matches ? restPose : sampleSequence(elapsedMs);
    const rotation = rotationAt(time);
    placement.position.set(pose.x, pose.y, 0);
    placement.scale.setScalar(pose.scale);
    placement.rotation.set(
      (pose.rotationX + rotation.x) * radiansPerDegree,
      (pose.rotationY + rotation.y) * radiansPerDegree,
      (pose.rotationZ + rotation.z) * radiansPerDegree,
    );

    display.clearRect(0, 0, width, height);
    if (petals.children.length) {
      flowers.visible = false;
      petals.visible = true;
      renderer.render(scene, camera);
      drawCharacters(source, sampler, display, width, height, petalInk);
    }

    flowers.visible = true;
    petals.visible = false;
    renderer.render(scene, camera);
    drawCharacters(source, sampler, display, width, height, flowerInk, petalInk);
  };
  const resize = () => {
    width = panel.clientWidth;
    height = panel.clientHeight;
    if (!width || !height) return;
    const halfHeight = Math.max(1.45, 2.02 * height / width);
    camera.left = -halfHeight * width / height;
    camera.right = -camera.left;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();

    const fontSize = Math.max(8, Math.min(11, width / 45));
    sampler.canvas.width = Math.max(1, Math.round(width / (fontSize * .69)));
    sampler.canvas.height = Math.max(1, Math.round(height / fontSize));
    const bufferWidth = sampler.canvas.width * 3;
    const density = Math.min(window.devicePixelRatio, 2);
    output.width = Math.round(width * density);
    output.height = Math.round(height * density);
    renderer.setSize(bufferWidth, Math.max(1, Math.round(bufferWidth * height / width)), false);
    display.setTransform(density, 0, 0, density, 0, 0);
    const mono = getComputedStyle(panel).getPropertyValue('--mono').trim();
    display.font = `600 ${fontSize}px ${mono}`;
    display.textAlign = 'center';
    display.textBaseline = 'middle';
    render();
    if (!lost) {
      panel.dataset.rendered = '';
      panel.tabIndex = 0;
      panel.removeAttribute('aria-hidden');
    }
  };

  const animate = (time: number) => {
    frame = requestAnimationFrame(animate);
    previousTime ??= time;
    const delta = time - previousTime;
    if (delta < minimumFrameTime) return;
    previousTime = time;
    elapsedMs = (elapsedMs + delta) % cycleDurationMs;
    render(time);
  };

  const syncAnimation = () => {
    const running = visible && !document.hidden && !motion.matches && !lost;
    if (running && !frame) {
      frame = requestAnimationFrame(animate);
    } else if (!running && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = undefined;
    }
  };

  panel.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag || lost) return;
    event.preventDefault();
    panel.focus({ preventScroll: true });
    adjustment = rotationAt(performance.now());
    releasedAt = undefined;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, rotation: adjustment, roll: event.altKey };
    panel.setPointerCapture(event.pointerId);
    panel.setAttribute('data-dragging', '');
  });

  panel.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const { roll, rotation } = drag;
    adjustment = roll
      ? { ...rotation, z: wrapDegrees(rotation.z - dx * .6) }
      : { ...rotation, x: wrapDegrees(rotation.x + dy * .45), y: wrapDegrees(rotation.y + dx * .45) };
    if (motion.matches) render();
  });
  const finishDrag = (event: PointerEvent) => {
    if (event.pointerId !== drag?.id) return;
    drag = undefined;
    releasedAt = motion.matches ? undefined : performance.now();
    panel.removeAttribute('data-dragging');
  };
  panel.addEventListener('pointerup', finishDrag);
  panel.addEventListener('pointercancel', finishDrag);
  panel.addEventListener('lostpointercapture', finishDrag);

  panel.addEventListener('keydown', event => {
    if (drag || lost || event.altKey || event.ctrlKey || event.metaKey) return;
    const horizontal = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    const vertical = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (!horizontal && !vertical) return;
    event.preventDefault();
    const now = performance.now();
    const axis = horizontal ? (event.shiftKey ? 'z' : 'y') : 'x';
    adjustment = rotationAt(now);
    adjustment[axis] = wrapDegrees(adjustment[axis] + (horizontal || vertical) * 5);
    releasedAt = motion.matches ? undefined : now + 160;
    render(now);
  });

  motion.addEventListener('change', () => {
    render();
    syncAnimation();
  });
  document.addEventListener('visibilitychange', syncAnimation);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncAnimation();
  }).observe(panel);

  const observer = new ResizeObserver(resize);
  observer.observe(panel);
  new MutationObserver(() => {
    readInk();
    render();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  source.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    delete panel.dataset.rendered;
    panel.tabIndex = -1;
    panel.setAttribute('aria-hidden', 'true');
    syncAnimation();
  });
  source.addEventListener('webglcontextrestored', () => {
    lost = false;
    resize();
    syncAnimation();
  });

  readInk();
  resize();
}
