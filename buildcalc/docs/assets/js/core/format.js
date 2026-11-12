/**
 * BuildCalc — number formatting & simple message interpolation.
 */

const cache = new Map();

export function formatNumber(value, locale = 'en', maxFractionDigits = 2, minFractionDigits = 0) {
  if (!Number.isFinite(value)) return '—';
  const key = `${locale}|${maxFractionDigits}|${minFractionDigits}`;
  let nf = cache.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(locale, {
      maximumFractionDigits: maxFractionDigits,
      minimumFractionDigits: minFractionDigits,
    });
    cache.set(key, nf);
  }
  // Avoid "-0"
  return nf.format(Object.is(value, -0) ? 0 : value);
}

/** Pick sensible decimals: more precision for small magnitudes. */
export function smartDecimals(value, base = 2) {
  const abs = Math.abs(value);
  if (abs === 0) return 0;
  if (abs < 0.01) return base + 3;
  if (abs < 1) return base + 1;
  if (abs >= 1000) return Math.max(0, base - 2);
  return base;
}

/** Replace {placeholders} in a template with values from params. */
export function interpolate(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}
