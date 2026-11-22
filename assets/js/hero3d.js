/* The hero scene.
   ~26k particles of red-earth dust gather into the foundation's heart-in-hands mark,
   dissolve into the Arabic "أهل الخير" (the people of goodness), then fall as water
   and spread across the ground as ripples. Scroll drives the story; the cursor
   pushes the dust aside. */
import * as THREE from '../vendor/three.module.js';

const VERT = /* glsl */`
  uniform float uTime;
  uniform float uMorph;
  uniform float uSize;
  uniform float uPR;
  uniform vec3 uMouse;
  uniform float uMouseF;
  uniform float uWave;
  attribute vec3 aHeart;
  attribute vec3 aArabic;
  attribute vec3 aRipple;
  attribute vec3 aCHeart;
  attribute vec4 aRand;
  varying vec3 vColor;
  varying float vAlpha;

  vec3 shape(float i) {
    if (i < 0.5) return position;
    if (i < 1.5) return aHeart;
    if (i < 2.5) return aArabic;
    return aRipple;
  }
  vec3 tint(float i, vec3 p) {
    vec3 clay = vec3(0.80, 0.36, 0.20);
    vec3 saffron = vec3(0.98, 0.72, 0.28);
    if (i < 0.5) return mix(clay, saffron, aRand.y * 0.8) * (0.55 + aRand.z * 0.6);
    if (i < 1.5) return aCHeart;
    if (i < 2.5) return mix(vec3(1.0, 0.80, 0.42), vec3(1.0, 0.93, 0.78), aRand.z * 0.6);
    float r = length(aRipple.xz - vec2(0.0, -4.0));
    vec3 mint = vec3(0.55, 0.88, 0.76);
    vec3 em = vec3(0.12, 0.52, 0.42);
    return mix(mint, em, smoothstep(1.0, 9.0, r)) * (0.75 + aRand.z * 0.5);
  }

  void main() {
    float m = clamp(uMorph, 0.0, 3.0);
    float i0 = floor(min(m, 2.999));
    float f = m - i0;
    // stagger: each particle leaves on its own schedule, so shapes dissolve like sand
    float k = clamp(f * 1.6 - aRand.x * 0.6, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    vec3 a = shape(i0), b = shape(i0 + 1.0);
    vec3 p = mix(a, b, k);

    // mid-flight turbulence: particles burst outward and swirl before re-forming
    float burst = sin(k * 3.14159);
    float t = uTime;
    vec3 swirl = vec3(
      sin(t * 0.7 + aRand.y * 12.0 + p.y * 1.3),
      cos(t * 0.6 + aRand.z * 12.0 + p.x * 1.1),
      sin(t * 0.5 + aRand.w * 12.0)
    );
    p += swirl * burst * (0.6 + aRand.w * 0.9);

    // idle life: dust drifts on the wind, shapes breathe
    float dustness = 1.0 - smoothstep(0.0, 0.6, m);
    vec3 drift = vec3(
      sin(t * (0.12 + aRand.y * 0.2) + aRand.z * 6.283) * 0.9 + t * 0.05,
      cos(t * (0.10 + aRand.z * 0.2) + aRand.w * 6.283) * 0.5,
      sin(t * 0.08 + aRand.y * 6.283) * 0.6
    );
    p += drift * dustness;
    p += swirl * 0.012 * (1.0 - dustness);

    // ripples on the ground
    float rip = smoothstep(2.3, 3.0, m);
    float rr = length(p.xz - vec2(0.0, -4.0));
    p.y += sin(rr * 2.6 - t * 1.6) * 0.09 * rip * uWave * smoothstep(0.0, 1.5, rr);

    // cursor pushes particles away
    vec2 d = p.xy - uMouse.xy;
    float dist = length(d);
    float push = smoothstep(1.1, 0.0, dist) * uMouseF;
    p.xy += normalize(d + 0.0001) * push * 0.55;
    p.z += push * 0.4;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = uSize * (0.55 + aRand.w * 0.9);
    size *= mix(1.0, 1.9, dustness);
    gl_PointSize = size * uPR * (1.0 / -mv.z);

    vec3 ca = tint(i0, a), cb = tint(i0 + 1.0, b);
    vColor = mix(ca, cb, k) + burst * vec3(0.25, 0.18, 0.05);
    // crest highlights on the water
    vColor += vec3(0.35, 0.3, 0.15) * rip * smoothstep(0.06, 0.09, sin(rr * 2.6 - t * 1.6) * 0.09) ;
    vAlpha = mix(0.9, 0.55, dustness) * (0.6 + aRand.z * 0.4);
    vAlpha *= smoothstep(-14.0, -6.0, mv.z) ; // fade far particles into the night
  }
`;

const FRAG = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float a = pow(core, 1.6) * vAlpha;
    gl_FragColor = vec4(vColor * (0.7 + core * 0.6), a);
  }
`;

/** Rasterise an image/text to a canvas and return weighted samples {x,y,kind} in [-0.5,0.5] space */
function sampleCanvas(draw, w, h, n, classify) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  draw(g, w, h);
  const data = g.getImageData(0, 0, w, h).data;
  const pts = [];
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const i = (y * w + x) * 4;
    if (data[i + 3] > 110) pts.push([x, y, classify ? classify(data[i], data[i + 1], data[i + 2]) : 0]);
  }
  const out = new Float32Array(n * 3);
  const kinds = new Uint8Array(n);
  const s = Math.max(w, h);
  for (let j = 0; j < n; j++) {
    const p = pts[(Math.random() * pts.length) | 0] || [w / 2, h / 2, 0];
    out[j * 3] = (p[0] + Math.random() - w / 2) / s;
    out[j * 3 + 1] = -(p[1] + Math.random() - h / 2) / s;
    out[j * 3 + 2] = 0;
    kinds[j] = p[2];
  }
  return { pos: out, kinds, aspect: w / h };
}

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

export async function createHero(container, { onReady } = {}) {
  const gl2 = document.createElement('canvas').getContext('webgl2');
  if (!gl2) throw new Error('no webgl2');

  const mobile = window.innerWidth < 760;
  const N = mobile ? 11000 : (navigator.hardwareConcurrency || 4) >= 8 ? 28000 : 20000;

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  camera.position.set(0, 0, 7);

  // --- shapes ---
  await document.fonts.load('700 200px "Aref Ruqaa"').catch(() => {});
  const markImg = await loadImage('assets/img/mark.svg');
  const heart = sampleCanvas((g, w, h) => g.drawImage(markImg, 0, 0, w, h), 520, Math.round(520 * markImg.height / markImg.width) || 460, N,
    (r, gg, b) => (gg > r + 30 ? 0 : (r < 30 && gg < 60 && gg > r ? 1 : 2))); // 0 heart, 1 handshake line, 2 hands
  const arabic = sampleCanvas((g, w, h) => {
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.direction = 'rtl';
    g.font = '700 230px "Aref Ruqaa", "Amiri", serif';
    g.fillText('أهل الخير', w / 2, h / 2 + 10);
  }, 1000, 360, N);

  const pos = new Float32Array(N * 3);
  const aHeart = new Float32Array(N * 3);
  const aArabic = new Float32Array(N * 3);
  const aRipple = new Float32Array(N * 3);
  const aCHeart = new Float32Array(N * 3);
  const aRand = new Float32Array(N * 4);
  const cHeart = [0.24, 0.80, 0.63], cLine = [1.0, 0.96, 0.88], cHands = [0.96, 0.84, 0.62];

  for (let i = 0; i < N; i++) {
    // dust: a wide, shallow storm in front of and behind the stage
    pos[i * 3] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
    pos[i * 3 + 2] = -7 + Math.random() * 9;
    // ground ripples: concentric rings receding to the horizon
    const ring = Math.floor(Math.pow(Math.random(), 0.8) * 26);
    const r = 0.35 + ring * 0.42 + (Math.random() - 0.5) * 0.06;
    const ang = Math.random() * Math.PI * 2;
    aRipple[i * 3] = Math.cos(ang) * r;
    aRipple[i * 3 + 1] = -1.55;
    aRipple[i * 3 + 2] = -4 + Math.sin(ang) * r;
    const k = heart.kinds[i];
    const col = k === 0 ? cHeart : k === 1 ? cLine : cHands;
    const v = 0.85 + Math.random() * 0.3;
    aCHeart[i * 3] = col[0] * v; aCHeart[i * 3 + 1] = col[1] * v; aCHeart[i * 3 + 2] = col[2] * v;
    aRand[i * 4] = Math.random(); aRand[i * 4 + 1] = Math.random(); aRand[i * 4 + 2] = Math.random(); aRand[i * 4 + 3] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aHeart', new THREE.BufferAttribute(aHeart, 3));
  geo.setAttribute('aArabic', new THREE.BufferAttribute(aArabic, 3));
  geo.setAttribute('aRipple', new THREE.BufferAttribute(aRipple, 3));
  geo.setAttribute('aCHeart', new THREE.BufferAttribute(aCHeart, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(aRand, 4));

  const uniforms = {
    uTime: { value: 0 }, uMorph: { value: 0 }, uSize: { value: mobile ? 34 : 30 },
    uPR: { value: renderer.getPixelRatio() }, uMouse: { value: new THREE.Vector3(99, 99, 0) },
    uMouseF: { value: 0 }, uWave: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  // place the heart & calligraphy for the current viewport
  function layout() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const visW = visH * camera.aspect;
    const wide = camera.aspect > 1.15;
    const heartH = wide ? visH * 0.6 : Math.min(visH * 0.38, visW * 0.8);
    const hx = wide ? visW * 0.21 : 0, hy = wide ? visH * 0.07 : visH * 0.2;
    const s = heartH * Math.max(1, heart.aspect); // samples normalised by max(w,h)
    const arW = Math.min(visW * 0.82, visH * 1.5 * 2.2);
    const ay = wide ? visH * 0.12 : visH * 0.14;
    for (let i = 0; i < N; i++) {
      aHeart[i * 3] = heart.pos[i * 3] * s + hx;
      aHeart[i * 3 + 1] = heart.pos[i * 3 + 1] * s + hy;
      aHeart[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
      aArabic[i * 3] = arabic.pos[i * 3] * arW;
      aArabic[i * 3 + 1] = arabic.pos[i * 3 + 1] * arW + ay;
      aArabic[i * 3 + 2] = (Math.random() - 0.5) * 0.18;
    }
    geo.attributes.aHeart.needsUpdate = true;
    geo.attributes.aArabic.needsUpdate = true;
    state.visW = visW; state.visH = visH;
  }

  const state = { intro: 0, scroll: 0, running: true, visW: 1, visH: 1, mx: 99, my: 99, mf: 0, camY: 0 };
  layout();
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 120); });

  // cursor in world space on the z=0 plane
  const onMove = e => {
    const r = container.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    state.mx = nx * state.visW; state.my = -ny * state.visH; state.mf = 1;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  container.addEventListener('pointerleave', () => { state.mf = 0; });

  const clock = new THREE.Clock();
  function frame() {
    if (!state.running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    uniforms.uTime.value += dt;
    uniforms.uMorph.value = state.intro + state.scroll * 2;
    const m = uniforms.uMouse.value;
    m.x += (state.mx - m.x) * 0.12; m.y += (state.my - m.y) * 0.12;
    uniforms.uMouseF.value += (state.mf * (uniforms.uMorph.value > 2.4 ? 0.3 : 1) - uniforms.uMouseF.value) * 0.06;
    // the camera rises a little and looks down as the water spreads
    const rip = Math.max(0, uniforms.uMorph.value - 2);
    const targetY = rip * 0.9;
    state.camY += (targetY - state.camY) * 0.08;
    camera.position.y = state.camY;
    camera.lookAt(0, -state.camY * 0.9, 0);
    // gentle parallax with the cursor
    camera.position.x += ((state.mf ? state.mx * 0.04 : 0) - camera.position.x) * 0.05;
    renderer.render(scene, camera);
  }

  const api = {
    setIntro(v) { state.intro = v; },
    setScroll(v) { state.scroll = v; },
    pause() { state.running = false; },
    resume() { if (!state.running) { state.running = true; clock.getDelta(); frame(); } },
    renderOnce() { renderer.render(scene, camera); },
    get uniforms() { return uniforms; },
  };
  frame();
  onReady?.(api);
  return api;
}
