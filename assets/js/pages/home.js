import { boot, $, $$, reduced, touch, initReveals, revealTitle, getSite, getProjects, frameHTML, hydrateImages, fmt, esc, lenis } from '../core.js';
import { cardHTML } from '../cards.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

boot();
// pins must be created top-to-bottom, so the hero's pin exists before anything below it
initScrollStory();

/* ---------------- preloader → hero ---------------- */
const pre = $('.preloader');
const pct = $('[data-pct]');
const bar = $('.preloader__bar i');
let heroApi = null;

async function startHero() {
  const box = $('.hero__canvas');
  if (reduced) { staticHeroFallback(box); return; }
  try {
    const { createHero } = await import('../hero3d.js');
    heroApi = await createHero(box);
  } catch (e) {
    console.warn('3D unavailable, using still mark', e);
    staticHeroFallback(box);
  }
}
function staticHeroFallback(box) {
  box.innerHTML = '<svg viewBox="-45 20 1454 1290" style="position:absolute;right:8%;top:50%;width:min(38vw,520px);transform:translateY(-50%);--mark-hands:#e9d6b0;opacity:.9"><use href="#mark"/></svg>';
}

const progress = { v: 0 };
const fontsReady = document.fonts?.ready || Promise.resolve();
const heroReady = startHero();
gsap.to(progress, { v: 0.85, duration: 1.6, ease: 'power2.out', onUpdate: () => { pct.textContent = Math.round(progress.v * 100) + '%'; bar.style.transform = `scaleX(${progress.v})`; } });

Promise.all([fontsReady, heroReady, new Promise(r => setTimeout(r, 900))]).then(() => {
  gsap.timeline()
    .to(progress, { v: 1, duration: 0.4, onUpdate: () => { pct.textContent = Math.round(progress.v * 100) + '%'; bar.style.transform = `scaleX(${progress.v})`; } })
    .to('.preloader__inner', { opacity: 0, y: -20, duration: 0.5, ease: 'power2.in' })
    .to(pre, { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'expo.inOut' }, '-=0.1')
    .add(() => { pre.remove(); document.body.classList.remove('is-loading'); introHero(); }, '-=0.5');
});

function introHero() {
  revealTitle($('[data-hero-split]'), { immediate: true, delay: 0.2 });
  gsap.from('[data-hero-fade]', { opacity: 0, y: 24, duration: 1.4, ease: 'expo.out', delay: 0.6, stagger: 0.1 });
  gsap.from('.hero__top, .hero__scroll', { opacity: 0, duration: 1.2, delay: 1 });
  if (heroApi) {
    const o = { v: 0 };
    gsap.to(o, { v: 1, duration: 3.6, ease: 'power3.inOut', delay: 0.1, onUpdate: () => heroApi.setIntro(o.v) });
  }
  initReveals();
  ScrollTrigger.refresh();
}

/* ---------------- pinned scroll story over the 3D scene ---------------- */
function initScrollStory() {
  if (initScrollStory.done) return; initScrollStory.done = true;
  const hero = $('.hero');
  const ch0 = $('[data-chapter="0"]'), ch1 = $('[data-chapter="1"]'), ch2 = $('[data-chapter="2"]');
  if (reduced) return;
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: hero, start: 'top top', end: '+=260%', pin: true, scrub: 0.8,
      onUpdate: s => heroApi?.setScroll(gsap.utils.clamp(0, 1, s.progress * 1.12)),
      onLeave: () => heroApi?.pause(), onEnterBack: () => heroApi?.resume(),
    },
  });
  tl.to(ch0, { opacity: 0, y: -60, duration: 0.12, ease: 'power2.in' }, 0.04)
    .to('.hero__scroll, .hero__top', { opacity: 0, duration: 0.06 }, 0.02)
    .fromTo(ch1, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.1 }, 0.3)
    .to(ch1, { opacity: 0, y: -40, duration: 0.08 }, 0.5)
    .fromTo(ch2, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.1 }, 0.8)
    .to({}, { duration: 0.1 }, 0.9);
}

/* ---------------- ribbon: drifts, speeds up with scroll velocity ---------------- */
(function ribbon() {
  const track = $('.ribbon__track');
  if (!track) return;
  track.innerHTML += track.innerHTML; // seamless loop
  hydrateImages(track);
  if (reduced) return;
  let x = 0, speed = 0.6, boost = 0;
  const half = () => track.scrollWidth / 2;
  if (lenis) lenis.on('scroll', ({ velocity }) => { boost = gsap.utils.clamp(-30, 30, velocity * 0.6); });
  let visible = false;
  ScrollTrigger.create({ trigger: '.ribbon', start: 'top bottom', end: 'bottom top', onToggle: s => visible = s.isActive });
  gsap.ticker.add(() => {
    if (!visible) return;
    boost *= 0.92;
    x -= speed + Math.abs(boost);
    if (-x >= half()) x += half();
    track.style.transform = `translate3d(${x}px,0,0) skewX(${-boost * 0.12}deg)`;
  });
})();

/* ---------------- statement: words light up as you read ---------------- */
(function statement() {
  const el = $('.statement__text');
  if (!el) return;
  // wrap words but keep the inline photo pills intact
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3 && n.textContent.trim()) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(p => {
        if (!p) return;
        if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p));
        else { const s = document.createElement('span'); s.className = 'word'; s.textContent = p; frag.appendChild(s); }
      });
      n.replaceWith(frag);
    } else if (n.nodeType === 1 && !n.classList.contains('pill-img')) walk(n);
  });
  walk(el);
  const targets = $$('.word, .pill-img', el);
  if (reduced) return;
  gsap.set($$('.pill-img', el), { scale: 0.4, opacity: 0.2 });
  gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true } })
    .to(targets, { opacity: 1, scale: 1, stagger: 0.05, ease: 'none' });
})();

/* ---------------- programs: horizontal travel + 3D tilt ---------------- */
(function programs() {
  const sec = $('.programs'), track = $('.programs__track');
  if (!sec || !track) return;
  const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
  if (!reduced) {
    gsap.to(track, {
      x: () => -distance(), ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + distance(), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    gsap.to('.programs__progress i', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + distance(), scrub: true } });
  } else {
    track.style.overflowX = 'auto';
  }
  if (touch || reduced) return;
  $$('.prog:not(.prog--intro)').forEach(p => {
    const card = $('.prog__card', p);
    p.addEventListener('pointermove', e => {
      const r = p.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 12}deg)`;
    });
    p.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
})();

/* ---------------- before / after ---------------- */
(function compare() {
  const c = $('.compare');
  if (!c) return;
  let pos = 50, dragging = false;
  const set = v => { pos = gsap.utils.clamp(2, 98, v); c.style.setProperty('--pos', pos + '%'); c.setAttribute('aria-valuenow', Math.round(pos)); };
  const fromEvent = e => { const r = c.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
  c.addEventListener('pointerdown', e => { dragging = true; c.setPointerCapture(e.pointerId); fromEvent(e); });
  c.addEventListener('pointermove', e => dragging && fromEvent(e));
  c.addEventListener('pointerup', () => dragging = false);
  c.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') set(pos - 5); if (e.key === 'ArrowRight') set(pos + 5); });
  // a little nudge on arrival so people know it moves
  if (!reduced) {
    const o = { v: 50 };
    ScrollTrigger.create({ trigger: c, start: 'top 70%', once: true, onEnter: () => gsap.timeline().to(o, { v: 22, duration: 0.9, ease: 'power3.inOut', onUpdate: () => set(o.v) }).to(o, { v: 62, duration: 1.1, ease: 'power3.inOut', onUpdate: () => set(o.v) }) });
  }
})();

/* ---------------- reels: preview on hover ---------------- */
(function reels() {
  if (touch) return;
  $$('.reel[data-preview]').forEach(r => {
    let v;
    r.addEventListener('pointerenter', () => {
      if (!v) { v = document.createElement('video'); v.src = r.dataset.preview + '#t=8'; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; r.insertBefore(v, r.firstChild.nextSibling); }
      v.style.opacity = 1; v.play().catch(() => {});
    });
    r.addEventListener('pointerleave', () => { if (v) { v.pause(); } });
  });
})();

/* ---------------- impact calculator ---------------- */
(async function calc() {
  const range = $('[data-calc-range]');
  if (!range) return;
  let site = {};
  try { site = await getSite(); } catch {}
  const impact = (site.impact && site.impact[0]) || { costUSD: 30, one: 'family fed for all of Ramadan', many: 'families fed for all of Ramadan' };
  const rate = site.donate?.usdToKes || 129;
  let cur = 'USD';
  const icons = $('[data-calc-icons]');
  let lastN = 0;
  const update = () => {
    const n = +range.value;
    const usd = n * impact.costUSD;
    const amount = cur === 'USD' ? usd : Math.round(usd * rate / 100) * 100;
    $('[data-calc-amount]').textContent = fmt(amount, cur);
    $('[data-calc-families]').textContent = `${n} ${n === 1 ? 'family' : 'families'}`;
    $('[data-calc-what]').textContent = (n === 1 ? impact.one : impact.many).replace(/^famil(y|ies)\s*/, '');
    $('[data-calc-min]').textContent = fmt(cur === 'USD' ? impact.costUSD : impact.costUSD * rate, cur);
    $('[data-calc-max]').textContent = fmt(cur === 'USD' ? impact.costUSD * 20 : impact.costUSD * 20 * rate, cur);
    range.style.setProperty('--fill', ((n - 1) / 19 * 100) + '%');
    const cta = $('[data-calc-cta]');
    cta.textContent = `Give ${fmt(amount, cur)} now`;
    cta.href = `donate.html?fund=${impact.id || 'ramadan'}&amount=${amount}&cur=${cur}`;
    if (n > lastN) for (let i = lastN; i < n; i++) icons.appendChild(document.createElement('i'));
    else while (icons.children.length > n) icons.lastChild.remove();
    lastN = n;
  };
  range.addEventListener('input', update);
  $$('[data-cur]').forEach(b => b.addEventListener('click', () => {
    cur = b.dataset.cur;
    $$('[data-cur]').forEach(x => x.setAttribute('aria-pressed', x === b));
    update();
  }));
  update();
})();

/* ---------------- Ramadan countdown ---------------- */
(async function countdown() {
  const box = $('[data-countdown]');
  if (!box) return;
  let site = {};
  try { site = await getSite(); } catch {}
  if (site.campaign && site.campaign.enabled === false) { $('[data-campaign]')?.remove(); return; }
  const target = new Date(site.campaign?.date || '2027-02-08T00:00:00+03:00').getTime();
  const pad = n => String(n).padStart(2, '0');
  const tick = () => {
    let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    box.querySelector('[data-cd="d"]').textContent = d;
    box.querySelector('[data-cd="h"]').textContent = pad(h);
    box.querySelector('[data-cd="m"]').textContent = pad(m);
    box.querySelector('[data-cd="s"]').textContent = pad(s);
  };
  tick(); setInterval(tick, 1000);
  if (!reduced) gsap.fromTo('.campaign__moon', { '--mx': '62%' }, { '--mx': '84%', ease: 'none', scrollTrigger: { trigger: '.campaign', start: 'top bottom', end: 'bottom top', scrub: true } });
})();

/* ---------------- latest projects ---------------- */
(async function latest() {
  const box = $('[data-latest]');
  if (!box) return;
  try {
    const [projects, site] = await Promise.all([getProjects(), getSite().catch(() => ({}))]);
    const list = projects.filter(p => p.featured).slice(0, 3);
    (list.length < 3 ? projects.slice(0, 3) : list).forEach(p => box.insertAdjacentHTML('beforeend', cardHTML(p, site)));
    initReveals(box);
    gsap.from(box.children, { opacity: 0, y: 50, duration: 1.1, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: box, start: 'top 85%', once: true } });
    ScrollTrigger.refresh();
  } catch (e) { box.innerHTML = '<p class="muted">Projects will appear here.</p>'; }
})();
