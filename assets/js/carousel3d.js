/* Projects in the round: you stand inside a ring of curved photographs.
   Drag (or scroll sideways) to turn the room; the photo in front glows and names itself. */
import * as THREE from '../vendor/three.module.js';

export function createCarousel(container, items, { onFocus, onOpen } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b1210, 6, 15);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 50);

  const N = Math.max(items.length, 8);
  const R = 7;
  const step = (Math.PI * 2) / N;
  const arc = step * 0.8;
  const H = R * arc * 1.22;
  const group = new THREE.Group();
  scene.add(group);
  group.position.y = -0.35;
  const loader = new THREE.TextureLoader();
  const meshes = [];

  for (let i = 0; i < N; i++) {
    const it = items[i % items.length];
    const geo = new THREE.CylinderGeometry(R, R, H, 32, 1, true, Math.PI + i * step - arc / 2, arc);
    const mat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.BackSide, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { item: it, index: i, dim: 0.35 };
    group.add(mesh);
    meshes.push(mesh);
    loader.load(it.image, tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const imgA = tex.image.width / tex.image.height, cardA = (R * arc) / H;
      const rx = Math.min(1, cardA / imgA), ry = Math.min(1, imgA / cardA);
      tex.repeat.set(-rx, ry);                 // mirrored: we look at the inside of the cylinder
      tex.offset.set((1 + rx) / 2, (1 - ry) / 2);
      mat.map = tex; mat.needsUpdate = true;
      mat.opacity = 1;
    });
  }

  // a soft floor glow under the ring
  const glow = new THREE.Mesh(new THREE.CircleGeometry(R * 0.95, 64), new THREE.MeshBasicMaterial({ color: 0x1b7662, transparent: true, opacity: 0.08 }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = -H / 2 - 0.4;
  scene.add(glow);

  const state = { rot: 0, target: 0, vel: 0, dragging: false, lastX: 0, moved: 0, front: -1, hover: null, auto: true, tilt: 0 };

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 700 ? 68 : 52;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const el = renderer.domElement;
  el.style.touchAction = 'pan-y';
  el.addEventListener('pointerdown', e => { state.dragging = true; state.lastX = e.clientX; state.moved = 0; state.auto = false; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    state.tilt = pointer.y;
    if (!state.dragging) return;
    const dx = e.clientX - state.lastX;
    state.lastX = e.clientX; state.moved += Math.abs(dx);
    state.target += dx * 0.0042;
  });
  el.addEventListener('pointerup', e => {
    state.dragging = false;
    if (state.moved < 6) {
      const hit = pick();
      if (hit) {
        if (hit.userData.index % N === state.front) onOpen?.(hit.userData.item);
        else state.target += snapDelta(hit.userData.index);
      }
    } else {
      state.target = Math.round(state.target / step) * step; // settle on a card
    }
  });
  el.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); state.auto = false; state.target -= e.deltaX * 0.003; clearTimeout(state.wt); state.wt = setTimeout(() => state.target = Math.round(state.target / step) * step, 160); }
  }, { passive: false });
  container.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { state.auto = false; state.target -= step; }
    if (e.key === 'ArrowLeft') { state.auto = false; state.target += step; }
    if (e.key === 'Enter' && state.front >= 0) onOpen?.(meshes[state.front].userData.item);
  });

  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(9, 9);
  function pick() { ray.setFromCamera(pointer, camera); const h = ray.intersectObjects(meshes)[0]; return h && h.object; }
  // shortest rotation that brings card i to the front
  function snapDelta(i) {
    const want = -i * step;
    let d = (want - state.target) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  let running = true, idle = 0;
  const clock = new THREE.Clock();
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (state.auto) { idle += dt; if (idle > 2.2) { state.target -= step; idle = 0; } }
    state.rot += (state.target - state.rot) * 0.075;
    group.rotation.y = state.rot;
    camera.rotation.x += (state.tilt * 0.06 - camera.rotation.x) * 0.05;
    // which card faces us?
    const f = ((Math.round(-state.rot / step) % N) + N) % N;
    if (f !== state.front) { state.front = f; onFocus?.(meshes[f].userData.item, f % items.length, items.length); }
    const hovered = state.dragging ? null : pick();
    el.style.cursor = hovered ? 'pointer' : '';
    meshes.forEach((m, i) => {
      const target = i === f ? 1 : hovered === m ? 0.42 : 0.16;
      m.userData.dim += (target - m.userData.dim) * 0.08;
      m.material.color.setScalar(m.userData.dim);
      const s = 1 + (i === f ? 0.04 : 0);
      m.scale.y += (s - m.scale.y) * 0.08;
    });
    renderer.render(scene, camera);
  }
  frame();

  return {
    pause() { running = false; },
    resume() { if (!running) { running = true; clock.getDelta(); frame(); } },
    next() { state.auto = false; state.target -= step; },
    prev() { state.auto = false; state.target += step; },
  };
}
