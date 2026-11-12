/**
 * BuildCalc UI — page bootstrap (browser).
 * Handles: nav toggle, unit system switching, live validation + calculation.
 */
import { UNIT_SYSTEMS, convertRole, getSystem } from '../core/units.js';
import { validateFields } from '../core/validate.js';
import { formatNumber, interpolate } from '../core/format.js';
import { makeContext, initialSystem, storeSystem, resultsToText, escapeHtml } from './common.js';
import * as concrete from './calc-concrete.js';
import * as paint from './calc-paint.js';
import * as flooring from './calc-flooring.js';

const CALCS = { concrete, paint, flooring };

/* ---------- navigation (all pages) ---------- */
function initNav() {
  const btn = document.querySelector('[data-nav-toggle]');
  const nav = document.getElementById('site-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });
}

/* ---------- calculator ---------- */
function initCalculator(form) {
  const calc = CALCS[form.dataset.calc];
  if (!calc) return;
  const i18nEl = document.getElementById('bc-i18n');
  const i18n = i18nEl ? JSON.parse(i18nEl.textContent) : null;
  if (!i18n) return;

  const results = document.getElementById('results');
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
      } else if (input.value === '' && defAttr !== undefined && !convertValues) {
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
    // unchecked checkboxes are absent from FormData
    form.querySelectorAll('input[type="checkbox"]').forEach((cb) => { if (!(cb.name in raw)) raw[cb.name] = false; });
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
      case 'min': return err.min === 0 ? interpolate(e.min, { min: 0 }) : interpolate(e.minInclusive, { min: formatNumber(err.min, ctx.locale, 2) });
      case 'max': return interpolate(e.max, { max: formatNumber(err.max, ctx.locale, 0) });
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
      const show = err && (!touchedOnly || isTouched || input.value !== '');
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
    if (firstErr) firstErr.focus();
    else results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  form.addEventListener('reset', () => {
    setTimeout(() => {
      form.querySelectorAll('[data-field]').forEach((w) => { delete w.dataset.touched; });
      applySystem(systemId, { convertValues: false });
      recalc();
      form.querySelector('input:not([type=radio]):not([type=checkbox]):not([disabled])')?.focus();
    }, 0);
  });

  const copyBtn = results.querySelector('[data-copy]');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      if (!lastResultOk) return;
      const text = resultsToText(resultsBody);
      try {
        await navigator.clipboard.writeText(text);
        const original = copyBtn.textContent;
        copyBtn.textContent = i18n.common.copied;
        setTimeout(() => { copyBtn.textContent = original; }, 1500);
      } catch { /* clipboard blocked */ }
    });
  }
  const printBtn = results.querySelector('[data-print]');
  if (printBtn) printBtn.addEventListener('click', () => window.print());

  /* -- boot -- */
  applySystem(systemId, { convertValues: false });
  recalc();
  form.dataset.ready = '1';
}

initNav();
document.querySelectorAll('form[data-calc]').forEach(initCalculator);
