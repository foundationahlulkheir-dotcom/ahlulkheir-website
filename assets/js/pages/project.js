import { boot, curtainOut, $, $$, reduced, getProjects, getSite, initReveals, revealTitle, frameHTML, esc, openGallery, openVideo, toast } from '../core.js';
import { progressHTML, STATUS } from '../cards.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;

boot();

(async () => {
  const id = new URLSearchParams(location.search).get('p');
  const [projects, site] = await Promise.all([getProjects(), getSite().catch(() => ({}))]);
  const i = projects.findIndex(p => p.id === id);
  const p = projects[i];
  if (!p) { location.replace('projects.html'); return; }
  const cats = site.categories || {};
  const fund = (site.funds || []).find(f => f.id === p.fund);

  document.title = `${p.title} | Ahlul Kheir Foundation`;
  $('meta[name="description"]').setAttribute('content', p.summary || p.title);

  // hero
  $('[data-pd-cover]').innerHTML = p.cover ? `<img src="${esc(p.cover.src.replace('-md.', '-lg.'))}" srcset="${esc(p.cover.srcset || '')}" sizes="100vw" alt="${esc(p.cover.alt || '')}" fetchpriority="high" ${p.cover.lqip ? `style="background:url('${p.cover.lqip}') center/cover"` : ''}>` : '';
  const cat = $('[data-pd-cat]');
  cat.textContent = cats[p.category] || 'Projects';
  cat.href = `projects.html?c=${encodeURIComponent(p.category)}`;
  const t = $('[data-pd-title]');
  t.innerHTML = esc(p.title).replace(/,\s*(.+)$/, ', <em>$1</em>');
  const meta = [['Status', STATUS[p.status] || p.status], ['When', p.date], ['Where', p.location], ['Fund', fund?.name]].filter(m => m[1]);
  $('[data-pd-meta]').innerHTML = meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');

  // story
  const story = Array.isArray(p.story) ? p.story : String(p.story || '').split(/\n\s*\n/);
  $('[data-pd-story]').innerHTML = (p.summary ? `<p class="h3" style="font-size:clamp(1.5rem,2.2vw,2.1rem);margin-bottom:1.2em">${esc(p.summary)}</p>` : '') +
    story.filter(Boolean).map(s => `<p>${esc(s)}</p>`).join('');
  if (p.summary) $('[data-pd-story] p:nth-child(2)')?.classList.add('first');
  if (p.stats?.length) {
    const box = $('[data-pd-stats]');
    box.hidden = false;
    box.innerHTML = p.stats.map(s => `<div class="pd-stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('');
  }

  // ask
  $('[data-pd-ask]').textContent = p.status === 'completed' ? 'Help us do this again, for the next family.' : 'Every gift moves this project forward.';
  $('[data-pd-progress]').innerHTML = progressHTML(p);
  $('[data-pd-give]').href = `donate.html?fund=${encodeURIComponent(p.fund || 'general')}&project=${encodeURIComponent(p.id)}`;

  // share
  const url = location.href, text = `${p.title} | Ahlul Kheir Foundation`;
  $('[data-share="wa"]').href = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
  $('[data-share="fb"]').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  $('[data-share="x"]').href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  $('[data-share="copy"]').onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Link copied. Thank you for sharing!'); } catch { toast(url); } };
  if (navigator.share) {
    const b = document.createElement('button'); b.className = 'btn btn--ink btn--sm'; b.textContent = 'Share…';
    b.onclick = () => navigator.share({ title: text, url }).catch(() => {});
    $('[data-pd-share]').prepend(b);
  }

  // video
  if (p.video?.src) {
    $('[data-pd-video-wrap]').hidden = false;
    const v = $('[data-pd-video]');
    v.innerHTML = `<img src="${esc(p.video.poster || p.cover?.src || '')}" alt="" style="opacity:1"><span class="play" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:var(--bone)"><span class="play__icon" style="width:96px;height:96px;background:rgba(11,18,16,.5);backdrop-filter:blur(6px)"><svg viewBox="0 0 24 24" fill="currentColor" style="width:26px;height:26px"><path d="M7 4.5v15l13-7.5z"/></svg></span></span>`;
    v.onclick = () => openVideo(p.video.src, p.title, p.video.poster);
  }

  // gallery
  const gal = (p.gallery || []).filter(Boolean);
  if (!gal.length) $('[data-pd-gallery-wrap]').remove();
  else {
    $('[data-pd-count]').textContent = `${gal.length} photograph${gal.length === 1 ? '' : 's'}. Tap any one to see it full size.`;
    $('[data-pd-gallery]').innerHTML = gal.map((g, n) => `<figure data-g="${n}" data-cursor="View" style="aspect-ratio:${g.ratio || 1}">${frameHTML(g, { sizes: '(max-width:520px) 100vw, (max-width:900px) 50vw, 33vw' }).replace('class="frame', 'style="height:100%" class="frame')}</figure>`).join('');
    const items = gal.map(g => ({ src: g.src, lg: g.src.replace('-md.', '-lg.'), alt: g.alt }));
    $('[data-pd-gallery]').addEventListener('click', e => { const f = e.target.closest('[data-g]'); if (f) openGallery(items, +f.dataset.g); });
  }

  // next
  const next = projects[(i + 1) % projects.length];
  if (next && next.id !== p.id) {
    const a = $('[data-pd-next]');
    a.href = `project.html?p=${encodeURIComponent(next.id)}`;
    $('[data-pd-next-title]').textContent = next.title;
    if (next.cover) a.insertAdjacentHTML('afterbegin', `<img src="${esc(next.cover.src)}" alt="" loading="lazy">`);
  }

  await curtainOut();
  revealTitle(t, { immediate: true, delay: 0.1 });
  if (!reduced) {
    gsap.from('.pd-hero__media img', { scale: 1.15, duration: 2.4, ease: 'expo.out' });
    gsap.from('.pd-meta div, [data-pd-cat]', { opacity: 0, y: 20, duration: 1, ease: 'expo.out', stagger: 0.06, delay: 0.4 });
    gsap.to('.pd-hero__media img', { yPercent: 12, ease: 'none', scrollTrigger: { trigger: '.pd-hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.from('.masonry figure', { opacity: 0, y: 50, duration: 1, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: '.masonry', start: 'top 85%', once: true } });
  }
  initReveals();
  ScrollTrigger.refresh();
})();
