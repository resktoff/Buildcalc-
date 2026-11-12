/**
 * BuildCalc UI — shared helpers for calculator pages (browser only).
 */
import { getSystem, convertLength, convertArea, convertVolume, coverageFromM2PerL } from '../core/units.js';
import { formatNumber, smartDecimals, interpolate } from '../core/format.js';

export const STORAGE_KEY = 'bc.units';

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Build a formatting context bound to the active language + unit system. */
export function makeContext(i18n, systemId) {
  const sys = getSystem(systemId);
  const locale = i18n.locale || 'en';
  const u = i18n.units;
  const n = (v, d = 2) => formatNumber(v, locale, d);
  const ctx = {
    sys,
    locale,
    i18n,
    t: (path, params) => interpolate(lookup(i18n, path) ?? path, params),
    n,
    unitLabel: (unitId) => u[unitId] ?? unitId,
    length(vM, decimals) {
      const v = convertLength(vM, 'm', sys.length);
      return `${n(v, decimals ?? smartDecimals(v, 2))} ${u[sys.length]}`;
    },
    small(vM, decimals) {
      const v = convertLength(vM, 'm', sys.small);
      return `${n(v, decimals ?? smartDecimals(v, 1))} ${u[sys.small]}`;
    },
    area(vM2, decimals) {
      const v = convertArea(vM2, 'm2', sys.area);
      return `${n(v, decimals ?? smartDecimals(v, 2))} ${u[sys.area]}`;
    },
    volume(vM3) {
      const main = convertVolume(vM3, 'm3', sys.volume);
      const txt = `${n(main, smartDecimals(main, 3))} ${u[sys.volume]}`;
      if (sys.id === 'imperial') {
        const alt = convertVolume(vM3, 'm3', sys.volumeAlt);
        return `${txt} (${n(alt, smartDecimals(alt, 2))} ${u[sys.volumeAlt]})`;
      }
      return txt;
    },
    liquid(vL) {
      const v = convertVolume(vL, 'L', sys.liquid);
      return `${n(v, smartDecimals(v, 2))} ${u[sys.liquid]}`;
    },
    coverage(vM2PerL) {
      const v = coverageFromM2PerL(vM2PerL, sys.coverageArea, sys.coverageVolume);
      return `${n(v, smartDecimals(v, 1))} ${sys.id === 'metric' ? u.m2PerL : u.ft2PerGal}`;
    },
    percent: (v) => `${n(v, 2)}`,
    int: (v) => n(v, 0),
  };
  return ctx;
}

function lookup(obj, path) {
  return path.split('.').reduce((o, k) => (o && k in o ? o[k] : undefined), obj);
}

/**
 * Format a calculator step into a localized sentence, converting SI params
 * into the active unit system by key suffix convention:
 *   *M → length, *M2 → area, *M3 → volume, *PerL → coverage,
 *   litres* / canLitres → liquid, *Percent → %, everything else raw.
 */
export function formatStep(ctx, stepsI18n, step) {
  const tpl = stepsI18n[step.id];
  if (!tpl) return '';
  const params = {};
  for (const [k, v] of Object.entries(step)) {
    if (k === 'id') continue;
    if (typeof v !== 'number') { params[k] = v; continue; }
    if (k.endsWith('M3')) params[k] = ctx.volume(v);
    else if (k.endsWith('M2')) params[k] = ctx.area(v);
    else if (k.endsWith('M')) params[k] = ctx.length(v);
    else if (k.endsWith('PerL')) params[k] = ctx.coverage(v);
    else if (k.startsWith('litres') || k === 'canLitres') params[k] = ctx.liquid(v);
    else if (k.endsWith('Percent')) params[k] = ctx.percent(v);
    else params[k] = ctx.int(v);
  }
  return interpolate(tpl, params);
}

/** Render a results block: primary figure + list of secondary rows + steps. */
export function renderResults({ primaryLabel, primaryValue, rows = [], warning = null, steps = [], howLabel, disclaimer }) {
  const rowsHtml = rows
    .filter((r) => r && r.value !== null && r.value !== undefined)
    .map((r) => `<div class="result-row"><dt>${escapeHtml(r.label)}</dt><dd>${escapeHtml(r.value)}${r.help ? `<small>${escapeHtml(r.help)}</small>` : ''}</dd></div>`)
    .join('');
  const stepsHtml = steps.filter(Boolean).map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  return `
    <div class="result-primary">
      <span class="result-label">${escapeHtml(primaryLabel)}</span>
      <strong class="result-value" data-testid="primary-result">${escapeHtml(primaryValue)}</strong>
    </div>
    ${warning ? `<p class="result-warning" role="status">${escapeHtml(warning)}</p>` : ''}
    <dl class="result-rows">${rowsHtml}</dl>
    <details class="result-steps" open>
      <summary>${escapeHtml(howLabel)}</summary>
      <ol>${stepsHtml}</ol>
    </details>
    <p class="result-disclaimer">${escapeHtml(disclaimer)}</p>`;
}

/** Plain-text version of results for the copy button. */
export function resultsToText(container) {
  const parts = [];
  const primary = container.querySelector('.result-primary');
  if (primary) parts.push(`${primary.querySelector('.result-label').textContent}: ${primary.querySelector('.result-value').textContent}`);
  container.querySelectorAll('.result-row').forEach((row) => {
    parts.push(`${row.querySelector('dt').textContent}: ${row.querySelector('dd').firstChild?.textContent ?? ''}`);
  });
  const steps = [...container.querySelectorAll('.result-steps li')].map((li, i) => `${i + 1}. ${li.textContent}`);
  if (steps.length) parts.push('', ...steps);
  return parts.join('\n');
}

/** Read the stored/preferred unit system. */
export function initialSystem(lang) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'metric' || stored === 'imperial') return stored;
  } catch { /* storage unavailable */ }
  // Spanish pages default to metric; English pages follow the browser locale
  // (US / Liberia / Myanmar → imperial). The choice is persisted once toggled.
  if (lang !== 'en') return 'metric';
  const nav = (typeof navigator !== 'undefined' && navigator.language) || '';
  if (/-(US|LR|MM)$/i.test(nav) || /^en$/i.test(nav)) return 'imperial';
  return 'metric';
}

export function storeSystem(id) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}
