# Buildcalc-
Proyecto

---

# BuildCalc — International construction calculators

> Calculadoras de construcción gratuitas (hormigón, pintura, pisos) · ES/EN · métrico e imperial · sin dependencias en producción.

**Live (once GitHub Pages is enabled):** `https://resktoff.github.io/Buildcalc-/` → redirects to `/es/` or `/en/`.

## Features

| | |
|---|---|
| Calculators | Concrete (slab / cylinder, bags), Paint (room or area, doors/windows, coats, coverage, cans), Flooring (tiles/planks, boxes) |
| Languages | Spanish `/es/…` and English `/en/…` — separate URLs, `hreflang`, language switch on every page |
| Units | Metric ⇄ imperial toggle; typed values are converted; preference persisted in `localStorage` |
| Waste | Configurable percentage on every calculator |
| Results | Instant (on input), with step-by-step formula using the user's numbers |
| Validation | Required / NaN / negative / zero / integer / out-of-range, inline messages + `aria-invalid`, error summary; never shows a wrong number |
| SEO | Canonical, hreflang (es, en, x-default), Open Graph, JSON-LD (WebApplication, FAQPage, BreadcrumbList, WebSite), `sitemap.xml`, `robots.txt`, one `<h1>` per page |
| Accessibility | Skip link, labelled inputs, `aria-live` results, keyboard nav, focus styles, WCAG AA contrast, reduced-motion, dark mode |
| Performance | Zero frameworks, ~10 KB CSS, ~30 KB JS modules, no external requests. Lighthouse (mobile): 99–100 / 100 / 100 / 100 |
| Monetization-ready | Google Analytics, Search Console verification, AdSense slots and affiliate boxes are all **config-driven and off by default** (`site.config.json`) |

## Project structure

```
site.config.json       # site URL, base path, analytics / ads / affiliates switches
src/
  core/                # pure maths — shared by Node tests and the browser
    units.js           #   conversions, unit systems
    validate.js        #   validation rules + sanity limits
    format.js          #   Intl number formatting, interpolation
    calculators/       #   concrete.js, paint.js, flooring.js
  ui/                  # browser modules (app.js bootstrap + one adapter per calculator)
  templates/           # layout.js (shell + SEO head), forms.js, pages.js
  i18n/es.json, en.json
  assets/              # styles.css, favicon.svg, og-image.png, manifest
scripts/build.js       # static site generator → docs/
scripts/serve.js       # tiny static server (preview + e2e)
tests/unit/            # node:test — 25 tests
tests/build.test.js    # SEO / i18n / links / budgets — 13 tests
tests/e2e/             # Playwright (Chromium) — 19 tests
docs/                  # BUILD OUTPUT (committed, served by GitHub Pages)
```

## Commands

```bash
npm install                 # only dev dependency: playwright
npm run build               # regenerate docs/
npm run serve               # http://localhost:4173
npm test                    # unit + build tests (fast, no browser)
npx playwright install chromium && npm run test:e2e   # real-browser tests
```

## Adding / editing content

* **Texts & SEO copy** → `src/i18n/{es,en}.json` (both files must keep identical keys — a test enforces it).
* **Formulas** → `src/core/calculators/*.js` (+ a unit test with a reference value).
* **Form fields** → `src/templates/forms.js` and the matching `src/ui/calc-*.js` adapter.
* **Analytics / Ads / Affiliates** → `site.config.json`:
  * `analytics.gaMeasurementId: "G-XXXX"` injects gtag (IP anonymised).
  * `seo.googleSiteVerification` / `bingSiteVerification` add the meta tags.
  * `ads.enabled: true` + `clientId` + `slots` render AdSense units in the two reserved, non-intrusive positions (below results, home footer). Keep `enabled:false` until approved.
  * `affiliates.enabled: true` + `links: [{label,url,calc}]` renders a clearly disclosed "Recommended tools" box (`rel="sponsored nofollow"`).

Run `npm run build` and commit `docs/` after any change.

## Deployment (free)

See [DEPLOY.md](DEPLOY.md). Short version: GitHub → Settings → Pages → *Deploy from a branch* → `main` / **`/docs`**.

## Status & tests

See [TESTING.md](TESTING.md) for the executed test report and [AUDIT.md](AUDIT.md) for the initial audit and plan.

## License

MIT
