/**
 * Build / SEO / i18n integrity tests. Run after `npm run build`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { document as renderDocument } from '../src/templates/layout.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs');
const config = JSON.parse(await fs.readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
const es = JSON.parse(await fs.readFile(path.join(ROOT, 'src/i18n/es.json'), 'utf8'));
const en = JSON.parse(await fs.readFile(path.join(ROOT, 'src/i18n/en.json'), 'utf8'));
const BASE = `${config.siteUrl.replace(/\/+$/, '')}${config.basePath ? `/${config.basePath.replace(/^\/+|\/+$/g, '')}` : ''}/`;

const read = (rel) => fs.readFile(path.join(OUT, rel), 'utf8');
const exists = async (rel) => !!(await fs.stat(path.join(OUT, rel)).catch(() => null));

const PAGES = {
  es: ['es/', 'es/hormigon/', 'es/pintura/', 'es/pisos/', 'es/privacidad/'],
  en: ['en/', 'en/concrete/', 'en/paint/', 'en/flooring/', 'en/privacy/'],
};
const PAIRS = PAGES.es.map((p, i) => [p, PAGES.en[i]]);

function keyPaths(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...keyPaths(v, p));
    else out.push(p + (Array.isArray(v) ? `[${v.length}]` : ''));
  }
  return out.sort();
}

test('i18n: es.json and en.json have identical key structure (incl. array lengths)', () => {
  const a = keyPaths(es);
  const b = keyPaths(en);
  assert.deepEqual(a, b);
});

test('i18n: no untranslated placeholders left in templates', () => {
  for (const [lang, d] of [['es', es], ['en', en]]) {
    const str = JSON.stringify(d);
    assert.ok(!/TODO|FIXME|lorem ipsum/.test(str), `${lang}.json contains TODO/FIXME/lorem ipsum`);
  }
});

test('all expected pages, sitemap, robots, 404, root redirect and assets exist', async () => {
  for (const p of [...PAGES.es, ...PAGES.en]) assert.ok(await exists(`${p}index.html`), `missing ${p}`);
  for (const f of ['index.html', '404.html', 'sitemap.xml', 'robots.txt', '.nojekyll',
    'assets/css/styles.css', 'assets/js/ui/app.js', 'assets/js/core/units.js', 'assets/js/core/calculators/concrete.js',
    'assets/favicon.svg', 'assets/og-image.png', 'assets/apple-touch-icon.png', 'assets/site.webmanifest']) {
    assert.ok(await exists(f), `missing ${f}`);
  }
});

test('each page has lang, title, description, canonical, hreflang es/en/x-default, OG, viewport', async () => {
  for (const lang of ['es', 'en']) {
    for (const p of PAGES[lang]) {
      const html = await read(`${p}index.html`);
      assert.match(html, new RegExp(`<html lang="${lang}"`), `${p} lang`);
      assert.match(html, /<title>[^<]{10,70}<\/title>/, `${p} title length`);
      const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
      assert.ok(desc && desc.length >= 50 && desc.length <= 170, `${p} description length (${desc?.length})`);
      assert.ok(html.includes(`<link rel="canonical" href="${BASE}${p}">`), `${p} canonical`);
      assert.match(html, /hreflang="es"/, `${p} hreflang es`);
      assert.match(html, /hreflang="en"/, `${p} hreflang en`);
      assert.match(html, /hreflang="x-default"/, `${p} x-default`);
      assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
      assert.match(html, /property="og:title"/);
      assert.match(html, /<h1[ >]/, `${p} h1`);
      assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${p} exactly one h1`);
      assert.match(html, /<meta name="robots" content="index, follow/, `${p} indexable`);
    }
  }
});

test('hreflang pairs are symmetric between ES and EN pages', async () => {
  for (const [pEs, pEn] of PAIRS) {
    const hEs = await read(`${pEs}index.html`);
    const hEn = await read(`${pEn}index.html`);
    assert.ok(hEs.includes(`hreflang="en" href="${BASE}${pEn}"`), `${pEs} → ${pEn}`);
    assert.ok(hEn.includes(`hreflang="es" href="${BASE}${pEs}"`), `${pEn} → ${pEs}`);
    // language switch link resolves to the sibling page
    assert.ok(hEs.includes(`class="lang-switch" href="../../${pEn}"`) || hEs.includes(`class="lang-switch" href="../${pEn}"`), `${pEs} lang switch`);
  }
});

test('calculator pages ship JSON-LD (WebApplication, FAQPage, BreadcrumbList) and client i18n', async () => {
  for (const p of [...PAGES.es.slice(1, 4), ...PAGES.en.slice(1, 4)]) {
    const html = await read(`${p}index.html`);
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(ld, `${p} json-ld`);
    const parsed = JSON.parse(ld);
    const types = parsed.map((x) => x['@type']);
    assert.deepEqual(types, ['WebApplication', 'FAQPage', 'BreadcrumbList']);
    assert.ok(parsed[1].mainEntity.length >= 3);
    const i18n = html.match(/<script type="application\/json" id="bc-i18n">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(i18n, `${p} client i18n`);
    const parsedI18n = JSON.parse(i18n);
    assert.ok(parsedI18n.calc.steps && parsedI18n.common.errors);
    assert.match(html, /<form class="calc-form card" data-calc="(concrete|paint|flooring)" novalidate/);
  }
});

test('every form input has an associated <label for> and error container', async () => {
  for (const p of [...PAGES.es.slice(1, 4), ...PAGES.en.slice(1, 4)]) {
    const html = await read(`${p}index.html`);
    const ids = [...html.matchAll(/<(?:input|select) [^>]*id="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(ids.length >= 5);
    for (const id of ids) assert.ok(html.includes(`for="${id}"`), `${p}: no label for #${id}`);
    const fields = [...html.matchAll(/data-field="([^"]+)"/g)].map((m) => m[1]);
    for (const f of fields) {
      if (f === 'ceiling') continue;
      assert.match(html, new RegExp(`data-field="${f}"[\\s\\S]*?class="field-error"`), `${p}: ${f} missing error container`);
    }
  }
});

test('all relative links/assets in pages resolve to real files', async () => {
  for (const p of [...PAGES.es, ...PAGES.en]) {
    const html = await read(`${p}index.html`);
    const refs = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)].map((m) => m[1])
      .filter((h) => !/^(https?:|mailto:|data:)/.test(h));
    for (const ref of refs) {
      const target = path.normalize(path.join(OUT, p, ref));
      const isDir = ref.endsWith('/');
      const file = isDir ? path.join(target, 'index.html') : target;
      assert.ok(await fs.stat(file).catch(() => null), `${p}: broken link ${ref}`);
    }
  }
});

test('sitemap lists every indexable page with hreflang alternates; robots points to it', async () => {
  const sm = await read('sitemap.xml');
  for (const p of [...PAGES.es, ...PAGES.en]) assert.ok(sm.includes(`<loc>${BASE}${p}</loc>`), `sitemap missing ${p}`);
  assert.ok(!sm.includes('404.html'));
  assert.ok(!sm.includes(`<loc>${BASE}</loc>`), 'root redirect must not be in sitemap');
  assert.equal((sm.match(/hreflang="x-default"/g) || []).length, PAGES.es.length + PAGES.en.length);
  const robots = await read('robots.txt');
  assert.ok(robots.includes(`Sitemap: ${BASE}sitemap.xml`));
  assert.match(robots, /Allow: \//);
});

test('root redirect and 404 are noindex; root offers both languages', async () => {
  const root = await read('index.html');
  assert.match(root, /noindex/);
  assert.match(root, /href="es\/"/);
  assert.match(root, /href="en\/"/);
  assert.match(root, /<noscript><meta http-equiv="refresh"/);
  const nf = await read('404.html');
  assert.match(nf, /noindex/);
});

test('analytics / ads are NOT injected while unconfigured (no third-party scripts)', async () => {
  const unconfigured = {
    ...config,
    analytics: { gaMeasurementId: '' },
    ads: { enabled: false, provider: 'adsense', clientId: '', slots: {} },
  };
  const cleanHtml = renderDocument({
    t: en,
    config: unconfigured,
    path: 'en/concrete/',
    alternates: { en: 'en/concrete/', es: 'es/hormigon/' },
    title: 'Test',
    description: 'Test description',
    body: '<p>Test</p>',
  });
  assert.ok(!cleanHtml.includes('googletagmanager.com'), 'GA injected without ID');
  assert.ok(!cleanHtml.includes('adsbygoogle'), 'AdSense injected while disabled');
  assert.ok(!/<script[^>]+src="https?:\/\//.test(cleanHtml), 'unexpected external script');

  const builtHtml = await read('en/concrete/index.html');
  assert.ok(!builtHtml.includes('adsbygoogle'), 'AdSense injected while disabled');

  const calcPages = [
    'es/hormigon/index.html', 'es/pintura/index.html', 'es/pisos/index.html',
    'en/concrete/index.html', 'en/paint/index.html', 'en/flooring/index.html',
  ];
  for (const rel of calcPages) {
    const html = await read(rel);
    const count = (html.match(/https:\/\/bauval\.org\/22\/41921c46095eecbf42ea9a25f4d05c50/g) || []).length;
    assert.equal(count, 1, `Expected exactly 1 Adsterra banner in ${rel}, got ${count}`);
  }

  const excludedPages = [
    'es/index.html', 'en/index.html',
    'es/privacidad/index.html', 'en/privacy/index.html',
    'index.html', '404.html',
  ];
  for (const rel of excludedPages) {
    const html = await read(rel);
    assert.ok(!html.includes('41921c46095eecbf42ea9a25f4d05c50'), `Adsterra banner must not appear on ${rel}`);
  }
});

test('page weight budget: HTML < 40 KB, CSS < 25 KB, JS total < 60 KB', async () => {
  const size = async (rel) => (await fs.stat(path.join(OUT, rel))).size;
  assert.ok(await size('en/concrete/index.html') < 40 * 1024);
  assert.ok(await size('assets/css/styles.css') < 25 * 1024);
  let js = 0;
  async function walk(dir) {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) await walk(f); else js += (await fs.stat(f)).size;
    }
  }
  await walk(path.join(OUT, 'assets/js'));
  assert.ok(js < 60 * 1024, `JS total ${js}`);
});

test('no duplicate element IDs in any page (a11y / label integrity)', async () => {
  for (const p of [...PAGES.es, ...PAGES.en]) {
    const html = await read(`${p}index.html`);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(dupes, [], `${p} duplicate ids`);
  }
});
