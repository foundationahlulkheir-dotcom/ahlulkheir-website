/* Ahlul Kheir: shared behaviour for every page.
   Smooth scroll, page transitions, reveals, cursor, nav, modals. */

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
export const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const touch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
if (reduced) document.documentElement.classList.add('reduced');
gsap.registerPlugin(ScrollTrigger);

/* ---------------- data ---------------- */
const cache = {};
export async function getJSON(url) {
  if (!cache[url]) cache[url] = fetch(url, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(url); return r.json(); });
  return cache[url];
}
export const getSite = () => getJSON('data/site.json');
export const getProjects = () => getJSON('data/projects.json').then(d => d.projects || []);

/* ---------------- helpers ---------------- */
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n, cur = 'USD') => cur === 'KES'
  ? 'KSh ' + Math.round(n).toLocaleString('en-KE')
  : '$' + Math.round(n).toLocaleString('en-US');

/** responsive <img> inside a frame, with a blurred placeholder underneath */
export function frameHTML(img, { sizes = '100vw', cls = '', eager = false, alt } = {}) {
  if (!img) return `<div class="frame ${cls}"></div>`;
  const lq = img.lqip ? ` style="background-image:url('${img.lqip}')"` : '';
  return `<div class="frame frame--lqip ${cls}"${lq}><img src="${esc(img.src)}" ${img.srcset ? `srcset="${esc(img.srcset)}" sizes="${sizes}"` : ''} alt="${esc(alt ?? img.alt ?? '')}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="${img.w || 1600}" height="${img.h || 1200}"></div>`;
}

export function hydrateImages(root = document) {
  $$('.frame img', root).forEach(img => {
    if (img.dataset.h) return;
    img.dataset.h = 1;
    const done = () => img.classList.add('is-loaded');
    if (img.complete && img.naturalWidth) done(); else img.addEventListener('load', done, { once: true });
  });
}

export function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('is-on'), 2400);
}

/* ---------------- smooth scroll ---------------- */
export let lenis = null;
if (!reduced && window.Lenis) {
  lenis = new window.Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
export const scrollTo = (target, opts = {}) => lenis ? lenis.scrollTo(target, { offset: -20, ...opts }) : (typeof target === 'number' ? window.scrollTo(0, target) : document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' }));

/* ---------------- split text into masked lines ---------------- */
export function splitLines(el) {
  if (el.dataset.splitDone) return $$('.split-line > span', el);
  const html = el.innerHTML;
  // wrap each word (keeping inline tags like <em>) so we can measure line breaks
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  const words = [];
  const walk = (node, wrapTag) => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) words.push({ space: true });
          else words.push({ text: part, wrap: wrapTag });
        });
      } else if (n.nodeType === 1) {
        if (n.tagName === 'BR') words.push({ br: true });
        else walk(n, n.cloneNode(false));
      }
    });
  };
  walk(tmp, null);
  el.innerHTML = words.map(w => {
    if (w.space) return ' ';
    if (w.br) return '<br>';
    let inner = esc(w.text);
    if (w.wrap) { const c = w.wrap.cloneNode(false); c.innerHTML = inner; inner = c.outerHTML; }
    return `<span class="word">${inner}</span>`;
  }).join('');
  // group by vertical position
  const lines = [];
  let lastTop = null;
  $$('.word', el).forEach(w => {
    const top = w.offsetTop;
    if (lastTop === null || Math.abs(top - lastTop) > 4) { lines.push([]); lastTop = top; }
    lines[lines.length - 1].push(w.outerHTML);
  });
  el.innerHTML = lines.map(l => `<span class="split-line"><span>${l.join(' ')}</span></span>`).join('');
  el.dataset.splitDone = 1;
  return $$('.split-line > span', el);
}

export function revealTitle(el, { delay = 0, immediate = false } = {}) {
  const spans = splitLines(el);
  gsap.set(el, { opacity: 1 });
  if (reduced) return gsap.set(spans, { yPercent: 0 });
  gsap.set(spans, { yPercent: 115, rotate: 2.5 });
  const tl = gsap.to(spans, { yPercent: 0, rotate: 0, duration: 1.3, ease: 'expo.out', stagger: 0.09, delay, paused: !immediate });
  if (!immediate) ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => tl.play() });
  return tl;
}

/* ---------------- page curtain ---------------- */
const curtain = document.createElement('div');
curtain.className = 'curtain';
curtain.innerHTML = `<svg class="curtain__mark" viewBox="0 0 100 100" aria-hidden="true"><use href="#mark"/></svg>`;
document.body.appendChild(curtain);

function isInternal(a) {
  if (!a || a.target === '_blank' || a.hasAttribute('download') || a.dataset.noTransition !== undefined) return false;
  const href = a.getAttribute('href') || '';
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('https://wa.me')) return false;
  const url = new URL(a.href, location.href);
  return url.origin === location.origin && !(url.pathname === location.pathname && url.search === location.search && url.hash);
}

document.addEventListener('click', e => {
  const a = e.target.closest('a');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const href = a.getAttribute('href') || '';
  if (href.startsWith('#') && href.length > 1 && document.querySelector(href)) { e.preventDefault(); scrollTo(href); return; }
  if (!isInternal(a) || reduced) return;
  e.preventDefault();
  document.body.classList.remove('menu-open');
  gsap.timeline()
    .set(curtain, { pointerEvents: 'all' })
    .fromTo(curtain, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 0.75, ease: 'expo.inOut' })
    .to('.curtain__mark', { opacity: 1, duration: 0.3 }, '-=0.25')
    .add(() => { sessionStorage.setItem('ak-curtain', '1'); location.href = a.href; });
});

// reveal from curtain when arriving from another page
export function curtainOut() {
  if (!sessionStorage.getItem('ak-curtain')) return Promise.resolve();
  sessionStorage.removeItem('ak-curtain');
  gsap.set(curtain, { clipPath: 'inset(0% 0 0 0)' });
  gsap.set('.curtain__mark', { opacity: 1 });
  return new Promise(res => gsap.timeline({ onComplete: res })
    .to('.curtain__mark', { opacity: 0, duration: 0.3 })
    .to(curtain, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'expo.inOut' }, '-=0.1')
    .set(curtain, { pointerEvents: 'none', clipPath: 'inset(100% 0 0 0)' }));
}
window.addEventListener('pageshow', e => { if (e.persisted) gsap.set(curtain, { clipPath: 'inset(100% 0 0 0)', pointerEvents: 'none' }); });

/* ---------------- nav ---------------- */
function initNav() {
  const nav = $('.nav');
  if (!nav) return;
  let last = 0;
  const onScroll = y => {
    nav.classList.toggle('is-solid', y > 40);
    if (!document.body.classList.contains('menu-open')) nav.classList.toggle('is-hidden', y > last && y > 300);
    last = y;
    const fab = $('.give-fab');
    if (fab) fab.classList.toggle('is-on', y > window.innerHeight * 0.9);
  };
  if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
  else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });

  // switch nav colours over light sections
  const lights = $$('[data-nav="light"]').map(sec => ScrollTrigger.create({
    trigger: sec, start: 'top 40px', end: 'bottom 40px',
    onToggle: () => nav.classList.toggle('is-light', lights.some(t => t.isActive)),
  }));

  $('.burger')?.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    $('.burger').setAttribute('aria-expanded', open);
    nav.classList.remove('is-hidden');
    open ? lenis?.stop() : lenis?.start();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) $('.burger').click(); });
}

/* ---------------- cursor & magnetic ---------------- */
function initCursor() {
  if (touch || reduced) return;
  const c = document.createElement('div');
  c.className = 'cursor'; c.innerHTML = '<span></span>';
  document.body.appendChild(c);
  const xTo = gsap.quickTo(c, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(c, 'y', { duration: 0.35, ease: 'power3' });
  window.addEventListener('pointermove', e => { xTo(e.clientX); yTo(e.clientY); });
  document.addEventListener('pointerover', e => {
    const l = e.target.closest('[data-cursor]');
    const h = e.target.closest('a, button, input[type=range], label, select');
    c.classList.toggle('is-label', !!l);
    c.classList.toggle('is-hover', !l && !!h);
    if (l) c.firstChild.textContent = l.dataset.cursor;
  });
  document.addEventListener('pointerleave', () => gsap.to(c, { opacity: 0 }));
  document.addEventListener('pointerenter', () => gsap.to(c, { opacity: 1 }));
}

function initMagnetic() {
  if (touch || reduced) return;
  $$('[data-magnetic]').forEach(el => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.28);
      yTo((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ---------------- scroll effects ---------------- */
export function initReveals(root = document) {
  $$('[data-split]', root).forEach(el => revealTitle(el, { delay: +(el.dataset.delay || 0) }));
  $$('[data-reveal]', root).forEach(el => {
    if (el.dataset.rv) return; el.dataset.rv = 1;
    if (reduced) return gsap.set(el, { opacity: 1, y: 0 });
    gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', delay: +(el.dataset.delay || 0), scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  $$('[data-stagger]', root).forEach(group => {
    if (group.dataset.rv) return; group.dataset.rv = 1;
    const kids = [...group.children];
    if (reduced) return;
    gsap.set(kids, { opacity: 0, y: 40 });
    ScrollTrigger.batch(kids, { start: 'top 92%', once: true, onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 }) });
  });
  if (!reduced) $$('[data-parallax]', root).forEach(el => {
    const amt = +(el.dataset.parallax || 12);
    gsap.fromTo(el, { yPercent: -amt / 2 }, { yPercent: amt / 2, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  $$('[data-count]', root).forEach(el => {
    const end = +el.dataset.count, dec = +(el.dataset.dec || 0);
    const o = { v: 0 };
    const set = () => el.textContent = o.v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    if (reduced) { o.v = end; return set(); }
    set();
    gsap.to(o, { v: end, duration: 2.2, ease: 'expo.out', onUpdate: set, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  hydrateImages(root);
}

/* ---------------- copy, modal, lightbox ---------------- */
function initCopy() {
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); } catch { /* older browsers */ const t = document.createElement('textarea'); t.value = b.dataset.copy; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    const old = b.textContent; b.textContent = 'Copied'; b.classList.add('is-done');
    toast(`Copied ${b.dataset.copy}`);
    setTimeout(() => { b.textContent = old; b.classList.remove('is-done'); }, 1800);
  });
}

const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICON_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7"/></svg>';
const ICON_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>';
let modal;
function ensureModal() {
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'modal'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `<div class="modal__box"><button class="modal__close" aria-label="Close">${ICON_X}</button><div class="modal__media"></div><p class="modal__cap"></p><button class="modal__nav modal__nav--prev" aria-label="Previous">${ICON_L}</button><button class="modal__nav modal__nav--next" aria-label="Next">${ICON_R}</button></div>`;
  document.body.appendChild(modal);
  const close = () => { modal.classList.remove('is-open'); $('.modal__media', modal).innerHTML = ''; lenis?.start(); };
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('.modal__close')) close(); });
  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') modal._step?.(1);
    if (e.key === 'ArrowLeft') modal._step?.(-1);
  });
  $('.modal__nav--prev', modal).onclick = () => modal._step?.(-1);
  $('.modal__nav--next', modal).onclick = () => modal._step?.(1);
  return modal;
}
export function openVideo(src, caption = '', poster = '') {
  const m = ensureModal();
  m._step = null; $$('.modal__nav', m).forEach(b => b.hidden = true);
  $('.modal__media', m).innerHTML = `<video src="${esc(src)}" ${poster ? `poster="${esc(poster)}"` : ''} controls autoplay playsinline></video>`;
  $('.modal__cap', m).textContent = caption;
  m.classList.add('is-open'); lenis?.stop();
}
export function openGallery(items, index = 0) {
  const m = ensureModal();
  let i = index;
  const show = () => {
    const it = items[i];
    $('.modal__media', m).innerHTML = `<img src="${esc(it.lg || it.src)}" alt="${esc(it.alt || '')}">`;
    $('.modal__cap', m).textContent = `${it.alt || ''}  ·  ${i + 1} / ${items.length}`;
  };
  m._step = d => { i = (i + d + items.length) % items.length; show(); };
  $$('.modal__nav', m).forEach(b => b.hidden = items.length < 2);
  show(); m.classList.add('is-open'); lenis?.stop();
}
function initVideoLinks() {
  document.addEventListener('click', e => {
    const v = e.target.closest('[data-video]');
    if (!v) return;
    e.preventDefault();
    openVideo(v.dataset.video, v.dataset.caption || '', v.dataset.poster || '');
  });
}

/* ---------------- site-wide content from site.json ---------------- */
async function fillSiteData() {
  try {
    const s = await getSite();
    $$('[data-site]').forEach(el => {
      const v = el.dataset.site.split('.').reduce((o, k) => o?.[k], s);
      if (v == null) return;
      if (el.dataset.siteAttr) el.setAttribute(el.dataset.siteAttr, (el.dataset.sitePrefix || '') + v);
      else el.textContent = v;
    });
    $$('[data-copy-site]').forEach(el => { const v = el.dataset.copySite.split('.').reduce((o, k) => o?.[k], s); if (v) el.dataset.copy = v; });
  } catch (e) { /* site.json missing: static fallbacks stay in place */ }
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
}

/* ---------------- boot ---------------- */
export function boot() {
  initNav(); initCursor(); initMagnetic(); initCopy(); initVideoLinks(); fillSiteData();
  // mark current nav link
  const here = location.pathname.split('/').pop() || 'index.html';
  $$('.nav__links a, .menu__links a').forEach(a => { if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page'); });
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

/** standard inner-page entrance */
export async function bootPage(extra) {
  boot();
  await curtainOut();
  $$('[data-hero-split]').forEach((el, i) => revealTitle(el, { immediate: true, delay: 0.1 + i * 0.1 }));
  if (!reduced) gsap.from('[data-hero-fade]', { opacity: 0, y: 24, duration: 1.2, ease: 'expo.out', delay: 0.5, stagger: 0.08 });
  initReveals();
  extra?.();
}
