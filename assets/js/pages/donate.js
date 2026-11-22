import { bootPage, $, $$, reduced, getSite, getProjects, fmt, esc, toast } from '../core.js';

const PRESETS = { USD: [30, 60, 120, 250], KES: [1000, 3000, 5000, 10000] };
const IMPACT = {
  ramadan: (usd) => { const n = Math.floor(usd / 30); return n >= 1 ? `${n} ${n === 1 ? 'family' : 'families'} fed for all of Ramadan` : 'Part of a family’s Ramadan food pack'; },
  general: () => 'Sent to wherever the need is most urgent',
  zakat: () => 'Given only to those eligible for Zakat',
  water: () => 'Clean water for families in drought',
  shelter: () => 'Bricks, roofing and doors for a family’s home',
  madrasa: () => 'Teachers and learning for madrasa students',
  qurbani: () => 'Qurbani shared with families on Eid',
  eid: () => 'New clothes and a festive meal for Eid',
};

bootPage(async () => {
  const site = await getSite().catch(() => ({}));
  const rate = site.donate?.usdToKes || 129;
  const funds = site.funds || [{ id: 'general', name: 'Where most needed', desc: '' }];
  const q = new URLSearchParams(location.search);
  const state = {
    fund: funds.find(f => f.id === q.get('fund'))?.id || 'ramadan',
    cur: q.get('cur') === 'KES' ? 'KES' : 'USD',
    amount: +q.get('amount') || 90,
    project: q.get('project'),
  };
  if (!funds.find(f => f.id === state.fund)) state.fund = funds[0].id;
  let projectTitle = '';
  if (state.project) { try { projectTitle = (await getProjects()).find(p => p.id === state.project)?.title || ''; } catch {} }

  /* funds */
  const fbox = $('[data-funds]');
  fbox.innerHTML = funds.map(f => `<button type="button" class="fund" role="radio" aria-checked="${f.id === state.fund}" data-fund="${esc(f.id)}"><b>${esc(f.name)}</b><small>${esc(f.desc || '')}</small></button>`).join('');
  fbox.addEventListener('click', e => { const b = e.target.closest('[data-fund]'); if (!b) return; state.fund = b.dataset.fund; $$('[data-fund]').forEach(x => x.setAttribute('aria-checked', x === b)); update(); });

  /* amounts */
  const abox = $('[data-amounts]'), custom = $('[data-custom]');
  function renderAmounts() {
    abox.innerHTML = PRESETS[state.cur].map(a => `<button type="button" class="amt" data-amt="${a}" aria-pressed="${a === state.amount}">${fmt(a, state.cur)}</button>`).join('');
    $('[data-cur-sym]').textContent = state.cur === 'USD' ? '$' : 'KSh';
    custom.value = PRESETS[state.cur].includes(state.amount) ? '' : state.amount;
  }
  abox.addEventListener('click', e => { const b = e.target.closest('[data-amt]'); if (!b) return; state.amount = +b.dataset.amt; custom.value = ''; $$('[data-amt]').forEach(x => x.setAttribute('aria-pressed', x === b)); update(); });
  custom.addEventListener('input', () => { state.amount = Math.max(0, +custom.value || 0); $$('[data-amt]').forEach(x => x.setAttribute('aria-pressed', +x.dataset.amt === state.amount)); update(); });
  $$('[data-c]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.c === state.cur) return;
    const usd = state.cur === 'USD' ? state.amount : state.amount / rate;
    state.cur = b.dataset.c;
    state.amount = state.cur === 'USD' ? Math.max(1, Math.round(usd)) : Math.round(usd * rate / 100) * 100;
    $$('[data-c]').forEach(x => x.setAttribute('aria-pressed', x === b));
    renderAmounts(); update();
  }));

  /* methods accordion */
  $('[data-methods]').addEventListener('click', e => {
    const h = e.target.closest('.method__head'); if (!h) return;
    const m = h.parentElement;
    $$('.method').forEach(x => x.classList.toggle('is-open', x === m && !m.classList.contains('is-open')));
  });

  const wa = site.contact?.whatsapp || '254723802894';
  const paypal = site.donate?.paypalUrl;

  function update() {
    const usd = state.cur === 'USD' ? state.amount : state.amount / rate;
    const kes = state.cur === 'KES' ? state.amount : Math.round(state.amount * rate);
    const fund = funds.find(f => f.id === state.fund) || funds[0];
    const impact = (IMPACT[state.fund] || IMPACT.general)(usd);
    const label = projectTitle ? `${fund.name} · ${projectTitle}` : fund.name;
    $('[data-impact]').textContent = state.amount ? `→ ${impact}` : '';
    $('[data-v-amount]').textContent = fmt(state.amount, state.cur);
    $('[data-v-impact]').textContent = impact;
    $('[data-s-fund]').textContent = label;
    $('[data-s-amount]').textContent = fmt(state.amount, state.cur);
    $('[data-s-kes]').textContent = fmt(kes, 'KES');
    $('[data-mpesa-amount]').textContent = fmt(kes, 'KES');
    const msg = (verb) => `Assalamu alaikum, Ahlul Kheir Foundation. ${verb} ${fmt(state.amount, state.cur)} for ${label}.`;
    $('[data-wa-confirm]').href = `https://wa.me/${wa}?text=${encodeURIComponent(msg('I have just sent') + ' My M-PESA name is: ')}`;
    $('[data-wa-pledge]').href = `https://wa.me/${wa}?text=${encodeURIComponent(msg('I would like to pledge') + ' Please send me the details.')}`;
    const pp = $('[data-paypal]');
    if (paypal) { pp.href = paypal; pp.hidden = false; }
    else { pp.href = `https://wa.me/${wa}?text=${encodeURIComponent(msg('I would like to give by card') + ' Please send me a payment link.')}`; pp.textContent = 'Request a card payment link'; $('[data-paypal-note]').textContent = 'Online card checkout is being set up. Message us and we will send you a secure payment link right away.'; }
    vessel.level = Math.min(1, Math.max(0.06, usd / 300));
    const url = new URL(location.href);
    url.searchParams.set('fund', state.fund); url.searchParams.set('amount', state.amount); url.searchParams.set('cur', state.cur);
    history.replaceState(null, '', url);
  }

  /* the vessel: water rises with your gift */
  const vessel = { level: 0.3, shown: 0.05 };
  const cv = $('[data-vessel]'), ctx = cv.getContext('2d');
  function size() { const r = cv.getBoundingClientRect(); const d = Math.min(devicePixelRatio, 2); cv.width = r.width * d; cv.height = r.height * d; }
  size(); window.addEventListener('resize', size);
  let t = 0;
  (function draw() {
    requestAnimationFrame(draw);
    t += reduced ? 0 : 0.016;
    vessel.shown += (vessel.level - vessel.shown) * 0.05;
    const w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    const base = h * (1 - vessel.shown);
    const wave = (amp, len, speed, phase, color) => {
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) ctx.lineTo(x, base + Math.sin(x / (w / len) + t * speed + phase) * amp * h);
      ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    };
    wave(0.022, 1.3, 1.4, 0, 'rgba(184,81,46,0.85)');
    wave(0.018, 1.8, -1.1, 2, 'rgba(242,181,58,0.9)');
    // light caustics
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 6; k++) {
      const x = (Math.sin(t * 0.4 + k * 1.7) * 0.4 + 0.5) * w, y = base + h * 0.08 + k * h * 0.05;
      const g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.12);
      g.addColorStop(0, 'rgba(255,240,200,0.10)'); g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
  })();

  /* zakat */
  const zf = $('[data-zakat]');
  const v = id => +($('#' + id).value || 0);
  const onZakat = () => {
    const assets = v('z-cash') + v('z-gold') + v('z-inv') + v('z-biz');
    const net = Math.max(0, assets - v('z-debt'));
    const nisab = v('z-nisab');
    const out = $('[data-z-out]'), note = $('[data-z-note]'), give = $('[data-z-give]');
    if (!assets) { out.textContent = '0.00'; note.textContent = 'Enter your figures above.'; give.hidden = true; return; }
    if (nisab && net < nisab) { out.textContent = '0.00'; note.textContent = `Your net wealth (${net.toLocaleString()}) is below the nisab, so no Zakat is due. Sadaqah is always welcome.`; give.hidden = true; return; }
    const z = net * 0.025;
    const zc = $('#z-cur').value;
    out.textContent = fmt(z, zc);
    note.textContent = nisab ? `2.5% of your net zakatable wealth of ${net.toLocaleString()}.` : `2.5% of ${net.toLocaleString()}. Add the nisab to confirm Zakat is due.`;
    give.hidden = false;
    give.onclick = e => {
      e.preventDefault();
      state.fund = 'zakat'; state.cur = zc; state.amount = Math.round(z);
      $$('[data-c]').forEach(x => x.setAttribute('aria-pressed', x.dataset.c === zc));
      $$('[data-fund]').forEach(x => x.setAttribute('aria-checked', x.dataset.fund === 'zakat'));
      renderAmounts(); update();
      toast(`Zakat of ${fmt(state.amount, state.cur)} selected. Choose how to give.`);
      document.querySelector('.donate-form').scrollIntoView({ behavior: 'smooth' });
    };
  };
  zf.addEventListener('input', onZakat);
  zf.addEventListener('change', onZakat);

  $$('[data-c]').forEach(x => x.setAttribute('aria-pressed', x.dataset.c === state.cur));
  renderAmounts(); update();
});
