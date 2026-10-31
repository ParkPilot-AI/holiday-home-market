#!/usr/bin/env node
/*
 * Holiday Home Market — zero-dependency static site builder.
 *
 *   node build.js
 *
 * - Copies /static to /public
 * - Renders every page in /src/pages with the shared partials
 * - Generates one page per listing at /listings/<slug>/ from static/data/listings.json
 * - Writes sitemap.xml
 *
 * Pages start with optional meta comments:
 *   <!--title: Page title-->
 *   <!--description: Meta description-->
 *   <!--nav: browse-->
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const STATIC = path.join(ROOT, 'static');
const OUT = path.join(ROOT, 'public');
const SITE_URL = (process.env.URL || 'https://holidayhomemarket.netlify.app').replace(/\/$/, '');
const SITE_NAME = 'Holiday Home Market';

const read = (p) => fs.readFileSync(p, 'utf8');
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}
function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

const partials = {
  head: read(path.join(SRC, 'partials/head.html')),
  header: read(path.join(SRC, 'partials/header.html')),
  footer: read(path.join(SRC, 'partials/footer.html')),
};

function parseMeta(src) {
  const meta = {};
  const body = src.replace(/^\s*<!--(\w+):\s*([\s\S]*?)-->\s*/gm, (_, k, v) => { meta[k] = v.trim(); return ''; });
  return { meta, body };
}

function layout({ title, description, nav = '', canonical, body, extraHead = '' }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — static caravans and lodges for sale`;
  let header = partials.header;
  // Mark the active nav item
  header = header.replace(new RegExp(`data-nav="${nav}"`, 'g'), `data-nav="${nav}" aria-current="page"`);
  const head = partials.head
    .replace(/{{title}}/g, esc(fullTitle))
    .replace(/{{description}}/g, esc(description || 'Buy and sell static caravans and holiday lodges across the UK. Free adverts for private sellers. Trade listings £5.'))
    .replace(/{{canonical}}/g, esc(canonical))
    .replace(/{{extraHead}}/g, extraHead);
  return `<!doctype html>\n<html lang="en-GB">\n${head}\n<body>\n<a class="skip" href="#main">Skip to content</a>\n${header}\n<main id="main">\n${body}\n</main>\n${partials.footer.replace(/{{year}}/g, new Date().getFullYear())}\n</body>\n</html>\n`;
}

// ---------- helpers for listings ----------
const gbp = (n) => '£' + Number(n).toLocaleString('en-GB');
function slugFor(l) {
  return l.slug || `${String(l.id).toLowerCase()}-${String(l.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
}
function specRows(l) {
  const rows = [
    ['Type', l.type === 'lodge' ? 'Lodge' : 'Static caravan'],
    ['Year', l.year],
    ['Make and model', [l.make, l.model].filter(Boolean).join(' ')],
    ['Size', l.length && l.width ? `${l.length}ft × ${l.width}ft` : ''],
    ['Bedrooms', l.bedrooms],
    ['Sleeps', l.berths],
    ['Park', l.park],
    ['Location', [l.town, l.county].filter(Boolean).join(', ')],
    ['Site fees', l.siteFees ? `${gbp(l.siteFees)} a year` : ''],
    ['Season', l.seasonMonths ? (Number(l.seasonMonths) >= 12 ? '12-month season' : `${l.seasonMonths}-month season`) : ''],
    ['Pets', l.pets === true ? 'Allowed' : l.pets === false ? 'Not allowed' : ''],
    ['Sited', l.sited === false ? 'Off site — buyer arranges siting' : l.sited === true ? 'On a pitch, ready to use' : ''],
  ];
  return rows.filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
}

function listingPage(l, template) {
  const slug = slugFor(l);
  const images = (l.images && l.images.length ? l.images : ['/assets/img/listings/placeholder.svg']);
  const gallery = images.map((src, i) => `<button class="thumb${i === 0 ? ' is-active' : ''}" type="button" data-src="${esc(src)}" aria-label="Show photo ${i + 1} of ${images.length}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('');
  const features = (l.features || []).map((f) => `<li>${esc(f)}</li>`).join('');
  const sellerLabel = l.seller === 'trade' ? esc(l.tradeName || 'Trade seller') : 'Private seller';
  const sellerBadge = l.seller === 'trade' ? '<span class="badge badge--trade">Trade</span>' : '<span class="badge badge--private">Private sale</span>';
  const statusBanner = l.status === 'sold' ? '<p class="notice notice--sold">This holiday home has been sold. <a href="/browse/">See similar homes</a>.</p>' : '';
  const exampleBanner = l.example ? '<p class="notice">This is an example listing, shown so you can see how adverts look. It isn’t a real home for sale.</p>' : '';
  const desc = String(l.description || '').split(/\n\s*\n/).map((p) => `<p>${esc(p)}</p>`).join('');
  const phone = l.phone ? `<p class="seller-phone"><button class="btn btn--quiet" type="button" data-reveal="${esc(l.phone)}">Show phone number</button></p>` : '';

  const body = template
    .replace(/{{statusBanner}}/g, statusBanner + exampleBanner)
    .replace(/{{title}}/g, esc(l.title))
    .replace(/{{price}}/g, l.priceOnApplication ? 'Price on application' : gbp(l.price))
    .replace(/{{location}}/g, esc([l.park, l.county].filter(Boolean).join(', ')))
    .replace(/{{mainImage}}/g, esc(images[0]))
    .replace(/{{mainAlt}}/g, esc(`${l.title} — photo`))
    .replace(/{{gallery}}/g, images.length > 1 ? gallery : '')
    .replace(/{{specs}}/g, specRows(l))
    .replace(/{{description}}/g, desc)
    .replace(/{{features}}/g, features ? `<h2>Features</h2><ul class="ticks">${features}</ul>` : '')
    .replace(/{{sellerBadge}}/g, sellerBadge)
    .replace(/{{sellerLabel}}/g, sellerLabel)
    .replace(/{{phone}}/g, phone)
    .replace(/{{ref}}/g, esc(l.id))
    .replace(/{{listed}}/g, esc(new Date(l.dateListed).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })));

  const jsonld = {
    '@context': 'https://schema.org', '@type': 'Product', name: l.title,
    description: String(l.description || '').slice(0, 300), image: images.map((s) => SITE_URL + s),
    offers: { '@type': 'Offer', priceCurrency: 'GBP', price: l.price, availability: l.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock' },
  };
  const ogImage = SITE_URL + images[0];
  return {
    slug,
    html: layout({
      title: `${l.title} — ${l.priceOnApplication ? 'POA' : gbp(l.price)}`,
      description: `${l.type === 'lodge' ? 'Holiday lodge' : 'Static caravan'} for sale at ${l.park}, ${l.county}. ${l.bedrooms} bedrooms, sleeps ${l.berths}. ${l.seller === 'trade' ? 'Trade' : 'Private'} sale.`,
      nav: 'browse',
      canonical: `${SITE_URL}/listings/${slug}/`,
      body,
      extraHead: `<meta property="og:image" content="${esc(ogImage)}">\n<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>`,
    }),
  };
}

// ---------- build ----------
rmrf(OUT);
copyDir(STATIC, OUT);

const urls = [];
for (const file of fs.readdirSync(path.join(SRC, 'pages'))) {
  if (!file.endsWith('.html')) continue;
  const { meta, body } = parseMeta(read(path.join(SRC, 'pages', file)));
  const name = file.replace(/\.html$/, '');
  let rel; let urlPath;
  if (name === 'index') { rel = 'index.html'; urlPath = '/'; }
  else if (name === '404') { rel = '404.html'; urlPath = null; }
  else { rel = `${name}/index.html`; urlPath = `/${name}/`; }
  write(rel, layout({ ...meta, canonical: `${SITE_URL}${urlPath || '/'}`, body }));
  if (urlPath && meta.sitemap !== 'no') urls.push(urlPath);
}

const data = JSON.parse(read(path.join(STATIC, 'data/listings.json')));
const template = read(path.join(SRC, 'templates/listing.html'));
const live = (data.listings || []).filter((l) => l.status !== 'draft');
const index = [];
for (const l of live) {
  const { slug, html } = listingPage(l, template);
  write(`listings/${slug}/index.html`, html);
  urls.push(`/listings/${slug}/`);
  index.push({ ...l, url: `/listings/${slug}/` });
}
// Public search index used by the browse page (drafts and phone numbers excluded)
write('data/search.json', JSON.stringify(index.map(({ phone, ...rest }) => rest)));
// Raw listings file stays CMS-only; don't publish phone numbers in it
fs.rmSync(path.join(OUT, 'data/listings.json'));

const today = new Date().toISOString().slice(0, 10);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nDisallow: /admin/\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`Built ${urls.length} pages (${live.length} listings) into /public`);
