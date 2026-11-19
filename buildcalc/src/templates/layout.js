/**
 * BuildCalc — HTML document shell, header/footer and SEO head.
 * Pure functions returning strings; executed at build time (Node).
 */

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const escXml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

const GA_ID_RE = /^(G|GT|AW)-[A-Z0-9]{4,20}$/;
const ADSENSE_CLIENT_RE = /^ca-pub-\d{10,24}$/;
const ADSENSE_SLOT_RE = /^\d{6,20}$/;

export const ICONS = {
  logo: `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect x="3" y="3" width="26" height="26" rx="6" fill="#0a58ca"/><path d="M9 22V11h5.5a3 3 0 0 1 0 6H9m0 0h6.5a3 3 0 0 1 0 6H9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 12h5M19 16h5M19 20h5" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  concrete: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 9l9-5 9 5-9 5-9-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 9v6l9 5 9-5V9M12 14v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  paint: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="14" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M17 7h3v5l-8 2v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="10" y="16" width="4" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
  flooring: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 4h18v16H3zM3 12h18M9 4v8M15 12v8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
};

export function absUrl(config, p = '') {
  const base = `${config.siteUrl.replace(/\/+$/, '')}${config.basePath ? `/${config.basePath.replace(/^\/+|\/+$/g, '')}` : ''}`;
  return `${base}/${String(p).replace(/^\/+/, '')}`;
}

export function verificationTags(config) {
  return [
    config.seo?.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(config.seo.googleSiteVerification)}">` : '',
    config.seo?.bingSiteVerification ? `<meta name="msvalidate.01" content="${esc(config.seo.bingSiteVerification)}">` : '',
  ].filter(Boolean).join('\n    ');
}

function safeJsonScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * @param {object} o
 * @param {object} o.t              i18n dictionary for the page language
 * @param {object} o.config         site.config.json
 * @param {string} o.path           page path relative to site root, e.g. "es/hormigon/"
 * @param {object} o.alternates     { es: "es/hormigon/", en: "en/concrete/" }
 * @param {string} o.title
 * @param {string} o.description
 * @param {string} o.body           main HTML
 * @param {string} [o.navCurrent]   nav id for aria-current
 * @param {string} [o.calcId]       calculator id when rendering a calculator page
 * @param {string} [o.otherOgLocale] alternate Open Graph locale
 * @param {Array}  [o.jsonLd]       JSON-LD objects
 * @param {object} [o.i18nClient]   JSON injected for the client app
 * @param {boolean} [o.noindex]
 * @param {boolean} [o.absoluteRoot] use base-path-absolute asset/nav URLs (for 404.html)
 * @param {string} [o.xDefault]
 */
export function document({
  t, config, path, alternates, title, description, body,
  navCurrent, calcId = null, otherOgLocale = null,
  jsonLd = [], i18nClient = null, noindex = false, absoluteRoot = false, xDefault = null,
}) {
  const lang = t.meta.lang;
  const base = config.basePath ? `/${config.basePath.replace(/^\/+|\/+$/g, '')}/` : '/';
  const root = absoluteRoot ? base : rootPrefix(path);
  const abs = (p) => absUrl(config, p);
  const canonical = abs(path);
  const otherLang = t.meta.otherLang;
  const ogImageAlt = `${t.site.name} — ${t.site.tagline}`;

  const indexHead = noindex
    ? '<meta name="robots" content="noindex, follow">'
    : [
      '<meta name="robots" content="index, follow, max-image-preview:large">',
      `<link rel="canonical" href="${esc(canonical)}">`,
      ...Object.entries(alternates).map(([l, p]) => `<link rel="alternate" hreflang="${esc(l)}" href="${esc(abs(p))}">`),
      `<link rel="alternate" hreflang="x-default" href="${esc(abs(xDefault ?? alternates[config.defaultLang] ?? path))}">`,
    ].join('\n    ');

  const socialHead = noindex
    ? ''
    : [
      '<meta property="og:type" content="website">',
      `<meta property="og:site_name" content="${esc(t.site.name)}">`,
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(description)}">`,
      `<meta property="og:url" content="${esc(canonical)}">`,
      `<meta property="og:locale" content="${esc(t.meta.ogLocale)}">`,
      otherOgLocale ? `<meta property="og:locale:alternate" content="${esc(otherOgLocale)}">` : '',
      `<meta property="og:image" content="${esc(abs('assets/og-image.png'))}">`,
      '<meta property="og:image:type" content="image/png">',
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      `<meta property="og:image:alt" content="${esc(ogImageAlt)}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${esc(title)}">`,
      `<meta name="twitter:description" content="${esc(description)}">`,
      `<meta name="twitter:image" content="${esc(abs('assets/og-image.png'))}">`,
      `<meta name="twitter:image:alt" content="${esc(ogImageAlt)}">`,
    ].filter(Boolean).join('\n    ');

  const gaId = String(config.analytics?.gaMeasurementId || '').trim();
  const ga = GA_ID_RE.test(gaId)
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(gaId)}"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(gaId)}',{anonymize_ip:true});</script>`
    : '<!-- analytics: disabled (set analytics.gaMeasurementId in site.config.json when ready) -->';

  const adsClient = String(config.ads?.clientId || '').trim();
  const adsHead = !noindex && config.ads?.enabled && config.ads.provider === 'adsense' && ADSENSE_CLIENT_RE.test(adsClient)
    ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(adsClient)}" crossorigin="anonymous"></script>`
    : '';

  const verification = noindex ? '' : verificationTags(config);
  const ld = jsonLd.length ? `<script type="application/ld+json">${safeJsonScript(jsonLd.length === 1 ? jsonLd[0] : jsonLd)}</script>` : '';
  const clientI18n = i18nClient ? `<script type="application/json" id="bc-i18n">${safeJsonScript(i18nClient)}</script>` : '';

  const scripts = calcId
    ? [
      `<link rel="modulepreload" href="${root}assets/js/ui/nav.js">`,
      `<link rel="modulepreload" href="${root}assets/js/ui/common.js">`,
      `<link rel="modulepreload" href="${root}assets/js/ui/calc-${esc(calcId)}.js">`,
      `<link rel="modulepreload" href="${root}assets/js/core/units.js">`,
      `<link rel="modulepreload" href="${root}assets/js/core/validate.js">`,
      `<link rel="modulepreload" href="${root}assets/js/core/format.js">`,
      `<link rel="modulepreload" href="${root}assets/js/core/calculators/${esc(calcId)}.js">`,
      `<script type="module" src="${root}assets/js/ui/app.js"></script>`,
    ].join('\n    ')
    : `<script type="module" src="${root}assets/js/ui/nav.js"></script>`;

  const headLines = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    indexHead,
    '<meta name="theme-color" content="#0a58ca" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#0f1419" media="(prefers-color-scheme: dark)">',
    socialHead,
    verification,
    `<link rel="icon" href="${root}assets/favicon.png" type="image/png">`,
    `<link rel="apple-touch-icon" href="${root}assets/apple-touch-icon.png">`,
    `<link rel="manifest" href="${root}assets/site.webmanifest">`,
    `<link rel="stylesheet" href="${root}assets/css/styles.css">`,
    scripts,
    ga,
    adsHead,
    ld,
  ].filter(Boolean).join('\n    ');

  const navItems = [
    ['home', `${lang}/`, t.nav.home],
    ['concrete', `${lang}/${t.concrete.slug}/`, t.nav.concrete],
    ['paint', `${lang}/${t.paint.slug}/`, t.nav.paint],
    ['flooring', `${lang}/${t.flooring.slug}/`, t.nav.flooring],
  ];

  return `<!DOCTYPE html>
<html lang="${esc(lang)}" dir="ltr">
<head>
    ${headLines}
</head>
<body>
    <a class="skip-link" href="#main">${esc(t.nav.skip)}</a>
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="${root}${lang}/" aria-label="${esc(t.site.name)} — ${esc(t.nav.home)}"><picture class="brand-picture"><source srcset="${root}assets/logo-dark.png" media="(prefers-color-scheme: dark)"><img src="${root}assets/logo-light.png" alt="${esc(t.site.name)}" class="brand-logo" height="36"></picture></a>
        <button class="nav-toggle" type="button" data-nav-toggle aria-controls="site-nav" aria-expanded="false" aria-label="${esc(t.nav.menu)}">${ICONS.menu}</button>
        <nav id="site-nav" class="site-nav" aria-label="${esc(t.nav.calculators)}">
          <ul>
            ${navItems.map(([id, p, label]) => `<li><a href="${root}${p}"${navCurrent === id ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`).join('\n            ')}
            <li><a class="lang-switch" href="${root}${alternates[otherLang]}" hreflang="${esc(otherLang)}" lang="${esc(otherLang)}" rel="alternate" data-lang-switch aria-label="${esc(t.meta.switchLangAria)}">🌐 ${esc(t.meta.otherLangName)}</a></li>
          </ul>
        </nav>
      </div>
    </header>
    <main id="main" class="container" tabindex="-1">
${body}
    </main>
    <footer class="site-footer">
      <div class="container footer-inner">
        <div>
          <p><strong>${esc(t.site.name)}</strong> — ${esc(t.site.tagline)}</p>
          <p>${esc(t.site.footerText)}</p>
          <p>© ${new Date().getFullYear()} ${esc(t.site.name)}. ${esc(t.site.copyright)}</p>
        </div>
        <nav aria-label="${esc(t.nav.footer)}">
          <ul>
            ${navItems.map(([id, p, label]) => `<li><a href="${root}${p}"${navCurrent === id ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`).join('\n            ')}
            <li><a href="${root}${lang}/${t.privacy.slug}/"${navCurrent === 'privacy' ? ' aria-current="page"' : ''}>${esc(t.nav.privacy)}</a></li>
            <li><a href="${root}${alternates[otherLang]}" hreflang="${esc(otherLang)}" lang="${esc(otherLang)}" rel="alternate" data-lang-switch>${esc(t.meta.otherLangName)}</a></li>
          </ul>
        </nav>
      </div>
    </footer>
    ${clientI18n}
</body>
</html>
`;
}

export function rootPrefix(path) {
  const depth = path.split('/').filter(Boolean).length;
  return depth === 0 ? './' : '../'.repeat(depth);
}

/** Ad slot placeholder: rendered only when ads are enabled with real verified IDs in site.config.json. */
export function adSlot(config, t, slotName) {
  const clientId = String(config.ads?.clientId || '').trim();
  const slotId = String(config.ads?.slots?.[slotName] || '').trim();
  if (!config.ads?.enabled || config.ads.provider !== 'adsense' || !ADSENSE_CLIENT_RE.test(clientId) || !ADSENSE_SLOT_RE.test(slotId)) {
    return `<!-- ad-slot:${esc(slotName)} (disabled) -->`;
  }
  return `<aside class="ad-slot" aria-label="${esc(t.ads.label)}"><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(clientId)}" data-ad-slot="${esc(slotId)}" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></aside>`;
}

/** Affiliate box: rendered only when enabled and valid HTTPS links exist for this calculator. */
export function affiliateBox(config, t, calcId) {
  if (!config.affiliates?.enabled) return '';
  const links = (config.affiliates.links || [])
    .filter((l) => l && l.label && /^https:\/\//i.test(String(l.url || '')) && (!l.calc || l.calc === calcId));
  if (!links.length) return '';
  return `<aside class="card affiliate-box section" aria-labelledby="aff-title">
      <h2 id="aff-title">${esc(t.affiliates.title)}</h2>
      <ul>${links.map((l) => `<li><a href="${esc(l.url)}" rel="sponsored nofollow noopener noreferrer" target="_blank">${esc(l.label)}</a></li>`).join('')}</ul>
      <small>${esc(t.affiliates.disclosure)}</small>
    </aside>`;
}
