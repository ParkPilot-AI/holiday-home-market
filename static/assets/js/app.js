/* Holiday Home Market — site behaviour (no dependencies) */
(function () {
  'use strict';
  const cfg = window.HHM_CONFIG || { REGIONS: [], TRADE_PRICE: 5 };
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const gbp = (n) => '£' + Number(n).toLocaleString('en-GB');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- nav ----------
  const toggle = $('.nav-toggle');
  if (toggle) toggle.addEventListener('click', () => {
    const nav = $('#site-nav');
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  // ---------- region selects ----------
  $$('select[data-regions]').forEach((sel) => {
    cfg.REGIONS.forEach((r) => sel.insertAdjacentHTML('beforeend', `<option value="${esc(r)}">${esc(r)}</option>`));
  });

  // ---------- data ----------
  let dataPromise;
  function loadListings() {
    if (!dataPromise) dataPromise = fetch('/data/search.json').then((r) => r.ok ? r.json() : []).catch(() => []);
    return dataPromise;
  }

  function card(l) {
    const img = (l.images && l.images[0]) || '/assets/img/listings/placeholder.svg';
    const badge = l.status === 'sold' ? '<span class="badge badge--sold">Sold</span>'
      : l.seller === 'trade' ? '<span class="badge badge--trade">Trade</span>'
      : '<span class="badge badge--private">Private sale</span>';
    const price = l.priceOnApplication ? 'POA' : gbp(l.price);
    const facts = [
      l.type === 'lodge' ? 'Lodge' : 'Static caravan',
      l.bedrooms ? `${l.bedrooms} bed` : '',
      l.berths ? `Sleeps ${l.berths}` : '',
      l.year ? String(l.year) : '',
    ].filter(Boolean).map((f) => `<span>${esc(f)}</span>`).join('');
    return `<a class="card${l.status === 'sold' ? ' card--sold' : ''}" href="${esc(l.url)}">
      <div class="card__img"><img src="${esc(img)}" alt="" loading="lazy">${badge}</div>
      <div class="card__body">
        <span class="card__price">${price}</span>
        <span class="card__title">${esc(l.title)}</span>
        <p class="card__meta">${esc([l.park, l.county].filter(Boolean).join(', '))}${l.example ? ' · example listing' : ''}</p>
        <div class="card__facts">${facts}</div>
      </div></a>`;
  }

  // ---------- home ----------
  const featured = $('#featured');
  if (featured) loadListings().then((all) => {
    const pick = all.filter((l) => l.status !== 'sold')
      .sort((a, b) => (b.featured === true) - (a.featured === true) || new Date(b.dateListed) - new Date(a.dateListed))
      .slice(0, 6);
    featured.innerHTML = pick.length ? pick.map(card).join('') : '<p class="empty">No homes listed yet. <a href="/sell/">Be the first to advertise.</a></p>';
  });
  const regionList = $('#region-list');
  if (regionList) loadListings().then((all) => {
    regionList.innerHTML = cfg.REGIONS.map((r) => {
      const n = all.filter((l) => l.region === r && l.status !== 'sold').length;
      return `<li><a href="/browse/?region=${encodeURIComponent(r)}">${esc(r)} <span>${n} ${n === 1 ? 'home' : 'homes'}</span></a></li>`;
    }).join('');
  });

  // ---------- browse ----------
  const results = $('#results');
  if (results) {
    const form = $('#filters-form');
    const count = $('#result-count');
    const sort = $('#sort');
    const params = new URLSearchParams(location.search);
    // Prefill from URL
    for (const [k, v] of params) {
      const el = form.elements[k];
      if (!el) continue;
      if (el instanceof RadioNodeList) { $$(`input[name="${k}"]`, form).forEach((r) => { r.checked = r.value === v; }); }
      else el.value = v;
    }
    if (params.get('sort')) sort.value = params.get('sort');

    const fT = $('.filters-toggle');
    if (fT) fT.addEventListener('click', () => {
      const open = $('.filters').classList.toggle('is-open');
      fT.setAttribute('aria-expanded', String(open));
    });

    function apply(all) {
      const f = Object.fromEntries(new FormData(form));
      const q = (f.q || '').trim().toLowerCase();
      let list = all.filter((l) => {
        if (f.type && f.type !== 'any' && l.type !== f.type) return false;
        if (f.seller && f.seller !== 'any' && l.seller !== f.seller) return false;
        if (f.region && l.region !== f.region) return false;
        if (f.min && Number(l.price) < Number(f.min)) return false;
        if (f.max && Number(l.price) > Number(f.max)) return false;
        if (f.bedrooms && Number(l.bedrooms) < Number(f.bedrooms)) return false;
        if (f.pets && l.pets !== true) return false;
        if (f.twelve && Number(l.seasonMonths) < 12) return false;
        if (!f.sold && l.status === 'sold') return false;
        if (q) {
          const hay = [l.title, l.park, l.town, l.county, l.make, l.model, l.description, l.tradeName].join(' ').toLowerCase();
          if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
        }
        return true;
      });
      const s = sort.value;
      list.sort((a, b) => s === 'price-asc' ? a.price - b.price
        : s === 'price-desc' ? b.price - a.price
        : s === 'year-desc' ? b.year - a.year
        : new Date(b.dateListed) - new Date(a.dateListed));
      count.textContent = `${list.length} ${list.length === 1 ? 'home' : 'homes'} for sale`;
      results.innerHTML = list.length ? list.map(card).join('')
        : `<div class="empty"><h2>No homes match those filters</h2><p>Try a wider price range or another region, or clear the filters to see everything.</p><button class="btn btn--quiet" type="button" id="clear-empty">Clear filters</button></div>`;
      const ce = $('#clear-empty');
      if (ce) ce.addEventListener('click', clear);
      // Keep the URL shareable
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(f)) if (v && v !== 'any') p.set(k, v);
      if (s !== 'newest') p.set('sort', s);
      history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname);
    }
    function clear() { form.reset(); sort.value = 'newest'; loadListings().then(apply); }
    loadListings().then((all) => {
      apply(all);
      form.addEventListener('input', () => apply(all));
      form.addEventListener('submit', (e) => { e.preventDefault(); apply(all); });
      sort.addEventListener('change', () => apply(all));
      $('#clear-filters').addEventListener('click', clear);
    });
  }

  // ---------- listing page ----------
  const mainImg = $('#gallery-main');
  if (mainImg) $$('.thumb').forEach((t) => t.addEventListener('click', () => {
    mainImg.src = t.dataset.src;
    $$('.thumb').forEach((x) => x.classList.toggle('is-active', x === t));
  }));
  $$('[data-reveal]').forEach((b) => b.addEventListener('click', () => {
    const tel = b.dataset.reveal;
    const a = document.createElement('a');
    a.href = 'tel:' + tel.replace(/\s+/g, '');
    a.textContent = tel;
    a.className = 'listing__phone';
    b.replaceWith(a);
  }));

  // ---------- forms (Netlify Forms, submitted with fetch) ----------
  $$('form[data-netlify-ajax]').forEach((form) => {
    const status = $('.form-status', form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const btn = $('button[type="submit"]', form);
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending…';
      if (status) status.textContent = '';
      const ref = 'HHM-' + Date.now().toString(36).toUpperCase();
      const refField = form.elements['reference'];
      if (refField) refField.value = ref;
      try {
        const hasFiles = $$('input[type="file"]', form).some((i) => i.files.length);
        const fd = new FormData(form);
        const res = await fetch('/', hasFiles
          ? { method: 'POST', body: fd }
          : { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fd).toString() });
        if (!res.ok) throw new Error(res.status);
        const next = form.dataset.next || '/thanks/';
        if (form.dataset.payment === 'trade' && cfg.TRADE_PAYMENT_LINK) {
          const qty = Math.max(1, Number(form.elements['listing_count']?.value || 1));
          const url = new URL(cfg.TRADE_PAYMENT_LINK);
          url.searchParams.set('client_reference_id', ref);
          const email = form.elements['email']?.value;
          if (email) url.searchParams.set('prefilled_email', email);
          sessionStorage.setItem('hhm_trade_qty', String(qty));
          location.href = url.toString();
          return;
        }
        location.href = `${next}?ref=${encodeURIComponent(ref)}`;
      } catch (err) {
        btn.disabled = false; btn.textContent = label;
        if (status) status.textContent = 'Your advert wasn’t sent — check your connection and try again. Photos must be under 8MB in total.';
      }
    });
  });

  // Trade order total
  const qty = $('#listing_count');
  if (qty) {
    const out = $('#trade-total');
    const upd = () => { const n = Math.max(1, Number(qty.value) || 1); out.textContent = gbp(n * cfg.TRADE_PRICE); };
    qty.addEventListener('input', upd); upd();
    const pay = $('#payment-note');
    if (pay) pay.textContent = cfg.TRADE_PAYMENT_LINK
      ? 'After you send your details you’ll go to our secure card payment page (Stripe).'
      : 'After you send your details we’ll email you a secure payment link. Your listings go live once payment clears.';
  }

  // Reference on thanks page
  const refOut = $('#ref-out');
  if (refOut) { const r = new URLSearchParams(location.search).get('ref'); if (r) refOut.textContent = r; else refOut.closest('p')?.remove(); }

  // Listing ref on enquiry forms
  const year = new Date().getFullYear();
  $$('input[data-year-max]').forEach((i) => { i.max = year + 1; });
})();
