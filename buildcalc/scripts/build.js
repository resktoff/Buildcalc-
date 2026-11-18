#!/usr/bin/env node
/**
 * BuildCalc static site generator.
 * Reads site.config.json + src/i18n/*.json, renders every page for every
 * language into ./docs (compatible with Render Static Sites & GitHub Pages).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { document, escXml, absUrl } from '../src/templates/layout.js';
import {
  homePage, calcPage, privacyPage, notFoundPage, rootRedirect,
  clientI18n, calcJsonLd, homeJsonLd, privacyJsonLd, calcPath,
} from '../src/templates/pages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs');
const SRC = path.join(ROOT, 'src');

const CALC_IDS = ['concrete', 'paint', 'flooring'];

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

async function writeOut(rel, content) {
  const file = path.join(OUT, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
  return rel;
}

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

export async function build({ quiet = false } = {}) {
  const config = await readJson(path.join(ROOT, 'site.config.json'));
  const dicts = {};
  for (const lang of config.languages) dicts[lang] = await readJson(path.join(SRC, 'i18n', `${lang}.json`));

  // Clean output (only our generated folder).
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  const written = [];
  const sitemapEntries = []; // { path, alternates, priority }

  // --- route table: pageId → { [lang]: path } ---
  const routes = { home: {}, privacy: {} };
  for (const id of CALC_IDS) routes[id] = {};
  for (const [lang, t] of Object.entries(dicts)) {
    routes.home[lang] = `${lang}/`;
    routes.privacy[lang] = `${lang}/${t.privacy.slug}/`;
    for (const id of CALC_IDS) routes[id][lang] = calcPath(lang, t, id);
  }

  for (const [lang, t] of Object.entries(dicts)) {
    const otherOgLocale = dicts[t.meta.otherLang]?.meta?.ogLocale || null;

    // Home
    {
      const p = routes.home[lang];
      const html = document({
        t, config, path: p, alternates: routes.home, otherOgLocale,
        title: t.home.metaTitle, description: t.home.metaDescription,
        body: homePage({ t, config }), navCurrent: 'home',
        jsonLd: homeJsonLd({ t, config }),
      });
      written.push(await writeOut(`${p}index.html`, html));
      sitemapEntries.push({ path: p, alternates: routes.home, priority: '1.0' });
    }
    // Calculators
    for (const id of CALC_IDS) {
      const p = routes[id][lang];
      const html = document({
        t, config, path: p, alternates: routes[id], otherOgLocale, calcId: id,
        title: t[id].metaTitle, description: t[id].metaDescription,
        body: calcPage({ t, config, id }), navCurrent: id,
        jsonLd: calcJsonLd({ t, config, id, path: p }),
        i18nClient: clientI18n(t, id),
      });
      written.push(await writeOut(`${p}index.html`, html));
      sitemapEntries.push({ path: p, alternates: routes[id], priority: '0.9' });
    }
    // Privacy
    {
      const p = routes.privacy[lang];
      const html = document({
        t, config, path: p, alternates: routes.privacy, otherOgLocale,
        title: t.privacy.metaTitle, description: t.privacy.metaDescription,
        body: privacyPage({ t }), navCurrent: 'privacy',
        jsonLd: privacyJsonLd({ t, config, path: p }),
      });
      written.push(await writeOut(`${p}index.html`, html));
      sitemapEntries.push({ path: p, alternates: routes.privacy, priority: '0.3' });
    }
  }

  // Root redirect + 404 (404 uses base-path-absolute URLs so it works from any depth, noindex)
  written.push(await writeOut('index.html', rootRedirect({ dicts, config })));
  {
    const t = dicts[config.defaultLang];
    const html = document({
      t, config, path: '404.html', alternates: routes.home,
      title: t.notFound.metaTitle, description: t.notFound.text,
      body: notFoundPage({ t, dicts, config }), noindex: true, absoluteRoot: true,
    });
    written.push(await writeOut('404.html', html));
  }

  // Assets
  await copyDir(path.join(SRC, 'core'), path.join(OUT, 'assets/js/core'));
  await copyDir(path.join(SRC, 'ui'), path.join(OUT, 'assets/js/ui'));
  await fs.mkdir(path.join(OUT, 'assets/css'), { recursive: true });
  await fs.copyFile(path.join(SRC, 'assets/styles.css'), path.join(OUT, 'assets/css/styles.css'));
  for (const f of await fs.readdir(path.join(SRC, 'assets'))) {
    if (f === 'styles.css') continue;
    await fs.copyFile(path.join(SRC, 'assets', f), path.join(OUT, 'assets', f));
  }

  // Optional root-level files (CNAME, ads.txt, google*.html …) from src/public/
  const pub = path.join(SRC, 'public');
  if (await fs.stat(pub).catch(() => null)) {
    for (const f of (await fs.readdir(pub)).filter((n) => !n.startsWith('.'))) {
      await fs.copyFile(path.join(pub, f), path.join(OUT, f));
      written.push(f);
    }
  }

  // robots.txt, sitemap.xml (pure UTF-8 XML), .nojekyll
  const abs = (p) => absUrl(config, p);
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapEntries.map((e) => `  <url>
    <loc>${escXml(abs(e.path))}</loc>
    <lastmod>${escXml(today)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${escXml(e.priority)}</priority>
${Object.entries(e.alternates).map(([l, p]) => `    <xhtml:link rel="alternate" hreflang="${escXml(l)}" href="${escXml(abs(p))}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${escXml(abs(e.alternates[config.defaultLang]))}"/>
  </url>`).join('\n')}
</urlset>
`;
  written.push(await writeOut('sitemap.xml', sitemap));
  written.push(await writeOut('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`));
  written.push(await writeOut('.nojekyll', ''));

  if (!quiet) {
    console.log(`Built ${written.length} files into ${path.relative(ROOT, OUT)}/`);
    for (const w of written) console.log('  ' + w);
  }
  return { written, routes, config, dicts };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  build().catch((err) => { console.error(err); process.exit(1); });
}
