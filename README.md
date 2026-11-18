# BuildCalc

Bilingual (Spanish & English) static construction material calculators for **Concrete**, **Paint**, and **Flooring & Tiles**, with metric & imperial units, waste allowance, and step-by-step breakdowns.

- Live site: https://buildcalc-c16f.onrender.com/
- Project directory: [`buildcalc/`](./buildcalc/)
- Commands (run inside `buildcalc/`):
  - `npm run build` — generates the static site into `buildcalc/docs/`
  - `npm run test:unit` — runs core math, unit conversion, and validation tests
  - `npm run test:build` — builds and validates JSON, SEO, hreflang, sitemap, links, and size budgets
  - `npm run test:e2e` — runs Playwright Chromium E2E tests
  - `npm run serve` — serves `buildcalc/docs/` locally
