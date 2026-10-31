# Holiday Home Market

Static caravan and lodge advertising site. Free adverts for private sellers, £5 per listing for trade. Hosted on Netlify, no database and no paid services needed to run it.

## How it works

| Piece | What it does |
|---|---|
| `src/pages/` | Site pages (home, browse, sell, trade, help, guide, safety, about, contact, terms, privacy) |
| `src/templates/listing.html` | Template for every listing page |
| `static/data/listings.json` | **All listings live here.** Edit by hand or through `/admin/` |
| `static/assets/js/config.js` | Trade price, Stripe payment link, contact email, region list |
| `build.js` | Zero-dependency build: renders pages, one page per listing, `search.json`, sitemap |
| `netlify.toml` | Build settings, headers, short redirects |

Netlify runs `node build.js` and publishes `public/`. To preview locally:

```
node build.js && npx serve public
```

## Adverts flow

1. **Private seller** fills in `/sell/` → arrives in Netlify → **Forms → private-advert**, with photos.
2. You check it, then add it at `/admin/` (or edit `listings.json`) with status `live`. Netlify rebuilds in about a minute.
3. **Buyer enquiries** arrive in **Forms → enquiry** with the advert reference. Forward them to the seller.
4. **Trade** fills in `/trade/` → **Forms → trade-advert** → sent to Stripe to pay £5 × number of homes (or emailed a link if no Stripe link is set).

Turn on email notifications for each form: Netlify → Project → Forms → Form notifications → Add notification → Email.

## Setup checklist

- [ ] **Forms:** Netlify → Forms → Enable form detection, then redeploy once.
- [ ] **Stripe (trade payments):** Create a Payment Link for £5.00 with "let customers adjust quantity" on. Set its confirmation page to redirect to `https://YOUR-SITE/trade-paid/`. Paste the link into `TRADE_PAYMENT_LINK` in `static/assets/js/config.js`.
- [ ] **Admin (`/admin/`):** Create a GitHub OAuth app (GitHub → Settings → Developer settings → OAuth Apps) with callback URL `https://api.netlify.com/auth/done`. In Netlify → Project configuration → Access & security → OAuth → Install provider → GitHub, paste the client ID and secret. Then sign in at `/admin/` with a GitHub account that can push to this repo.
- [ ] Update `site_url` in `static/admin/config.yml` and the contact email in `config.js` and the pages.
- [ ] Replace the example listings (they're marked `example: true`) once real adverts arrive.
- [ ] Have `terms` and `privacy` reviewed, and add company details.
- [ ] Add a custom domain in Netlify → Domain management.
