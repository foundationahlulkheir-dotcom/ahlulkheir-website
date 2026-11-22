import { frameHTML, esc, fmt } from './core.js';

export const STATUS = { completed: 'Completed', ongoing: 'Ongoing', upcoming: 'Upcoming' };

export function progressHTML(p) {
  if (!p.goal) return '';
  const pc = Math.min(100, Math.round(((p.raised || 0) / p.goal) * 100));
  return `<div class="progress"><div class="progress__bar"><i style="width:${pc}%"></i></div><div class="progress__txt"><span>${fmt(p.raised || 0)} raised</span><span>${pc}% of ${fmt(p.goal)}</span></div></div>`;
}

export function cardHTML(p, site = {}) {
  const cat = site.categories?.[p.category] || p.category || '';
  return `<a class="card" href="project.html?p=${encodeURIComponent(p.id)}" data-cursor="View" data-cat="${esc(p.category)}">
    <div style="position:relative">
      ${frameHTML(p.cover, { cls: 'card__media', sizes: '(max-width:600px) 100vw, (max-width:960px) 50vw, 33vw' })}
      <span class="card__badge card__badge--${esc(p.status)}">${esc(STATUS[p.status] || p.status)}</span>
    </div>
    <div class="card__meta"><span>${esc(cat)}</span><span>${esc(p.date || '')}</span></div>
    <h3 class="card__title">${esc(p.title)}</h3>
    <p class="card__sum">${esc(p.summary || '')}</p>
    ${progressHTML(p)}
  </a>`;
}
