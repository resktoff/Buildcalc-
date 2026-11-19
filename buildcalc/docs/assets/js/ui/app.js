/**
 * BuildCalc UI — calculator bootstrap (browser).
 * Handles: nav toggle, unit system switching, live validation + calculation.
 */
import { UNIT_SYSTEMS, convertRole, getSystem } from '../core/units.js';
import { validateFields } from '../core/validate.js';
import { formatNumber, interpolate } from '../core/format.js';
import { makeContext, initialSystem, storeSystem, resultsToText, escapeHtml } from './common.js';
import { loadHistory, saveHistoryEntry, removeHistoryEntry, clearHistory, restoreFormEntry } from './history.js';
import { initNav } from './nav.js';

const CALC_LOADERS = Object.freeze({
  concrete: () => import('./calc-concrete.js'),
  paint: () => import('./calc-paint.js'),
  flooring: () => import('./calc-flooring.js'),
});

async function copyText(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

/* ---------- calculator ---------- */
async function initCalculator(form) {
  const load = CALC_LOADERS[form.dataset.calc];
  if (!load) return;
  const i18nEl = document.getElementById('bc-i18n');
  let i18n = null;
  try { i18n = i18nEl ? JSON.parse(i18nEl.textContent) : null; } catch { return; }
  if (!i18n) return;

  const calc = await load();

  const results = document.getElementById('results');
  if (!results) return;
  const resultsBody = results.querySelector('[data-results-body]');
  const summary = form.querySelector('[data-error-summary]');
  const bar = document.querySelector('[data-result-bar]');
  const barValue = bar ? bar.querySelector('[data-result-bar-value]') : null;
  const unitRadios = [...form.querySelectorAll('input[name="units"]')];
  const roleInputs = [...form.querySelectorAll('input[data-role]')];
  const unitLabels = [...document.querySelectorAll('[data-unit-role]')];
  const selectEls = [...form.querySelectorAll('select[data-select]')];
  const conditionals = [...form.querySelectorAll('[data-show-when]')];

  let systemId = initialSystem(i18n.lang);
  if (!UNIT_SYSTEMS[systemId]) systemId = 'metric';
  let ctx = makeContext(i18n, systemId);
  let lastResultOk = false;

  /* -- unit system -- */
  function unitForRole(role, sys) {
    switch (role) {
      case 'length': return i18n.units[sys.length];
      case 'small': return i18n.units[sys.small];
      case 'area': return i18n.units[sys.area];
      case 'coverage': return sys.id === 'metric' ? i18n.units.m2PerL : i18n.units.ft2PerGal;
      default: return '';
    }
  }

  function applySystem(newId, { convertValues }) {
    const prevId = systemId;
    systemId = newId;
    const sys = getSystem(systemId);
    ctx = makeContext(i18n, systemId);
    unitRadios.forEach((r) => { r.checked = r.value === systemId; });
    form.dataset.units = systemId;
    unitLabels.forEach((el) => { el.textContent = unitForRole(el.dataset.unitRole, sys); });

    roleInputs.forEach((input) => {
      const role = input.dataset.role;
      const defAttr = systemId === 'metric' ? input.dataset.defaultMetric : input.dataset.defaultImperial;
      if (convertValues && prevId !== systemId && input.value !== '' && Number.isFinite(input.valueAsNumber) && role !== 'none') {
        const v = convertRole(input.valueAsNumber, role, prevId, systemId);
        input.value = String(roundSmart(v));
      } else if (input.value === '' && !input.validity?.badInput && defAttr !== undefined && !convertValues) {
        input.value = defAttr;
      }
      if (input.dataset.placeholderMetric !== undefined) {
        input.placeholder = systemId === 'metric' ? input.dataset.placeholderMetric : input.dataset.placeholderImperial || '';
      }
    });

    selectEls.forEach((sel) => {
      const def = calc.selects[sel.dataset.select];
      if (!def) return;
      const previous = sel.value;
      const keepNone = sel.querySelector('option[value="none"]');
      sel.innerHTML = '';
      if (keepNone) sel.appendChild(keepNone);
      def.options.filter((o) => o.system === systemId).forEach((o) => {
        const opt = document.createElement('option');
        opt.value = o.id;
        opt.textContent = o.label;
        sel.appendChild(opt);
      });
      const firstInit = sel.dataset.init !== '1';
      sel.dataset.init = '1';
      if (!firstInit && previous === 'none' && keepNone) sel.value = 'none';
      else sel.value = def.defaults[systemId];
    });

    if (typeof calc.dynamicHelp === 'function') {
      const help = calc.dynamicHelp(ctx);
      for (const [field, text] of Object.entries(help)) {
        const el = form.querySelector(`[data-help-for="${field}"]`);
        if (el) el.textContent = text;
      }
    }
  }

  function roundSmart(v) {
    const abs = Math.abs(v);
    const digits = abs >= 100 ? 1 : abs >= 10 ? 2 : abs >= 1 ? 3 : 4;
    return Number(v.toFixed(digits));
  }

  /* -- conditional groups -- */
  function readRaw() {
    const fd = new FormData(form);
    const raw = {};
    for (const [k, v] of fd.entries()) raw[k] = v;
    // Unchecked checkboxes are absent from FormData.
    form.querySelectorAll('input[type="checkbox"]').forEach((cb) => { if (!(cb.name in raw)) raw[cb.name] = false; });
    // Flag browser badInput (e.g. "abc", "--", "1e") on enabled number fields so validation reports "nan".
    form.querySelectorAll('input[type="number"]:not([disabled])').forEach((input) => {
      if (input.validity?.badInput) raw[input.name] = '__invalid__';
    });
    return raw;
  }

  function updateConditionals(raw) {
    conditionals.forEach((el) => {
      const [field, values] = el.dataset.showWhen.split('=');
      const allowed = values.split('|');
      const show = allowed.includes(String(raw[field] ?? ''));
      el.hidden = !show;
      el.querySelectorAll('input,select').forEach((i) => { i.disabled = !show; });
    });
  }

  /* -- validation UI -- */
  function errorMessage(err) {
    const e = i18n.common.errors;
    switch (err.code) {
      case 'min': {
        const minTxt = formatNumber(err.min, ctx.locale, 2);
        return err.exclusive ? interpolate(e.min, { min: minTxt }) : interpolate(e.minInclusive, { min: minTxt });
      }
      case 'max': {
        const safeMax = err.max >= 1 ? Math.floor(err.max) : err.max;
        return interpolate(e.max, { max: formatNumber(safeMax, ctx.locale, err.max >= 1 ? 0 : 2) });
      }
      default: return e[err.code] || e.nan;
    }
  }

  function showErrors(errors, touchedOnly) {
    let count = 0;
    form.querySelectorAll('[data-field]').forEach((wrap) => {
      const name = wrap.dataset.field;
      const input = wrap.querySelector('input,select');
      const errEl = wrap.querySelector('.field-error');
      const err = errors[name];
      const isTouched = wrap.dataset.touched === '1';
      const hasContent = input.value !== '' || Boolean(input.validity?.badInput);
      const show = err && (!touchedOnly || isTouched || hasContent);
      if (show) {
        count += 1;
        wrap.classList.add('has-error');
        input.setAttribute('aria-invalid', 'true');
        if (errEl) { errEl.textContent = errorMessage(err); errEl.hidden = false; }
      } else {
        wrap.classList.remove('has-error');
        input.removeAttribute('aria-invalid');
        if (errEl) { errEl.textContent = ''; errEl.hidden = true; }
      }
    });
    if (summary) {
      summary.hidden = count === 0;
      summary.textContent = count ? interpolate(i18n.common.summaryError, { count }) : '';
    }
    return count;
  }

  /* -- main loop -- */
  function recalc({ touchedOnly = true } = {}) {
    const raw = readRaw();
    updateConditionals(raw);
    // Re-read after enabling/disabling conditional inputs so disabled fields are excluded.
    const live = readRaw();
    const sys = getSystem(systemId);
    const { ok, values, errors } = validateFields(live, calc.schema(live, sys));
    showErrors(errors, touchedOnly);

    if (bar) bar.hidden = true;
    if (!ok) {
      lastResultOk = false;
      results.dataset.state = Object.values(errors).some((e) => e.code !== 'required') ? 'invalid' : 'empty';
      resultsBody.innerHTML = `<p class="results-placeholder">${escapeHtml(results.dataset.state === 'invalid' ? i18n.common.resultsInvalid : i18n.common.resultsEmpty)}</p>`;
      return;
    }
    try {
      const result = calc.compute(values, live, sys);
      resultsBody.innerHTML = calc.render(result, ctx, live);
      results.dataset.state = 'ok';
      lastResultOk = true;
      if (bar && barValue) {
        barValue.textContent = resultsBody.querySelector('[data-testid=primary-result]')?.textContent ?? '';
        bar.hidden = false;
      }
    } catch (err) {
      // Defensive: core threw despite validation → show invalid state, never a wrong number.
      console.error('[BuildCalc] calculation error', err);
      results.dataset.state = 'invalid';
      resultsBody.innerHTML = `<p class="results-placeholder">${escapeHtml(i18n.common.resultsInvalid)}</p>`;
      lastResultOk = false;
    }
  }

  /* -- events -- */
  form.addEventListener('input', (e) => {
    const wrap = e.target.closest('[data-field]');
    if (wrap) wrap.dataset.touched = '1';
    if (e.target.name === 'units') return;
    recalc();
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'units') {
      applySystem(e.target.value, { convertValues: true });
      storeSystem(systemId);
      recalc();
      return;
    }
    const wrap = e.target.closest('[data-field]');
    if (wrap) wrap.dataset.touched = '1';
    recalc();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.querySelectorAll('[data-field]').forEach((w) => { w.dataset.touched = '1'; });
    recalc({ touchedOnly: false });
    const firstErr = form.querySelector('.has-error input, .has-error select');
    if (firstErr) {
      firstErr.focus();
    } else {
      if (lastResultOk) {
        saveHistoryEntry(form.dataset.calc, { system: systemId, inputs: readRaw() });
        renderHistory();
      }
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  form.addEventListener('reset', () => {
    setTimeout(() => {
      form.querySelectorAll('[data-field]').forEach((w) => { delete w.dataset.touched; });
      selectEls.forEach((sel) => { delete sel.dataset.init; });
      applySystem(systemId, { convertValues: false });
      recalc();
      form.querySelector('input:not([type=radio]):not([type=checkbox]):not([disabled])')?.focus();
    }, 0);
  });

  const copyBtn = results.querySelector('[data-copy]');
  const copyStatus = results.querySelector('[data-copy-status]');
  if (copyBtn) {
    const copyOriginal = copyBtn.textContent;
    let copyTimer = null;
    copyBtn.addEventListener('click', async () => {
      if (!lastResultOk) return;
      const text = resultsToText(resultsBody);
      try {
        const copied = await copyText(text);
        if (!copied) return;
        copyBtn.textContent = i18n.common.copied;
        if (copyStatus) copyStatus.textContent = i18n.common.copied;
        if (copyTimer) clearTimeout(copyTimer);
        copyTimer = setTimeout(() => {
          copyBtn.textContent = copyOriginal;
          if (copyStatus) copyStatus.textContent = '';
          copyTimer = null;
        }, 1500);
      } catch { /* clipboard blocked */ }
    });
  }
  const printBtn = results.querySelector('[data-print]');
  if (printBtn) printBtn.addEventListener('click', () => window.print());

  /* -- history -- */
  const calcId = form.dataset.calc;
  const historyEl = document.querySelector('[data-history]');
  const historyListEl = historyEl?.querySelector('[data-history-list]');
  const historyClearBtn = historyEl?.querySelector('[data-history-clear]');
  const hI18n = i18n.common.history;

  function formatHistoryDate(ts) {
    try {
      return new Intl.DateTimeFormat(i18n.locale || 'en', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ts));
    } catch {
      return new Date(ts).toLocaleString();
    }
  }

  function formatEntryPreview(inputs) {
    return Object.entries(inputs)
      .filter(([k, v]) => k !== 'units' && v !== '' && v !== false && v !== 'none')
      .slice(0, 5)
      .map(([k, v]) => `${k}: ${v === true ? '✓' : v}`)
      .join(' · ');
  }

  function restoreEntry(entry) {
    restoreFormEntry(form, entry, { applySystem, storeSystem, updateConditionals, recalc });
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderHistory() {
    if (!historyListEl) return;
    const list = loadHistory(calcId);
    if (historyClearBtn) historyClearBtn.hidden = list.length === 0;
    if (list.length === 0) {
      historyListEl.innerHTML = `<p class="history-empty">${escapeHtml(hI18n.empty)}</p>`;
      return;
    }
    historyListEl.innerHTML = `<ul class="history-list">${list.map((entry) => `
      <li class="history-item" data-history-id="${escapeHtml(entry.id)}">
        <div class="history-meta">
          <span class="history-date">${escapeHtml(formatHistoryDate(entry.ts))}</span>
          <span class="history-sys">${escapeHtml(hI18n[entry.system] || entry.system)}</span>
        </div>
        <div class="history-preview">${escapeHtml(formatEntryPreview(entry.inputs))}</div>
        <div class="history-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-history-load="${escapeHtml(entry.id)}">${escapeHtml(hI18n.load)}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-history-remove="${escapeHtml(entry.id)}">${escapeHtml(hI18n.remove)}</button>
        </div>
      </li>`).join('')}</ul>`;
  }

  historyListEl?.addEventListener('click', (e) => {
    const loadBtn = e.target.closest('[data-history-load]');
    if (loadBtn) {
      const entry = loadHistory(calcId).find((item) => item.id === loadBtn.dataset.historyLoad);
      if (entry) restoreEntry(entry);
      return;
    }
    const delBtn = e.target.closest('[data-history-remove]');
    if (delBtn) {
      removeHistoryEntry(calcId, delBtn.dataset.historyRemove);
      renderHistory();
    }
  });
  historyClearBtn?.addEventListener('click', () => {
    clearHistory(calcId);
    renderHistory();
  });

  /* -- boot -- */
  applySystem(systemId, { convertValues: false });
  recalc();
  renderHistory();
  form.dataset.ready = '1';
}

initNav();
document.querySelectorAll('form[data-calc]').forEach((form) => {
  initCalculator(form).catch((err) => console.error('[BuildCalc] init error', err));
});
