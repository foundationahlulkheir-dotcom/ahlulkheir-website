import { bootPage, $, $$, reduced, getProjects, getSite, initReveals, esc } from '../core.js';
import { cardHTML } from '../cards.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

bootPage(async () => {
  const [projects, site] = await Promise.all([getProjects(), getSite().catch(() => ({}))]);
  const cats = site.categories || {};
  const params = new URLSearchParams(location.search);
  let active = params.get('c') || 'all';

  /* --- filters + grid --- */
  const grid = $('[data-grid]'), filters = $('[data-filters]');
  const counts = projects.reduce((m, p) => (m[p.category] = (m[p.category] || 0) + 1, m), {});
  const chips = [['all', 'All', projects.length], ...Object.keys(counts).map(k => [k, cats[k] || k, counts[k]])];
  filters.innerHTML = chips.map(([k, l, n]) => `<button class="chip" data-f="${esc(k)}" aria-pressed="${k === active}">${esc(l)}<sup>${n}</sup></button>`).join('');

  function render() {
    const list = active === 'all' ? projects : projects.filter(p => p.category === active);
    grid.innerHTML = list.length ? list.map(p => cardHTML(p, site)).join('') : '<p class="grid-empty">No projects here yet.</p>';
    initReveals(grid);
    if (!reduced) gsap.from(grid.children, { opacity: 0, y: 40, duration: 0.9, ease: 'expo.out', stagger: 0.06 });
    ScrollTrigger.refresh();
  }
  filters.addEventListener('click', e => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    active = b.dataset.f;
    $$('[data-f]', filters).forEach(x => x.setAttribute('aria-pressed', x === b));
    history.replaceState(null, '', active === 'all' ? 'projects.html' : `projects.html?c=${active}`);
    render();
  });
  render();
  if (params.get('c')) setTimeout(() => document.getElementById('all').scrollIntoView(), 300);

  /* --- 3D ring --- */
  const stage = $('.carousel3d');
  const title = $('[data-c-title]'), meta = $('[data-c-meta]');
  const items = projects.filter(p => p.cover).map(p => ({ id: p.id, title: p.title, cat: cats[p.category] || p.category, image: p.cover.src.replace('-md.', '-md.') }));
  const focus = (it, i, n) => {
    const apply = () => { title.textContent = it.title; meta.textContent = `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}  ·  ${it.cat}`; };
    if (reduced) return apply();
    gsap.timeline().to([title, meta], { opacity: 0, y: -8, duration: 0.18 }).add(apply).to([title, meta], { opacity: 1, y: 0, duration: 0.4, ease: 'expo.out' });
  };
  try {
    if (!document.createElement('canvas').getContext('webgl2')) throw 0;
    const { createCarousel } = await import('../carousel3d.js');
    stage.tabIndex = 0;
    const api = createCarousel(stage, items, { onFocus: focus, onOpen: it => { location.href = `project.html?p=${encodeURIComponent(it.id)}`; } });
    ScrollTrigger.create({ trigger: stage, start: 'top bottom', end: 'bottom top', onToggle: s => s.isActive ? api.resume() : api.pause() });
  } catch {
    // no WebGL: show the first project as a still
    stage.style.cursor = 'default';
    stage.insertAdjacentHTML('afterbegin', `<img src="${esc(items[0].image)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.5">`);
    focus(items[0], 0, items.length);
  }
});
