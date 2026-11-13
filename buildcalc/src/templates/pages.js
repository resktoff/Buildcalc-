/**
 * BuildCalc — page bodies (build time).
 */
import { esc, ICONS, rootPrefix, adSlot, affiliateBox } from './layout.js';
import { FORMS } from './forms.js';

const CALC_IDS = ['concrete', 'paint', 'flooring'];

export function calcPath(lang, t, id) {
  return `${lang}/${t[id].slug}/`;
}

/* ---------- home ---------- */
export function homePage({ t, config }) {
  const lang = t.meta.lang;
  const root = rootPrefix(`${lang}/`);
  const h = t.home;
  const cards = CALC_IDS.map((id) => `
        <a class="card calc-card" href="${root}${calcPath(lang, t, id)}">
          <span class="icon">${ICONS[id]}</span>
          <h3>${esc(h.cards[id].title)}</h3>
          <p>${esc(h.cards[id].text)}</p>
          <span class="cta">${esc(h.cards[id].cta)} →</span>
        </a>`).join('');
  const why = h.why.map((w) => `<div class="feature"><h3>${esc(w.title)}</h3><p>${esc(w.text)}</p></div>`).join('');
  return `
      <section class="hero">
        <h1>${esc(h.h1)}</h1>
        <p class="lead">${esc(h.lead)}</p>
      </section>
      <section aria-labelledby="calcs-title">
        <h2 id="calcs-title">${esc(h.cta)}</h2>
        <div class="card-grid">${cards}
        </div>
      </section>
      <section class="section" aria-labelledby="why-title">
        <h2 id="why-title">${esc(h.whyTitle)}</h2>
        <div class="feature-grid">${why}</div>
      </section>
      <section class="section prose" aria-labelledby="about-title">
        <h2 id="about-title">${esc(h.aboutTitle)}</h2>
        <p>${esc(h.aboutText)}</p>
      </section>
      ${adSlot(config, t, 'home-footer')}`;
}

/* ---------- calculator page ---------- */
export function calcPage({ t, config, id }) {
  const lang = t.meta.lang;
  const c = t[id];
  const path = calcPath(lang, t, id);
  const root = rootPrefix(path);
  const formula = ['p1', 'p2', 'p3', 'p4'].map((k) => `<p>${esc(c.formula[k])}</p>`).join('\n          ');
  const faq = c.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n          ');
  const related = CALC_IDS.filter((x) => x !== id)
    .map((x) => `<li><a href="${root}${calcPath(lang, t, x)}">${esc(t[x].h1)}</a></li>`).join('');
  return `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol><li><a href="${root}${lang}/">${esc(t.nav.home)}</a></li><li aria-current="page">${esc(c.h1)}</li></ol>
      </nav>
      <header class="page-head">
        <h1 id="calc-title">${esc(c.h1)}</h1>
        <p class="lead">${esc(c.intro)}</p>
      </header>
      <div class="calc-layout">
        <div>
    ${FORMS[id](t)}
        </div>
        <section class="results card" id="results" data-state="empty" aria-labelledby="results-title" aria-live="polite">
          <h2 id="results-title">${esc(t.common.results)}</h2>
          <div data-results-body><p class="results-placeholder">${esc(t.common.resultsEmpty)}</p></div>
          <div class="results-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-copy>${esc(t.common.copy)}</button>
            <button type="button" class="btn btn-ghost btn-sm" data-print>${esc(t.common.print)}</button>
          </div>
        </section>
      </div>
      <a class="result-bar" href="#results" data-result-bar hidden aria-label="${esc(t.common.results)}">
        <span class="result-bar-label">${esc(c.results.total)}</span>
        <strong class="result-bar-value" data-result-bar-value></strong>
        <span class="result-bar-cta" aria-hidden="true">↓</span>
      </a>
      ${adSlot(config, t, 'calc-below-results')}
      <section class="section prose" aria-labelledby="formula-title">
        <h2 id="formula-title">${esc(c.formula.title)}</h2>
          ${formula}
      </section>
      ${affiliateBox(config, t, id)}
      <section class="section faq" aria-labelledby="faq-title">
        <h2 id="faq-title">${esc(t.common.faq)}</h2>
          ${faq}
      </section>
      <section class="section related" aria-labelledby="related-title">
        <h2 id="related-title">${esc(t.common.related)}</h2>
        <ul>${related}</ul>
      </section>`;
}

/** Subset of the dictionary shipped to the browser for one calculator. */
export function clientI18n(t, id) {
  return {
    lang: t.meta.lang,
    locale: t.meta.locale,
    units: t.units,
    common: t.common,
    calc: { fields: t[id].fields, results: t[id].results, steps: t[id].steps },
  };
}

export function calcJsonLd({ t, config, id, path, alternates }) {
  const abs = (p) => `${config.siteUrl.replace(/\/+$/, '')}${config.basePath ? `/${config.basePath.replace(/^\/+|\/+$/g, '')}` : ''}/${String(p).replace(/^\/+/, '')}`;
  const c = t[id];
  const lang = t.meta.lang;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: c.h1,
      url: abs(path),
      description: c.metaDescription,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript',
      inLanguage: lang,
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@type': 'Organization', name: t.site.name, url: abs(`${lang}/`) },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: c.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.nav.home, item: abs(`${lang}/`) },
        { '@type': 'ListItem', position: 2, name: c.h1, item: abs(path) },
      ],
    },
  ];
}

export function homeJsonLd({ t, config }) {
  const abs = (p) => `${config.siteUrl.replace(/\/+$/, '')}${config.basePath ? `/${config.basePath.replace(/^\/+|\/+$/g, '')}` : ''}/${String(p).replace(/^\/+/, '')}`;
  const lang = t.meta.lang;
  return [{
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: t.site.name,
    url: abs(`${lang}/`),
    description: t.site.description,
    inLanguage: lang,
    publisher: { '@type': 'Organization', name: t.site.name, url: abs('') },
  }];
}

/* ---------- privacy ---------- */
export function privacyPage({ t }) {
  const p = t.privacy;
  const date = new Date().toISOString().slice(0, 10);
  return `
      <header class="page-head">
        <h1>${esc(p.h1)}</h1>
        <p class="lead">${esc(p.updated.replace('{date}', date))}</p>
      </header>
      <div class="prose">
        ${p.sections.map((s) => `<section><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p></section>`).join('\n        ')}
      </div>`;
}

/* ---------- 404 ---------- */
export function notFoundPage({ t, config }) {
  const lang = t.meta.lang;
  // 404 is served from the site root → use base-path-absolute links so it works from any depth
  const base = config.basePath ? `/${config.basePath.replace(/^\/+|\/+$/g, '')}/` : '/';
  return `
      <div class="center-page">
        <h1>${esc(t.notFound.h1)}</h1>
        <p class="lead">${esc(t.notFound.text)}</p>
        <div class="lang-choice">
          <a class="btn btn-primary" href="${base}${lang}/">${esc(t.notFound.cta)}</a>
        </div>
      </div>`;
}

/* ---------- root language redirect ---------- */
export function rootRedirect({ dicts, config }) {
  const langs = Object.keys(dicts);
  const def = config.defaultLang;
  const abs = (p) => `${config.siteUrl.replace(/\/+$/, '')}${config.basePath ? `/${config.basePath.replace(/^\/+|\/+$/g, '')}` : ''}/${String(p).replace(/^\/+/, '')}`;
  const links = langs.map((l) => `<a class="btn ${l === def ? 'btn-primary' : 'btn-ghost'}" href="${l}/" hreflang="${l}" lang="${l}">${esc(dicts[l].meta.langName)}</a>`).join('\n          ');
  return `<!DOCTYPE html>
<html lang="${def}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>BuildCalc — ${esc(dicts[def].site.tagline)}</title>
    <meta name="description" content="${esc(dicts[def].site.description)}">
    <meta name="robots" content="noindex, follow">
    <link rel="canonical" href="${abs(`${def}/`)}">
    ${langs.map((l) => `<link rel="alternate" hreflang="${l}" href="${abs(`${l}/`)}">`).join('\n    ')}
    <link rel="alternate" hreflang="x-default" href="${abs('')}">
    <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="assets/css/styles.css">
    <script>
      (function () {
        var supported = ${JSON.stringify(langs)};
        var stored = null;
        try { stored = localStorage.getItem('bc.lang'); } catch (e) {}
        var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
        var target = stored && supported.indexOf(stored) !== -1 ? stored : null;
        if (!target) {
          for (var i = 0; i < langs.length && !target; i++) {
            var code = String(langs[i]).toLowerCase().split('-')[0];
            if (supported.indexOf(code) !== -1) target = code;
          }
        }
        location.replace((target || '${def}') + '/');
      })();
    </script>
    <noscript><meta http-equiv="refresh" content="0; url=${def}/"></noscript>
</head>
<body>
    <main class="container center-page">
      <h1>BuildCalc</h1>
      <p class="lead">${esc(dicts[def].site.tagline)} · ${esc(dicts[langs.find((l) => l !== def)].site.tagline)}</p>
      <div class="lang-choice">
          ${links}
      </div>
    </main>
</body>
</html>
`;
}
