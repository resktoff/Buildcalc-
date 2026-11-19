/**
 * End-to-end tests in real Chromium (Playwright) against the built ./docs site.
 * Run: npm run test:e2e   (requires `npx playwright install chromium`)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from '../../scripts/serve.js';

let server; let browser; let base;
const issues = []; // console errors / failed requests across all pages

before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});

async function openPage(path, { viewport = { width: 1280, height: 900 }, locale = 'en-US', units = null } = {}) {
  const ctx = await browser.newContext({ viewport, locale });
  if (units) await ctx.addInitScript((u) => localStorage.setItem('bc.units', u), units);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') issues.push(`${path} console: ${m.text()}`); });
  page.on('pageerror', (e) => issues.push(`${path} pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) issues.push(`${path} http ${r.status()} ${r.url()}`); });
  await page.goto(base + path);
  return { page, ctx };
}
const primary = (page) => page.textContent('[data-testid=primary-result]');
/** First numeric token of a result string; last separator (, or .) is treated as decimal (values in tests are < 1000). */
const num = (s) => {
  const tok = String(s).match(/-?\d[\d.,]*/)?.[0] ?? 'NaN';
  const i = Math.max(tok.lastIndexOf(','), tok.lastIndexOf('.'));
  return Number(i === -1 ? tok : tok.slice(0, i).replace(/[.,]/g, '') + '.' + tok.slice(i + 1));
};

/* ---------------- concrete ---------------- */
test('concrete ES metric: 5 × 4 m × 10 cm, 5 % waste → 2.1 m³, 50 kg bags', async () => {
  const { page, ctx } = await openPage('/es/hormigon/', { units: 'metric' });
  await page.waitForSelector('form[data-ready="1"]');
  assert.equal(await page.getAttribute('#results', 'data-state'), 'empty');
  await page.fill('#c-length', '5'); await page.fill('#c-width', '4'); await page.fill('#c-thickness', '10');
  await page.waitForSelector('#results[data-state="ok"]');
  const txt = await primary(page);
  assert.match(txt, /m³/);
  assert.ok(Math.abs(num(txt) - 2.1) < 0.001, txt);
  assert.equal(await page.inputValue('#c-bag'), '50kg');
  const rows = await page.textContent('.result-rows');
  assert.match(rows, /Bolsas de 50 kg/);
  // 2.1 m³ / (50 kg × yield) → ceil(2.1 / 0.023406) = 90
  assert.match(rows, /Bolsas de 50 kg\s*90/);
  const steps = await page.textContent('.result-steps');
  assert.match(steps, /Volumen de 1 elemento = 5 m × 4 m × 0,1 m = 2 m³/);
  await ctx.close();
});

test('concrete EN imperial: 10 × 10 ft × 4 in, 0 % waste → 1.235 yd³, 45 bags/yd³ rule holds', async () => {
  const { page, ctx } = await openPage('/en/concrete/', { units: 'imperial' });
  await page.waitForSelector('form[data-ready="1"]');
  await page.fill('#c-length', '10'); await page.fill('#c-width', '10'); await page.fill('#c-thickness', '4');
  await page.fill('#c-waste', '0');
  await page.waitForSelector('#results[data-state="ok"]');
  const txt = await primary(page);
  assert.match(txt, /yd³/);
  assert.ok(Math.abs(num(txt) - 1.235) < 0.002, txt);
  assert.equal(await page.inputValue('#c-bag'), '80lb');
  const rows = await page.textContent('.result-rows');
  assert.match(rows, /Bags needed\s*56/); // 33.33 ft³ / 0.6 = 55.6 → 56
  await ctx.close();
});

test('concrete: cylinder shape hides slab fields and computes π r² h × quantity', async () => {
  const { page, ctx } = await openPage('/en/concrete/', { units: 'metric' });
  await page.waitForSelector('form[data-ready="1"]');
  await page.check('input[name=shape][value=cylinder]');
  assert.equal(await page.isVisible('#c-length'), false);
  assert.equal(await page.isVisible('#c-diameter'), true);
  await page.fill('#c-diameter', '30'); await page.fill('#c-height', '3'); await page.fill('#c-quantity', '4'); await page.fill('#c-waste', '0');
  await page.waitForSelector('#results[data-state="ok"]');
  const expected = Math.PI * 0.15 * 0.15 * 3 * 4; // 0.848 m³
  assert.ok(Math.abs(num(await primary(page)) - expected) < 0.002);
  await ctx.close();
});

test('concrete: toggling units converts typed values and result stays physically identical', async () => {
  const { page, ctx } = await openPage('/en/concrete/', { units: 'metric' });
  await page.waitForSelector('form[data-ready="1"]');
  await page.fill('#c-length', '5'); await page.fill('#c-width', '4'); await page.fill('#c-thickness', '10'); await page.fill('#c-waste', '0');
  await page.waitForSelector('#results[data-state="ok"]');
  await page.check('input[name=units][value=imperial]');
  assert.ok(Math.abs(Number(await page.inputValue('#c-length')) - 16.404) < 0.01);
  assert.ok(Math.abs(Number(await page.inputValue('#c-thickness')) - 3.937) < 0.01);
  assert.equal(await page.textContent('label[for=c-length] .unit'), 'ft');
  assert.equal(await page.textContent('label[for=c-thickness] .unit'), 'in');
  const txt = await primary(page);
  assert.match(txt, /yd³/);
  assert.ok(Math.abs(num(txt) - 2 / 0.764554857984) < 0.01, txt); // 2 m³ = 2.616 yd³
  // preference persisted
  assert.equal(await page.evaluate(() => localStorage.getItem('bc.units')), 'imperial');
  await ctx.close();
});

/* ---------------- paint ---------------- */
test('paint ES metric: 4×3×2.5 m, 1 door, 1 window, 2 coats, 10 m²/L, 5 % → 6.64 L, 2 × 4 L', async () => {
  const { page, ctx } = await openPage('/es/pintura/', { units: 'metric' });
  await page.waitForSelector('form[data-ready="1"]');
  await page.fill('#p-length', '4'); await page.fill('#p-width', '3'); await page.fill('#p-height', '2.5');
  assert.equal(await page.inputValue('#p-coverage'), '10');
  assert.equal(await page.inputValue('#p-coats'), '2');
  await page.waitForSelector('#results[data-state="ok"]');
  const txt = await primary(page);
  assert.match(txt, /L$/);
  assert.ok(Math.abs(num(txt) - 6.636) < 0.01, txt);
  const rows = await page.textContent('.result-rows');
  assert.match(rows, /Superficie neta \(por mano\)\s*6[.,]32 L/);
  assert.match(rows, /Superficie bruta\s*31[.,]6 m²/);
  assert.match(rows, /Envases necesarios\s*2/);
  await ctx.close();
});

test('paint EN imperial: 12×10×8 ft → 1.89 gal; area mode & ceiling work', async () => {
  const { page, ctx } = await openPage('/en/paint/', { units: 'imperial' });
  await page.waitForSelector('form[data-ready="1"]');
  assert.equal(await page.inputValue('#p-coverage'), '350');
  await page.fill('#p-length', '12'); await page.fill('#p-width', '10'); await page.fill('#p-height', '8');
  await page.waitForSelector('#results[data-state="ok"]');
  assert.ok(Math.abs(num(await primary(page)) - 1.89) < 0.01);
  await page.check('input[name=ceiling]');
  await page.waitForTimeout(50);
  const withCeiling = num(await primary(page)); // +120 ft² ×2 /350 ×1.05 = +0.72
  assert.ok(Math.abs(withCeiling - 2.61) < 0.02, String(withCeiling));
  await page.check('input[name=mode][value=area]');
  assert.equal(await page.isVisible('#p-length'), false);
  await page.fill('#p-area', '350'); await page.fill('#p-doors', '0'); await page.fill('#p-windows', '0'); await page.fill('#p-coats', '1'); await page.fill('#p-waste', '0');
  await page.waitForTimeout(50);
  assert.ok(Math.abs(num(await primary(page)) - 1) < 0.001);
  await ctx.close();
});

test('paint: openings larger than wall area show a warning instead of a negative number', async () => {
  const { page, ctx } = await openPage('/en/paint/', { units: 'metric' });
  await page.waitForSelector('form[data-ready="1"]');
  await page.check('input[name=mode][value=area]');
  await page.fill('#p-area', '2'); await page.fill('#p-doors', '5');
  await page.waitForSelector('#results[data-state="ok"]');
  assert.equal(await page.isVisible('.result-warning'), true);
  assert.equal(num(await primary(page)), 0);
  await ctx.close();
});

/* ---------------- flooring ---------------- */
test('flooring ES metric: 5×4 m, 10 %, 60×60 cm, 4/box → 22 m², 62 pieces, 16 boxes', async () => {
  const { page, ctx } = await openPage('/es/pisos/', { units: 'metric' });
  await page.waitForSelector('form[data-ready="1"]');
  await page.fill('#f-length', '5'); await page.fill('#f-width', '4');
  assert.equal(await page.inputValue('#f-waste'), '10');
  await page.waitForSelector('#results[data-state="ok"]');
  assert.ok(Math.abs(num(await primary(page)) - 22) < 0.001);
  await page.fill('#f-tile-length', '60'); await page.fill('#f-tile-width', '60');
  await page.check('input[name=boxMode][value=pieces]');
  await page.fill('#f-ppb', '4');
  await page.waitForTimeout(50);
  const rows = await page.textContent('.result-rows');
  assert.match(rows, /Piezas necesarias\s*62/);
  assert.match(rows, /Cajas necesarias\s*16/);
  await ctx.close();
});

test('flooring EN imperial: 12×10 ft, 10 %, 12×24 in → 132 ft², 66 tiles; box area mode', async () => {
  const { page, ctx } = await openPage('/en/flooring/', { units: 'imperial' });
  await page.waitForSelector('form[data-ready="1"]');
  await page.fill('#f-length', '12'); await page.fill('#f-width', '10');
  await page.fill('#f-tile-length', '12'); await page.fill('#f-tile-width', '24');
  await page.waitForSelector('#results[data-state="ok"]');
  assert.ok(Math.abs(num(await primary(page)) - 132) < 0.01);
  let rows = await page.textContent('.result-rows');
  assert.match(rows, /Pieces needed\s*66/);
  await page.check('input[name=boxMode][value=area]');
  await page.fill('#f-box-area', '16');
  await page.waitForTimeout(50);
  rows = await page.textContent('.result-rows');
  assert.match(rows, /Boxes needed\s*9/); // 132/16 = 8.25 → 9
  await ctx.close();
});

test('flooring: giving only one tile dimension flags the other as required', async () => {
  const { page, ctx } = await openPage('/en/flooring/', { units: 'metric' });
  await page.waitForSelector('form[data-ready="1"]');
  await page.fill('#f-length', '5'); await page.fill('#f-width', '4'); await page.fill('#f-tile-length', '60');
  await page.click('button[type=submit]');
  assert.equal(await page.getAttribute('#f-tile-width', 'aria-invalid'), 'true');
  assert.match(await page.textContent('#f-tile-width-err'), /required/i);
  await ctx.close();
});

/* ---------------- validation ---------------- */
test('validation: negative, zero, non-integer, out-of-range values block the result with messages', async () => {
  const { page, ctx } = await openPage('/en/concrete/', { units: 'metric' });
  await page.waitForSelector('form[data-ready="1"]');
  await page.fill('#c-length', '-5'); await page.fill('#c-width', '0'); await page.fill('#c-thickness', '99999');
  await page.fill('#c-quantity', '2.5'); await page.fill('#c-waste', '150');
  await page.waitForTimeout(50);
  assert.equal(await page.getAttribute('#results', 'data-state'), 'invalid');
  assert.equal(await page.isVisible('[data-testid=primary-result]'), false);
  assert.match(await page.textContent('#c-length-err'), /greater than 0/);
  assert.match(await page.textContent('#c-width-err'), /greater than 0/);
  assert.match(await page.textContent('#c-thickness-err'), /Cannot exceed/);
  assert.match(await page.textContent('#c-quantity-err'), /whole number/);
  assert.match(await page.textContent('#c-waste-err'), /Cannot exceed/);
  assert.equal(await page.getAttribute('#c-length', 'aria-invalid'), 'true');
  const summary = await page.textContent('[data-error-summary]');
  assert.match(summary, /5 field/);
  // fix → result appears, errors cleared
  await page.fill('#c-length', '5'); await page.fill('#c-width', '4'); await page.fill('#c-thickness', '10');
  await page.fill('#c-quantity', '1'); await page.fill('#c-waste', '5');
  await page.waitForSelector('#results[data-state="ok"]');
  assert.equal(await page.isVisible('[data-error-summary]'), false);
  await ctx.close();
});

test('validation: submitting an empty form focuses the first invalid field; reset restores defaults', async () => {
  const { page, ctx } = await openPage('/es/pintura/', { units: 'metric' });
  await page.waitForSelector('form[data-ready="1"]');
  await page.click('button[type=submit]');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'p-length');
  assert.match(await page.textContent('#p-length-err'), /obligatorio/);
  await page.fill('#p-length', '4'); await page.fill('#p-coverage', '12');
  await page.click('button[type=reset]');
  await page.waitForTimeout(50);
  assert.equal(await page.inputValue('#p-length'), '');
  assert.equal(await page.inputValue('#p-coverage'), '10');
  assert.equal(await page.getAttribute('#results', 'data-state'), 'empty');
  await ctx.close();
});

/* ---------------- bilingual / navigation ---------------- */
test('language switch links between equivalent ES/EN pages and UI strings are translated', async () => {
  const { page, ctx } = await openPage('/es/hormigon/');
  assert.equal(await page.textContent('h1'), 'Calculadora de hormigón');
  await page.click('a.lang-switch');
  await page.waitForURL(/\/en\/concrete\/$/);
  assert.equal(await page.textContent('h1'), 'Concrete calculator');
  assert.equal(await page.getAttribute('html', 'lang'), 'en');
  await page.click('a.lang-switch');
  await page.waitForURL(/\/es\/hormigon\/$/);
  await ctx.close();
});

test('root redirects by browser language (es-AR → /es/, en-US → /en/)', async () => {
  for (const [locale, target] of [['es-AR', '/es/'], ['en-US', '/en/'], ['fr-FR', '/en/']]) {
    const { page, ctx } = await openPage('/', { locale });
    await page.waitForURL(new RegExp(`${target}$`));
    await ctx.close();
  }
});

test('home pages link to all three calculators in each language', async () => {
  for (const [path, slugs] of [['/es/', ['hormigon', 'pintura', 'pisos']], ['/en/', ['concrete', 'paint', 'flooring']]]) {
    const { page, ctx } = await openPage(path);
    for (const s of slugs) assert.ok(await page.$(`a.calc-card[href$="/${s}/"]`), `${path} missing card ${s}`);
    await ctx.close();
  }
});

/* ---------------- mobile / a11y ---------------- */
test('mobile (390px): no horizontal overflow, nav toggle works, inputs ≥ 44px tall', async () => {
  const { page, ctx } = await openPage('/en/flooring/', { viewport: { width: 390, height: 844 } });
  await page.waitForSelector('form[data-ready="1"]');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false, 'horizontal overflow on mobile');
  assert.equal(await page.isVisible('#site-nav'), false);
  await page.click('[data-nav-toggle]');
  assert.equal(await page.isVisible('#site-nav'), true);
  assert.equal(await page.getAttribute('[data-nav-toggle]', 'aria-expanded'), 'true');
  const h = await page.evaluate(() => document.querySelector('#f-length').getBoundingClientRect().height);
  assert.ok(h >= 44, `input height ${h}`);
  const btn = await page.evaluate(() => document.querySelector('button[type=submit]').getBoundingClientRect().height);
  assert.ok(btn >= 44);
  await ctx.close();
});

test('keyboard: skip link is first tab stop and results region is aria-live', async () => {
  const { page, ctx } = await openPage('/en/concrete/');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
  assert.equal(await page.getAttribute('#results', 'aria-live'), 'polite');
  await ctx.close();
});


test('mobile sticky result bar mirrors the primary result and is hidden on desktop', async () => {
  const { page, ctx } = await openPage('/es/pisos/', { viewport: { width: 390, height: 844 }, units: 'metric' });
  await page.waitForSelector('form[data-ready="1"]');
  assert.equal(await page.isVisible('[data-result-bar]'), false);
  await page.fill('#f-length', '5'); await page.fill('#f-width', '4');
  await page.waitForSelector('#results[data-state="ok"]');
  assert.equal(await page.isVisible('[data-result-bar]'), true);
  assert.equal(await page.textContent('[data-result-bar-value]'), await primary(page));
  await page.fill('#f-length', '-1');
  await page.waitForTimeout(50);
  assert.equal(await page.isVisible('[data-result-bar]'), false);
  await ctx.close();
  const d = await openPage('/es/pisos/', { units: 'metric' });
  await d.page.fill('#f-length', '5'); await d.page.fill('#f-width', '4');
  await d.page.waitForSelector('#results[data-state="ok"]');
  assert.equal(await d.page.isVisible('[data-result-bar]'), false);
  await d.ctx.close();
});

test('no console errors, page errors or HTTP ≥ 400 across all visited pages', () => {
  assert.deepEqual(issues, []);
});
