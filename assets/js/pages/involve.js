import { bootPage, $, getSite } from '../core.js';

bootPage(async () => {
  const site = await getSite().catch(() => ({}));
  const form = $('[data-volunteer]'), status = $('[data-status]');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const name = (fd.get('name') || '').trim(), phone = (fd.get('phone') || '').trim();
    if (!name || !phone) { status.textContent = 'Please add your name and phone number.'; status.style.color = 'var(--clay)'; (name ? $('#v-phone') : $('#v-name')).focus(); return; }
    const interests = fd.getAll('interest').join(', ') || 'Anything';
    const endpoint = site.forms?.volunteerEndpoint;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; status.style.color = ''; status.textContent = 'Sending…';
    if (endpoint) {
      try {
        const res = await fetch(endpoint, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error();
        form.reset(); status.textContent = 'Thank you! Your details were sent. We’ll be in touch soon.';
      } catch { status.textContent = 'Couldn’t send just now. Please try WhatsApp instead.'; status.style.color = 'var(--clay)'; }
      btn.disabled = false;
      return;
    }
    // no form service configured: hand the details to WhatsApp, which everyone here uses
    const text = `Assalamu alaikum! I'd like to volunteer with Ahlul Kheir.\n\nName: ${name}\nPhone: ${phone}\nEmail: ${fd.get('email') || '-'}\nBased in: ${fd.get('location') || '-'}\nInterests: ${interests}\n${fd.get('message') ? '\n' + fd.get('message') : ''}`;
    window.open(`https://wa.me/${site.contact?.whatsapp || '254723802894'}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    status.textContent = 'WhatsApp has opened with your details. Just press send.';
    btn.disabled = false;
  });
});
